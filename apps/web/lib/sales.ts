import { prisma, type SalePaymentMethod } from "@navaxa/db";
import { ApiError } from "./api-errors";

export interface SaleItemInput {
  productId?: string;
  serviceId?: string;
  qty: number;
}

/**
 * Crea una venta de caja en una transacción: valida catálogo del tenant,
 * snapshot de nombre/precio en cada línea, descuenta stock con guard
 * (stock >= qty, si no la venta completa se rechaza) y deja el movimiento
 * en stock_movements.
 */
export async function createSale(input: {
  tenantId: string;
  items: SaleItemInput[];
  paymentMethod: SalePaymentMethod;
  clientId?: string;
  appointmentId?: string;
  barberId?: string;
  note?: string;
}) {
  const productIds = input.items.filter((i) => i.productId).map((i) => i.productId!);
  const serviceIds = input.items.filter((i) => i.serviceId).map((i) => i.serviceId!);

  const [products, services] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds }, tenantId: input.tenantId, active: true },
          select: { id: true, name: true, price: true, stock: true },
        })
      : [],
    serviceIds.length
      ? prisma.service.findMany({
          where: { id: { in: serviceIds }, tenantId: input.tenantId, active: true },
          select: { id: true, name: true, price: true },
        })
      : [],
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const serviceById = new Map(services.map((s) => [s.id, s]));

  // Referencias opcionales: si vienen, deben ser del tenant (no se confía en el cliente).
  const [client, barber, appointment] = await Promise.all([
    input.clientId
      ? prisma.client.findFirst({ where: { id: input.clientId, tenantId: input.tenantId }, select: { id: true } })
      : null,
    input.barberId
      ? prisma.barber.findFirst({ where: { id: input.barberId, tenantId: input.tenantId }, select: { id: true } })
      : null,
    input.appointmentId
      ? prisma.appointment.findFirst({
          where: { id: input.appointmentId, tenantId: input.tenantId },
          select: { id: true, clientId: true },
        })
      : null,
  ]);
  if (input.clientId && !client) throw new ApiError(400, "Cliente no encontrado");
  if (input.barberId && !barber) throw new ApiError(400, "Barbero no encontrado");
  if (input.appointmentId && !appointment) throw new ApiError(400, "Cita no encontrada");

  // Consolidar líneas duplicadas del mismo producto (dos veces la misma cera
  // debe descontar stock una sola vez con la suma).
  const lines: { productId?: string; serviceId?: string; name: string; unitPrice: number; qty: number }[] = [];
  for (const item of input.items) {
    if (item.productId) {
      const p = productById.get(item.productId);
      if (!p) throw new ApiError(400, "Producto no disponible");
      const existing = lines.find((l) => l.productId === p.id);
      if (existing) existing.qty += item.qty;
      else lines.push({ productId: p.id, name: p.name, unitPrice: p.price, qty: item.qty });
    } else {
      const s = serviceById.get(item.serviceId!);
      if (!s) throw new ApiError(400, "Servicio no disponible");
      const existing = lines.find((l) => l.serviceId === s.id);
      if (existing) existing.qty += item.qty;
      else lines.push({ serviceId: s.id, name: s.name, unitPrice: s.price, qty: item.qty });
    }
  }

  for (const line of lines) {
    if (!line.productId) continue;
    const p = productById.get(line.productId)!;
    if (p.stock < line.qty) {
      throw new ApiError(409, `Stock insuficiente de ${p.name} (quedan ${p.stock})`);
    }
  }

  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        tenantId: input.tenantId,
        clientId: client?.id ?? appointment?.clientId ?? null,
        appointmentId: appointment?.id ?? null,
        barberId: barber?.id ?? null,
        total,
        paymentMethod: input.paymentMethod,
        note: input.note || null,
        items: {
          create: lines.map((l) => ({
            productId: l.productId ?? null,
            serviceId: l.serviceId ?? null,
            name: l.name,
            unitPrice: l.unitPrice,
            qty: l.qty,
          })),
        },
      },
      include: { items: true },
    });

    for (const line of lines) {
      if (!line.productId) continue;
      // Guard optimista: si otra venta agotó el stock entre la validación y
      // acá, count=0 → rollback de toda la venta.
      const updated = await tx.product.updateMany({
        where: { id: line.productId, tenantId: input.tenantId, stock: { gte: line.qty } },
        data: { stock: { decrement: line.qty } },
      });
      if (updated.count === 0) {
        throw new ApiError(409, `Stock insuficiente de ${line.name}`);
      }
      await tx.stockMovement.create({
        data: {
          tenantId: input.tenantId,
          productId: line.productId,
          delta: -line.qty,
          reason: "SALE",
          saleId: sale.id,
        },
      });
    }

    return sale;
  });
}

/**
 * Anula una venta: marca cancelledAt y devuelve el stock de los productos
 * (movimiento RETURN). Idempotente: una venta ya anulada no se re-procesa.
 */
export async function cancelSale(tenantId: string, saleId: string) {
  return prisma.$transaction(async (tx) => {
    // Guard de estado dentro de la tx: dos anulaciones simultáneas no duplican
    // la devolución de stock.
    const updated = await tx.sale.updateMany({
      where: { id: saleId, tenantId, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    if (updated.count === 0) {
      throw new ApiError(409, "La venta no existe o ya fue anulada");
    }
    const sale = await tx.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { items: true },
    });

    for (const item of sale!.items) {
      if (!item.productId) continue;
      await tx.product.updateMany({
        where: { id: item.productId, tenantId },
        data: { stock: { increment: item.qty } },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: item.productId,
          delta: item.qty,
          reason: "RETURN",
          saleId,
          note: "Venta anulada",
        },
      });
    }
    return sale!;
  });
}

/** Productos activos con stock en o bajo su umbral de alerta (minStock > 0). */
export async function lowStockCount(tenantId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count FROM products
    WHERE "tenantId" = ${tenantId} AND active AND "minStock" > 0 AND stock <= "minStock"
  `;
  return Number(rows[0]?.count ?? 0);
}
