/**
 * Cliente REST de Oneclick Mall (Transbank). Sin SDK, fetch directo — mismo
 * criterio que webpay.ts (el SDK oficial arrastra axios y no aporta nada sobre
 * cuatro llamadas HTTP).
 *
 * Doc: https://www.transbankdevelopers.cl/referencia/oneclick
 * Paths y headers verificados contra transbank-sdk@6.1.1.
 *
 * Para qué: la renovación de la suscripción SaaS. El dueño inscribe su tarjeta
 * una vez (flujo con redirect a Transbank) y nos queda un `tbk_user` con el que
 * podemos cobrar sin que esté presente (`processSubscriptionRenewals`).
 *
 * Oneclick es "Mall" siempre: hay un código de comercio padre (el mall) que
 * autentica, y al menos un código hijo (la tienda) que recibe el cobro. Aunque
 * navaxa sea una sola tienda, la API exige los dos.
 */

const HOST_INT = "https://webpay3gint.transbank.cl";
const HOST_PROD = "https://webpay3g.transbank.cl";
const BASE = "/rswebpaytransaction/api/oneclick/v1.2";

// Credenciales públicas de integración (Transbank docs / SDK). Solo sirven en el
// sandbox: ninguna tarjeta mueve dinero real.
const PUBLIC_INT_MALL_CC = "597055555541";
const PUBLIC_INT_CHILD_CC = "597055555542";
const PUBLIC_INT_KEY =
  "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";

/** Límites de la API (ApiConstants del SDK). Exceder = 422 de Transbank. */
export const ONECLICK_LIMITS = {
  username: 40,
  buyOrder: 26,
  tbkUser: 40,
  email: 100,
} as const;

function oneclickHost(): string {
  return process.env.WEBPAY_ENV === "production" ? HOST_PROD : HOST_INT;
}

/** Ver el comentario homónimo en webpay.ts: escotilla solo para el sandbox. */
function integrationAllowed(): boolean {
  return (
    process.env.WEBPAY_ALLOW_INTEGRATION === "1" && process.env.WEBPAY_ENV !== "production"
  );
}

interface OneclickCreds {
  mallCc: string;
  childCc: string;
  key: string;
}

function creds(): OneclickCreds {
  const mallCc = process.env.ONECLICK_MALL_COMMERCE_CODE || PUBLIC_INT_MALL_CC;
  const childCc = process.env.ONECLICK_CHILD_COMMERCE_CODE || PUBLIC_INT_CHILD_CC;
  const key = process.env.ONECLICK_API_KEY || PUBLIC_INT_KEY;
  // Fail-closed idéntico a Webpay Plus: en producción nunca operamos con las
  // credenciales públicas (toda tarjeta "aprueba" y no se cobra nada de verdad,
  // así que una renovación fallida pasaría por exitosa y regalaríamos el plan).
  if (
    process.env.NODE_ENV === "production" &&
    !integrationAllowed() &&
    (mallCc === PUBLIC_INT_MALL_CC ||
      childCc === PUBLIC_INT_CHILD_CC ||
      key === PUBLIC_INT_KEY ||
      process.env.WEBPAY_ENV !== "production")
  ) {
    throw new Error(
      "Oneclick mal configurado en producción (faltan ONECLICK_MALL_COMMERCE_CODE/ONECLICK_CHILD_COMMERCE_CODE/ONECLICK_API_KEY reales o WEBPAY_ENV)",
    );
  }
  return { mallCc, childCc, key };
}

/** true si Oneclick está utilizable (env seteado, o sandbox permitido). */
export function oneclickEnabled(): boolean {
  try {
    creds();
    return true;
  } catch {
    return false;
  }
}

/** Código de comercio hijo: el que recibe el cobro y el que se usa para anular. */
export function oneclickChildCommerceCode(): string {
  return creds().childCc;
}

