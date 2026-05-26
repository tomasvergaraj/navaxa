import { notFound } from "next/navigation";
import { prisma, AppointmentStatus } from "@navaxa/db";
import { Card } from "@navaxa/ui";
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
      status: true,
      client: { select: { firstName: true } },
      barber: { select: { user: { select: { name: true } } } },
      tenant: { select: { name: true, logoUrl: true } },
      review: { select: { rating: true, comment: true } },
    },
  });
  if (!appt) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          {appt.tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={appt.tenant.logoUrl}
              alt={appt.tenant.name}
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
          <ReviewForm
            token={params.token}
            shopName={appt.tenant.name}
            barberName={appt.barber.user.name}
            firstName={appt.client.firstName}
            initialRating={appt.review?.rating ?? 0}
            initialComment={appt.review?.comment ?? ""}
          />
        )}
      </div>

      <footer className="fixed bottom-4 left-0 right-0 text-center text-xs text-muted-foreground">
        Reseñas con <span className="font-medium text-foreground">navaxa</span>
      </footer>
    </div>
  );
}
