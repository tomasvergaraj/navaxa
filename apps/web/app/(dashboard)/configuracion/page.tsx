import { Card, TabsList, TabsTrigger, TabsContent } from "@navaxa/ui";
import { UrlTabs } from "@/components/ui/url-tabs";
import { scopedDb } from "@/lib/tenant";
import { requireManagerPage } from "@/lib/page-guards";
import { prisma } from "@navaxa/db";
import { BookingLinkCard } from "@/components/booking/booking-link-card";
import { TenantSettingsForm } from "@/components/settings/tenant-settings-form";
import { ServicesManager } from "@/components/settings/services-manager";
import { ScheduleManager } from "@/components/settings/schedule-manager";
import { TeamManager } from "@/components/settings/team-manager";
import { PaymentSettingsForm } from "@/components/settings/payment-settings-form";
import { PlanManager } from "@/components/settings/plan-manager";
import { whatsappMonthlyLimit, whatsappUsageThisMonth } from "@/lib/notifications/channel";

export const dynamic = "force-dynamic";

const TABS = ["barberia", "servicios", "horarios", "pagos", "equipo", "plan"];

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const { tenantId, userId } = requireManagerPage();
  const db = scopedDb();
  const activeTab = searchParams.tab && TABS.includes(searchParams.tab) ? searchParams.tab : "barberia";

  const [tenant, services, usersList, barbers, subscription, whatsappUsed] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    db.service.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        barber: { select: { id: true, commissionRate: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.barber.findMany({
      where: { active: true },
      select: {
        id: true,
        user: { select: { name: true } },
        schedule: { select: { weekday: true, startMin: true, endMin: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.subscription.findUnique({ where: { tenantId } }),
    whatsappUsageThisMonth(tenantId),
  ]);

  if (!tenant) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const bookingUrl = `${appUrl}/reservar/${tenant.slug}`;

  return (
    <div className="container max-w-5xl py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Datos de tu barbería, servicios y equipo.
        </p>
      </header>

      <UrlTabs defaultValue={activeTab}>
        <TabsList className="flex w-full max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="barberia">Barbería</TabsTrigger>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
          <TabsTrigger value="horarios">Horarios</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="barberia" className="mt-6">
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Información general
            </h2>
            <TenantSettingsForm tenant={tenant} />
          </Card>

          <Card className="mt-6 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Link de reservas
            </h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              Comparte este enlace con tus clientes (Instagram, WhatsApp, Google) para que reserven
              hora solos, sin llamar.
              {!tenant.bookingEnabled && (
                <span className="text-destructive"> Las reservas online están desactivadas.</span>
              )}
            </p>
            <BookingLinkCard url={bookingUrl} />
          </Card>
        </TabsContent>

        <TabsContent value="servicios" className="mt-6">
          <Card className="overflow-hidden">
            <ServicesManager services={services} />
          </Card>
        </TabsContent>

        <TabsContent value="horarios" className="mt-6">
          <Card className="overflow-hidden">
            <div className="border-b border-border p-5">
              <h2 className="font-medium">Horarios de atención</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Define los días y horas de cada barbero. Determina las horas disponibles para reservar.
              </p>
            </div>
            <ScheduleManager
              barbers={barbers.map((b) => ({ id: b.id, name: b.user.name, schedule: b.schedule }))}
            />
          </Card>
        </TabsContent>

        <TabsContent value="pagos" className="mt-6">
          <Card className="p-6">
            <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Abono al reservar
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Cobra una seña cuando un cliente agenda online. Útil para reducir las inasistencias.
            </p>
            <PaymentSettingsForm
              tenant={{
                paymentsEnabled: tenant.paymentsEnabled,
                depositType: tenant.depositType,
                depositValue: tenant.depositValue,
              }}
            />
          </Card>
        </TabsContent>

        <TabsContent value="equipo" className="mt-6">
          <Card className="overflow-hidden">
            <TeamManager
              currentUserId={userId}
              members={usersList.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                active: u.active,
                barberId: u.barber?.id ?? null,
                commissionRate: u.barber?.commissionRate ?? null,
              }))}
            />
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="mt-6">
          <PlanManager
            currentPlan={tenant.plan}
            whatsappUsage={{ used: whatsappUsed, limit: whatsappMonthlyLimit(tenant.plan) }}
            trialEndsAt={tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : null}
            subscription={
              subscription
                ? {
                    status: subscription.status,
                    currentPeriodEnd: subscription.currentPeriodEnd
                      ? subscription.currentPeriodEnd.toISOString()
                      : null,
                    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                  }
                : null
            }
          />
        </TabsContent>
      </UrlTabs>
    </div>
  );
}
