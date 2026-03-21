import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: new URL("../../../.env", import.meta.url) });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3-flash-preview"),
  WORKER_INTERVAL_MINUTES: z.coerce.number().default(5),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  intervalMs: parsed.WORKER_INTERVAL_MINUTES * 60 * 1000,
};
