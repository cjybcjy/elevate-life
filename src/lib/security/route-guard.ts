import { auth } from '@/lib/auth';
import { isSameOriginRequest } from './request';

type AuthenticatedApiRequest = {
  ok: true;
  userId: string;
};

type RejectedApiRequest = {
  ok: false;
  response: Response;
};

export async function authenticateApiRequest(
  request: Request,
): Promise<AuthenticatedApiRequest | RejectedApiRequest> {
  if (!isSameOriginRequest(request)) {
    return {
      ok: false,
      response: Response.json(
        { success: false, error: 'Forbidden' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      ),
    };
  }

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      ok: false,
      response: Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
    };
  }

  return { ok: true, userId };
}
