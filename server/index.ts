import "./instrument.js";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";

const port = env.PORT;
console.log(`[specshield-qa] api on :${port} (mode default: ${env.FORCE_FALLBACK ? "fallback" : "auto"})`);

serve({ fetch: app.fetch, port });