async function call<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const { mallCc, key } = creds();
  const res = await fetch(`${oneclickHost()}${BASE}${path}`, {
    method,
    headers: {
      "Tbk-Api-Key-Id": mallCc,
      "Tbk-Api-Key-Secret": key,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Oneclick ${method} ${path} → ${res.status}: ${await res.text()}`);
  }
  // DELETE de inscripción responde 204 sin cuerpo.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Inscripción ----

export interface OneclickInscriptionStarted {
  token: string;
  url_webpay: string;
}

/**
 * Paso 1: pide a Transbank una inscripción. Devuelve el token y la URL del
 * formulario; el browser debe hacer POST a `url_webpay` con el campo
 * `TBK_TOKEN` = token (ver oneclick-inscription-form.tsx).
 */
export function startOneclickInscription(input: {
  username: string;
  email: string;
  responseUrl: string;
}): Promise<OneclickInscriptionStarted> {
  return call<OneclickInscriptionStarted>("/inscriptions", "POST", {
    username: input.username.slice(0, ONECLICK_LIMITS.username),
    email: input.email.slice(0, ONECLICK_LIMITS.email),
    response_url: input.responseUrl,
  });
}

export interface OneclickInscriptionFinished {
  response_code: number;
  tbk_user?: string;
  authorization_code?: string;
  card_type?: string;
  card_number?: string; // enmascarado por Transbank: "XXXXXXXXXXXX6623"
}

/**
 * Paso 2: confirma la inscripción con el TBK_TOKEN que Transbank devuelve al
 * response_url. `response_code === 0` es el único caso exitoso; solo entonces
 * viene `tbk_user`, que es la credencial con la que cobramos después.
 */
export function finishOneclickInscription(token: string): Promise<OneclickInscriptionFinished> {
  return call<OneclickInscriptionFinished>(`/inscriptions/${encodeURIComponent(token)}`, "PUT");
}

/** Borra la inscripción en Transbank. Idempotente desde nuestro lado. */
export function deleteOneclickInscription(input: {
  tbkUser: string;
  username: string;
}): Promise<void> {
  return call<void>("/inscriptions", "DELETE", {
    tbk_user: input.tbkUser,
    username: input.username,
  });
}

// ---- Cobro ----

export interface OneclickAuthorizeDetail {
  amount: number;
  status: string;
  authorization_code?: string;
  payment_type_code?: string;
  response_code: number;
  installments_number?: number;
  commerce_code: string;
  buy_order: string;
}

export interface OneclickAuthorized {
  buy_order: string;
  session_id?: string;
  card_detail?: { card_number: string };
  accounting_date?: string;
  transaction_date?: string;
  details: OneclickAuthorizeDetail[];
}

/**
 * Cobra `amount` CLP a la tarjeta inscrita. Sin cliente presente: esta llamada
 * es la que mueve el dinero, no hay commit posterior (a diferencia de Webpay
 * Plus). El resultado real está en `details[0].response_code === 0`.
 *
 * `buyOrder` debe ser único en Transbank — reintentar con el mismo lo rechaza.
 */
export function authorizeOneclickCharge(input: {
  username: string;
  tbkUser: string;
  buyOrder: string;
  amount: number;
}): Promise<OneclickAuthorized> {
  const { childCc } = creds();
  const buyOrder = input.buyOrder.slice(0, ONECLICK_LIMITS.buyOrder);
  return call<OneclickAuthorized>("/transactions", "POST", {
    username: input.username.slice(0, ONECLICK_LIMITS.username),
    tbk_user: input.tbkUser,
    buy_order: buyOrder,
    details: [
      {
        commerce_code: childCc,
        buy_order: buyOrder,
        amount: input.amount,
        installments_number: 1,
      },
    ],
  });
}

/**
 * Estado de un cobro por su buy_order. Se usa para reconciliar: si el proceso
 * se cae entre el POST y el guardado, esto dice si el dinero se movió o no
 * (sin esto, reintentar podría cobrar dos veces).
 *
 * Devuelve null si Transbank no conoce el buy_order (nunca llegó a cobrarse).
 */
export async function getOneclickChargeStatus(
  buyOrder: string,
): Promise<OneclickAuthorized | null> {
  try {
    return await call<OneclickAuthorized>(
      `/transactions/${encodeURIComponent(buyOrder)}`,
      "GET",
    );
  } catch (e) {
    // 404/422 = transacción inexistente. Cualquier otro error se propaga: no
    // podemos asumir "no cobrada" ante un fallo de red.
    const msg = (e as Error).message;
    if (/→ 404|→ 422/.test(msg)) return null;
    throw e;
  }
}

/** Anula/reversa un cobro (ventana corta = reversa, después = anulación). */
export function refundOneclickCharge(input: {
  buyOrder: string;
  childBuyOrder: string;
  amount: number;
}): Promise<unknown> {
  const { childCc } = creds();
  return call(`/transactions/${encodeURIComponent(input.buyOrder)}/refunds`, "POST", {
    detail_buy_order: input.childBuyOrder,
    commerce_code: childCc,
    amount: input.amount,
  });
}
