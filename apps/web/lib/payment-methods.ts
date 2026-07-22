import { Banknote, CreditCard, Landmark, CircleDollarSign } from "lucide-react";

/**
 * Métodos de pago que el usuario puede elegir. GIFTCARD queda fuera a propósito:
 * no se elige, lo deriva el server cuando el saldo de la giftcard cubre el total.
 *
 * Compartido entre la caja y el cobro del saldo de una cita — «Tarjeta» cubre
 * cualquier POS (SumUp, Transbank, etc.); el detalle va en la nota.
 */
export const PAYMENT_METHODS = [
  { key: "CASH", label: "Efectivo", icon: Banknote },
  { key: "CARD", label: "Tarjeta", icon: CreditCard },
  { key: "TRANSFER", label: "Transferencia", icon: Landmark },
  { key: "OTHER", label: "Otro", icon: CircleDollarSign },
] as const;

export type ChoosablePaymentMethod = (typeof PAYMENT_METHODS)[number]["key"];

/** Incluye GIFTCARD porque acá sí se muestran ventas ya guardadas. */
export const PAYMENT_METHOD_LABEL: Record<ChoosablePaymentMethod | "GIFTCARD", string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
  GIFTCARD: "Giftcard",
};
