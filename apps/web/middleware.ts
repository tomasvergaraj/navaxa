import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/registro",
  "/precios",
  "/legal",
  "/recuperar", // solicitar reset de contraseña (sin login)
  "/establecer-clave", // definir contraseña por token de invitación/reset (sin login)
]);
const PUBLIC_PREFIXES = [
  "/legal/",
  "/api/auth/",
  "/api/webhooks/",
  "/reservar/", // storefront público de reservas (sin login)
  "/resena/", // dejar reseña por token (sin login)
  "/foto/", // calificar foto de corte por token (sin login)
  "/api/billing/webpay/", // return URL de Webpay para SaaS: viene cross-site sin cookies
  "/pagar/", // checkout de abono (sin login)
  "/api/public/", // API pública de reservas y pagos
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir assets estáticos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const secureCookie = process.env.NODE_ENV === "production";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET!,
    secureCookie,
    // salt = nombre de la cookie de sesión (default de Auth.js v5); explícito por tipos.
    salt: secureCookie ? "__Secure-authjs.session-token" : "authjs.session-token",
  });

  // Redirigir usuarios autenticados desde login/registro al dashboard
  if (token && (pathname === "/login" || pathname === "/registro")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Rutas públicas pasan
  if (isPublic(pathname)) return NextResponse.next();

  // Bloqueo de rutas privadas
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Panel super admin: gateado fuera del scope de tenant.
  const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (isAdminPath && !token.platformAdmin) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Propagar contexto en headers internos
  const headers = new Headers(req.headers);
  headers.set("x-tenant-id", String(token.tenantId ?? ""));
  headers.set("x-user-id", String(token.sub ?? ""));
  headers.set("x-user-role", String(token.role ?? "STAFF"));
  headers.set("x-platform-admin", token.platformAdmin ? "1" : "0");

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.mp4$).*)",
  ],
};
