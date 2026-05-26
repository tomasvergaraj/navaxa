import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, Role, Plan, CampaignTrigger, NotificationChannel } from "@navaxa/db";
import { registerSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = registerSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { shopName, ownerName, email, password, phone } = parsed.data;

  const cleanEmail = email.toLowerCase().trim();
  const exists = await prisma.user.findFirst({ where: { email: cleanEmail } });
  if (exists) {
    return NextResponse.json(
      { error: { formErrors: ["Ya existe una cuenta con este email"] } },
      { status: 400 },
    );
  }

  let baseSlug = slugify(shopName);
  if (!baseSlug) baseSlug = `barberia-${Date.now()}`;

  // Asegurar slug único
  let slug = baseSlug;
  let i = 1;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 14);

  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: shopName,
      plan: Plan.FREE,
      phone: phone || null,
      trialEndsAt: trialEnds,
      subscription: {
        create: {
          plan: Plan.FREE,
          status: "TRIALING",
          currentPeriodEnd: trialEnds,
        },
      },
      users: {
        create: {
          email: cleanEmail,
          name: ownerName,
          passwordHash,
          role: Role.OWNER,
        },
      },
      services: {
        create: [
          { name: "Corte clásico", durationMin: 30, price: 12000 },
          { name: "Corte + barba", durationMin: 45, price: 18000 },
          { name: "Fade", durationMin: 50, price: 18000 },
          { name: "Arreglo de barba", durationMin: 20, price: 8000 },
        ],
      },
      campaigns: {
        create: [
          {
            name: "Recordatorio 24h",
            trigger: CampaignTrigger.APPOINTMENT_REMINDER,
            channel: NotificationChannel.WHATSAPP,
            templateKey: "reminder_24h",
            conditions: { hoursBeforeStart: 24 },
          },
          {
            name: "Recordatorio 1h",
            trigger: CampaignTrigger.APPOINTMENT_REMINDER,
            channel: NotificationChannel.WHATSAPP,
            templateKey: "reminder_1h",
            conditions: { hoursBeforeStart: 1 },
          },
          {
            name: "Reactivación 30 días",
            trigger: CampaignTrigger.RECALL_INACTIVE,
            channel: NotificationChannel.WHATSAPP,
            templateKey: "recall_30d",
            conditions: { daysSinceLastVisit: 30 },
          },
        ],
      },
    },
  });

  return NextResponse.json({ tenantId: tenant.id, slug: tenant.slug }, { status: 201 });
}
