import crypto from "node:crypto";
import { prisma, type Prisma } from "@navaxa/db";
import { ApiError } from "./api-errors";

// Alfabeto sin caracteres ambiguos (0/O, 1/I) para dictar el código por teléfono.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  const bytes = crypto.randomBytes(6);
  let body = "";
  for (let i = 0; i < 6; i++) body += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return `NVX-${body}`;
}

/** Genera un código único por tenant (reintenta ante colisión, muy improbable). */
async function uniqueCode(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const existing = await prisma.giftCard.findFirst({
      where: { tenantId, code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new ApiError(500, "No se pudo generar un código único, intenta de nuevo");
}

export async function issueGiftCard(input: {
  tenantId: string;
  amount: number;
  buyerName?: string;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  expiresAt?: Date | null;
}) {
  const code = await uniqueCode(input.tenantId);
  return prisma.giftCard.create({
    data: {
      tenantId: input.tenantId,
      code,
      initialValue: input.amount,
      balance: input.amount,
      buyerName: input.buyerName || null,
      recipientName: input.recipientName || null,
      recipientEmail: input.recipientEmail || null,
      message: input.message || null,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

/** Normaliza el código tal como lo tipea el cajero (mayúsculas, con o sin guion). */
export function normalizeCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (cleaned.startsWith("NVX-")) return cleaned;
  if (cleaned.startsWith("NVX")) return `NVX-${cleaned.slice(3)}`;
  return cleaned;
}

export async function findGiftCardByCode(tenantId: string, code: string) {
  return prisma.giftCard.findFirst({
    where: { tenantId, code: normalizeCode(code) },
  });
}

/**
 * Canjea `amount` del saldo de una giftcard dentro de una transacción ya
 * abierta. Valida estado, expiración y saldo; deja el consumo en
 * gift_card_redemptions y marca REDEEMED al llegar a 0. A prueba de doble canje
 * concurrente (guard sobre el balance en el updateMany).
 *
 * Se expone en versión `tx` para que la caja pueda cobrar con giftcard y
 * descontar stock en la MISMA transacción: si la venta falla, el saldo no se
 * consume.
 */
export async function redeemGiftCardTx(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    giftCardId: string;
    amount: number;
    note?: string;
    saleId?: string;
  },
) {
  if (input.amount <= 0) throw new ApiError(400, "El monto a canjear debe ser mayor a 0");

  const card = await tx.giftCard.findFirst({
    where: { id: input.giftCardId, tenantId: input.tenantId },
  });
  if (!card) throw new ApiError(404, "Giftcard no encontrada");
  if (card.status === "CANCELLED") throw new ApiError(409, "Esta giftcard fue anulada");
  if (card.status === "REDEEMED" || card.balance <= 0)
    throw new ApiError(409, "Esta giftcard ya no tiene saldo");
  if (card.expiresAt && card.expiresAt < new Date()) {
    await tx.giftCard.updateMany({
      where: { id: card.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    throw new ApiError(409, "Esta giftcard está vencida");
  }
  if (input.amount > card.balance) {
    throw new ApiError(409, `El saldo disponible es menor (${card.balance})`);
  }

  const newBalance = card.balance - input.amount;
  const claimed = await tx.giftCard.updateMany({
    where: { id: card.id, balance: { gte: input.amount }, status: "ACTIVE" },
    data: { balance: newBalance, status: newBalance === 0 ? "REDEEMED" : "ACTIVE" },
  });
  if (claimed.count === 0) throw new ApiError(409, "El saldo cambió, vuelve a intentar");

  await tx.giftCardRedemption.create({
    data: {
      tenantId: input.tenantId,
      giftCardId: card.id,
      saleId: input.saleId ?? null,
      amount: input.amount,
      note: input.note || null,
    },
  });

  return { ...card, balance: newBalance, status: newBalance === 0 ? "REDEEMED" : card.status };
}

/** Canje suelto desde el mostrador (abre su propia transacción). */
export async function redeemGiftCard(input: {
  tenantId: string;
  giftCardId: string;
  amount: number;
  note?: string;
}) {
  return prisma.$transaction((tx) => redeemGiftCardTx(tx, input));
}

/**
 * Devuelve saldo consumido por una venta anulada. Deja un consumo negativo en
 * el histórico (la suma de `amount` sigue siendo el consumo neto) y reactiva la
 * giftcard si se había marcado REDEEMED. Una giftcard anulada recupera el saldo
 * pero sigue CANCELLED: anular es decisión del local, no la revierte un refund.
 */
export async function refundGiftCardTx(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; giftCardId: string; amount: number; saleId: string; note?: string },
) {
  if (input.amount <= 0) return;
  const card = await tx.giftCard.findFirst({
    where: { id: input.giftCardId, tenantId: input.tenantId },
    select: { id: true, status: true },
  });
  if (!card) return;

  await tx.giftCard.update({
    where: { id: card.id },
    data: {
      balance: { increment: input.amount },
      ...(card.status === "REDEEMED" ? { status: "ACTIVE" as const } : {}),
    },
  });
  await tx.giftCardRedemption.create({
    data: {
      tenantId: input.tenantId,
      giftCardId: card.id,
      saleId: input.saleId,
      amount: -input.amount,
      note: input.note || "Venta anulada",
    },
  });
}

/** Anula una giftcard (deja de ser canjeable). No borra el historial. */
export async function cancelGiftCard(tenantId: string, giftCardId: string) {
  const updated = await prisma.giftCard.updateMany({
    where: { id: giftCardId, tenantId, status: { in: ["ACTIVE", "EXPIRED"] } },
    data: { status: "CANCELLED" },
  });
  if (updated.count === 0) throw new ApiError(409, "La giftcard no existe o ya estaba anulada/canjeada");
}
