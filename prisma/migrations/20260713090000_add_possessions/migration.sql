-- CreateTable
CREATE TABLE "Possession" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purchase_price" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sold_price" TEXT,
    "sold_date" TIMESTAMP(3),
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Possession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Possession_user_id_status_idx" ON "Possession"("user_id", "status");

-- AddForeignKey
ALTER TABLE "Possession" ADD CONSTRAINT "Possession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
