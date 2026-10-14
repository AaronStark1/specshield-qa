import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../env.js";
import type { RunRecord } from "@shared/types.js";

async function ensureDir(): Promise<string> {
  const dir = path.resolve(env.DATA_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export class JsonStore {
  static async loadAll(): Promise<RunRecord[]> {
    try {
      const dir = await ensureDir();
      const raw = await fs.readFile(path.join(dir, "runs.json"), "utf-8");
      const arr = JSON.parse(raw) as RunRecord[];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  static async save(record: RunRecord): Promise<void> {
    const dir = await ensureDir();
    const file = path.join(dir, "runs.json");
    const tmp = path.join(dir, `runs.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    const all = await JsonStore.loadAll();
    const idx = all.findIndex((r) => r.id === record.id);
    if (idx >= 0) all[idx] = record;
    else all.unshift(record);
    await fs.writeFile(tmp, JSON.stringify(all, null, 2), "utf-8");
    await fs.rename(tmp, file);
  }

  static async get(id: string): Promise<RunRecord | undefined> {
    const all = await JsonStore.loadAll();
    return all.find((r) => r.id === id);
  }

  static async remove(id: string): Promise<boolean> {
    const dir = await ensureDir();
    const file = path.join(dir, "runs.json");
    const all = await JsonStore.loadAll();
    const next = all.filter((r) => r.id !== id);
    if (next.length === all.length) return false;
    const tmp = path.join(dir, `runs.${Date.now()}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
    await fs.rename(tmp, file);
    return true;
  }
}
