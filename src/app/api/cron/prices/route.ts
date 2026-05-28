import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractPriceItems, refreshPricesForItems } from '@/lib/services/price';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ success: true, warnings: result.errors }, { status: 200 });
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
