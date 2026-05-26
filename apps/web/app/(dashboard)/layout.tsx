import { redirect } from "next/navigation";
import { prisma } from "@navaxa/db";
import { auth } from "@/lib/auth";
import { AuthSessionProvider } from "@/components/session-provider";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { SubscriptionBanner } from "@/components/subscription-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [subscription, tenant, barber] = await Promise.all([
    prisma.subscription.findUnique({
      where: { tenantId: session.user.tenantId },
      select: { status: true },
    }),
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { trialEndsAt: true, plan: true },
    }),
    prisma.barber.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    }),
  ]);

  return (
    <AuthSessionProvider>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar isBarber={!!barber} />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader isBarber={!!barber} />
          <SubscriptionBanner
            status={subscription?.status ?? null}
            trialEndsAt={tenant?.trialEndsAt ?? null}
            plan={tenant?.plan ?? "FREE"}
          />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </AuthSessionProvider>
  );
}
