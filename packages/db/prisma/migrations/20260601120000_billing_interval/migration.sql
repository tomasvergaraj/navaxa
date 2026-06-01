-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY';
