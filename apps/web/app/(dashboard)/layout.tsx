import { redirect } from "next/navigation";
import { prisma } from "@navaxa/db";
import { auth } from "@/lib/auth";
import { AuthSessionProvider } from "@/components/session-provider";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { isManagerRole } from "@/lib/page-guards";

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

  const isManager = isManagerRole((session.user.role ?? "STAFF") as "OWNER" | "ADMIN" | "BARBER" | "STAFF");

  return (
    <AuthSessionProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <DashboardSidebar isBarber={!!barber} isManager={isManager} />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader isBarber={!!barber} isManager={isManager} />
          <SubscriptionBanner
            status={subscription?.status ?? null}
            trialEndsAt={tenant?.trialEndsAt ?? null}
            plan={tenant?.plan ?? "FREE"}
          />
          <main
            id="main"
            className="min-h-0 flex-1 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0"
          >
            {children}
          </main>
        </div>
        <MobileTabBar isBarber={!!barber} isManager={isManager} />
      </div>
    </AuthSessionProvider>
  );
}
