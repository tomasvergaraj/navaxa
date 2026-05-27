import {
  PrismaClient,
  Plan,
  Role,
  AppointmentStatus,
  CampaignTrigger,
  NotificationChannel,
  SubscriptionStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hash = (pw: string) => bcrypt.hashSync(pw, 10);
const DEMO_PASSWORD = "navaxa123";
const day = 86_400_000;

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
let imgIndex = 0;
const pickImage = () =>
  SAMPLE_HAIRCUT_IMAGES[imgIndex++ % SAMPLE_HAIRCUT_IMAGES.length]!;

// Servicios y campañas son iguales para todas las barberías del demo.
const SERVICE_DEFS = [
  { name: "Corte clásico", duration: 30, price: 12000, color: "#0A0B0E" },
  { name: "Corte + barba", duration: 45, price: 18000, color: "#C9A961" },
  { name: "Fade premium", duration: 50, price: 20000, color: "#2563EB" },
  { name: "Arreglo de barba", duration: 20, price: 8000, color: "#16A34A" },
  { name: "Corte niño", duration: 25, price: 9000, color: "#F59E0B" },
  { name: "Tinte", duration: 60, price: 25000, color: "#DC2626" },
];

const CLIENT_POOL = [
  { firstName: "Cristián", lastName: "Bravo", style: "fade alto", hairType: "straight", fadeType: "high", topLength: "medium" },
  { firstName: "Ignacio", lastName: "Soto", style: "corte clásico", hairType: "straight", fadeType: "none", topLength: "medium" },
  { firstName: "Andrés", lastName: "Muñoz", style: "undercut", hairType: "wavy", fadeType: "skin", topLength: "long" },
  { firstName: "Diego", lastName: "Rojas", style: "fade bajo + barba", hairType: "straight", fadeType: "low", topLength: "short", beardStyle: "barba completa recortada" },
  { firstName: "Sebastián", lastName: "Núñez", style: "pompadour", hairType: "wavy", fadeType: "mid", topLength: "long" },
  { firstName: "Tomás", lastName: "Henríquez", style: "buzz cut", hairType: "curly", fadeType: "skin", topLength: "short" },
  { firstName: "Javier", lastName: "Castillo", style: "side part clásico", hairType: "straight", fadeType: "low", topLength: "medium" },
  { firstName: "Benjamín", lastName: "Ortiz", style: "crew cut", hairType: "straight", fadeType: "taper", topLength: "short" },
];

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

type BarberDef = {
  email: string;
  name: string;
  rate: number;
  specialties: string[];
  bio: string;
  instagram: string;
};

type TenantDef = {
  slug: string;
  name: string;
  plan: Plan;
  subStatus: SubscriptionStatus;
  subPeriodDays: number; // días hasta currentPeriodEnd
  lastPaymentDaysAgo: number | null; // null = nunca pagó (trial)
  rut: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  owner: { email: string; name: string };
  barbers: BarberDef[];
  clientCount: number;
};

const TENANTS: TenantDef[] = [
  {
    slug: "barberia-don-pepe",
    name: "Barbería Don Pepe",
    plan: Plan.PRO,
    subStatus: SubscriptionStatus.ACTIVE,
    subPeriodDays: 22,
    lastPaymentDaysAgo: 8,
    rut: "76.543.210-K",
    phone: "+56 9 8765 4321",
    email: "contacto@donpepe.cl",
    address: "Av. Libertad 1234, local 5",
    city: "Viña del Mar",
    owner: { email: "pepe@donpepe.cl", name: "Pepe Contreras" },
    clientCount: 8,
    barbers: [
      { email: "rodrigo@donpepe.cl", name: "Rodrigo Salinas", rate: 0.45, specialties: ["fade", "barba", "diseño"], bio: "Especialista en fades y diseños personalizados. 8 años de experiencia.", instagram: "rodrigo.fades" },
      { email: "matias@donpepe.cl", name: "Matías Pérez", rate: 0.4, specialties: ["clásico", "tijera"], bio: "Maestro del corte clásico a tijera. Formado en Buenos Aires.", instagram: "matias.barber" },
      { email: "felipe@donpepe.cl", name: "Felipe Vega", rate: 0.42, specialties: ["fade", "color"], bio: "Cortes modernos y aplicación de color. Llegó hace 2 años.", instagram: "felipe.vega.hair" },
    ],
  },
  {
    slug: "the-gentlemen-club",
    name: "The Gentlemen Club",
    plan: Plan.STARTER,
    subStatus: SubscriptionStatus.ACTIVE,
    subPeriodDays: 9,
    lastPaymentDaysAgo: 21,
    rut: "77.111.222-3",
    phone: "+56 9 7654 3210",
    email: "hola@gentlemenclub.cl",
    address: "Av. Providencia 2020, of. 3",
    city: "Santiago",
    owner: { email: "owner@gentlemenclub.cl", name: "Andrés Lagos" },
    clientCount: 6,
    barbers: [
      { email: "carlos@gentlemenclub.cl", name: "Carlos Fuentes", rate: 0.5, specialties: ["fade", "navaja"], bio: "Afeitado a navaja y fades de precisión.", instagram: "carlos.razor" },
      { email: "nico@gentlemenclub.cl", name: "Nicolás Tapia", rate: 0.43, specialties: ["texturizado", "moderno"], bio: "Cortes texturizados y estilo urbano.", instagram: "nico.cuts" },
    ],
  },
  {
    slug: "cortes-express",
    name: "Cortes Express",
    plan: Plan.FREE,
    subStatus: SubscriptionStatus.TRIALING,
    subPeriodDays: 11,
    lastPaymentDaysAgo: null,
    rut: "78.999.000-1",
    phone: "+56 9 6543 2109",
    email: "contacto@cortesexpress.cl",
    address: "Barros Arana 567",
    city: "Concepción",
    owner: { email: "owner@cortesexpress.cl", name: "María José Díaz" },
    clientCount: 5,
    barbers: [
      { email: "pablo@cortesexpress.cl", name: "Pablo Riquelme", rate: 0.4, specialties: ["rápido", "clásico"], bio: "Cortes rápidos sin reserva.", instagram: "pablo.express" },
      { email: "seba@cortesexpress.cl", name: "Sebastián Vera", rate: 0.4, specialties: ["fade", "niños"], bio: "Especialista en cortes para niños.", instagram: "seba.kids.cuts" },
    ],
  },
];

async function clean() {
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
  await prisma.subscription.deleteMany();
  await prisma.tenant.deleteMany();
}

async function seedTenant(def: TenantDef) {
  const tenant = await prisma.tenant.create({
    data: {
      slug: def.slug,
      name: def.name,
      plan: def.plan,
      rut: def.rut,
      phone: def.phone,
      email: def.email,
      address: def.address,
      city: def.city,
      timezone: "America/Santiago",
      currency: "CLP",
      locale: "es-CL",
    },
  });

  // Suscripción al SaaS (estado de facturación para el futuro panel admin).
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      plan: def.plan,
      status: def.subStatus,
      currentPeriodEnd: new Date(Date.now() + def.subPeriodDays * day),
      lastPaymentAt:
        def.lastPaymentDaysAgo != null
          ? new Date(Date.now() - def.lastPaymentDaysAgo * day)
          : null,
      provider: "mock",
    },
  });

  // Owner
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: def.owner.email,
      passwordHash: hash(DEMO_PASSWORD),
      name: def.owner.name,
      role: Role.OWNER,
    },
  });

  // Barberos (usuario + perfil + horario)
  const barbers = await Promise.all(
    def.barbers.map((b) =>
      prisma.user
        .create({
          data: {
            tenantId: tenant.id,
            email: b.email,
            passwordHash: hash(DEMO_PASSWORD),
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

  // Servicios
  const services = await Promise.all(
    SERVICE_DEFS.map((s) =>
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

  // Clientes con historial + próximas citas
  const clientDefs = CLIENT_POOL.slice(0, def.clientCount);
  const clients: { id: string }[] = [];
  for (let ci = 0; ci < clientDefs.length; ci++) {
    const c = clientDefs[ci]!;
    const visits = 4 + (ci % 4);
    const client = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: c.firstName,
        lastName: c.lastName,
        // Teléfono/email prefijados por tenant para evitar choques entre demos.
        phone: `+5698${(def.slug.length % 9) + 1}${String(7654300 + ci).slice(-7)}`,
        email: `${c.firstName.toLowerCase()}.${def.slug}@example.cl`,
        tags: ci % 3 === 0 ? ["recurrente", "vip"] : ["recurrente"],
        totalVisits: visits,
        totalSpent: visits * 15000,
        lastVisitAt: new Date(Date.now() - 21 * day),
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
          imageUrl: pickImage(),
          notes: i === 0 ? `${c.style} — quedó muy conforme` : `${c.style}`,
          rating: 4 + ((i + ci) % 2),
          style: c.style,
          performedAt: new Date(Date.now() - daysAgo * day),
        },
      });
    }

    // Próxima cita en los próximos 14 días (para parte de los clientes)
    if (ci < Math.min(6, clientDefs.length)) {
      const inDays = (ci % 7) + 1;
      const hour = 10 + (ci % 8);
      const startsAt = new Date(Date.now() + inDays * day);
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
    }
  }

  // Citas completadas históricas (3 meses) + comisiones + reseñas
  const now = new Date();
  let pastAppts = 0;
  for (let monthsAgo = 3; monthsAgo >= 0; monthsAgo--) {
    const year = now.getFullYear();
    const month = now.getMonth() - monthsAgo;
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0, 23, 59, 59);
    const paid = monthsAgo === 3; // el mes más antiguo queda liquidado
    const maxDay = monthsAgo === 0 ? now.getDate() : 28;

    for (let bi = 0; bi < barbers.length; bi++) {
      const barber = barbers[bi]!.barber;
      const count = 4 + ((bi + monthsAgo) % 3);
      for (let k = 0; k < count; k++) {
        const client = clients[(bi + k + monthsAgo) % clients.length]!;
        const service = services[(bi + k) % services.length]!;
        const d = 2 + ((k * 5 + bi) % 26);
        if (d > maxDay) continue;
        const hour = 10 + ((k + bi) % 8);
        const startsAt = new Date(year, month, d, hour, 0, 0);
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

        if (pastAppts % 3 !== 0) {
          await prisma.review.create({
            data: {
              tenantId: tenant.id,
              appointmentId: appt.id,
              clientId: client.id,
              barberId: barber.id,
              rating: 4 + (pastAppts % 2),
              comment: REVIEW_COMMENTS[pastAppts % REVIEW_COMMENTS.length],
              createdAt: endsAt,
            },
          });
        }
      }
    }
  }

  // Campañas por defecto
  await prisma.campaign.createMany({
    data: [
      { tenantId: tenant.id, name: "Recordatorio 24h", description: "Confirmación automática 24h antes de la cita", trigger: CampaignTrigger.APPOINTMENT_REMINDER, channel: NotificationChannel.WHATSAPP, templateKey: "reminder_24h", conditions: { hoursBeforeStart: 24 } },
      { tenantId: tenant.id, name: "Reactivación 30 días", description: "Mensaje a clientes que no vienen hace 30+ días", trigger: CampaignTrigger.RECALL_INACTIVE, channel: NotificationChannel.WHATSAPP, templateKey: "recall_30d", conditions: { daysSinceLastVisit: 30 } },
      { tenantId: tenant.id, name: "Saludo de cumpleaños", description: "Felicitación + cupón el día del cumpleaños", trigger: CampaignTrigger.BIRTHDAY, channel: NotificationChannel.WHATSAPP, templateKey: "birthday", conditions: {} },
      { tenantId: tenant.id, name: "Agradecimiento post-visita", description: "Mensaje 2h después de completar el corte", trigger: CampaignTrigger.POST_VISIT, channel: NotificationChannel.WHATSAPP, templateKey: "thanks_post_visit", conditions: { hoursAfter: 2 } },
    ],
  });

  console.log(
    `  · ${def.name} [${def.plan}/${def.subStatus}] — ${barbers.length} barberos, ${clients.length} clientes, ${pastAppts} citas completadas`,
  );
}

async function main() {
  console.log("🌱 Sembrando navaxa (multi-tenant demo)…\n");
  await clean();
  for (const def of TENANTS) {
    await seedTenant(def);
  }

  console.log("\n✅ Listo. Logins demo (contraseña: " + DEMO_PASSWORD + "):");
  for (const t of TENANTS) {
    console.log(`   ${t.name.padEnd(22)} owner → ${t.owner.email}`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
