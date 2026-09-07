import { getAssets } from '@/lib/actions/assets';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { authenticateApiRequest } from '@/lib/security/route-guard';
import { refreshPricesForUser } from '@/lib/services/price';

export async function POST(request: Request) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) return authentication.response;

  try {
    const rateLimit = await consumeRateLimit({
      scope: 'interactive-price-refresh',
      identifier: authentication.userId,
      limit: 5,
      windowMs: 60 * 1_000,
    });
    if (!rateLimit.allowed) {
      return Response.json(
        { success: false, error: '刷新过于频繁，请稍后重试' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const result = await refreshPricesForUser(authentication.userId, { interactive: true });
    const assets = await getAssets();

    if (!assets.success) {
      return Response.json(
        { success: false, error: assets.error || 'Failed to load refreshed assets' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return Response.json(
      {
        ...result,
        assets: {
          data: assets.data ?? [],
          pricesStale: assets.pricesStale ?? false,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[prices/refresh] Request failed', error);
    return Response.json(
      {
        success: false,
        error: 'Price refresh failed',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
