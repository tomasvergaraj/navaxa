"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { Logo, cn, Dialog, SheetContent, DialogClose, DialogTitle } from "@navaxa/ui";
import { getNavItems, isNavActive } from "./dashboard-nav";

/**
 * Drawer de navegación lateral (mobile). Controlado desde afuera para que lo
 * abran tanto la hamburguesa del header como el botón "Más" de la barra
 * inferior, compartiendo el mismo estado y contenido.
 */
export function MobileNavDrawer({
  open,
  onOpenChange,
  isBarber = false,
  isManager = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isBarber?: boolean;
  isManager?: boolean;
}) {
  const pathname = usePathname();
  const nav = getNavItems({ isBarber, isManager });

  // Cierra el menú al navegar.
  useEffect(() => {
    onOpenChange(false);
    // Solo al cambiar de ruta; onOpenChange es estable (setState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" aria-describedby={undefined} className="p-0">
        <DialogTitle className="sr-only">Menú de navegación</DialogTitle>
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Link href="/dashboard" aria-label="Inicio">
            <Logo size={26} />
          </Link>
          <DialogClose
            aria-label="Cerrar menú"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </DialogClose>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/15 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </SheetContent>
    </Dialog>
  );
}
