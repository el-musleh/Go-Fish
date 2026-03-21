import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: new URL("../../../../.env", import.meta.url) });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_WEB_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8787"),
  GO_FISH_ENABLE_TEST_LOGINS: z.string().optional(),
  INTERNAL_WORKER_TOKEN: z.string().default("go-fish-worker-token"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default("Go Fish <hello@gofish.local>"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  enableTestLogins:
    parsed.GO_FISH_ENABLE_TEST_LOGINS !== undefined ? parsed.GO_FISH_ENABLE_TEST_LOGINS === "true" : parsed.NODE_ENV !== "production",
  trustedOrigins: parsed.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
};
