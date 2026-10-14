import { Hono } from "hono";
import { JsonStore } from "../services/store.js";
import type { RunRecord } from "@shared/types.js";

export const runsRoute = new Hono();

runsRoute.get("/", async (c) => {
  const all = await JsonStore.loadAll();
  const summaries = all.map((r: RunRecord) => {
    const { spec: _spec, requirements: _req, playwright, ...rest } = r;
    void _spec;
    void _req;
    return {
      ...rest,
      playwright: {
        fileName: playwright.fileName,
        pageObjects: playwright.pageObjects.map((p) => ({ className: p.className, fileName: p.fileName })),
        specCode: playwright.specCode,
        coverage: playwright.coverage,
      },
    };
  });
  return c.json(summaries);
});

runsRoute.get("/:id", async (c) => {
  const rec = await JsonStore.get(c.req.param("id"));
  if (!rec) return c.json({ error: "not found" }, 404);
  return c.json(rec);
});

runsRoute.delete("/:id", async (c) => {
  const ok = await JsonStore.remove(c.req.param("id"));
  if (!ok) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});
