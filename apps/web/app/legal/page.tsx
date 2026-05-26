import Link from "next/link";
import { Logo } from "@navaxa/ui";

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <Logo size={28} />
          </Link>
        </div>
      </header>
      <main className="container max-w-3xl py-12">
        <h1 className="font-display text-3xl font-medium tracking-tight">Legal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Términos de servicio y política de privacidad de navaxa.
        </p>

        <section className="mt-10 space-y-4 text-sm leading-relaxed">
          <h2 className="font-display text-xl font-medium">Términos de servicio</h2>
          <p>
            Al usar navaxa aceptas estos términos. navaxa es un sistema SaaS provisto por
            Nexo Software (Chile) destinado a la gestión de barberías. El servicio se entrega
            tal cual y se actualiza periódicamente.
          </p>

          <h2 className="mt-8 font-display text-xl font-medium">Privacidad</h2>
          <p>
            Tus datos (clientes, citas, imágenes) son tuyos. navaxa los procesa únicamente
            para entregarte el servicio. No vendemos ni compartimos información con terceros
            para fines publicitarios. Los datos se almacenan cifrados en reposo y en tránsito.
          </p>

          <h2 className="mt-8 font-display text-xl font-medium">Contacto</h2>
          <p>
            Para consultas legales o de privacidad escribe a{" "}
            <a href="mailto:hola@navaxa.app" className="underline">
              hola@navaxa.app
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
