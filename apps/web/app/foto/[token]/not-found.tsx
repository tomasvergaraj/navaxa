export default function PhotoLinkNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">navaxa</p>
      <h1 className="mt-2 font-display text-2xl font-medium">Este enlace ya no está disponible</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        El enlace para calificar tu corte expiró o no es válido. Puedes dejar tu opinión
        directamente en la barbería en tu próxima visita.
      </p>
    </div>
  );
}
