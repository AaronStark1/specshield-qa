import type { ParsedRequirements } from "@shared/types.js";

function extractTitle(spec: string): string {
  const m = spec.match(/^#\s+(.+)$/m);
  if (m?.[1]) return m[1].trim().slice(0, 120);
  const first = spec.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  return (first ?? "Untitled Spec").slice(0, 120);
}

function extractSummary(spec: string): string {
  const bg = spec.match(/##\s*1\.\s*Background([\s\S]*?)(?=\n##\s*\d|\n###|$)/i);
  const chunk = (bg?.[1] ?? spec).replace(/^#.*$/gm, "").trim().split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4).join(" ");
  return chunk.slice(0, 600) || "Parsed from pasted specification.";
}

function extractRoles(spec: string): ParsedRequirements["roles"] {
  const rolesSection = spec.match(/##\s*2\.\s*User Roles([\s\S]*?)(?=\n##\s*\d|\n###\s*3|$)/i);
  const hay = rolesSection?.[1] ?? spec;
  const roles: ParsedRequirements["roles"] = [];
  const re = /^-\s*\*\*(.+?)\*\*\s*[—–\-–—]\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(hay)) !== null) {
    roles.push({ name: (m[1] ?? "").trim(), description: (m[2] ?? "").trim().slice(0, 300) });
  }
  if (roles.length === 0) {
    // generic fallback: look for "role" mentions
    const generic = spec.match(/^-\s*\*\*(.+?)\*\*\s*[-–—]\s*(.+)$/gm);
    if (generic) {
      for (const line of generic.slice(0, 6)) {
        const mm = line.match(/^-\s*\*\*(.+?)\*\*\s*[-–—]\s*(.+)$/);
        if (mm?.[1] && mm?.[2]) roles.push({ name: (mm[1] ?? "").trim(), description: (mm[2] ?? "").trim().slice(0, 300) });
      }
    }
  }
  if (roles.length === 0) {
    roles.push({ name: "User", description: "Default end user described by the specification." });
  }
  return roles.slice(0, 12);
}

function extractFeatures(spec: string): ParsedRequirements["features"] {
  const features: ParsedRequirements["features"] = [];
  const re = /^###\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(spec)) !== null) {
    idx += 1;
    const raw = (m[1] ?? "").trim();
    const idMatch = raw.match(/\((FR-[A-Z]+|NFR-[A-Z]+)\)/i);
    const parenId = idMatch?.[1]?.toUpperCase();
    // Derive a stable feature id: reuse FR-XXX prefix, else F-NN
    const fid = parenId ?? `F-${String(idx).padStart(2, "0")}`;
    // Clean name: strip numbering like "3.1 Vendor Registration (FR-REG)"
    const name = raw.replace(/^\d+(\.\d+)*\s+/, "").replace(/\s*\(.*?\)\s*$/, "").trim() || `Feature ${idx}`;
    // Description: first non-empty line after heading
    const after = spec.slice((m.index ?? 0) + m[0].length);
    const descLine = after.split("\n").map((l) => l.trim()).find((l) => l.length > 0 && !l.startsWith("-") && !l.startsWith("FR-") && !l.startsWith("NFR-")) ?? "";
    features.push({ id: fid, name: name.slice(0, 80), description: descLine.slice(0, 300) || name, roles: [] });
  }
  if (features.length === 0) {
    // Fall back to ## headings
    const re2 = /^##\s+(.+?)\s*$/gm;
    let n = 0;
    while ((m = re2.exec(spec)) !== null && n < 8) {
      n += 1;
      const raw = (m[1] ?? "").trim();
      if (/background|user roles|non-functional|out of scope/i.test(raw)) continue;
      features.push({ id: `F-${String(n).padStart(2, "0")}`, name: raw.slice(0, 80), description: raw.slice(0, 300), roles: [] });
    }
  }
  if (features.length === 0) {
    features.push({ id: "F-01", name: "Core Workflow", description: "Primary workflow described by the specification.", roles: [] });
  }
  return features.slice(0, 12);
}

function featureIdForCriterion(criterionId: string, features: ParsedRequirements["features"]): string {
  const prefix = criterionId.split("-").slice(0, 2).join("-").toUpperCase();
  const hit = features.find((f) => f.id.toUpperCase() === prefix);
  if (hit) return hit.id;
  // NFR-SEC-01 -> map to closest feature containing "audit"/"security"? default to last feature
  if (criterionId.toUpperCase().startsWith("NFR-SEC") || criterionId.toUpperCase().startsWith("NFR-")) {
    const audit = features.find((f) => /audit|security|report/i.test(f.name));
    if (audit) return audit.id;
  }
  return features[0]?.id ?? "F-01";
}

function extractCriteria(spec: string, features: ParsedRequirements["features"]): ParsedRequirements["acceptanceCriteria"] {
  const out: ParsedRequirements["acceptanceCriteria"] = [];
  const re = /^-\s*((?:FR|NFR)-[A-Z]+-\d+)\s*:\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(spec)) !== null) {
    const id = (m[1] ?? "").trim().toUpperCase();
    const text = (m[2] ?? "").trim().slice(0, 500);
    out.push({ id, featureId: featureIdForCriterion(id, features), text });
  }
  return out;
}

