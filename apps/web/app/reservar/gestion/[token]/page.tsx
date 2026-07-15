import { ManageBooking } from "@/components/booking/manage-booking";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi reserva",
  robots: { index: false },
};

export default function GestionPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <main id="main" className="mx-auto max-w-2xl px-4 py-8">
        <ManageBooking token={params.token} />
      </main>
    </div>
  );
}
