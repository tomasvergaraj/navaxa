import Link from "next/link";
import { Logo } from "@navaxa/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col">
        <div className="flex h-16 items-center px-8">
          <Link href="/">
            <Logo size={28} />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-8 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-graphite lg:block">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          poster="/videos/barber-loop-poster.jpg"
        >
          <source src="/videos/barber-loop.mp4" type="video/mp4" />
        </video>
        {/* Oscurece desde abajo para que la cita blanca sea legible sobre el video */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-graphite via-brand-graphite/60 to-brand-graphite/20" />
        <div className="absolute inset-0 flex flex-col justify-end p-12 text-brand-ivory">
          <blockquote className="font-display text-2xl font-medium leading-tight tracking-tight">
            &ldquo;Mis clientes vuelven más porque me acuerdo de cada corte que les hice.
            navaxa hace ese trabajo por mí.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm opacity-80">
            Pepe Contreras · Barbería Don Pepe, Viña del Mar
          </p>
        </div>
      </div>
    </div>
  );
}
