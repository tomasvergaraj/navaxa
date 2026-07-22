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
  "/reservar", // directorio público de barberías (el prefijo /reservar/ cubre las vitrinas)
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
  "/regalar/", // compra pública de giftcard y su checkout (sin login)
  "/api/public/", // API pública de reservas y pagos
];

/** URL canónica de Auth.js; define si las cookies llevan el prefijo `__Secure-`. */
const authUrl = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").trim();

// Headers de confianza que fija el middleware a partir del JWT. Se borran de la
// entrada (el cliente no debe poder inyectarlos) y se re-setean abajo.
const INTERNAL_HEADERS = [
  "x-tenant-id",
  "x-user-id",
  "x-user-role",
  "x-platform-admin",
  "x-auth-at",
] as const;

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
    pathname === "/sitemap.xml" ||
    // Imagen OG generada por Next (la piden WhatsApp/bots sin sesión).
    pathname.startsWith("/opengraph-image")
  ) {
    return NextResponse.next();
  }

  // Auth.js elige `__Secure-` según el PROTOCOLO de AUTH_URL, no según NODE_ENV.
  // Acá se seguía NODE_ENV, así que un despliegue en http con la imagen de
  // producción (el entorno de prueba de docker-compose.sandbox.yml) buscaba una
  // cookie que Auth.js nunca escribió y toda sesión se veía como anónima. En
  // producción AUTH_URL es https → mismo valor de antes.
  const secureCookie = authUrl
    ? authUrl.startsWith("https:")
    : process.env.NODE_ENV === "production";
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

  // Rutas públicas pasan. Igual borramos los headers internos de confianza que
  // pudiera haber inyectado el cliente: una ruta pública no debe poder ser engañada
  // para leer un x-tenant-id/x-platform-admin falso vía getTenantContext().
  if (isPublic(pathname)) {
    const h = new Headers(req.headers);
    for (const k of INTERNAL_HEADERS) h.delete(k);
    return NextResponse.next({ request: { headers: h } });
  }

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

  // Propagar contexto en headers internos. `set` pisa cualquier valor entrante,
  // así que el cliente no puede falsearlos aunque nginx los deje pasar.
  const headers = new Headers(req.headers);
  headers.set("x-tenant-id", String(token.tenantId ?? ""));
  headers.set("x-user-id", String(token.sub ?? ""));
  headers.set("x-user-role", String(token.role ?? "STAFF"));
  headers.set("x-platform-admin", token.platformAdmin ? "1" : "0");
  // Emisión del token: la capa Node la contrasta con users.sessionInvalidBefore.
  // El middleware corre en Edge y no puede consultar Postgres, por eso solo lo
  // transporta (ver lib/session-revocation.ts).
  headers.set("x-auth-at", String(token.authAt ?? 0));

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.mp4$).*)",
  ],
};
