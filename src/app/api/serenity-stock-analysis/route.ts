import { NextResponse } from 'next/server';
import {
  FinanceAiInputError,
  FinanceAiProviderError,
  normalizeFinanceAiEndpoint,
} from '@/lib/finance-ai';
import {
  parseSerenityStockAnalysisInput,
  sendSerenityStockAnalysis,
} from '@/lib/serenity-stock-ai';
import { assertAllowedAiEndpoint } from '@/lib/security/ai-endpoint';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { HttpSecurityError, readJsonBody } from '@/lib/security/request';
import { authenticateApiRequest } from '@/lib/security/route-guard';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) return authentication.response;

  try {
    const rateLimit = await consumeRateLimit({
      scope: 'ai-provider-request',
      identifier: authentication.userId,
      limit: 20,
      windowMs: 10 * 60 * 1_000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const input = parseSerenityStockAnalysisInput(await readJsonBody(request));
    assertAllowedAiEndpoint(normalizeFinanceAiEndpoint(input.config.endpoint));
    const result = await sendSerenityStockAnalysis(input);

    return NextResponse.json(
      { success: true, content: result.content },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const isInputError = error instanceof FinanceAiInputError;
    const isProviderError = error instanceof FinanceAiProviderError;
    const isHttpError = error instanceof HttpSecurityError;

    if (!isInputError && !isProviderError && !isHttpError) {
      console.error('[serenity-stock-analysis] Request failed', error);
    }

    return NextResponse.json(
      {
        success: false,
        error: isInputError || isProviderError || isHttpError
          ? error.message
          : 'AI 请求失败',
      },
      {
        status: isHttpError ? error.status : isProviderError ? 502 : isInputError ? 400 : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
