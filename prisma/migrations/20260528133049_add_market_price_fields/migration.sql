/*
  Warnings:

  - You are about to drop the `GoldPrice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockPrice` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "cost_unit_price" DECIMAL(18,4),
ADD COLUMN     "market" TEXT,
ADD COLUMN     "quantity" DECIMAL(18,4),
ADD COLUMN     "stock_code" TEXT;

-- DropTable
DROP TABLE "GoldPrice";

-- DropTable
DROP TABLE "StockPrice";

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "source" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPrice_market_idx" ON "MarketPrice"("market");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_code_market_key" ON "MarketPrice"("code", "market");

-- CreateIndex
CREATE INDEX "Asset_stock_code_market_idx" ON "Asset"("stock_code", "market");
