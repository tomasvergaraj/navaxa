import { prisma, Prisma } from "@navaxa/db";

/**
 * Reseñas de Google vía Places API (New).
 *
 * El rating y las reseñas se cachean en el Tenant y se refrescan una vez al
 * día por el cron interno (más un sync inmediato al guardar el Place ID en
 * Configuración). La página pública lee solo el cache: cero llamadas a Google
 * en el hot path.
 *
 * Requiere GOOGLE_MAPS_API_KEY (key de Google Cloud con Places API New
 * habilitada). Sin la key, el feature queda inerte.
 */

const FIELD_MASK = "displayName,rating,userRatingCount,googleMapsUri,reviews";

export interface GoogleReview {
  author: string;
  avatarUrl: string | null;
  rating: number;
  text: string;
  /** Texto relativo que entrega Google ya localizado, ej. "hace 2 semanas". */
  relativeTime: string;
  publishTime: string;
}

export function googleReviewsEnabled() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

/** Consulta Place Details y normaliza rating global + hasta 5 reseñas. */
export async function fetchGooglePlace(placeId: string) {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=es`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY ?? "",
      "X-Goog-FieldMask": FIELD_MASK,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Places API ${res.status}: ${body.slice(0, 200)}`);
  }
  const place = (await res.json()) as {
    displayName?: { text?: string };
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    reviews?: Array<{
      rating?: number;
      text?: { text?: string };
      relativePublishTimeDescription?: string;
      publishTime?: string;
      authorAttribution?: { displayName?: string; photoUri?: string };
    }>;
  };

  const reviews: GoogleReview[] = (place.reviews ?? [])
    .filter((r) => typeof r.rating === "number")
    .map((r) => ({
      author: r.authorAttribution?.displayName ?? "Usuario de Google",
      avatarUrl: r.authorAttribution?.photoUri ?? null,
      rating: r.rating as number,
      text: r.text?.text ?? "",
      relativeTime: r.relativePublishTimeDescription ?? "",
      publishTime: r.publishTime ?? "",
    }));

  return {
    name: place.displayName?.text ?? null,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? 0,
    mapsUri: place.googleMapsUri ?? null,
    reviews,
  };
}

export interface GooglePlaceResult {
  id: string;
  name: string;
  address: string;
}

/**
 * Busca lugares por texto libre (nombre + comuna) para que el dueño vincule
 * su local sin conocer el Place ID.
 *
 * Cost: Text Search Pro ~$0.032/req (5k gratis/mes). Solo se invoca a demanda
 * desde Configuración (setup one-shot por tenant) → ignorable.
 */
export async function searchGooglePlaces(query: string): Promise<GooglePlaceResult[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY ?? "",
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "es", pageSize: 5 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Places searchText ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
    }>;
  };
  return (data.places ?? [])
    .filter((p) => p.id)
    .map((p) => ({
      id: p.id as string,
      name: p.displayName?.text ?? "Sin nombre",
      address: p.formattedAddress ?? "",
    }));
}

/** Refresca el cache de Google de un tenant. Lanza si la API falla. */
export async function syncGoogleReviewsForTenant(tenantId: string, placeId: string) {
  const data = await fetchGooglePlace(placeId);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      googlePlaceName: data.name,
      googleRating: data.rating,
      googleReviewCount: data.reviewCount,
      googleMapsUri: data.mapsUri,
      googleReviews: data.reviews as unknown as Prisma.InputJsonValue,
      googleSyncedAt: new Date(),
    },
  });
  return data;
}

/** Job diario: refresca todos los tenants activos con Place ID configurado. */
export async function syncAllGoogleReviews() {
  if (!googleReviewsEnabled()) return { synced: 0, failed: 0 };
  const tenants = await prisma.tenant.findMany({
    where: { active: true, googlePlaceId: { not: null } },
    select: { id: true, slug: true, googlePlaceId: true },
  });
  let synced = 0;
  let failed = 0;
  for (const t of tenants) {
    try {
      await syncGoogleReviewsForTenant(t.id, t.googlePlaceId as string);
      synced++;
    } catch (e) {
      failed++;
      // Un tenant con Place ID inválido no debe frenar al resto; se conserva el cache anterior.
      console.error(`[google-reviews] fallo sync tenant ${t.slug}:`, (e as Error).message);
    }
  }
  return { synced, failed };
}
