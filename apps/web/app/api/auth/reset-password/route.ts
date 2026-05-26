import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { resetPasswordSchema } from "@/lib/validators";
import { validatePasswordToken, consumePasswordToken } from "@/lib/password-tokens";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Valida un token (sin consumirlo) para que la página muestre el contexto. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const valid = await validatePasswordToken(token);
  if (!valid) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }
  return NextResponse.json({
    valid: true,
    purpose: valid.purpose,
    name: valid.userName,
    email: valid.userEmail,
  });
}

/** Fija la nueva contraseña a partir del token (invitación o recuperación). */
export async function POST(req: Request) {
  const { ok, retryAfter } = rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!ok) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta más tarde." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const parsed = resetPasswordSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const done = await consumePasswordToken(parsed.data.token, passwordHash);
  if (!done) {
    return NextResponse.json(
      { error: "El enlace es inválido o expiró. Solicita uno nuevo." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
