import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button, Logo } from "@navaxa/ui";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { ThemeToggle } from "@/components/theme-toggle";

// Página propia (antes era un redirect a /#precios): URL indexable para
// búsquedas de precios + metadata dedicada.
export const metadata = {
  title: "Precios",
  description:
    "Planes de navaxa para barberías en Chile: prueba gratis 14 días, planes desde el gratuito con agenda online, y PRO/Enterprise con recordatorios por WhatsApp.",
};

const PAYMENT_FAQS = [
  {
    q: "¿Qué pasa cuando termina la prueba de 14 días?",
    a: "Puedes seguir en el plan Gratis (1 barbero, hasta 50 clientes, agenda básica) o elegir un plan pagado. No hay cobros automáticos sorpresa.",
  },
  {
    q: "¿Cómo se paga?",
    a: "Con Webpay (débito o crédito). El plan anual equivale a 10 meses: 2 meses gratis.",
  },
  {
    q: "¿Puedo cambiar de plan después?",
    a: "Sí, en cualquier momento desde Configuración → Plan. El cambio aplica de inmediato.",
  },
];

export default function PreciosPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link href="/" className="shrink-0">
            <Logo size={28} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild>
              <Link href="/registro">
                Empezar gratis
                <ArrowRight className="hidden h-4 w-4 sm:inline" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-14">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
        <div className="mb-10 text-center">
          <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
            Precios simples, en pesos chilenos
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            14 días de prueba con todo incluido, sin tarjeta. Después eliges el plan que le queda a
            tu barbería.
          </p>
        </div>

        <PricingPlans />

        <section className="mx-auto mt-16 max-w-2xl">
          <h2 className="mb-4 font-display text-xl font-medium">Preguntas sobre el pago</h2>
          <div className="space-y-3">
            {PAYMENT_FAQS.map((f) => (
              <details key={f.q} className="group rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer text-sm font-medium">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Reservas y gestión con <span className="font-medium text-foreground">navaxa</span>
      </footer>
    </div>
  );
}
