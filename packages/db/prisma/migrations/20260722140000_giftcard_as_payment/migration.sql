-- Giftcard como medio de pago en la caja.

-- AlterEnum
ALTER TYPE "SalePaymentMethod" ADD VALUE 'GIFTCARD';

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "giftCardAmount" INTEGER NOT NULL DEFAULT 0,
                   ADD COLUMN "giftCardId" TEXT;

-- AlterTable
ALTER TABLE "gift_card_redemptions" ADD COLUMN "saleId" TEXT;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_redemptions" ADD CONSTRAINT "gift_card_redemptions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
