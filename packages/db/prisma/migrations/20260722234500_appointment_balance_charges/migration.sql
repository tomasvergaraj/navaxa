-- Cobro del saldo pendiente de una cita.
--
-- `kind` separa el ingreso nuevo (COUNTER) de la cobranza de un servicio cuyo
-- ingreso ya se reconoció al completar la cita (APPOINTMENT_BALANCE). Sin esta
-- columna, el saldo cobrado aparecería a la vez en «Ingresos servicios» y en
-- «Ventas caja». El DEFAULT deja todas las ventas existentes como COUNTER, que
-- es lo que son.

-- CreateEnum
CREATE TYPE "SaleKind" AS ENUM ('COUNTER', 'APPOINTMENT_BALANCE');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "kind" "SaleKind" NOT NULL DEFAULT 'COUNTER';

-- CreateIndex: el cálculo del saldo consulta las ventas de una cita.
CREATE INDEX "sales_tenantId_appointmentId_idx" ON "sales"("tenantId", "appointmentId");