const UNIT_RE = /(\d+(?:[–\-—]\d+)?\s*(?:MB|KB|GB|characters|chars|days|hours|minutes|seconds|ms|photos?|files?|%|m\b|business days|digits?|questions?|sections?))/gi;
const RANGE_RE = /(\d+)\s*[–\-—]\s*(\d+)\s*(characters|chars|digits|days|minutes|hours|photos?|files?|questions?)?/i;

function extractFields(spec: string, features: ParsedRequirements["features"], criteria: ParsedRequirements["acceptanceCriteria"]): ParsedRequirements["fields"] {
  const fields: ParsedRequirements["fields"] = [];
  const seen = new Set<string>();
  const push = (name: string, type: string, required: boolean, constraints: string[], featureId: string) => {
    const key = `${featureId}::${name.toLowerCase()}`;
    if (seen.has(key)) {
      const ex = fields.find((f) => `${f.featureId}::${f.name.toLowerCase()}` === key);
      if (ex) for (const c of constraints) if (!ex.constraints.includes(c)) ex.constraints.push(c);
      return;
    }
    seen.add(key);
    fields.push({ name, type, required, constraints: constraints.slice(0, 6), featureId });
  };

  // Heuristic field-name bank matched against spec text
  const candidates: { pattern: RegExp; name: string; type: string }[] = [
    { pattern: /corporate email|email address/i, name: "corporateEmail", type: "email" },
    { pattern: /password/i, name: "password", type: "password" },
    { pattern: /company legal name|legal name/i, name: "companyLegalName", type: "string" },
    { pattern: /tax identifier|GSTIN|VAT|EIN/i, name: "taxIdentifier", type: "string" },
    { pattern: /expiry date|expiring/i, name: "documentExpiryDate", type: "date" },
    { pattern: /account holder name/i, name: "accountHolderName", type: "string" },
    { pattern: /IBAN/i, name: "iban", type: "string" },
    { pattern: /bank name/i, name: "bankName", type: "string" },
    { pattern: /currency/i, name: "currency", type: "string" },
    { pattern: /geo-tagged photo|photo/i, name: "sitePhoto", type: "file" },
    { pattern: /justification note/i, name: "justificationNote", type: "text" },
    { pattern: /rejection.*reason|free text/i, name: "rejectionReason", type: "text" },
    { pattern: /vendor id/i, name: "vendorId", type: "string" },
    { pattern: /audit log/i, name: "auditExport", type: "file" },
    { pattern: /session/i, name: "session", type: "session" },
    { pattern: /login/i, name: "login", type: "credentials" },
  ];

  for (const c of candidates) {
    if (c.pattern.test(spec)) {
      const fid = criteria.length > 0 ? (criteria[0]?.featureId ?? features[0]?.id ?? "F-01") : (features[0]?.id ?? "F-01");
      // Find best feature: first criterion mentioning the field-ish word
      let bestFid = fid;
      const word = c.name.replace(/([A-Z])/g, " $1").toLowerCase();
      const hit = criteria.find((cr) => cr.text.toLowerCase().includes(word.split(" ")[0] ?? ""));
      if (hit) bestFid = hit.featureId;
      const required = /required|must|mandatory/i.test(spec.match(c.pattern)?.[0] ?? "") || /required|must/i.test(spec);
      push(c.name, c.type, required, [], bestFid);
    }
  }

  // Attach numeric constraints from criteria text to the closest field / or as generic constraints
  for (const cr of criteria) {
    const units = [...cr.text.matchAll(UNIT_RE)].map((x) => (x[1] ?? "").trim()).filter(Boolean).slice(0, 4);
    if (units.length === 0) continue;
    // attach to a field of same feature if any, else create a constraint field
    const f = fields.find((x) => x.featureId === cr.featureId);
    if (f) {
      for (const u of units) if (!f.constraints.includes(u)) f.constraints.push(u);
    } else {
      push(`constraint_${cr.id.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, "string", false, units, cr.featureId);
    }
  }

  // Ensure at least a few fields
  if (fields.length === 0) {
    const fid = features[0]?.id ?? "F-01";
    push("title", "string", true, [], fid);
    push("description", "text", false, [], fid);
  }
  return fields.slice(0, 24);
}

function extractValidationRules(criteria: ParsedRequirements["acceptanceCriteria"]): ParsedRequirements["validationRules"] {
  const rules: ParsedRequirements["validationRules"] = [];
  let n = 0;
  for (const cr of criteria) {
    if (/validat|must|pattern|checksum|reject|require|expire|limit|mask|rate-limit|enforc|sanitis/i.test(cr.text)) {
      n += 1;
      rules.push({ id: `VR-${String(n).padStart(2, "0")}`, rule: cr.text.slice(0, 300), featureId: cr.featureId });
    }
  }
  return rules.slice(0, 30);
}

function extractSecurity(spec: string): string[] {
  const lower = spec.toLowerCase();
  const keys: { k: string; label: string }[] = [
    { k: "login", label: "Login rate-limiting and account lockout (5 failed / 15 min)" },
    { k: "password", label: "Password complexity rules (12–64 chars, upper/digit/symbol)" },
    { k: "session", label: "Session expiry after 30 minutes with 2-minute warning" },
    { k: "upload", label: "File upload validation, virus scan and quarantine" },
    { k: "rate-limit", label: "Rate limiting on authentication endpoints" },
    { k: "rate limit", label: "Rate limiting on authentication endpoints" },
    { k: "rbac", label: "Role-based access control enforced server-side" },
    { k: "role-based", label: "Role-based access control enforced server-side" },
    { k: "injection", label: "Input sanitisation against injection (OWASP Top 10)" },
    { k: "owasp", label: "Input sanitisation against injection (OWASP Top 10)" },
    { k: "encrypted", label: "Encrypted storage for uploads at rest" },
    { k: "signed", label: "Signed, expiring download links (10 minutes)" },
    { k: "mask", label: "Masked bank details except for privileged role" },
    { k: "sanitis", label: "Free-text rendered as plain text, never HTML" },
    { k: "audit", label: "Immutable audit log with actor, timestamp, IP" },
    { k: "verification", label: "Email verification with 24-hour expiry" },
    { k: "segregation", label: "Segregation of duties on approval" },
  ];
  const out: string[] = [];
  for (const { k, label } of keys) {
    if (lower.includes(k) && !out.includes(label)) out.push(label);
  }
  // keyword scan for generic specs
  if (out.length === 0) {
    if (lower.includes("auth")) out.push("Authentication and authorisation checks");
    if (lower.includes("token")) out.push("Token handling and expiry");
    if (lower.includes("permission")) out.push("Permission checks on privileged actions");
  }
  return out.slice(0, 12);
}

export function parseRequirements(spec: string): ParsedRequirements {
  const title = extractTitle(spec);
  const summary = extractSummary(spec);
  const roles = extractRoles(spec);
  const features = extractFeatures(spec);
  // assign roles to features round-robin if features lack roles
  features.forEach((f, i) => {
    if (f.roles.length === 0 && roles.length > 0) {
      f.roles = [roles[i % roles.length]?.name ?? roles[0]!.name];
    }
  });
  const acceptanceCriteria = extractCriteria(spec, features);
  const fields = extractFields(spec, features, acceptanceCriteria);
  const validationRules = extractValidationRules(acceptanceCriteria);
  const securitySurfaces = extractSecurity(spec);
  void RANGE_RE;
  return { title, summary, roles, features, acceptanceCriteria, fields, validationRules, securitySurfaces };
}
