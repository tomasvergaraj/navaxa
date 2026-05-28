import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@navaxa/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * Emails declarados como operadores de la plataforma (super admin). Se setean
 * en SUPER_ADMIN_EMAILS (CSV en .env). Si un usuario hace login y figura ahí,
 * promovemos su flag `platformAdmin` en BD. Quitar el email del env NO degrada
 * automáticamente — eso queda en BD; bórralo manualmente si quieres revocar.
 */
function isSuperAdminEmail(email: string): boolean {
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
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findFirst({
          where: { email: parsed.data.email.toLowerCase().trim(), active: true },
          include: {
            tenant: { select: { id: true, slug: true, active: true } },
          },
        });

        if (!user || !user.passwordHash || !user.tenant.active) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

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
    jwt: ({ token, user }) => {
      if (user) {
        token.sub = user.id;
        token.tenantId = (user as any).tenantId;
        token.tenantSlug = (user as any).tenantSlug;
        token.role = (user as any).role;
        token.platformAdmin = Boolean((user as any).platformAdmin);
      }
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
