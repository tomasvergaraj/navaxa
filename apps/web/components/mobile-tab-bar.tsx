"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@navaxa/ui";
import { getQuickNavItems, isNavActive } from "./dashboard-nav";
import { MobileNavDrawer } from "./mobile-nav-drawer";

/**
 * Barra flotante de acceso rápido, solo mobile. Vive fija abajo con efecto
 * glass (backdrop-blur, como el header) por encima del contenido. Muestra los
 * 4 accesos más usados del rol + "Más", que abre el drawer completo. En
 * desktop no se renderiza (md:hidden) y la barra lateral queda igual.
 */
export function MobileTabBar({
  isBarber = false,
  isManager = false,
}: {
  isBarber?: boolean;
  isManager?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = getQuickNavItems({ isBarber, isManager });

  const anyActive = items.some((i) => isNavActive(pathname, i.href));
  // "Más" resalta cuando el drawer está abierto o cuando estás en una sección
  // que no tiene acceso directo en la barra (así nunca queda sin contexto).
  const moreActive = open || !anyActive;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        <nav
          aria-label="Navegación rápida"
          className="pointer-events-auto mx-auto flex max-w-md items-stretch justify-around gap-1 rounded-2xl border border-border/60 bg-background/80 p-1.5 shadow-lg shadow-black/5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-medium leading-none text-muted-foreground focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "flex h-8 w-full max-w-[3.25rem] items-center justify-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring",
                    active && "bg-accent/15",
                  )}
                >
                  <Icon className={cn("h-5 w-5 transition-colors", active && "text-foreground")} />
                </span>
                <span className={cn("transition-colors", active && "text-foreground")}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Más opciones"
            aria-current={moreActive ? "page" : undefined}
            className="group flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-medium leading-none text-muted-foreground focus-visible:outline-none"
          >
            <span
              className={cn(
                "flex h-8 w-full max-w-[3.25rem] items-center justify-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring",
                moreActive && "bg-accent/15",
              )}
            >
              <MoreHorizontal
                className={cn("h-5 w-5 transition-colors", moreActive && "text-foreground")}
              />
            </span>
            <span className={cn("transition-colors", moreActive && "text-foreground")}>Más</span>
          </button>
        </nav>
      </div>

      <MobileNavDrawer
        open={open}
        onOpenChange={setOpen}
        isBarber={isBarber}
        isManager={isManager}
      />
    </>
  );
}
