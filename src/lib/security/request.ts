import { createHash, timingSafeEqual } from 'node:crypto';

const JSON_CONTENT_TYPE = /^(application\/json|[^;]+\+json)(?:;|$)/i;

export class HttpSecurityError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpSecurityError';
  }
}

export function constantTimeEqual(actual: string, expected: string) {
  const actualBuffer = createHash('sha256').update(actual).digest();
  const expectedBuffer = createHash('sha256').update(expected).digest();

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function verifyBearerSecret(request: Request, expectedSecret: string | undefined) {
  if (!expectedSecret || expectedSecret.length < 32) return false;

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;

  return constantTimeEqual(authorization.slice('Bearer '.length), expectedSecret);
}

export function getClientIp(headers: Headers) {
  const candidate = headers.get('cf-connecting-ip')
    || headers.get('x-real-ip')
    || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';

  return /^[0-9a-f:.]{1,64}$/i.test(candidate) ? candidate : 'unknown';
}

function addOrigin(origins: Set<string>, value: string | null | undefined) {
  if (!value) return;

  try {
    origins.add(new URL(value).origin);
  } catch {
    // Ignore malformed deployment configuration and fail closed below.
  }
}

export function isSameOriginRequest(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;

  const origin = request.headers.get('origin');
  if (!origin) return true;

  const allowedOrigins = new Set<string>();
  addOrigin(allowedOrigins, request.url);
  addOrigin(allowedOrigins, process.env.APP_PUBLIC_BASE_URL);

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host');
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();

  if (host && forwardedProtocol && /^(https?|http)$/.test(forwardedProtocol)) {
    addOrigin(allowedOrigins, `${forwardedProtocol}://${host}`);
  }

  try {
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export async function readJsonBody(request: Request, maxBytes = 128 * 1024): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    throw new HttpSecurityError('Content-Type 必须是 application/json', 415);
  }

  const contentEncoding = request.headers.get('content-encoding');
  if (contentEncoding && contentEncoding.toLowerCase() !== 'identity') {
    throw new HttpSecurityError('不支持压缩的请求体', 415);
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpSecurityError('请求内容过大', 413);
  }

  if (!request.body) {
    throw new HttpSecurityError('请求内容不能为空', 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new HttpSecurityError('请求内容过大', 413);
    }
    chunks.push(value);
  }

  if (totalBytes === 0) {
    throw new HttpSecurityError('请求内容不能为空', 400);
  }

  try {
    return JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8'));
  } catch {
    throw new HttpSecurityError('请求 JSON 格式无效', 400);
  }
}
