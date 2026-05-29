import { prisma, NotificationChannel, NotificationStatus } from "@navaxa/db";
import { emailProvider } from "./providers/email";
import { whatsappProvider } from "./providers/whatsapp";
import { renderTemplate, type TemplateKey } from "./templates";

export interface ChannelProvider {
  send(args: {
    to: string;
    subject?: string;
    body: string;
    mediaUrl?: string;
    // WhatsApp (Meta Cloud API) manda por template aprobado, no texto libre:
    // necesita la key + las variables crudas para armar los `components`.
    // Email/mock los ignoran y usan `body` ya renderizado.
    templateKey?: TemplateKey;
    data?: Record<string, string | number>;
  }): Promise<{ providerId: string }>;
}

export interface SendInput {
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  templateKey: TemplateKey;
  data: Record<string, string | number>;
}

const providers: Record<NotificationChannel, ChannelProvider> = {
  EMAIL: emailProvider,
  WHATSAPP: whatsappProvider,
  SMS: whatsappProvider,
};

export async function sendNotification(input: SendInput) {
  const rendered = renderTemplate(input.templateKey, input.data);

  const log = await prisma.notificationLog.create({
    data: {
      tenantId: input.tenantId,
      channel: input.channel,
      recipient: input.recipient,
      templateKey: input.templateKey,
      payload: input.data,
      status: NotificationStatus.PENDING,
    },
  });

  try {
    const { providerId } = await providers[input.channel].send({
      to: input.recipient,
      subject: rendered.subject,
      body: rendered.body,
      templateKey: input.templateKey,
      data: input.data,
    });

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: NotificationStatus.SENT,
        providerId,
        sentAt: new Date(),
      },
    });

    return { ok: true as const, logId: log.id, providerId };
  } catch (err) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: NotificationStatus.FAILED,
        errorMessage: (err as Error).message,
      },
    });
    return { ok: false as const, logId: log.id, error: (err as Error).message };
  }
}
