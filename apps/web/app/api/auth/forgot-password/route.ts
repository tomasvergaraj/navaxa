import { NextResponse } from "next/server";
import { prisma, PasswordTokenPurpose, NotificationChannel } from "@navaxa/db";
import { forgotPasswordSchema } from "@/lib/validators";
import { createPasswordToken, buildSetPasswordUrl } from "@/lib/password-tokens";
import { sendNotification } from "@/lib/notifications";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Rate limit por IP: 5 solicitudes cada 15 min.
  const { ok, retryAfter } = rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60 * 1000);
  if (!ok) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta más tarde." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const parsed = forgotPasswordSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findFirst({
    where: { email, active: true },
    select: { id: true, name: true, tenantId: true, tenant: { select: { name: true, active: true } } },
  });

  // Solo enviamos si el usuario existe y su tenant está activo, pero respondemos
  // siempre 200 para no filtrar qué correos están registrados (anti-enumeración).
  if (user && user.tenant.active) {
    const token = await createPasswordToken(user.id, PasswordTokenPurpose.RESET);
    await sendNotification({
      tenantId: user.tenantId,
      channel: NotificationChannel.EMAIL,
      recipient: email,
      templateKey: "password_reset",
      data: {
        firstName: user.name,
        shopName: user.tenant.name,
        actionUrl: buildSetPasswordUrl(token),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
