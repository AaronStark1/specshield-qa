import type { ParsedRequirements, TestCase, TestCategory, Priority } from "@shared/types.js";

function prefixFor(title: string): string {
  const upper = title.toUpperCase();
  if (upper.includes("INVOICE")) return "FIT";
  const letters = title.replace(/[^A-Za-z]/g, "");
  const p = (letters.slice(0, 3) || "SPC").toUpperCase();
  return p.padEnd(3, "X").slice(0, 3);
}

function rangeFromText(text: string): { min: number; max: number; unit: string } | null {
  const m = text.match(/(\d+)\s*[–\-—]\s*(\d+)\s*(characters|chars|digits|days|minutes|hours|photos?|files?)?/i);
  if (!m?.[1] || !m?.[2]) return null;
  return { min: Number(m[1]), max: Number(m[2]), unit: (m[3] ?? "").toLowerCase() || "units" };
}

function singleNumber(text: string): { value: number; unit: string } | null {
  const m = text.match(/(\d+)\s*(MB|days|hours|minutes|seconds|ms|photos?|files?|characters|chars|digits|m\b|business days)/i);
  if (!m?.[1]) return null;
  return { value: Number(m[1]), unit: (m[2] ?? "").toLowerCase() };
}

export function buildMatrix(req: ParsedRequirements): TestCase[] {
  const P = prefixFor(req.title);
  const cases: TestCase[] = [];
  const counters: Record<TestCategory, number> = { Functional: 0, Boundary: 0, Negative: 0, Security: 0 };
  const code = (cat: TestCategory): string => {
    counters[cat] += 1;
    const tag = cat === "Functional" ? "FUNC" : cat === "Boundary" ? "BND" : cat === "Negative" ? "NEG" : "SEC";
    return `${P}-${tag}-${String(counters[cat]).padStart(3, "0")}`;
  };
  const prio = (i: number): Priority => (["P0", "P1", "P2", "P3"] as Priority[])[i % 4]!;

  // 1) One Functional happy-path per feature
  req.features.forEach((f, i) => {
    const id = code("Functional");
    cases.push({
      id,
      featureId: f.id,
      category: "Functional",
      title: `Happy path: ${f.name} completes successfully`,
      given: `a privileged user with access to ${f.name}`,
      when: `they complete the ${f.name.toLowerCase()} flow with valid data`,
      then: `the system persists the result and advances the workflow without errors`,
      priority: i < 3 ? "P0" : "P1",
      expectedResult: `${f.name} succeeds and the status advances as specified`,
      tags: ["happy-path", f.id.toLowerCase(), "functional"],
    });
    void prio(i);
  });

  // 2) Boundary cases from numeric ranges in criteria
  for (const cr of req.acceptanceCriteria) {
    if (counters.Boundary >= 8) break;
    const r = rangeFromText(cr.text);
    if (r) {
      const mk = (delta: number, label: string, expect: string, pr: Priority): TestCase => ({
        id: code("Boundary"),
        featureId: cr.featureId,
        category: "Boundary",
        title: `${cr.id}: ${label} (${r.min}${r.unit ? `–${r.max} ${r.unit}` : ""})`,
        given: `a value near the ${r.min}–${r.max} ${r.unit} limit for ${cr.id}`,
        when: `the user submits ${delta} ${r.unit}`,
        then: expect,
        priority: pr,
        expectedResult: expect,
        tags: ["boundary", cr.featureId.toLowerCase(), cr.id.toLowerCase()],
      });
      cases.push(mk(r.min - 1, `below minimum is rejected`, `the system rejects the value with a validation message`, "P1"));
      if (counters.Boundary >= 8) break;
      cases.push(mk(r.max + 1, `above maximum is rejected`, `the system rejects the value with a validation message`, "P1"));
      continue;
    }
    const s = singleNumber(cr.text);
    if (s) {
      cases.push({
        id: code("Boundary"),
        featureId: cr.featureId,
        category: "Boundary",
        title: `${cr.id}: limit enforced at ${s.value} ${s.unit}`,
        given: `a submission at the ${s.value} ${s.unit} threshold`,
        when: `the user submits exactly ${s.value} ${s.unit} and then ${s.value + 1} ${s.unit}`,
        then: `the first is accepted and the second is rejected with a clear message`,
        priority: "P1",
        expectedResult: `Boundary at ${s.value} ${s.unit} is enforced`,
        tags: ["boundary", cr.featureId.toLowerCase()],
      });
    }
  }

  // Ensure at least 3 boundary cases even for specs without numbers
  let bi = 0;
  while (counters.Boundary < 3 && bi < req.features.length) {
    const f = req.features[bi % req.features.length]!;
    cases.push({
      id: code("Boundary"),
      featureId: f.id,
      category: "Boundary",
      title: `Empty versus max-length input on ${f.name}`,
      given: `the ${f.name.toLowerCase()} form`,
      when: `the user submits an empty value and then a 512-character value`,
      then: `empty is rejected as required and over-long input is truncated or rejected`,
      priority: "P2",
      expectedResult: "Length boundaries are enforced",
      tags: ["boundary", f.id.toLowerCase()],
    });
    bi += 1;
  }

  // 3) Negative cases: one per required field (cap 10)
  const requiredFields = req.fields.filter((f) => f.required).slice(0, 10);
  const negPool = requiredFields.length > 0 ? requiredFields : req.fields.slice(0, 6);
  for (const f of negPool) {
    if (counters.Negative >= 10) break;
    cases.push({
      id: code("Negative"),
      featureId: f.featureId,
      category: "Negative",
      title: `Missing or invalid ${f.name} is rejected`,
      given: `a submission where ${f.name} is missing or malformed`,
      when: `the user submits without a valid ${f.name}`,
      then: `the system blocks submission and highlights ${f.name} with a field-level error`,
      priority: "P1",
      expectedResult: `${f.name} is required and validated`,
      tags: ["negative", f.name.toLowerCase(), f.featureId.toLowerCase()],
    });
  }

  // 4) Security cases: one per surface (cap 8)
  for (const surface of req.securitySurfaces.slice(0, 8)) {
    const fid = req.features[req.securitySurfaces.indexOf(surface) % req.features.length]?.id ?? req.features[0]!.id;
    const lower = surface.toLowerCase();
    let title = `Security: ${surface}`;
    let when = `an unauthorised actor attempts the protected action`;
    let then = `the system denies the action and records an audit entry`;
    if (lower.includes("password")) {
      title = "Weak password is rejected (12–64 chars, upper/digit/symbol)";
      when = `the user registers with password "weakpass1"`;
      then = `registration is rejected with the complexity message`;
    } else if (lower.includes("rate")) {
      title = "Login is locked after 6 failed attempts in 15 minutes";
      when = `the attacker fails login 6 times within 15 minutes`;
      then = `the account locks for 30 minutes and an unlock email is sent`;
    } else if (lower.includes("upload") || lower.includes("virus")) {
      title = "Infected upload is quarantined and blocks submission";
      when = `the vendor uploads a file flagged as infected`;
      then = `the file is quarantined, the vendor is notified, submission is blocked`;
    } else if (lower.includes("role")) {
      title = "Server-side RBAC hides unauthorised fields";
      when = `a Vendor Admin requests the procurement-only bank detail panel`;
      then = `the API omits masked fields and the UI shows only the last 4 characters`;
    } else if (lower.includes("injection") || lower.includes("sanitis")) {
      title = "Script input is rendered as plain text, never HTML";
      when = `the user submits "<script>alert(1)</script>" in a free-text field`;
      then = `the value is stored sanitised and rendered as plain text`;
    } else if (lower.includes("session")) {
      title = "Idle session expires after 30 minutes with 2-minute warning";
      when = `the user idles for 28 minutes`;
      then = `a warning modal appears; at 30 minutes the session expires`;
    } else if (lower.includes("signed") || lower.includes("expir")) {
      title = "Download link expires after 10 minutes";
      when = `the user opens an 11-minute-old signed download link`;
      then = `access is denied and a fresh link must be issued`;
    } else if (lower.includes("audit")) {
      title = "Privilege escalation attempt is audit-logged";
      when = `a reviewer edits another reviewer's approval`;
      then = `the attempt is denied and logged with actor, timestamp and IP`;
    }
    cases.push({
      id: code("Security"),
      featureId: fid,
      category: "Security",
      title,
      given: `the system under test with security control: ${surface.slice(0, 90)}`,
      when,
      then,
      priority: "P2",
      expectedResult: then,
      tags: ["security", fid.toLowerCase()],
    });
  }
  while (counters.Security < 3) {
    const f = req.features[counters.Security % req.features.length]!;
    cases.push({
      id: code("Security"),
      featureId: f.id,
      category: "Security",
      title: `Unauthorised access to ${f.name} is denied`,
      given: `a user without the ${f.name.toLowerCase()} permission`,
      when: `they call the ${f.name.toLowerCase()} endpoint directly`,
      then: `the API returns 403 and logs the attempt`,
      priority: "P2",
      expectedResult: "Access denied with audit entry",
      tags: ["security", f.id.toLowerCase()],
    });
  }

  // Cap total at 40, keep category mix
  return cases.slice(0, 40);
}
