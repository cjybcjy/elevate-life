CREATE TABLE "SecurityRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityRateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "SecurityRateLimit_expires_at_idx" ON "SecurityRateLimit"("expires_at");
