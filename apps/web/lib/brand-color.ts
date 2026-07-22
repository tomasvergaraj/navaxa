import type { CSSProperties } from "react";

/** Valida un color hex #RRGGBB (lo que emite <input type="color">). */
export function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** hex #RRGGBB → triple HSL "H S% L%" (el formato que usan los tokens Tailwind). */
export function hexToHslTriple(hex: string): string {
  const [r, g, b] = toRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Luminancia relativa WCAG de un canal 0-1. */
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Texto legible (AA) sobre el color de marca: elige entre casi-negro y
 * casi-blanco el de mayor contraste. Devuelve el triple HSL del token.
 */
export function readableForegroundTriple(hex: string): string {
  const bg = luminance(hex);
  const contrastWhite = (1.0 + 0.05) / (bg + 0.05);
  const contrastBlack = (bg + 0.05) / (0.0 + 0.05);
  // Casi-blanco (60 6% 98%) vs casi-negro (220 14% 6%) del sistema.
  return contrastWhite >= contrastBlack ? "60 6% 98%" : "220 14% 6%";
}

/**
 * Variables CSS para pintar los CTA del storefront con los colores del tenant.
 * Se aplican en un ancestro del árbol público (inline style): sobreescriben
 * `--primary`/`--accent` solo ahí, sin tocar el dashboard.
 *
 * `accentHex` es el segundo color de marca: tiñe los realces (chips de estado,
 * opción seleccionada del wizard, tile del logo, degradado de portada). No toca
 * `--accent-ink` a propósito: ese token necesita valores distintos en claro y
 * oscuro y un style inline no puede llevar media query, así que las estrellas y
 * el resto del texto sobre acento siguen con el dorado del sistema (que ya es
 * AA en ambos temas).
 *
 * Devuelve undefined si no hay ningún color válido (usa la paleta navaxa).
 */
export function brandStyle(
  hex: string | null | undefined,
  accentHex?: string | null,
): CSSProperties | undefined {
  const primary = hex && isHexColor(hex) ? hex : null;
  const accent = accentHex && isHexColor(accentHex) ? accentHex : null;
  if (!primary && !accent) return undefined;
  return {
    ...(primary
      ? {
          ["--primary" as string]: hexToHslTriple(primary),
          ["--primary-foreground" as string]: readableForegroundTriple(primary),
          ["--ring" as string]: hexToHslTriple(primary),
        }
      : {}),
    ...(accent
      ? {
          ["--accent" as string]: hexToHslTriple(accent),
          ["--accent-foreground" as string]: readableForegroundTriple(accent),
        }
      : {}),
  } as CSSProperties;
}
