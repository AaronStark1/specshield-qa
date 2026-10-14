import type { ParsedRequirements } from "@shared/types.js";

export const PARSER_SYSTEM = `You are the Requirement Parser, an expert business analyst turning raw product specs into structured requirements.

Return a single minified JSON on a single line matching this TypeScript interface and nothing else. No markdown fences, no commentary, no indentation, no newlines inside the JSON.

interface ParsedRequirements {
  title: string;
  summary: string;
  roles: { name: string; description: string }[];
  features: { id: string; name: string; description: string; roles: string[] }[];
  acceptanceCriteria: { id: string; featureId: string; text: string }[];
  fields: { name: string; type: string; required: boolean; constraints: string[]; featureId: string }[];
  validationRules: { id: string; rule: string; featureId: string }[];
  securitySurfaces: string[];
}

Rules:
- Reuse IDs found in the spec (FR-AUTH-01, FR-CLI-01, NFR-SEC-01) where present; otherwise generate F-01, F-02.
- Extract every role, numeric limit, validation rule and security surface.
- Keep values short: descriptions ≤ 15 words, constraints as terse fragments ("8-64 chars", "≥1 digit").
- Respond with a single minified JSON on a single line and nothing else. No markdown fences, no newlines.`;

export function parserUser(spec: string, titleHint?: string): string {
  return `Parse the following product specification into minified ParsedRequirements JSON on a single line.\n${titleHint ? `Suggested title: ${titleHint}\n` : ""}Specification:\n\n${spec.slice(0, 24000)}`;
}

export type { ParsedRequirements };
