import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield, Building2, ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { requireSuperAdminPage } from "@/lib/page-guards";
import { AuthSessionProvider } from "@/components/session-provider";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // El middleware ya gateó esto, pero defensa en profundidad por si la matcher cambia.
  if (!session?.user) redirect("/login");
  // El flag del JWT puede ir hasta 7 días atrasado; el privilegio lo decide la BD.
  await requireSuperAdminPage();

  return (
    <AuthSessionProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-background md:flex-row">
        {/* Header móvil: la sidebar fija dejaba el panel inusable en celular. */}
        <header className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3 md:hidden">
          <Link href="/admin" className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-amber-600" />
            navaxa admin
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a mi tenant
          </Link>
        </header>
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-muted/30 md:flex">
          <div className="flex items-center gap-2 border-b border-border px-4 py-4">
            <Shield className="h-5 w-5 text-amber-600" />
            <div>
              <div className="text-sm font-medium">navaxa admin</div>
              <div className="text-[11px] text-muted-foreground">Plataforma</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-3 text-sm">
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded px-3 py-2 hover:bg-muted"
            >
              <Building2 className="h-4 w-4" />
              Barberías
            </Link>
          </nav>
          <Link
            href="/dashboard"
            className="m-2 flex items-center gap-2 rounded px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a mi tenant
          </Link>
        </aside>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </AuthSessionProvider>
  );
}
