import { NextResponse } from "next/server";
import { prisma, DepositType, Prisma } from "@navaxa/db";
import { apiError, requireManager } from "@/lib/api-errors";
import { tenantUpdateSchema } from "@/lib/validators";
import { googleReviewsEnabled, syncGoogleReviewsForTenant } from "@/lib/google-reviews";

export const dynamic = "force-dynamic";

// Tenant no lleva columna tenantId (su id ES el tenant) → se usa prisma directo, no scopedDb.
export async function PATCH(req: Request) {
  try {
    const { tenantId } = requireManager();
    const parsed = tenantUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const emptyToNull = (v?: string) => (v === undefined ? undefined : v === "" ? null : v);

    // Si es PERCENT, el valor es 0-100; si es FIXED, un monto en CLP.
    let depositValue = d.depositValue;
    if (depositValue !== undefined && d.depositType === "PERCENT") {
      depositValue = Math.min(100, depositValue);
    }

    const newPlaceId = emptyToNull(d.googlePlaceId);
    const prev =
      newPlaceId !== undefined
        ? await prisma.tenant.findUnique({ where: { id: tenantId }, select: { googlePlaceId: true } })
        : null;

    // GA/Meta Pixel es feature PRO+: guardar un ID nuevo exige el plan (quitar
    // o dejar igual siempre se permite; si el plan baja, el storefront ya no
    // inyecta los scripts aunque el ID quede guardado).
    const gaRaw = emptyToNull(d.gaMeasurementId);
    const gaMeasurementId = typeof gaRaw === "string" ? gaRaw.toUpperCase() : gaRaw;
    const metaPixelId = emptyToNull(d.metaPixelId);
    const brandRaw = emptyToNull(d.brandColor);
    // null (limpiar) debe llegar a Prisma como null; ?.toLowerCase() lo volvía
    // undefined y la columna nunca se limpiaba.
    const brandColor = typeof brandRaw === "string" ? brandRaw.toLowerCase() : brandRaw;
    // GA/Pixel y color de marca son features PRO+: guardar un valor nuevo exige
    // el plan (quitar o dejar igual siempre se permite; si el plan baja, el
    // storefront deja de aplicarlo aunque el valor quede guardado).
    if (gaMeasurementId || metaPixelId || brandColor) {
      const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
      if (t?.plan !== "PRO" && t?.plan !== "ENTERPRISE") {
        return NextResponse.json(
          { error: "La personalización visual y las integraciones de analítica son del plan Pro.", code: "PLAN_LIMIT" },
          { status: 403 },
        );
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: d.name,
        rut: emptyToNull(d.rut),
        phone: emptyToNull(d.phone),
        email: emptyToNull(d.email),
        address: emptyToNull(d.address),
        city: emptyToNull(d.city),
        timezone: d.timezone,
        description: emptyToNull(d.description),
        instagram: emptyToNull(d.instagram),
        website: emptyToNull(d.website),
        bookingEnabled: d.bookingEnabled,
        bookingNoticeMin: d.bookingNoticeMin,
        gaMeasurementId,
        metaPixelId,
        brandColor,
        marketplaceVisible: d.marketplaceVisible,
        paymentsEnabled: d.paymentsEnabled,
        depositType: d.depositType ? (d.depositType as DepositType) : undefined,
        depositValue,
        googlePlaceId: newPlaceId,
        // Si el lugar cambió, el nombre cacheado ya no corresponde; el sync
        // inmediato de más abajo lo repone para el lugar nuevo.
        ...(newPlaceId !== undefined && newPlaceId !== prev?.googlePlaceId
          ? { googlePlaceName: null }
          : {}),
        // Al quitar el Place ID se limpia el cache de reseñas para que la
        // página pública no siga mostrando datos de un lugar desvinculado.
        ...(newPlaceId === null
          ? {
              googleRating: null,
              googleReviewCount: null,
              googleMapsUri: null,
              googleReviews: Prisma.DbNull,
              googleSyncedAt: null,
            }
          : {}),
      },
    });

    // Place ID nuevo o cambiado → sync inmediato (best-effort) para que el
    // dueño vea sus reseñas sin esperar al cron diario.
    if (newPlaceId && newPlaceId !== prev?.googlePlaceId && googleReviewsEnabled()) {
      try {
        await syncGoogleReviewsForTenant(tenantId, newPlaceId);
      } catch (err) {
        console.error("[google-reviews] sync inmediato falló:", (err as Error).message);
      }
    }

    return NextResponse.json({ tenant });
  } catch (e) {
    return apiError(e);
  }
}
