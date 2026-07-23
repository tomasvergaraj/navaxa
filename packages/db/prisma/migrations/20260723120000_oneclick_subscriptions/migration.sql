-- Renovación automática de la suscripción SaaS con Webpay Oneclick.
--
-- La suscripción guarda la tarjeta inscrita (tbk_user + username, ambos
-- necesarios para cobrar y para borrar la inscripción) y el token de una
-- inscripción en vuelo: el return de Transbank solo trae TBK_TOKEN, sin
-- referencia al tenant, y no se puede resolver por cookie (POST cross-site).
--
-- subscription_charges es el historial de cobros: idempotencia por período
-- (subscriptionId + periodEnd + attempt), auditoría y soporte de reintentos.
-- Cada intento lleva su propio buyOrder porque Transbank rechaza uno repetido.

-- AlterTable
ALTER TABLE "subscriptions"
    ADD COLUMN "oneclickUsername" TEXT,
    ADD COLUMN "oneclickTbkUser" TEXT,
    ADD COLUMN "oneclickToken" TEXT,
    ADD COLUMN "cardBrand" TEXT,
    ADD COLUMN "cardLast4" TEXT,
    ADD COLUMN "cardInscribedAt" TIMESTAMP(3),
    ADD COLUMN "renewalAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastRenewalAttemptAt" TIMESTAMP(3),
    ADD COLUMN "lastRenewalError" TEXT;

-- CreateIndex: lookup del return de inscripción por TBK_TOKEN.
CREATE UNIQUE INDEX "subscriptions_oneclickToken_key" ON "subscriptions"("oneclickToken");

-- CreateTable
CREATE TABLE "subscription_charges" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "buyOrder" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "plan" "Plan" NOT NULL,
    "billingInterval" "BillingInterval" NOT NULL,
    "status" TEXT NOT NULL,
    "responseCode" INTEGER,
    "authorizationCode" TEXT,
    "cardLast4" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_charges_buyOrder_key" ON "subscription_charges"("buyOrder");

-- CreateIndex: guard de idempotencia — un intento por ciclo.
CREATE UNIQUE INDEX "subscription_charges_subscriptionId_periodEnd_attempt_key" ON "subscription_charges"("subscriptionId", "periodEnd", "attempt");

-- CreateIndex: historial de cobros del tenant (más reciente primero).
CREATE INDEX "subscription_charges_tenantId_createdAt_idx" ON "subscription_charges"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
