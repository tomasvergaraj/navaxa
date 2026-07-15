import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma, AppointmentStatus } from "@navaxa/db";
import { Card } from "@navaxa/ui";
import { subHours, addHours } from "date-fns";
import { verifyReviewToken } from "@/lib/reviews";
import { ReviewForm } from "@/components/booking/review-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu reseña", robots: { index: false } };

export default async function ResenaPage({ params }: { params: { token: string } }) {
  const appointmentId = verifyReviewToken(params.token);
  if (!appointmentId) notFound();

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      tenantId: true,
      clientId: true,
      startsAt: true,
      status: true,
      client: { select: { firstName: true } },
      barber: { select: { user: { select: { name: true } } } },
      tenant: { select: { name: true, logoUrl: true, googlePlaceId: true } },
      review: { select: { rating: true, comment: true } },
    },
  });
  if (!appt) notFound();

  // Foto del corte de esta visita: primero por vínculo directo con la cita;
  // si no (fotos previas al vínculo), la más cercana a la hora de la visita.
  const haircut =
    (await prisma.haircutRecord.findFirst({
      where: { appointmentId },
      select: { imageUrl: true, style: true },
    })) ??
    (await prisma.haircutRecord.findFirst({
      where: {
        tenantId: appt.tenantId,
        clientId: appt.clientId,
        appointmentId: null,
        performedAt: { gte: subHours(appt.startsAt, 6), lte: addHours(appt.startsAt, 48) },
      },
      orderBy: { performedAt: "desc" },
      select: { imageUrl: true, style: true },
    }));

  // Un tap más al terminar: deep link al diálogo de reseña de Google.
  // Se muestra a todos los clientes (filtrar por rating viola políticas de Google).
  const googleReviewUrl = appt.tenant.googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(appt.tenant.googlePlaceId)}`
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          {appt.tenant.logoUrl ? (
            <Image
              src={appt.tenant.logoUrl}
              alt={appt.tenant.name}
              width={56}
              height={56}
              sizes="56px"
              className="h-14 w-14 rounded-2xl border border-border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-graphite font-display text-2xl text-brand-ivory">
              {appt.tenant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="mt-2 font-display text-lg font-medium">{appt.tenant.name}</span>
        </div>

        {appt.status !== AppointmentStatus.COMPLETED ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Esta cita aún no está completada, así que todavía no puedes dejar tu reseña.
          </Card>
        ) : (
          <>
            {haircut && (
              <Card className="mb-4 overflow-hidden">
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
                {haircut.style && (
                  <p className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                    Así quedó tu {haircut.style.toLowerCase()}
                  </p>
                )}
              </Card>
            )}
            <ReviewForm
              token={params.token}
              shopName={appt.tenant.name}
              barberName={appt.barber.user.name}
              firstName={appt.client.firstName}
              initialRating={appt.review?.rating ?? 0}
              initialComment={appt.review?.comment ?? ""}
              googleReviewUrl={googleReviewUrl}
            />
          </>
        )}
      </div>

      <footer className="mt-10 pb-6 text-center text-xs text-muted-foreground">
        Reseñas con <span className="font-medium text-foreground">navaxa</span>
      </footer>
    </div>
  );
}
