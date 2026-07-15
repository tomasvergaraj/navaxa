import Link from "next/link";
import { Button } from "@navaxa/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">navaxa</p>
      <h1 className="mt-2 font-display text-2xl font-medium">Página no encontrada</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        El enlace que abriste no existe o ya no está disponible.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Ir al inicio</Link>
      </Button>
    </div>
  );
}
