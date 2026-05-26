import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { validatePasswordToken } from "@/lib/password-tokens";
import { SetPasswordForm } from "./set-password-form";

export const dynamic = "force-dynamic";

export default async function EstablecerClavePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";
  const valid = await validatePasswordToken(token);

  if (!valid) {
    return (
      <div className="space-y-6">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Enlace no válido</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este enlace es inválido o ya expiró. Pide uno nuevo desde{" "}
            <Link href="/recuperar" className="font-medium text-foreground hover:underline">
              recuperar contraseña
            </Link>
            , o solicita a tu barbería que te reenvíe la invitación.
          </p>
        </div>
        <Link href="/login" className="text-sm font-medium text-foreground hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  const isInvite = valid.purpose === "INVITE";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">
          {isInvite ? `Hola, ${valid.userName}` : "Nueva contraseña"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isInvite
            ? "Crea tu contraseña para entrar a tu cuenta."
            : "Elige una nueva contraseña para tu cuenta."}{" "}
          <span className="text-foreground">{valid.userEmail}</span>
        </p>
      </div>

      <SetPasswordForm token={token} submitLabel={isInvite ? "Crear cuenta" : "Guardar contraseña"} />
    </div>
  );
}
