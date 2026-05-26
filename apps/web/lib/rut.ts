/**
 * Utilidades para validar y formatear RUT chileno.
 */

/** Limpia un RUT dejando solo dígitos y dígito verificador (K). */
export function cleanRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Calcula el dígito verificador para un número de RUT. */
export function computeDV(rutNumber: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = rutNumber.length - 1; i >= 0; i--) {
    sum += Number(rutNumber[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const mod = 11 - (sum % 11);
  if (mod === 11) return "0";
  if (mod === 10) return "K";
  return String(mod);
}

/** Valida un RUT chileno (acepta con puntos/guión o limpio). */
export function isValidRut(rut: string): boolean {
  const clean = cleanRut(rut);
  if (clean.length < 8 || clean.length > 9) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  return computeDV(body) === dv;
}

/** Formatea un RUT como 12.345.678-9 */
export function formatRut(rut: string): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${grouped}-${dv}`;
}
