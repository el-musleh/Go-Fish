import { hashPassword } from "better-auth/crypto";
import { db } from "@go-fish/database";

import { env } from "./env";

const devUsers = [
  {
    email: "testuser@gofish.local",
    name: "testuser",
    password: "testuser",
  },
  {
    email: "testuser2@gofish.local",
    name: "testuser2",
    password: "testuser2",
  },
] as const;

export async function ensureDevUsers() {
  if (!env.enableTestLogins) {
    return;
  }

  for (const devUser of devUsers) {
    const passwordHash = await hashPassword(devUser.password);
    const existingUser = await db.user.findUnique({
      where: { email: devUser.email },
    });

    const user =
      existingUser ??
      (await db.user.create({
        data: {
          id: crypto.randomUUID(),
          email: devUser.email,
          emailVerified: true,
          name: devUser.name,
        },
      }));

    await db.account.upsert({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: user.id,
        },
      },
      update: {
        password: passwordHash,
        userId: user.id,
      },
      create: {
        id: crypto.randomUUID(),
        accountId: user.id,
        password: passwordHash,
        providerId: "credential",
        userId: user.id,
      },
    });
  }
}
