import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@navaxa/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getSessionState, isSessionRevoked } from "@/lib/session-revocation";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Hash bcrypt válido pero de una contraseña que nadie tiene. Se usa para gastar
// un compare aun cuando el usuario no existe → el tiempo de respuesta no revela
// qué emails están registrados (anti-enumeración por timing).
const DUMMY_HASH = "$2a$10$hNvkrrIQuvkhEeb6SSuOoutFMZmeyuhymdRsq/t116IrQmwf2wd56";

/**
 * Emails declarados como operadores de la plataforma (super admin). Se setean
 * en SUPER_ADMIN_EMAILS (CSV en .env). Si un usuario hace login y figura ahí,
 * promovemos su flag `platformAdmin` en BD. Quitar el email del env NO degrada
 * automáticamente — eso queda en BD; bórralo manualmente si quieres revocar.
 */
export function isSuperAdminEmail(email: string): boolean {
  const list = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export const authConfig: NextAuthConfig = {
  // 7 días: acota la ventana en que un JWT conserva rol/tenant/estado obsoletos
  // (p.ej. usuario desactivado) sin revalidar contra BD en cada request.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  secret: process.env.AUTH_SECRET,
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (raw, req) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase().trim();

        // Rate limit anti fuerza-bruta / credential stuffing: por IP (10/15min) y
        // por email (5/15min). Antes el login no tenía ningún tope (bcrypt cost 10
        // no frena ataques distribuidos). Devolvemos null (silencioso) al pasarse.
        const ip = req ? clientIp(req as unknown as Request) : "unknown";
        if (!rateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000).ok) return null;
        if (!rateLimit(`login:email:${email}`, 5, 15 * 60 * 1000).ok) return null;

        const user = await prisma.user.findFirst({
          where: { email, active: true },
          include: {
            tenant: { select: { id: true, slug: true, active: true } },
          },
        });

        // Siempre gastamos un bcrypt.compare (contra un hash dummy si el usuario no
        // existe) para no filtrar por timing qué emails están registrados.
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.passwordHash || !user.tenant.active || !ok) return null;

        // Auto-promoción a super admin si el email está en SUPER_ADMIN_EMAILS.
        const shouldBeAdmin = isSuperAdminEmail(user.email);
        const platformAdmin = user.platformAdmin || shouldBeAdmin;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            // Solo escribimos si cambia, para no machacar updatedAt al pedo.
            ...(shouldBeAdmin && !user.platformAdmin ? { platformAdmin: true } : {}),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
          role: user.role,
          platformAdmin,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id;
        token.tenantId = (user as any).tenantId;
        token.tenantSlug = (user as any).tenantSlug;
        token.role = (user as any).role;
        token.platformAdmin = Boolean((user as any).platformAdmin);
        // Instante de emisión real. No usamos token.iat: Auth.js re-firma el JWT
        // en cada lectura de sesión, así que su iat se refresca solo y nunca
        // quedaría por detrás del corte de revocación.
        token.authAt = Date.now();
        return token;
      }

      // Token existente: revalidar contra BD (cacheado 60s). Devolver null borra
      // la cookie de sesión → el usuario queda deslogueado de verdad.
      if (!token.sub) return null;
      const state = await getSessionState(token.sub);
      if (isSessionRevoked(state, Number(token.authAt ?? 0))) return null;

      // Refrescar rol/admin: si se los cambiaron, el token deja de ir obsoleto
      // sin obligar a re-loguear.
      token.role = state!.role;
      token.platformAdmin = state!.platformAdmin;
      return token;
    },
    session: ({ session, token }) => {
      if (token) {
        session.user.id = token.sub!;
        session.user.tenantId = token.tenantId;
        session.user.tenantSlug = token.tenantSlug;
        session.user.role = token.role;
        session.user.platformAdmin = Boolean(token.platformAdmin);
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
