import crypto from "node:crypto";
import { prisma, PasswordTokenPurpose } from "@navaxa/db";

// Vigencia de cada tipo de token.
const TTL_MS: Record<PasswordTokenPurpose, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000, // 7 días para que el barbero defina su clave
  RESET: 60 * 60 * 1000, // 1 hora para recuperar contraseña
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Crea un token de un solo uso para el usuario y propósito dados.
 * Invalida (marca como usados) los tokens anteriores del mismo propósito.
 * Devuelve el token en claro (solo se guarda su hash en la BD).
 */
export async function createPasswordToken(
  userId: string,
  purpose: PasswordTokenPurpose,
): Promise<string> {
  const raw = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TTL_MS[purpose]);

  await prisma.$transaction([
    prisma.passwordToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordToken.create({
      data: { userId, purpose, tokenHash, expiresAt },
    }),
  ]);

  return raw;
}

export interface ValidatedToken {
  userId: string;
  purpose: PasswordTokenPurpose;
  userName: string;
  userEmail: string;
}

/**
 * Valida un token (sin consumirlo): existe, no usado y no expirado.
 * Devuelve null si es inválido.
 */
export async function validatePasswordToken(raw: string): Promise<ValidatedToken | null> {
  if (!raw) return null;
  const record = await prisma.passwordToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { name: true, email: true, active: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  if (!record.user.active) return null;
  return {
    userId: record.userId,
    purpose: record.purpose,
    userName: record.user.name,
    userEmail: record.user.email,
  };
}

/**
 * Consume el token: valida, fija la nueva contraseña del usuario y marca el
 * token como usado de forma atómica. Devuelve false si el token es inválido.
 */
export async function consumePasswordToken(raw: string, passwordHash: string): Promise<boolean> {
  if (!raw) return false;
  const tokenHash = hashToken(raw);
  const record = await prisma.passwordToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return false;

  // updateMany con usedAt:null asegura que solo el primer consumo gane (idempotencia ante carreras).
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return false;
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
    return true;
  });

  return result;
}

/** URL pública para que el usuario defina su contraseña con este token. */
export function buildSetPasswordUrl(rawToken: string): string {
  return `${APP_URL}/establecer-clave?token=${encodeURIComponent(rawToken)}`;
}
