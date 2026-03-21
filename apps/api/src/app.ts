import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./lib/auth";
import { AppError } from "./lib/errors";
import { env } from "./lib/env";
import { registerEventRoutes } from "./routes/events";
import { registerPreferenceRoutes } from "./routes/preferences";

export async function createApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  await app.register(cors, {
    origin: env.trustedOrigins,
    credentials: true,
  });

  const authHandler = toNodeHandler(auth);
  app.addHook("onRequest", async (request, reply) => {
    if (request.raw.url?.startsWith("/api/auth/")) {
      const origin = request.headers.origin;
      if (origin && env.trustedOrigins.includes(origin)) {
        reply.raw.setHeader("access-control-allow-origin", origin);
        reply.raw.setHeader("vary", "Origin");
      }
      reply.raw.setHeader("access-control-allow-credentials", "true");
      reply.raw.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      reply.raw.setHeader("access-control-allow-headers", "Content-Type, Authorization");

      if (request.method === "OPTIONS") {
        return reply.status(204).send();
      }

      reply.hijack();
      await authHandler(request.raw, reply.raw);
    }
  });

  app.get("/health", async () => ({
    ok: true,
    service: "go-fish-api",
  }));

  await registerPreferenceRoutes(app);
  await registerEventRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    app.log.error(error);
    return reply.status(500).send({ error: "Internal server error" });
  });

  return app;
}

export type AppInstance = Awaited<ReturnType<typeof createApp>> extends FastifyInstance ? Awaited<ReturnType<typeof createApp>> : FastifyInstance;
