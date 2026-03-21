import { benchmarkQuestions, benchmarkSubmissionSchema } from "@go-fish/contracts";
import { db } from "@go-fish/database";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { auth, headersFromNode } from "../lib/auth";
import { AppError } from "../lib/errors";
import { serializeTasteProfile } from "../services/presenters";

async function requireUser(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: headersFromNode(request.raw.headers),
  });

  if (!session?.user) {
    throw new AppError("Unauthorized", 401);
  }

  return session.user;
}

export async function registerPreferenceRoutes(app: FastifyInstance) {
  app.get("/v1/me/preferences", async (request) => {
    const user = await requireUser(request);
    const tasteProfile = await db.tasteProfile.findUnique({
      where: { userId: user.id },
      include: { answers: true },
    });

    return {
      benchmarkQuestions,
      tasteProfile: serializeTasteProfile(tasteProfile),
    };
  });

  app.patch("/v1/me/preferences", async (request) => {
    const user = await requireUser(request);
    const payload = benchmarkSubmissionSchema.parse(request.body);

    const tasteProfile = await db.tasteProfile.upsert({
      where: { userId: user.id },
      update: {
        isComplete: true,
      },
      create: {
        userId: user.id,
        isComplete: true,
      },
    });

    await db.$transaction([
      db.tasteProfileAnswer.deleteMany({
        where: { profileId: tasteProfile.id },
      }),
      db.tasteProfileAnswer.createMany({
        data: payload.answers.map((answer) => ({
          profileId: tasteProfile.id,
          questionId: answer.questionId,
          selections: answer.selections,
        })),
      }),
    ]);

    const refreshed = await db.tasteProfile.findUniqueOrThrow({
      where: { userId: user.id },
      include: { answers: true },
    });

    return {
      benchmarkQuestions,
      tasteProfile: serializeTasteProfile(refreshed),
    };
  });
}

