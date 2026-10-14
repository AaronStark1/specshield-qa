import "./instrument.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { healthRoute } from "./routes/health.js";
import { runRoute } from "./routes/run.js";
import { runsRoute } from "./routes/runs.js";

const app = new Hono();
app.use("*", cors());

app.route("/api/health", healthRoute);
app.route("/api/run", runRoute);
app.route("/api/runs", runsRoute);

app.get("/api", (c) => c.json({ ok: true, name: "specshield-qa" }));

if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", async (c) => {
    try {
      const fs = await import("node:fs/promises");
      const html = await fs.readFile("./dist/index.html", "utf-8");
      return c.html(html);
    } catch {
      return c.text("Not found", 404);
    }
  });
}

export { app };
