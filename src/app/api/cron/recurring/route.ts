import { NextResponse } from 'next/server';
import { processDueRecurring } from '@/lib/actions/recurring';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await processDueRecurring();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
