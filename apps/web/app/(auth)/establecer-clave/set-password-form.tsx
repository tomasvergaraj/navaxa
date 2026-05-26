"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@navaxa/ui";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function SetPasswordForm({
  token,
  submitLabel,
}: {
  token: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= 8 && confirm === password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
        return;
      }
      toast.success("Contraseña guardada");
      // Intentamos iniciar sesión automáticamente; necesitamos el email, que no
      // tenemos en el cliente, así que dejamos que el usuario inicie sesión.
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Error guardando la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
        />
        {tooShort && <p className="text-xs text-destructive">Debe tener al menos 8 caracteres.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Repetir contraseña</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
        />
        {mismatch && <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>}
      </div>
      <Button type="submit" className="w-full" disabled={loading || !valid}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
