import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/go_fish";

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export function createDb() {
  return createPrismaClient();
}
