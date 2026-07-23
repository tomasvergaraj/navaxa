import "./globals.css";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata, Viewport } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Display editorial de la marca: hasta ahora --font-display no se cargaba y
// todos los `font-display` caían a Inter en silencio.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://navaxa.cl"),
  title: {
    default: "navaxa — Cortes que cuentan una historia",
    template: "%s · navaxa",
  },
  description:
    "El sistema para barberías que recuerdan a cada cliente. Agenda online, historial de cortes con fotos, comisiones y recordatorios por WhatsApp.",
  openGraph: {
    title: "navaxa",
    description:
      "El sistema operativo para barberías que recuerdan a cada cliente.",
    url: "https://navaxa.cl",
    siteName: "navaxa",
    locale: "es_CL",
    type: "website",
  },
  // Twitter/X cae a og:image cuando no hay twitter:image, pero sin la card
  // declarada el preview sale como link pelado. `summary_large_image` usa la
  // OG de 1200x630 de app/opengraph-image.tsx.
  twitter: {
    card: "summary_large_image",
    title: "navaxa",
    description:
      "El sistema operativo para barberías que recuerdan a cada cliente.",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0B0E" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CL" suppressHydrationWarning className="scroll-smooth">
      <body className={`${inter.variable} ${fraunces.variable} font-sans antialiased`}>
        {/* Skip-link: visible solo con foco de teclado. Las páginas marcan su
            contenido con id="main". */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg focus:ring-2 focus:ring-ring"
        >
          Saltar al contenido
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {/* Anclado bajo el header sticky (h-16 = 64px + 12px de aire). Sin
              esto, sonner deja los toasts a top:32px en desktop y top:20px en
              mobile (media query max-width:600px) — ambos caen ENCIMA del
              header (hamburguesa izq. / avatar der.). El `top` inline gana sobre
              esa media query por especificidad. Arriba también esquiva la barra
              flotante inferior de mobile. */}
          <Toaster position="top-right" style={{ top: "4.75rem" }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
