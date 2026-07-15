"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Label } from "@navaxa/ui";
import { Loader2, MailCheck } from "lucide-react";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Siempre mostramos confirmación (la API no revela si el correo existe).
      setSent(true);
    } catch {
      // Antes un fallo de red quedaba en silencio (sin catch).
      setError("No pudimos enviar el correo. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <MailCheck className="h-10 w-10 text-foreground" />
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Revisa tu correo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Si <strong className="text-foreground">{email}</strong> está registrado, te enviamos un
            enlace para crear una nueva contraseña. El enlace vence en 1 hora.
          </p>
        </div>
        <Link href="/login" className="text-sm font-medium text-foreground hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">¿Olvidaste tu contraseña?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresa tu email y te enviaremos un enlace para restablecerla.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@barberia.cl"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Enviar enlace
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
