import { createApp } from "./app";
import { ensureDevUsers } from "./lib/dev-users";
import { env } from "./lib/env";

const app = await createApp();
await ensureDevUsers();

await app.listen({
  host: env.API_HOST,
  port: env.API_PORT,
});
