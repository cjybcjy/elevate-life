-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "balance" TEXT NOT NULL DEFAULT '0',
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "valuation_method" TEXT,
    "liquidity_tier" TEXT,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "cost_price" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "principal" TEXT NOT NULL DEFAULT '0',
    "current_balance" TEXT NOT NULL DEFAULT '0',
    "interest_rate" DECIMAL(6,4) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "monthly_payment" TEXT,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Liability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtMilestone" (
    "id" TEXT NOT NULL,
    "liability_id" TEXT NOT NULL,
    "month_index" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "principal_due" DECIMAL(18,4) NOT NULL,
    "interest_due" DECIMAL(18,4) NOT NULL,
    "total_due" DECIMAL(18,4) NOT NULL,
    "remaining_balance" DECIMAL(18,4) NOT NULL,
    "scenario_type" TEXT NOT NULL DEFAULT 'base',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "category_id" TEXT,
    "from_account_id" TEXT,
    "to_account_id" TEXT,
    "liability_id" TEXT,
    "description" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "is_essential" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_essential" BOOLEAN NOT NULL DEFAULT false,
    "essential_ratio" DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    "icon" TEXT,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldPrice" (
    "id" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL DEFAULT 'gold_au9999',
    "price" DECIMAL(18,4) NOT NULL,
    "data_source" TEXT,
    "is_interpolated" BOOLEAN NOT NULL DEFAULT false,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoldPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPrice" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "market" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Asset_user_id_category_idx" ON "Asset"("user_id", "category");

-- CreateIndex
CREATE INDEX "DebtMilestone_liability_id_month_index_idx" ON "DebtMilestone"("liability_id", "month_index");

-- CreateIndex
CREATE INDEX "Transaction_user_id_occurred_at_idx" ON "Transaction"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "GoldPrice_asset_type_recorded_at_idx" ON "GoldPrice"("asset_type", "recorded_at");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtMilestone" ADD CONSTRAINT "DebtMilestone_liability_id_fkey" FOREIGN KEY ("liability_id") REFERENCES "Liability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_liability_id_fkey" FOREIGN KEY ("liability_id") REFERENCES "Liability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
