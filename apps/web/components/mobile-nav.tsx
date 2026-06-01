"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Logo, cn } from "@navaxa/ui";
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
  const [mounted, setMounted] = useState(false);
  const nav = getNavItems({ isBarber, isManager });

  useEffect(() => setMounted(true), []);

  // Cierra el menú al navegar.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloquea el scroll del fondo mientras el drawer está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* El drawer va por portal a <body>: el header tiene backdrop-blur, que crea
          un containing block y rompería el `fixed` si quedara dentro del header. */}
      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-card shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <Logo size={26} />
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
            </div>
            <div className="border-t border-border p-3">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </nav>
          </div>,
          document.body,
        )}
    </div>
  );
}
