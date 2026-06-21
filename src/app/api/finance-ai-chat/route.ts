import { NextResponse } from 'next/server';
import { sendFinanceAiChat } from '@/lib/finance-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await sendFinanceAiChat(body);

    return NextResponse.json({ success: true, content: result.content });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI 请求失败',
      },
      { status: 400 },
    );
  }
}
