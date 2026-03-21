import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: new URL("../../.env", import.meta.url) });

export default defineConfig({
  schema: "./prisma/schema.prisma",
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/go_fish",
  },
});
