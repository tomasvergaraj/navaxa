"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  Megaphone,
  Wallet,
  Star,
  UserCircle,
  Settings,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Logo, cn } from "@navaxa/ui";

const baseNav = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/barberos", label: "Barberos", icon: Scissors },
  { href: "/comisiones", label: "Comisiones", icon: Wallet },
  { href: "/resenas", label: "Reseñas", icon: Star },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function DashboardSidebar({ isBarber = false }: { isBarber?: boolean }) {
  const pathname = usePathname();
  const nav = isBarber
    ? [...baseNav, { href: "/mi-perfil", label: "Mi perfil", icon: UserCircle }]
    : baseNav;
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link href="/dashboard" className="flex items-center">
          <Logo size={28} />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
