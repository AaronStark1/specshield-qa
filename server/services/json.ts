import type { z } from "zod";

export function extractJson(text: string): unknown {
  let t = text.trim();
  // strip ```json / ``` fences
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in model output (excerpt): ${text.slice(0, 200)}`);
  }
  const slice = t.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    // one repair pass: trailing commas + smart quotes
    const repaired = slice
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(repaired);
    } catch (err) {
      throw new Error(
        `JSON parse failed after repair (excerpt): ${slice.slice(0, 200)} :: ${(err as Error).message}`
      );
    }
  }
}

export function parseWithSchema<T>(
  schema: z.ZodType<T>,
  text: string
): { ok: true; data: T } | { ok: false; error: string } {
  try {
    const raw = extractJson(text);
    const parsed = schema.safeParse(raw);
    if (parsed.success) return { ok: true, data: parsed.data };
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { ok: false, error: issues.slice(0, 800) };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 800) };
  }
}
