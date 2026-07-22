-- Giftcard como pago del abono de reserva.

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "giftCardAmount" INTEGER NOT NULL DEFAULT 0,
                      ADD COLUMN "giftCardId" TEXT;

-- AlterTable
ALTER TABLE "gift_card_redemptions" ADD COLUMN "paymentId" TEXT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_redemptions" ADD CONSTRAINT "gift_card_redemptions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
