import Link from "next/link";
import { Button, Logo, Badge, cn } from "@navaxa/ui";
import {
  Sparkles,
  Calendar,
  Image as ImageIcon,
  TrendingUp,
  MessageSquare,
  ArrowRight,
  Users,
  ChevronDown,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Reveal } from "@/components/marketing/reveal";
import { PricingPlans } from "@/components/marketing/pricing-plans";

const FEATURES = [
  {
    icon: ImageIcon,
    title: "CRM Visual",
    desc: "Cada cliente con su historial de cortes en imágenes. Adiós al cliente que pide 'lo mismo de la otra vez' sin saber qué fue.",
  },
  {
    icon: Calendar,
    title: "Agenda inteligente",
    desc: "Disponibilidad real por barbero, servicios encadenados, drag-to-reschedule. Sin overbookings nunca más.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp automático",
    desc: "Recordatorios 24h antes, reactivación a inactivos, saludo de cumpleaños. Tu cliente vuelve sin que muevas un dedo.",
  },
  {
    icon: TrendingUp,
    title: "Comisiones",
    desc: "Cada corte completado genera la comisión del barbero automáticamente. Cierre de mes en un click.",
  },
  {
    icon: Sparkles,
    title: "IA: próximo corte",
    desc: "Analiza el historial visual, ratings y preferencias para sugerir el corte ideal del cliente. Ahorra discusiones.",
  },
  {
    icon: Users,
    title: "Multi-barbero",
    desc: "Cada barbero ve su agenda y sus clientes; recepción gestiona el local; el dueño ve todo.",
  },
];

const FAQS = [
  {
    q: "¿Necesito tarjeta de crédito para probar?",
    a: "No. Son 14 días de prueba con todas las funciones, sin ingresar ningún medio de pago. Si te sirve, eliges un plan; si no, no pasa nada.",
  },
  {
    q: "¿Funciona bien desde el celular?",
    a: "Sí. Agenda, clientes y notificaciones están pensados para usarse desde el teléfono, tanto el dueño como cada barbero.",
  },
  {
    q: "¿Puedo cobrar el abono de la reserva online?",
    a: "Sí, con Webpay. El cliente paga un abono al reservar y el resto en la barbería. Reduce las inasistencias.",
  },
  {
    q: "¿Cómo funciona el WhatsApp automático?",
    a: "Envía recordatorios 24h antes, reactiva a clientes que llevan más de un mes sin venir y saluda en cumpleaños, con un link directo para reagendar. Disponible desde el plan Pro.",
  },
  {
    q: "¿Puedo cargar mis clientes actuales?",
    a: "Sí. Puedes registrar clientes manualmente y se van enriqueciendo solos con cada visita, foto y rating.",
  },
];

