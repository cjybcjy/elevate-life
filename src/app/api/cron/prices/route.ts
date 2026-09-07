import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractPriceItems, refreshPricesForItems } from '@/lib/services/price';
import { verifyBearerSecret } from '@/lib/security/request';

export async function GET(request: Request) {
  if (!verifyBearerSecret(request, process.env.CRON_SECRET)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    // Collect all unique stockCode+market from all users' market-priced assets
    const assets = await prisma.asset.findMany({
      where: {
        OR: [
          { category: { in: ['gold_physical', 'gold_paper'] } },
          { category: { in: ['stock', 'fund'] }, stockCode: { not: null }, market: { not: null } },
        ],
      },
      select: { category: true, stockCode: true, market: true },
    });

    const items = await extractPriceItems(assets);
    const result = await refreshPricesForItems(items);

    if (!result.success) {
      return NextResponse.json(
        { success: true, warnings: result.errors },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { success: true, count: items.length },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Scheduled price refresh failed', error);
    return NextResponse.json(
      { error: 'Scheduled price refresh failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
