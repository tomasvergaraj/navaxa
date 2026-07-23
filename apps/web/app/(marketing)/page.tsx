import Link from "next/link";
import Image from "next/image";
import { Button, Logo, cn } from "@navaxa/ui";
import {
  Sparkles,
  Calendar,
  Image as ImageIcon,
  TrendingUp,
  MessageSquare,
  ArrowRight,
  Users,
  ChevronDown,
  Star,
  Check,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Reveal } from "@/components/marketing/reveal";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { LandingHeader } from "@/components/marketing/landing-header";

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
    a: "Sí. Puedes registrar clientes manualmente y su ficha se va completando sola con cada visita, foto y evaluación.",
  },
];

// JSON-LD: habilita rich results (FAQ) y describe la app con sus precios.
function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "navaxa",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Software de gestión para barberías: agenda, clientes, comisiones y recordatorios por WhatsApp.",
        url: "https://navaxa.cl",
        offers: { "@type": "Offer", price: "0", priceCurrency: "CLP", description: "Plan gratis y 14 días de prueba" },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

export default function MarketingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()).replace(/</g, "\\u003c") }}
      />
      {/* Nav: transparente sobre el hero, fondo + hairline solo al scrollear. */}
      <LandingHeader>
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link href="/" className="shrink-0">
            <Logo size={28} />
          </Link>
          <nav className="hidden items-center gap-3 text-sm text-muted-foreground sm:flex sm:gap-4 md:gap-8">
            <a href="#features" className="hidden transition-colors hover:text-foreground sm:inline">
              <span className="md:hidden">Funciones</span>
              <span className="hidden md:inline">Funcionalidades</span>
            </a>
            <a href="#precios" className="transition-colors hover:text-foreground">Precios</a>
            <a href="#faq" className="hidden transition-colors hover:text-foreground sm:inline">
              <span className="md:hidden">FAQ</span>
              <span className="hidden md:inline">Preguntas</span>
            </a>
            {/* Entrada al directorio para clientes finales (el resto del landing es B2B). */}
            <Link href="/reservar" className="font-medium text-foreground hover:underline">
              Reservar hora
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Button variant="ghost" className="rounded-full" asChild>
              <Link href="/login">
                <span className="sm:hidden">Entrar</span>
                <span className="hidden sm:inline">Iniciar sesión</span>
              </Link>
            </Button>
            <Button className="rounded-full" asChild>
              <Link href="/registro">
                <span className="hidden sm:inline">Empezar gratis</span>
                <span className="sm:hidden">Empezar</span>
                <ArrowRight className="hidden h-4 w-4 sm:inline" />
              </Link>
            </Button>
          </div>
        </div>
      </LandingHeader>
      <main id="main">

      {/* Hero: titular editorial centrado + par de pills + artifacts flotantes. */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-24%] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand-brass/[0.07] blur-3xl" />
        </div>
        <div className="container flex flex-col items-center pb-20 pt-16 text-center md:pb-28 md:pt-24">
          <span className="inline-flex animate-rise items-center gap-1.5 rounded-full border border-brand-brass/30 bg-brand-brass/10 px-3 py-1 text-xs font-medium text-accent-ink">
            <Sparkles className="h-3 w-3" />
            Nuevo: recomendación de corte con IA
          </span>
          <h1
            className="mt-8 max-w-3xl animate-rise-blur text-balance font-display text-[2.75rem] font-normal leading-[1.06] tracking-[-0.02em] sm:text-6xl md:text-[4.75rem]"
            style={{ animationDelay: "90ms" }}
          >
            Cortes que cuentan{" "}
            <span className="text-muted-foreground">una historia.</span>
          </h1>
          <p
            className="mt-6 max-w-xl animate-rise text-balance text-lg text-muted-foreground"
            style={{ animationDelay: "220ms" }}
          >
            El sistema para barberías que recuerdan a cada cliente.
            Fotos de cada corte, agenda al día y mensajes de WhatsApp automáticos
            que hacen volver a tus clientes.
          </p>
          <div
            className="mt-9 flex animate-rise flex-col items-center gap-3 sm:flex-row"
            style={{ animationDelay: "320ms" }}
          >
            <Button size="lg" className="rounded-full px-7" asChild>
              <Link href="/registro">
                Empezar gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-foreground/25 bg-transparent px-7 hover:border-foreground/50 hover:bg-transparent hover:text-foreground"
              asChild
            >
              <a href="#features">Ver cómo funciona</a>
            </Button>
          </div>
          <p className="mt-5 animate-rise text-xs text-muted-foreground" style={{ animationDelay: "420ms" }}>
            14 días de prueba · Sin tarjeta de crédito · En español chileno
          </p>

          <div className="mt-16 w-full animate-settle md:mt-20" style={{ animationDelay: "460ms" }}>
            <HeroArtifacts />
          </div>
        </div>
      </section>

      {/* Features: bento editorial sobre banda alterna, cards planas radius 24. */}
      <section id="features" className="scroll-mt-20 bg-secondary/50 dark:bg-secondary/30">
        <div className="container py-24 md:py-28">
          <Reveal className="mb-14 text-center">
            <h2 className="text-balance font-display text-3xl font-normal tracking-[-0.015em] md:text-5xl">
              Todo lo que tu barbería necesita
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Diseñado con barberos chilenos. Sin funciones que sobran.
            </p>
          </Reveal>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Ficha del cliente: la feature insignia, con su artifact de historial. */}
            <Reveal variant="scale" className="lg:col-span-7">
              <FeatureCard
                icon={ImageIcon}
                title="Ficha visual del cliente"
                desc="Cada cliente con sus cortes en fotos. Se acabó el «córtame lo mismo de la otra vez» sin saber qué fue."
              >
                <HistoryMock />
              </FeatureCard>
            </Reveal>

            {/* WhatsApp: LA card acento (una sola por página, tinte brass). */}
            <Reveal variant="scale" delay={90} className="lg:col-span-5">
              <FeatureCard
                icon={MessageSquare}
                title="WhatsApp automático"
                desc="Recordatorio 24h antes de la hora, mensaje a los que llevan tiempo sin venir y saludo de cumpleaños. Tu cliente vuelve sin que muevas un dedo."
                accent
              >
                <ChatMock />
              </FeatureCard>
            </Reveal>

            <Reveal variant="scale" className="lg:col-span-5">
              <FeatureCard
                icon={Calendar}
                title="Agenda inteligente"
                desc="Las horas libres de cada barbero siempre al día, y las citas se mueven arrastrándolas. Nunca más dos clientes a la misma hora."
              >
                <AgendaMock />
              </FeatureCard>
            </Reveal>

            <Reveal variant="scale" delay={90} className="lg:col-span-7">
              <FeatureCard
                icon={Sparkles}
                title="IA: próximo corte"
                desc="Mira las fotos, evaluaciones y gustos del cliente y sugiere el corte ideal. Ahorra discusiones."
              >
                <AiMock />
              </FeatureCard>
            </Reveal>

            <Reveal variant="scale" className="lg:col-span-6">
              <FeatureCard
                icon={TrendingUp}
                title="Comisiones"
                desc="Cada corte completado genera la comisión del barbero automáticamente. Cierre de mes en un click."
              />
            </Reveal>
            <Reveal variant="scale" delay={90} className="lg:col-span-6">
              <FeatureCard
                icon={Users}
                title="Para todo el equipo"
                desc="Cada barbero ve su agenda y sus clientes; recepción gestiona el local; el dueño ve todo."
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="scroll-mt-20">
        <div className="container py-24 md:py-28">
          <Reveal className="mb-12 text-center">
            <h2 className="text-balance font-display text-3xl font-normal tracking-[-0.015em] md:text-5xl">
              Precios en pesos chilenos
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Sin cargos sorpresa. Cancelas cuando quieras.
            </p>
          </Reveal>

          <PricingPlans />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 bg-secondary/50 dark:bg-secondary/30">
        <div className="container py-24 md:py-28">
          <Reveal className="mb-10 text-center">
            <h2 className="text-balance font-display text-3xl font-normal tracking-[-0.015em] md:text-5xl">
              Preguntas frecuentes
            </h2>
          </Reveal>
          <Reveal variant="fade" className="mx-auto max-w-2xl divide-y divide-border">
            {FAQS.map((f) => (
              <Faq key={f.q} q={f.q} a={f.a} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* CTA final: card tinta plana, sin gradientes ni glow. */}
      <section>
        <div className="container py-24 md:py-28">
          <Reveal variant="scale">
            <div className="rounded-[2rem] border border-white/10 bg-brand-graphite px-6 py-16 text-center text-brand-ivory md:py-20">
              <h2 className="text-balance font-display text-3xl font-normal tracking-[-0.015em] md:text-5xl">
                Tu agenda llena empieza hoy
              </h2>
              <p className="mx-auto mt-4 max-w-md text-brand-ivory/70">
                14 días gratis, sin tarjeta. Configúralo en minutos y deja que
                navaxa traiga a tus clientes de vuelta.
              </p>
              <Button
                size="lg"
                className="mt-9 rounded-full bg-brand-brass px-7 text-brand-graphite hover:bg-brand-brass-soft"
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

      </main>
      <footer>
        <div className="container pb-14 pt-4">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <Logo size={24} />
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} navaxa · Hecho en Chile.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/reservar" className="transition-colors hover:text-foreground">Reservar hora</Link>
              <Link href="/legal#terminos" className="transition-colors hover:text-foreground">Términos</Link>
              <Link href="/legal#privacidad" className="transition-colors hover:text-foreground">Privacidad</Link>
              <a href="mailto:contacto@navaxa.cl" className="transition-colors hover:text-foreground">
                contacto@navaxa.cl
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Card de feature plana (radius 24, sin borde ni sombra). `accent` la convierte
 * en la única card con tinte brass de la página.
 */
function FeatureCard({
  icon: Icon,
  title,
  desc,
  accent = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-3xl p-7 md:p-8",
        accent ? "bg-brand-brass/15 dark:bg-brand-brass/10" : "bg-card",
      )}
    >
      <h3 className="flex items-center gap-2 text-lg font-medium">
        <Icon className="h-[1.125rem] w-[1.125rem] text-accent-ink" />
        {title}
      </h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{desc}</p>
      {children && <div className="mt-6 flex-1">{children}</div>}
    </div>
  );
}

