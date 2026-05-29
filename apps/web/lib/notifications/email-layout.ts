/**
 * Envoltorio HTML de marca para los correos transaccionales (navaxa).
 *
 * Los templates ([templates.ts]) producen texto plano; acá lo envolvemos en un
 * layout con el estilo del sistema (crema #FAFAF8, tinta #0D0F13, acento dorado
 * #C1A86C — los mismos tokens de globals.css). Estilos INLINE y layout con
 * tablas para compatibilidad con clientes de correo (Gmail/Outlook). No se usa
 * el logo SVG porque muchos clientes no lo renderizan: va el wordmark en texto.
 */

const C = {
  bg: "#FAFAF8", // --background
  card: "#FFFFFF",
  border: "#ECECE6",
  ink: "#0D0F13", // --foreground
  body: "#3A3D42",
  muted: "#9A9A93",
  accent: "#C1A86C", // --accent (gold)
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texto plano → HTML: escapa, convierte URLs en links y saltos de línea en <br>. */
function bodyToHtml(body: string): string {
  const escaped = escapeHtml(body);
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" style="color:${C.accent};text-decoration:underline;">${url}</a>`,
  );
  return linked.replace(/\n/g, "<br/>");
}

export function renderEmailHtml(subject: string, body: string): string {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${C.card};border:1px solid ${C.border};border-radius:12px;">
        <tr><td style="padding:24px 28px 0;">
          <div style="font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${C.accent};">navaxa</div>
        </td></tr>
        <tr><td style="padding:14px 28px 0;">
          <h1 style="margin:0;font-size:20px;line-height:1.3;color:${C.ink};font-weight:600;">${escapeHtml(subject)}</h1>
        </td></tr>
        <tr><td style="padding:10px 28px 26px;">
          <div style="font-size:15px;line-height:1.6;color:${C.body};">${bodyToHtml(body)}</div>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid ${C.border};">
          <p style="margin:0;font-size:12px;line-height:1.5;color:${C.muted};">Mensaje automático. Si necesitas ayuda, responde este correo.</p>
        </td></tr>
      </table>
      <p style="max-width:480px;margin:14px auto 0;font-size:11px;color:${C.muted};text-align:center;">navaxa.cl</p>
    </td></tr>
  </table>
</body>
</html>`;
}
