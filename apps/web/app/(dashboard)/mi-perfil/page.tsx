import { Scissors } from "lucide-react";
import { getTenantContext, scopedDb } from "@/lib/tenant";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { BarberProfileForm } from "@/components/barbers/barber-profile-form";

export const dynamic = "force-dynamic";

export default async function MiPerfilPage() {
  const { userId } = getTenantContext();
  const db = scopedDb();
  const barber = await db.barber.findFirst({
    where: { userId },
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="container max-w-2xl py-8">
      <PageHeader
        title="Mi perfil"
        subtitle="Edita la información que ven tus clientes en la página de reservas."
      />

      {!barber ? (
        <EmptyState
          icon={Scissors}
          title="No tienes perfil de barbero"
          description="Tu cuenta no está vinculada a un perfil de barbero. Pídele al dueño que te agregue al equipo."
        />
      ) : (
        <BarberProfileForm
          barberId={barber.id}
          name={barber.user.name ?? ""}
          email={barber.user.email}
          avatarUrl={barber.avatarUrl}
          bio={barber.bio ?? ""}
          specialties={barber.specialties}
          instagram={barber.instagram ?? ""}
          commissionPct={Math.round(barber.commissionRate * 100)}
        />
      )}
    </div>
  );
}
