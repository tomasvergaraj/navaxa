import { z } from "zod";

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),

  // Storage
  STORAGE_PROVIDER: z.enum(["mock", "r2", "s3"]).default("mock"),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),

  // Notifications
  NOTIF_EMAIL_PROVIDER: z.enum(["mock", "resend"]).default("mock"),
  NOTIF_WHATSAPP_PROVIDER: z.enum(["mock", "twilio", "meta"]).default("mock"),
  RESEND_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  // AI
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-haiku-4-5"),

  // Cron
  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Variables de entorno inválidas:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Variables de entorno inválidas");
  }
  cached = parsed.data;
  return cached;
}
