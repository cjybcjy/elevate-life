-- Add start_date and end_date first (nullable initially)
ALTER TABLE "Budget" ADD COLUMN "start_date" TIMESTAMP(3);
ALTER TABLE "Budget" ADD COLUMN "end_date" TIMESTAMP(3);

-- Migrate existing data: month "YYYY-MM" → start=first day, end=last day of month
UPDATE "Budget"
SET "start_date" = (month || '-01')::TIMESTAMP(3),
    "end_date" = ((month || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day')::TIMESTAMP(3)
WHERE "start_date" IS NULL;

-- Now make them NOT NULL
ALTER TABLE "Budget" ALTER COLUMN "start_date" SET NOT NULL;
ALTER TABLE "Budget" ALTER COLUMN "end_date" SET NOT NULL;

-- Drop old columns
ALTER TABLE "Budget" DROP COLUMN "period";
ALTER TABLE "Budget" DROP COLUMN "month";

-- Update indexes for Budget
DROP INDEX IF EXISTS "Budget_user_id_category_id_month_key";
DROP INDEX IF EXISTS "Budget_user_id_month_idx";
ALTER TABLE "Budget" DROP CONSTRAINT IF EXISTS "Budget_user_id_category_id_month_key";
CREATE INDEX "Budget_user_id_start_date_end_date_idx" ON "Budget"("user_id", "start_date", "end_date");

-- Add budgetId to Transaction
ALTER TABLE "Transaction" ADD COLUMN "budget_id" TEXT;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
