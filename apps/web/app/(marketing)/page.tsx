import Link from "next/link";
import {
  Button,
  Logo,
  Card,
  Badge,
} from "@navaxa/ui";
import {
  Sparkles,
  Calendar,
  Image as ImageIcon,
  TrendingUp,
  MessageSquare,
  Check,
  ArrowRight,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PLANS } from "@navaxa/config";
import { formatCLP } from "@/lib/format";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo size={28} />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Funcionalidades</a>
            <a href="#precios" className="hover:text-foreground">Precios</a>
            <Link href="/legal" className="hover:text-foreground">Legal</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/registro">
                Empezar gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="container py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 gap-1.5">
              <Sparkles className="h-3 w-3" />
              Nuevo: recomendación de corte con IA
            </Badge>
            <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">
              Cortes que cuentan
              <br />
              <span className="text-muted-foreground">una historia.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground">
              El sistema operativo para barberías que recuerdan a cada cliente.
              Historial visual, agenda inteligente y reactivación automática por WhatsApp.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/registro">
                  Empezar gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">Ver cómo funciona</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              14 días de prueba · Sin tarjeta de crédito · En español chileno
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-border">
        <div className="container py-20">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
              Todo lo que tu barbería necesita
            </h2>
            <p className="mt-3 text-muted-foreground">
              Diseñado con barberos chilenos. Sin funciones que sobran.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={ImageIcon}
              title="CRM Visual"
              desc="Cada cliente con su historial de cortes en imágenes. Adiós al cliente que pide 'lo mismo de la otra vez' sin saber qué fue."
            />
            <Feature
              icon={Calendar}
              title="Agenda inteligente"
              desc="Disponibilidad real por barbero, servicios encadenados, drag-to-reschedule. Sin overbookings nunca más."
            />
            <Feature
              icon={MessageSquare}
              title="WhatsApp automático"
              desc="Recordatorios 24h antes, reactivación a inactivos, saludo de cumpleaños. Tu cliente vuelve sin que muevas un dedo."
            />
            <Feature
              icon={TrendingUp}
              title="Comisiones"
              desc="Cada corte completado genera la comisión del barbero automáticamente. Cierre de mes en un click."
            />
            <Feature
              icon={Sparkles}
              title="IA: próximo corte"
              desc="Analiza el historial visual, ratings y preferencias para sugerir el corte ideal del cliente. Ahorra discusiones."
            />
            <Feature
              icon={ImageIcon}
              title="Multi-barbero"
              desc="Cada barbero ve su agenda, sus comisiones y sus clientes. El dueño ve todo."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="border-b border-border">
        <div className="container py-20">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
              Precios en pesos chilenos
            </h2>
            <p className="mt-3 text-muted-foreground">
              Sin cargos sorpresa. Cancelas cuando quieras.
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
            {[PLANS.STARTER, PLANS.PRO, PLANS.ENTERPRISE].map((plan) => (
              <Card
                key={plan.id}
                className={
                  ("popular" in plan && plan.popular)
                    ? "relative border-2 border-brand-graphite p-6 dark:border-brand-ivory"
                    : "relative p-6"
                }
              >
                {"popular" in plan && plan.popular && (
                  <Badge variant="brand" className="absolute -top-2 right-6">
                    Más popular
                  </Badge>
                )}
                <h3 className="font-display text-lg font-medium">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-medium tracking-tight">
                    {formatCLP(plan.priceClp)}
                  </span>
                  <span className="text-sm text-muted-foreground">/mes</span>
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={("popular" in plan && plan.popular) ? "default" : "outline"}
                  className="mt-6 w-full"
                  asChild
                >
                  <Link href="/registro">Empezar</Link>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-0">
        <div className="container py-12">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <Logo size={24} />
            <p className="text-sm text-muted-foreground">
              © 2026 navaxa · Hecho en Chile.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/legal" className="hover:text-foreground">Términos</Link>
              <Link href="/legal" className="hover:text-foreground">Privacidad</Link>
              <a href="mailto:contacto@navaxa.cl" className="hover:text-foreground">
                contacto@navaxa.cl
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-border p-6">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-accent/15 text-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
