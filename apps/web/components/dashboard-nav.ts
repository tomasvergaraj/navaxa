import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  Wallet,
  Star,
  BarChart3,
  Megaphone,
  UserCircle,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const BASE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/barberos", label: "Barberos", icon: Scissors },
  { href: "/comisiones", label: "Comisiones", icon: Wallet },
  { href: "/resenas", label: "Reseñas", icon: Star },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

/** Ítems de navegación del dashboard; agrega "Mi perfil" si el usuario es barbero. */
export function getNavItems(isBarber: boolean): NavItem[] {
  return isBarber
    ? [...BASE_NAV, { href: "/mi-perfil", label: "Mi perfil", icon: UserCircle }]
    : BASE_NAV;
}

export function isNavActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}
