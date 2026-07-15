"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  Logo,
  cn,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@navaxa/ui";
import { getNavItems, isNavActive } from "./dashboard-nav";

export function MobileNav({
  isBarber = false,
  isManager = false,
}: {
  isBarber?: boolean;
  isManager?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = getNavItems({ isBarber, isManager });

  // Cierra el menú al navegar.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      {/* Dialog de Radix en vez del portal artesanal: focus trap, Escape y
          aria-modal vienen gratis (el drawer anterior dejaba el foco detrás
          del overlay y no cerraba con Esc). */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            aria-label="Abrir menú"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        </DialogTrigger>
        <DialogContent className="left-0 top-0 flex h-full w-64 max-w-[16rem] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 border-r border-border bg-card p-0 sm:rounded-none">
          <DialogTitle className="sr-only">Menú de navegación</DialogTitle>
          <div className="flex h-16 items-center border-b border-border px-5">
            <Logo size={26} />
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
          <div className="border-t border-border p-3">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