export default function MarketingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link href="/" className="shrink-0">
            <Logo size={28} />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Funcionalidades</a>
            <a href="#precios" className="hover:text-foreground">Precios</a>
            <a href="#faq" className="hover:text-foreground">Preguntas</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">
                <span className="sm:hidden">Entrar</span>
                <span className="hidden sm:inline">Iniciar sesión</span>
              </Link>
            </Button>
            <Button asChild>
              <Link href="/registro">
                <span className="hidden sm:inline">Empezar gratis</span>
                <span className="sm:hidden">Empezar</span>
                <ArrowRight className="hidden h-4 w-4 sm:inline" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Glow de marca */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-20%] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-brand-brass/10 blur-3xl animate-glow-pulse motion-reduce:animate-none" />
        </div>
        <div className="container grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <Badge
              variant="outline"
              className="mb-6 gap-1.5 border-brand-brass/30 bg-brand-brass/10 text-brand-brass"
            >
              <Sparkles className="h-3 w-3" />
              Nuevo: recomendación de corte con IA
            </Badge>
            <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Cortes que cuentan
              <br />
              <span className="text-muted-foreground">una historia.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground lg:mx-0">
              El sistema operativo para barberías que recuerdan a cada cliente.
              Historial visual, agenda inteligente y reactivación automática por WhatsApp.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
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

          <Reveal delay={120} className="lg:pl-6">
            <HeroMock />
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-border">
        <div className="container py-20">
          <Reveal className="mb-12 text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
              Todo lo que tu barbería necesita
            </h2>
            <p className="mt-3 text-muted-foreground">
              Diseñado con barberos chilenos. Sin funciones que sobran.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80} className="h-full">
                <Feature icon={f.icon} title={f.title} desc={f.desc} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="border-b border-border">
        <div className="container py-20">
          <Reveal className="mb-12 text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
              Precios en pesos chilenos
            </h2>
            <p className="mt-3 text-muted-foreground">
              Sin cargos sorpresa. Cancelas cuando quieras.
            </p>
          </Reveal>

          <PricingPlans />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-border">
        <div className="container py-20">
          <Reveal className="mb-10 text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
              Preguntas frecuentes
            </h2>
          </Reveal>
          <Reveal className="mx-auto max-w-2xl divide-y divide-border rounded-xl border border-border px-5">
            {FAQS.map((f) => (
              <Faq key={f.q} q={f.q} a={f.a} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-b border-border">
        <div className="container py-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-graphite to-[#16181d] px-6 py-14 text-center text-brand-ivory">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-brand-brass/30 blur-3xl"
              />
              <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
                Tu agenda llena empieza hoy
              </h2>
              <p className="mx-auto mt-3 max-w-md text-brand-ivory/70">
                14 días gratis, sin tarjeta. Configúralo en minutos y deja que
                navaxa traiga a tus clientes de vuelta.
              </p>
              <Button
                size="lg"
                className="mt-8 bg-brand-brass text-brand-graphite hover:bg-brand-brass-soft"
                asChild
              >
                <Link href="/registro">
                  Empezar gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer>
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
    <div className="group h-full rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-brass/40 hover:shadow-lg">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-brass/10 text-brand-brass transition-colors duration-300 group-hover:bg-brand-brass group-hover:text-brand-graphite">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
    </details>
  );
}

/** Mockup estilizado del producto (agenda del día) para el hero — puro CSS. */
function HeroMock() {
  const rows = [
    { t: "10:00", n: "Tomás V.", s: "Corte clásico", c: "bg-emerald-500" },
    { t: "11:30", n: "Diego R.", s: "Corte + barba", c: "bg-blue-500" },
    { t: "13:00", n: "Matías P.", s: "Solo barba", c: "bg-violet-500" },
    { t: "16:00", n: "Joaquín L.", s: "Corte + barba", c: "bg-amber-500" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md animate-float motion-reduce:animate-none">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-brand-brass/20 blur-3xl"
      />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-brass" />
            <span className="text-sm font-medium">Agenda · Hoy</span>
          </div>
          <span className="rounded-full bg-brand-brass/15 px-2 py-0.5 text-xs font-medium text-brand-brass">
            8 citas
          </span>
        </div>
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.t} className="flex items-center gap-3 px-4 py-3">
              <span className="w-11 text-xs tabular-nums text-muted-foreground">{r.t}</span>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white",
                  r.c,
                )}
              >
                {r.n[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.n}</div>
                <div className="truncate text-xs text-muted-foreground">{r.s}</div>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
          <span className="text-xs text-muted-foreground">Ingresos hoy</span>
          <span className="text-sm font-semibold">$182.000</span>
        </div>
      </div>

      {/* Mini-card flotante: notificación WhatsApp */}
      <div className="absolute -bottom-5 -left-4 hidden rounded-xl border border-border bg-card p-3 shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <MessageSquare className="h-4 w-4" />
          </span>
          <div>
            <div className="text-xs font-medium">Recordatorio enviado</div>
            <div className="text-[10px] text-muted-foreground">a 6 clientes · WhatsApp</div>
          </div>
        </div>
      </div>
    </div>
  );
}
