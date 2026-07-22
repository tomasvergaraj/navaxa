import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gift } from "lucide-react";
import { resolveTenantBySlug } from "@/lib/public-booking";
import { planHasBranding, planHasGiftCards } from "@/lib/plan-features";
import { brandStyle } from "@/lib/brand-color";
import { turnstileSiteKey } from "@/lib/turnstile";
import { GiftPurchaseForm } from "./gift-purchase-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const tenant = await resolveTenantBySlug(params.slug);
  if (!tenant) return { title: "Giftcard" };

  const title = `Giftcard · ${tenant.name}`;
  const description = `Regala un corte en ${tenant.name}. La giftcard llega por email con un código para usar al reservar o pagar.`;
  const image = tenant.coverUrl ?? tenant.logoUrl ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: `/regalar/${tenant.slug}` },
    openGraph: {
      title,
      description,
      url: `/regalar/${tenant.slug}`,
      siteName: tenant.name,
      locale: "es_CL",
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? ("summary_large_image" as const) : ("summary" as const),
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function RegalarPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { cancelado?: string };
}) {
  const tenant = await resolveTenantBySlug(params.slug);
  if (!tenant) notFound();
  // Las giftcards son feature del plan Pro: sin plan, la página no existe.
  if (!planHasGiftCards(tenant.plan)) notFound();

  return (
    <div
      className="min-h-screen bg-muted/30"
      style={
        planHasBranding(tenant.plan)
          ? brandStyle(tenant.brandColor, tenant.brandAccentColor)
          : undefined
      }
    >
      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link
            href={`/reservar/${tenant.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {tenant.name}
          </Link>
        </div>
      </nav>

      <main id="main" className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-5 rounded-lg border border-border bg-card p-5">
          <Gift className="h-8 w-8 text-primary" />
          <h1 className="mt-3 font-display text-2xl font-medium tracking-tight">
            Regala una giftcard
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Elige el monto y quién la recibe. Al confirmar el pago te enviamos un código que sirve
            para reservar o pagar en {tenant.name}. Vigencia: 12 meses.
          </p>
        </div>

        {searchParams.cancelado && (
          <p
            role="status"
            className="mb-5 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          >
            Cancelaste el pago, así que no se emitió ninguna giftcard. Puedes intentar de nuevo.
          </p>
        )}

        <div className="rounded-lg border border-border bg-card p-5">
          <GiftPurchaseForm slug={tenant.slug} turnstileSiteKey={turnstileSiteKey()} />
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        Giftcards con <span className="font-medium text-foreground">navaxa</span>
      </footer>
    </div>
  );
}