/** Mini-artifact: historial visual de un cliente con fotos reales (Unsplash, servidas locales). */
function HistoryMock() {
  const cuts = [
    { img: "/landing/corte-fade-medio.jpg", d: "Mar", n: "Fade medio", r: 5 },
    { img: "/landing/corte-clasico-tijera.jpg", d: "Ene", n: "Clásico tijera", r: 4 },
    { img: "/landing/corte-buzz.jpg", d: "Nov", n: "Buzz corto", r: 2 },
  ];
  return (
    <div className="grid grid-cols-3 gap-3" aria-hidden>
      {cuts.map((c) => (
        <div key={c.n} className="overflow-hidden rounded-xl bg-muted">
          <Image
            src={c.img}
            alt=""
            width={480}
            height={360}
            sizes="(min-width: 1024px) 200px, 30vw"
            className="aspect-[4/3] w-full object-cover"
          />
          <div className="px-2.5 py-2">
            <div className="truncate text-xs font-medium">{c.n}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              {c.d}
              <span className="inline-flex items-center gap-0.5 text-accent-ink">
                <Star className="h-2.5 w-2.5 fill-current" />
                {c.r}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mini-artifact: conversación de recordatorio WhatsApp. */
function ChatMock() {
  return (
    <div className="space-y-2.5 text-sm" aria-hidden>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        Hola Tomás 👋 Te recordamos tu hora mañana a las <strong>11:30</strong> con Diego.
      </div>
      <div className="ml-auto max-w-[60%] rounded-2xl rounded-br-md bg-brand-graphite px-3.5 py-2.5 text-brand-ivory">
        ¡Ahí estaré! ✂️
      </div>
      <div className="flex items-center gap-1.5 pt-1 text-xs text-accent-ink">
        <Check className="h-3.5 w-3.5" />
        Enviado automático · sin mover un dedo
      </div>
    </div>
  );
}

/** Mini-artifact: tres bloques de agenda. */
function AgendaMock() {
  const rows = [
    { t: "10:00", n: "Tomás V.", s: "Corte clásico" },
    { t: "11:30", n: "Diego R.", s: "Corte + barba" },
    { t: "13:00", n: "Matías P.", s: "Solo barba" },
  ];
  return (
    <div className="space-y-2" aria-hidden>
      {rows.map((r) => (
        <div key={r.t} className="flex items-center gap-3 rounded-xl bg-muted px-3.5 py-2.5">
          <span className="w-10 text-xs tabular-nums text-muted-foreground">{r.t}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{r.n}</div>
          </div>
          <span className="truncate text-xs text-muted-foreground">{r.s}</span>
        </div>
      ))}
    </div>
  );
}

/** Mini-artifact: sugerencia de la IA. */
function AiMock() {
  return (
    <div className="rounded-xl bg-muted px-4 py-3.5" aria-hidden>
      <div className="flex items-center gap-1.5 text-xs font-medium text-accent-ink">
        <Sparkles className="h-3.5 w-3.5" />
        Sugerencia para Tomás
      </div>
      <p className="mt-1.5 text-sm">
        Fade medio con textura arriba — su corte mejor evaluado. Evitar buzz corto
        (2 estrellas en noviembre).
      </p>
    </div>
  );
}

/** Cluster de artifacts del hero: agenda del día + minis flotantes (puro CSS). */
function HeroArtifacts() {
  const rows = [
    { t: "10:00", n: "Tomás V.", s: "Corte clásico", c: "bg-brand-graphite text-brand-ivory dark:bg-brand-ivory dark:text-brand-graphite" },
    { t: "11:30", n: "Diego R.", s: "Corte + barba", c: "bg-accent-ink text-white" },
    { t: "13:00", n: "Matías P.", s: "Solo barba", c: "bg-brand-brass/25 text-accent-ink" },
    { t: "16:00", n: "Joaquín L.", s: "Corte + barba", c: "bg-muted text-foreground" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-brand-brass/10 blur-3xl"
      />
      <div className="animate-float motion-reduce:animate-none">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-12px_rgba(0,0,0,0.15)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-brass" />
              <span className="text-sm font-medium">Agenda · Hoy</span>
            </div>
            <span className="rounded-full bg-brand-brass/15 px-2 py-0.5 text-xs font-medium text-accent-ink">
              {rows.length} citas
            </span>
          </div>
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.t} className="flex items-center gap-3 px-4 py-3">
                <span className="w-11 text-xs tabular-nums text-muted-foreground">{r.t}</span>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
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
      </div>

      {/* Minis flotantes desfasados (duración/delay distintos: no van en sincro). */}
      <div className="absolute -bottom-6 -left-6 hidden animate-float-soft rounded-xl border border-border/70 bg-card p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-10px_rgba(0,0,0,0.16)] motion-reduce:animate-none sm:block">
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
      <div className="absolute -right-8 -top-5 hidden rounded-xl border border-border/70 bg-card p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-10px_rgba(0,0,0,0.16)] sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-brass/15 text-accent-ink">
            <Star className="h-4 w-4 fill-current" />
          </span>
          <div>
            <div className="text-xs font-medium">Nueva reseña 5★</div>
            <div className="text-[10px] text-muted-foreground">«El mejor fade de Ñuñoa»</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group py-5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-muted-foreground">{a}</p>
    </details>
  );
}
