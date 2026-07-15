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
    "El sistema operativo para barberías que recuerdan a cada cliente. CRM visual, agenda, comisiones y automatizaciones por WhatsApp.",
  openGraph: {
    title: "navaxa",
    description:
      "El sistema operativo para barberías que recuerdan a cada cliente.",
    url: "https://navaxa.cl",
    siteName: "navaxa",
    locale: "es_CL",
    type: "website",
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
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
