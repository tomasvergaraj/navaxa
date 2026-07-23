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
  Banknote,
  Package,
  Gift,
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
  { href: "/caja", label: "Caja", icon: Banknote },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/giftcards", label: "Giftcards", icon: Gift },
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
  "/productos",
  "/giftcards",
  "/barberos",
  "/comisiones",
  "/resenas",
  "/reportes",
  "/marketing",
  "/configuracion",
]);

// La caja la operan gestión y recepción (STAFF); un barbero no vende productos.
const BARBER_HIDDEN = new Set(["/caja"]);

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
    ? [
        ...base.filter((i) => !BARBER_HIDDEN.has(i.href)),
        { href: "/mi-perfil", label: "Mi perfil", icon: UserCircle },
      ]
    : base;
}

export function isNavActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

// Orden de preferencia para la barra flotante de acceso rápido en mobile.
const QUICK_HREFS = ["/dashboard", "/agenda", "/caja", "/clientes"];

/**
 * Los 4 accesos directos de la barra inferior (mobile). Toma los más usados
 * que el rol puede ver; si a un barbero le falta la Caja, se rellena con
 * "Mi perfil" para no dejar el hueco. La barra agrega "Más" aparte.
 */
export function getQuickNavItems(opts: {
  isBarber?: boolean;
  isManager?: boolean;
}): NavItem[] {
  const all = getNavItems(opts);
  const byHref = new Map(all.map((i) => [i.href, i]));
  const picks = QUICK_HREFS.map((h) => byHref.get(h)).filter(Boolean) as NavItem[];
  if (picks.length < 4) {
    const perfil = all.find((i) => i.href === "/mi-perfil");
    if (perfil && !picks.includes(perfil)) picks.push(perfil);
  }
  return picks.slice(0, 4);
}
