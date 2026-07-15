import { ImageResponse } from "next/og";

// Imagen OG de la marca: los links se comparten sobre todo por WhatsApp y sin
// esto el preview salía sin imagen.
export const runtime = "edge";
export const alt = "navaxa — el sistema operativo para barberías";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#0A0B0E",
          color: "#FAFAF7",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 14,
              height: 56,
              backgroundColor: "#C9A961",
              borderRadius: 4,
            }}
          />
          <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: "-0.02em" }}>navaxa</div>
        </div>
        <div style={{ marginTop: 28, fontSize: 34, color: "#C9A961" }}>
          Cortes que cuentan una historia
        </div>
        <div style={{ marginTop: 16, fontSize: 26, color: "#9CA3AF", maxWidth: 900 }}>
          Agenda, clientes, comisiones y recordatorios por WhatsApp para tu barbería.
        </div>
      </div>
    ),
    size,
  );
}
