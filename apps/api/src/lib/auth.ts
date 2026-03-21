import { prismaAdapter } from "@better-auth/prisma-adapter";
import { db } from "@go-fish/database";
import { betterAuth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";

import { env } from "./env";

export const auth = betterAuth({
  appName: "Go Fish",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.trustedOrigins,
  emailAndPassword: {
    enabled: env.enableTestLogins,
  },
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
});

export async function getSessionFromHeaders(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

export function headersFromNode(rawHeaders: Record<string, string | string[] | undefined>) {
  return fromNodeHeaders(rawHeaders);
}
