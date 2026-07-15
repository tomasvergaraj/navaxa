export default function ReviewLinkNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">navaxa</p>
      <h1 className="mt-2 font-display text-2xl font-medium">Este enlace ya no está disponible</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        El enlace para dejar tu reseña expiró o ya fue usado. Si quieres compartir tu experiencia
        igual, escríbele directamente a tu barbería — ¡les va a encantar leerte!
      </p>
    </div>
  );
}
