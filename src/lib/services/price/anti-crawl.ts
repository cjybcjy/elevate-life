const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(): number {
  return 1000 + Math.random() * 2000; // 1-3 seconds
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchResult {
  ok: boolean;
  text: string;
  status: number;
}

export interface AntiCrawlFetchOptions {
  skipInitialDelay?: boolean;
  attempts?: number;
  timeoutMs?: number;
}

export async function fetchWithAntiCrawl(
  url: string,
  referer?: string,
  options: AntiCrawlFetchOptions = {},
): Promise<FetchResult> {
  if (!options.skipInitialDelay) {
    await sleep(randomDelay());
  }

  const headers: Record<string, string> = {
    'User-Agent': randomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
  };

  if (referer) {
    headers['Referer'] = referer;
  }

  const attempts = Math.max(1, Math.floor(options.attempts ?? 3));
  const timeoutMs = Math.max(1, options.timeoutMs ?? 5000);

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, { headers, signal: controller.signal });
        const text = await response.text();
        return { ok: response.ok, text, status: response.status };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, ...
      await sleep(backoff);
    }
  }

  throw new Error('fetchWithAntiCrawl: unreachable');
}
