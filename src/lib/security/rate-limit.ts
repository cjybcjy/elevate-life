import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

type RateLimitOptions = {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
};

type RateLimitRow = {
  count: number;
  expiresAt: Date;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function rateLimitKey(scope: string, identifier: string) {
  return createHash('sha256').update(`${scope}\0${identifier}`).digest('hex');
}

export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1_000, Math.floor(options.windowMs));
  const key = rateLimitKey(options.scope, options.identifier);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  const [row] = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO "SecurityRateLimit" (
      "key",
      "count",
      "window_started_at",
      "expires_at",
      "updated_at"
    )
    VALUES (${key}, 1, ${now}, ${expiresAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "SecurityRateLimit"."expires_at" <= ${now} THEN 1
        ELSE "SecurityRateLimit"."count" + 1
      END,
      "window_started_at" = CASE
        WHEN "SecurityRateLimit"."expires_at" <= ${now} THEN ${now}
        ELSE "SecurityRateLimit"."window_started_at"
      END,
      "expires_at" = CASE
        WHEN "SecurityRateLimit"."expires_at" <= ${now} THEN ${expiresAt}
        ELSE "SecurityRateLimit"."expires_at"
      END,
      "updated_at" = ${now}
    RETURNING "count", "expires_at" AS "expiresAt"
  `;

  if (!row) throw new Error('Rate limit state unavailable');

  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    retryAfterSeconds: Math.max(1, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1_000)),
  };
}

export async function cleanupExpiredRateLimits(before = new Date()) {
  return prisma.securityRateLimit.deleteMany({
    where: { expiresAt: { lt: before } },
  });
}
