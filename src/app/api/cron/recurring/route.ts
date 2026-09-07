import { NextResponse } from 'next/server';
import { cleanupExpiredRateLimits } from '@/lib/security/rate-limit';
import { verifyBearerSecret } from '@/lib/security/request';
import { processAllDueRecurring } from '@/lib/services/recurring-processor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyBearerSecret(request, process.env.CRON_SECRET)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const result = await processAllDueRecurring();
    await cleanupExpiredRateLimits().catch((error) => {
      console.error('Failed to clean expired rate limit buckets', error);
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Scheduled recurring processing failed', error);
    return NextResponse.json(
      { success: false, error: 'Scheduled recurring processing failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
