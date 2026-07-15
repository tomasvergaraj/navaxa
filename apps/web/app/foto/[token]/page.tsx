import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@navaxa/db";
import { Card } from "@navaxa/ui";
import { verifyHaircutRatingToken } from "@/lib/haircut-rating";
import { HaircutRatingForm } from "@/components/booking/haircut-rating-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Califica tu corte", robots: { index: false } };

export default async function FotoPage({ params }: { params: { token: string } }) {
  const haircutId = verifyHaircutRatingToken(params.token);
  if (!haircutId) notFound();

  const haircut = await prisma.haircutRecord.findUnique({
    where: { id: haircutId },
    select: {
      id: true,
      imageUrl: true,
      thumbnailUrl: true,
      style: true,
      rating: true,
      client: { select: { firstName: true } },
      barber: { select: { user: { select: { name: true } } } },
      tenant: { select: { name: true, logoUrl: true } },
    },
  });
  if (!haircut) notFound();

  return (
    <div id="main" className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          {haircut.tenant.logoUrl ? (
            <Image
              src={haircut.tenant.logoUrl}
              alt={haircut.tenant.name}
              width={56}
              height={56}
              sizes="56px"
              className="h-14 w-14 rounded-2xl border border-border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-graphite font-display text-2xl text-brand-ivory">
              {haircut.tenant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="mt-2 font-display text-lg font-medium">{haircut.tenant.name}</span>
        </div>

        <Card className="overflow-hidden">
          <div className="relative aspect-square w-full">
            <Image
              src={haircut.imageUrl}
              alt={haircut.style ?? "Tu corte"}
              fill
              sizes="(max-width: 640px) 100vw, 400px"
              className="object-cover"
              priority
            />
          </div>
          <HaircutRatingForm
            token={params.token}
            firstName={haircut.client.firstName}
            barberName={haircut.barber?.user.name ?? null}
            style={haircut.style ?? null}
            initialRating={haircut.rating ?? 0}
          />
        </Card>
      </div>
    </div>
  );
}
