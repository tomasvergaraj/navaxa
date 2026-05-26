-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "bookingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bookingNoticeMin" INTEGER NOT NULL DEFAULT 0;
