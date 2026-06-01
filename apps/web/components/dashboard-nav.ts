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

/**
 * Ítems solo para gestión (OWNER/ADMIN): finanzas, equipo y configuración. Un
 * barbero no debe verlos (las páginas además redirigen vía requireManagerPage).
 */
const MANAGER_ONLY = new Set([
  "/barberos",
  "/comisiones",
  "/resenas",
  "/reportes",
  "/marketing",
  "/configuracion",
]);

/**
 * Ítems de navegación según rol. Gestión ve todo; barbero/staff solo Inicio,
 * Agenda y Clientes (+ "Mi perfil" si es barbero).
 */
export function getNavItems({
  isBarber = false,
  isManager = false,
}: {
  isBarber?: boolean;
  isManager?: boolean;
}): NavItem[] {
  const base = isManager ? BASE_NAV : BASE_NAV.filter((i) => !MANAGER_ONLY.has(i.href));
  return isBarber
    ? [...base, { href: "/mi-perfil", label: "Mi perfil", icon: UserCircle }]
    : base;
}

export function isNavActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}
