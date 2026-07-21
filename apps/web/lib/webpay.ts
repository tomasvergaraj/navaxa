/**
 * Cliente REST de Webpay Plus (Transbank). Sin SDK, fetch directo: dos endpoints.
 *
 * Doc: https://www.transbankdevelopers.cl/referencia/webpay#webpay-plus-rest
 *
 * Ambientes:
 *   - integration: https://webpay3gint.transbank.cl (credenciales públicas o tuyas)
 *   - production:  https://webpay3g.transbank.cl (las tuyas; cobros reales)
 */

const HOST_INT = "https://webpay3gint.transbank.cl";
const HOST_PROD = "https://webpay3g.transbank.cl";

// Credenciales públicas de integración (Transbank docs). Útiles cuando no se han
// seteado WEBPAY_COMMERCE_CODE / WEBPAY_API_KEY — para test sin afiliación propia.
const PUBLIC_INT_CC = "597055555532";
const PUBLIC_INT_KEY =
  "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";

export function webpayHost(): string {
  return process.env.WEBPAY_ENV === "production" ? HOST_PROD : HOST_INT;
}

function creds(): { cc: string; key: string } {
  const cc = process.env.WEBPAY_COMMERCE_CODE || PUBLIC_INT_CC;
  const key = process.env.WEBPAY_API_KEY || PUBLIC_INT_KEY;
  // Fail-closed: en producción nunca operamos con las credenciales públicas de
  // integración (Transbank sandbox: toda tarjeta de prueba "aprueba" y no mueve
  // dinero real). Faltar WEBPAY_* en prod es un error de despliegue.
  if (
    process.env.NODE_ENV === "production" &&
    (cc === PUBLIC_INT_CC || key === PUBLIC_INT_KEY || process.env.WEBPAY_ENV !== "production")
  ) {
    throw new Error("Webpay mal configurado en producción (faltan WEBPAY_COMMERCE_CODE/API_KEY/ENV reales)");
  }
  return { cc, key };
}

export interface WebpayCreated {
  token: string;
  url: string;
}

export interface WebpayCommitted {
  vci: string;
  amount: number;
  status: string;
  buy_order: string;
  session_id: string;
  card_detail?: { card_number: string };
  authorization_code?: string;
  payment_type_code?: string;
  response_code: number;
  installments_number?: number;
  transaction_date?: string;
}

export async function createWebpayTransaction(input: {
  buy_order: string;
  session_id: string;
  amount: number;
  return_url: string;
}): Promise<WebpayCreated> {
  // Webpay Plus exige montos enteros en CLP (sin decimales) y caracteres ASCII.
  const { cc, key } = creds();
  const res = await fetch(`${webpayHost()}/rswebpaytransaction/api/webpay/v1.2/transactions`, {
    method: "POST",
    headers: {
      "Tbk-Api-Key-Id": cc,
      "Tbk-Api-Key-Secret": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Webpay create ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as WebpayCreated;
}

export async function commitWebpayTransaction(token: string): Promise<WebpayCommitted> {
  const { cc, key } = creds();
  const res = await fetch(
    `${webpayHost()}/rswebpaytransaction/api/webpay/v1.2/transactions/${token}`,
    {
      method: "PUT",
      headers: {
        "Tbk-Api-Key-Id": cc,
        "Tbk-Api-Key-Secret": key,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Webpay commit ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as WebpayCommitted;
}

/**
 * URL del formulario al que el browser hace POST con token_ws para iniciar el
 * checkout. Action del form en /pagar/[token] y /facturar/[token].
 */
export function webpayFormUrl(): string {
  return `${webpayHost()}/webpayserver/initTransaction`;
}
