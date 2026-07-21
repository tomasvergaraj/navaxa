import { NextResponse } from "next/server";
import { scopedDb } from "@/lib/tenant";
import { apiError, requireManager } from "@/lib/api-errors";
import { AppointmentStatus } from "@navaxa/db";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { tenantId } = await requireManager();
    const db = scopedDb();
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    const last30 = subDays(now, 30);

    const [
      todayAppts,
      monthRevenue,
      monthAppts,
      noShows30,
      activeClients,
      newClients30,
      upcoming,
      barberStats,
    ] = await Promise.all([
      db.appointment.count({
        where: {
          startsAt: { gte: dayStart, lte: dayEnd },
          status: { notIn: [AppointmentStatus.CANCELLED] },
        },
      }),
      db.appointment.aggregate({
        where: {
          startsAt: { gte: monthStart, lte: monthEnd },
          status: AppointmentStatus.COMPLETED,
        },
        _sum: { totalPrice: true },
      }),
      db.appointment.count({
        where: {
          startsAt: { gte: monthStart, lte: monthEnd },
          status: AppointmentStatus.COMPLETED,
        },
      }),
      db.appointment.count({
        where: {
          startsAt: { gte: last30 },
          status: AppointmentStatus.NO_SHOW,
        },
      }),
      db.client.count({ where: { totalVisits: { gt: 0 } } }),
      db.client.count({ where: { createdAt: { gte: last30 } } }),
      db.appointment.findMany({
        where: {
          startsAt: { gte: now },
          status: {
            in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
          },
        },
        orderBy: { startsAt: "asc" },
        take: 5,
        include: {
          client: { select: { firstName: true, lastName: true } },
          barber: { include: { user: { select: { name: true } } } },
          services: { include: { service: { select: { name: true } } } },
        },
      }),
      db.barber.findMany({
        where: { active: true },
        select: {
          id: true,
          user: { select: { name: true } },
          appointments: {
            where: {
              startsAt: { gte: last30 },
              status: AppointmentStatus.COMPLETED,
            },
            select: { totalPrice: true },
          },
        },
      }),
    ]);

    const barberPerformance = barberStats.map((b) => ({
      id: b.id,
      name: b.user.name,
      appointments: b.appointments.length,
      revenue: b.appointments.reduce((s, a) => s + a.totalPrice, 0),
    }));

    return NextResponse.json({
      stats: {
        todayAppts,
        monthRevenue: monthRevenue._sum.totalPrice ?? 0,
        monthAppts,
        noShows30,
        activeClients,
        newClients30,
      },
      upcoming,
      barberPerformance,
    });
  } catch (e) {
    return apiError(e);
  }
}
