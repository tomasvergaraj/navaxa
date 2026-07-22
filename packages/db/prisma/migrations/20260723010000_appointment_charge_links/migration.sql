-- Cobro del saldo de una cita por link/QR: el cliente paga desde su teléfono.
--
-- Tabla propia porque `payments.appointmentId` es UNIQUE (el abono de la reserva)
-- y una cita puede necesitar varios cobros del saldo. Al confirmarse, el cobro
-- crea una venta con kind = APPOINTMENT_BALANCE y queda enlazada por `saleId`.

-- CreateTable
CREATE TABLE "appointment_charges" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerRef" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_charges_saleId_key" ON "appointment_charges"("saleId");

-- CreateIndex
CREATE INDEX "appointment_charges_tenantId_status_idx" ON "appointment_charges"("tenantId", "status");

-- CreateIndex: links vigentes de una cita (reuso del link y aviso en la agenda).
CREATE INDEX "appointment_charges_appointmentId_status_idx" ON "appointment_charges"("appointmentId", "status");

-- CreateIndex: lookup del return de Webpay por token_ws.
CREATE INDEX "appointment_charges_providerRef_idx" ON "appointment_charges"("providerRef");

-- CreateIndex: barrido del job que expira los links vencidos.
CREATE INDEX "appointment_charges_status_expiresAt_idx" ON "appointment_charges"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "appointment_charges" ADD CONSTRAINT "appointment_charges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_charges" ADD CONSTRAINT "appointment_charges_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_charges" ADD CONSTRAINT "appointment_charges_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
