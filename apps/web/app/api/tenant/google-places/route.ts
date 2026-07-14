import { NextResponse } from "next/server";
import { apiError, requireManager } from "@/lib/api-errors";
import { googleReviewsEnabled, searchGooglePlaces } from "@/lib/google-reviews";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Búsqueda de locales en Google Maps para vincular reseñas (Configuración > Barbería).
export async function GET(req: Request) {
  try {
    const { tenantId } = requireManager();
    if (!googleReviewsEnabled()) {
      return NextResponse.json({ error: "Reseñas de Google no disponibles" }, { status: 503 });
    }

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 3 || q.length > 200) {
      return NextResponse.json({ error: "Escribe al menos 3 caracteres" }, { status: 400 });
    }

    // La búsqueda cuesta plata (Places Text Search) → tope por tenant.
    const { ok, retryAfter } = rateLimit(`gplaces:${tenantId}`, 10, 60 * 1000);
    if (!ok) {
      return NextResponse.json(
        { error: "Demasiadas búsquedas, intenta de nuevo en un momento" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const places = await searchGooglePlaces(q);
    return NextResponse.json({ places });
  } catch (e) {
    return apiError(e);
  }
}
