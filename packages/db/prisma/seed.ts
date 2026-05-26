import {
  PrismaClient,
  Plan,
  Role,
  AppointmentStatus,
  CampaignTrigger,
  NotificationChannel,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hash = (pw: string) => bcrypt.hashSync(pw, 10);

const SAMPLE_HAIRCUT_IMAGES = [
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80",
  "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80",
  "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&q=80",
  "https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=800&q=80",
  "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=800&q=80",
  "https://images.unsplash.com/photo-1593702288056-f173a7b03b9b?w=800&q=80",
  "https://images.unsplash.com/photo-1620975944333-8e6c1d5ef9a3?w=800&q=80",
];

const pickImage = (i: number) =>
  SAMPLE_HAIRCUT_IMAGES[i % SAMPLE_HAIRCUT_IMAGES.length]!;

async function main() {
  console.log("🌱 Sembrando navaxa…");

  // Limpiar
  await prisma.aIRecommendation.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.review.deleteMany();
  await prisma.appointmentService.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.haircutRecord.deleteMany();
  await prisma.clientPreference.deleteMany();
  await prisma.client.deleteMany();
  await prisma.barberTimeOff.deleteMany();
  await prisma.barberSchedule.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.service.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // ===== Tenant principal =====
  const tenant = await prisma.tenant.create({
    data: {
      slug: "barberia-don-pepe",
      name: "Barbería Don Pepe",
      plan: Plan.PRO,
      rut: "76.543.210-K",
      phone: "+56 9 8765 4321",
      email: "contacto@donpepe.cl",
      address: "Av. Libertad 1234, local 5",
      city: "Viña del Mar",
      timezone: "America/Santiago",
      currency: "CLP",
      locale: "es-CL",
    },
  });
  console.log(`  · Tenant creado: ${tenant.name}`);

  // ===== Usuarios =====
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "pepe@donpepe.cl",
      passwordHash: hash("navaxa123"),
      name: "Pepe Contreras",
      role: Role.OWNER,
    },
  });

  const barberDefs = [
    {
      email: "rodrigo@donpepe.cl",
      name: "Rodrigo Salinas",
      rate: 0.45,
      specialties: ["fade", "barba", "diseño"],
      bio: "Especialista en fades y diseños personalizados. 8 años de experiencia.",
      instagram: "rodrigo.fades",
    },
    {
      email: "matias@donpepe.cl",
      name: "Matías Pérez",
      rate: 0.4,
      specialties: ["clásico", "tijera"],
      bio: "Maestro del corte clásico a tijera. Formado en Buenos Aires.",
      instagram: "matias.barber",
    },
    {
      email: "felipe@donpepe.cl",
      name: "Felipe Vega",
      rate: 0.42,
      specialties: ["fade", "color"],
      bio: "Cortes modernos y aplicación de color. Llegó hace 2 años.",
      instagram: "felipe.vega.hair",
    },
  ];

  const barbers = await Promise.all(
    barberDefs.map((b) =>
      prisma.user
        .create({
          data: {
            tenantId: tenant.id,
            email: b.email,
            passwordHash: hash("navaxa123"),
            name: b.name,
            role: Role.BARBER,
            barber: {
              create: {
                tenantId: tenant.id,
                bio: b.bio,
                commissionRate: b.rate,
                specialties: b.specialties,
                instagram: b.instagram,
                schedule: {
                  create: [1, 2, 3, 4, 5, 6].map((wd) => ({
                    weekday: wd,
                    startMin: 10 * 60,
                    endMin: 20 * 60,
                  })),
                },
              },
            },
          },
          include: { barber: true },
        })
        .then((u) => ({ user: u, barber: u.barber! })),
    ),
  );
  console.log(`  · ${barbers.length} barberos creados`);

  // ===== Servicios =====
  const serviceDefs = [
    { name: "Corte clásico", duration: 30, price: 12000, color: "#0A0B0E" },
    { name: "Corte + barba", duration: 45, price: 18000, color: "#C9A961" },
    { name: "Fade premium", duration: 50, price: 20000, color: "#2563EB" },
    { name: "Arreglo de barba", duration: 20, price: 8000, color: "#16A34A" },
    { name: "Corte niño", duration: 25, price: 9000, color: "#F59E0B" },
    { name: "Tinte", duration: 60, price: 25000, color: "#DC2626" },
  ];

  const services = await Promise.all(
    serviceDefs.map((s) =>
      prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: s.name,
          durationMin: s.duration,
          price: s.price,
          color: s.color,
        },
      }),
    ),
  );
  console.log(`  · ${services.length} servicios creados`);

  // ===== Clientes con historial =====
  const clientDefs = [
    {
      firstName: "Cristián",
      lastName: "Bravo",
      phone: "+56987654321",
      style: "fade alto",
      hairType: "straight",
      fadeType: "high",
      topLength: "medium",
    },
    {
      firstName: "Ignacio",
      lastName: "Soto",
      phone: "+56987654322",
      style: "corte clásico",
      hairType: "straight",
      fadeType: "none",
      topLength: "medium",
    },
    {
      firstName: "Andrés",
      lastName: "Muñoz",
      phone: "+56987654323",
      style: "undercut",
      hairType: "wavy",
      fadeType: "skin",
      topLength: "long",
    },
    {
      firstName: "Diego",
      lastName: "Rojas",
      phone: "+56987654324",
      style: "fade bajo + barba",
      hairType: "straight",
      fadeType: "low",
      topLength: "short",
      beardStyle: "barba completa recortada",
    },
    {
      firstName: "Sebastián",
      lastName: "Núñez",
      phone: "+56987654325",
      style: "pompadour",
      hairType: "wavy",
      fadeType: "mid",
      topLength: "long",
    },
    {
      firstName: "Tomás",
      lastName: "Henríquez",
      phone: "+56987654326",
      style: "buzz cut",
      hairType: "curly",
      fadeType: "skin",
      topLength: "short",
    },
    {
      firstName: "Javier",
      lastName: "Castillo",
      phone: "+56987654327",
      style: "side part clásico",
      hairType: "straight",
      fadeType: "low",
      topLength: "medium",
    },
    {
      firstName: "Benjamín",
      lastName: "Ortiz",
      phone: "+56987654328",
      style: "crew cut",
      hairType: "straight",
      fadeType: "taper",
      topLength: "short",
    },
  ];

  let totalHaircuts = 0;
  let totalAppts = 0;
  let imgIndex = 0;
  const clients: { id: string }[] = [];

  for (let ci = 0; ci < clientDefs.length; ci++) {
    const c = clientDefs[ci]!;
    const visits = 4 + (ci % 4);
    const client = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: `${c.firstName.toLowerCase()}@example.cl`,
        tags: ci % 3 === 0 ? ["recurrente", "vip"] : ["recurrente"],
        totalVisits: visits,
        totalSpent: visits * 15000,
        lastVisitAt: new Date(Date.now() - 21 * 86_400_000),
        preferences: {
          create: {
            hairType: c.hairType,
            preferredStyle: c.style,
            fadeType: c.fadeType,
            topLength: c.topLength,
            beardStyle: c.beardStyle ?? null,
            preferredBarberId: barbers[ci % barbers.length]!.barber.id,
          },
        },
      },
    });

    clients.push(client);

    // Historial de cortes (4 fotos por cliente)
    for (let i = 0; i < 4; i++) {
      const daysAgo = (i + 1) * 28;
      const barber = barbers[(ci + i) % barbers.length]!;
      await prisma.haircutRecord.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          barberId: barber.barber.id,
          imageUrl: pickImage(imgIndex++),
          notes: i === 0 ? `${c.style} — quedó muy conforme` : `${c.style}`,
          rating: 4 + ((i + ci) % 2),
          style: c.style,
          performedAt: new Date(Date.now() - daysAgo * 86_400_000),
        },
      });
      totalHaircuts++;
    }

    // Próxima cita en los próximos 14 días
    if (ci < 6) {
      const inDays = (ci % 7) + 1;
      const hour = 10 + (ci % 8);
      const startsAt = new Date(Date.now() + inDays * 86_400_000);
      startsAt.setHours(hour, 0, 0, 0);
      const service = services[ci % services.length]!;
      const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
      const barber = barbers[ci % barbers.length]!;
      await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          barberId: barber.barber.id,
          startsAt,
          endsAt,
          totalPrice: service.price,
          status:
            ci % 4 === 0
              ? AppointmentStatus.CONFIRMED
              : AppointmentStatus.SCHEDULED,
          source: "web",
          services: {
            create: [{ serviceId: service.id, priceCharged: service.price }],
          },
        },
      });
      totalAppts++;
    }
  }
  console.log(
    `  · ${clientDefs.length} clientes, ${totalHaircuts} cortes, ${totalAppts} citas próximas`,
  );

  // ===== Citas completadas históricas + comisiones =====
  // 3 meses hacia atrás: el más antiguo queda liquidado (paid), los recientes pendientes.
  // Permite que la página de Comisiones muestre datos al sembrar de cero.
  const now = new Date();
  let pastAppts = 0;
  let commissionTotal = 0;
  let reviewCount = 0;
  const REVIEW_COMMENTS = [
    "Excelente atención, quedé muy conforme con el corte.",
    "El mejor fade que me han hecho. Volveré seguro.",
    "Muy puntuales y profesionales. Recomendado.",
    "Buen ambiente y gran trabajo con la barba.",
    "Quedó tal como lo pedí, gracias!",
    null,
    "Atención de primera, mi barbero de confianza.",
    null,
  ];
  // Incluye el mes en curso (monthsAgo=0) hasta hoy, para que Reportes "últimos 30 días" tenga datos.
  for (let monthsAgo = 3; monthsAgo >= 0; monthsAgo--) {
    const year = now.getFullYear();
    const month = now.getMonth() - monthsAgo;
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0, 23, 59, 59);
    const paid = monthsAgo === 3;
    const maxDay = monthsAgo === 0 ? now.getDate() : 28; // no crear citas "completadas" en el futuro

    for (let bi = 0; bi < barbers.length; bi++) {
      const barber = barbers[bi]!.barber;
      const count = 4 + ((bi + monthsAgo) % 3); // 4-6 citas por barbero/mes
      for (let k = 0; k < count; k++) {
        const client = clients[(bi + k + monthsAgo) % clients.length]!;
        const service = services[(bi + k) % services.length]!;
        const day = 2 + ((k * 5 + bi) % 26);
        if (day > maxDay) continue;
        const hour = 10 + ((k + bi) % 8);
        const startsAt = new Date(year, month, day, hour, 0, 0);
        const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
        const amount = Math.round(service.price * barber.commissionRate);

        const appt = await prisma.appointment.create({
          data: {
            tenantId: tenant.id,
            clientId: client.id,
            barberId: barber.id,
            startsAt,
            endsAt,
            totalPrice: service.price,
            status: AppointmentStatus.COMPLETED,
            source: "web",
            services: { create: [{ serviceId: service.id, priceCharged: service.price }] },
            commission: {
              create: {
                tenantId: tenant.id,
                barberId: barber.id,
                baseAmount: service.price,
                rate: barber.commissionRate,
                amount,
                paid,
                paidAt: paid ? periodEnd : null,
                periodStart,
                periodEnd,
              },
            },
          },
        });
        pastAppts++;
        commissionTotal += amount;

        // ~2 de cada 3 citas dejan reseña (notas 4-5).
        const idx = pastAppts;
        if (idx % 3 !== 0) {
          await prisma.review.create({
            data: {
              tenantId: tenant.id,
              appointmentId: appt.id,
              clientId: client.id,
              barberId: barber.id,
              rating: 4 + (idx % 2), // 4 o 5
              comment: REVIEW_COMMENTS[idx % REVIEW_COMMENTS.length],
              createdAt: endsAt,
            },
          });
          reviewCount++;
        }
      }
    }
  }
  console.log(
    `  · ${pastAppts} citas completadas + comisiones (CLP ${commissionTotal} en comisiones), ${reviewCount} reseñas`,
  );

  // ===== Campañas por defecto =====
  await prisma.campaign.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: "Recordatorio 24h",
        description: "Confirmación automática 24h antes de la cita",
        trigger: CampaignTrigger.APPOINTMENT_REMINDER,
        channel: NotificationChannel.WHATSAPP,
        templateKey: "reminder_24h",
        conditions: { hoursBeforeStart: 24 },
      },
      {
        tenantId: tenant.id,
        name: "Reactivación 30 días",
        description: "Mensaje a clientes que no vienen hace 30+ días",
        trigger: CampaignTrigger.RECALL_INACTIVE,
        channel: NotificationChannel.WHATSAPP,
        templateKey: "recall_30d",
        conditions: { daysSinceLastVisit: 30 },
      },
      {
        tenantId: tenant.id,
        name: "Saludo de cumpleaños",
        description: "Felicitación + cupón el día del cumpleaños",
        trigger: CampaignTrigger.BIRTHDAY,
        channel: NotificationChannel.WHATSAPP,
        templateKey: "birthday",
        conditions: {},
      },
      {
        tenantId: tenant.id,
        name: "Agradecimiento post-visita",
        description: "Mensaje 2h después de completar el corte",
        trigger: CampaignTrigger.POST_VISIT,
        channel: NotificationChannel.WHATSAPP,
        templateKey: "thanks_post_visit",
        conditions: { hoursAfter: 2 },
      },
    ],
  });
  console.log(`  · 4 campañas creadas`);

  console.log("\n✅ Listo.\n");
  console.log("   Login owner:  pepe@donpepe.cl / navaxa123");
  console.log("   Login barber: rodrigo@donpepe.cl / navaxa123\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
