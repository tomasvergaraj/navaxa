-- Compra pública de giftcard desde la vitrina (sin sesión, cobro por pasarela).

-- CreateTable
CREATE TABLE "gift_card_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerRef" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "message" TEXT,
    "expiresInMonths" INTEGER NOT NULL DEFAULT 12,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "giftCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_card_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gift_card_orders_giftCardId_key" ON "gift_card_orders"("giftCardId");

-- CreateIndex
CREATE INDEX "gift_card_orders_tenantId_status_idx" ON "gift_card_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "gift_card_orders_providerRef_idx" ON "gift_card_orders"("providerRef");

-- AddForeignKey
ALTER TABLE "gift_card_orders" ADD CONSTRAINT "gift_card_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_orders" ADD CONSTRAINT "gift_card_orders_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
