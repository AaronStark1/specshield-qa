import type { ParsedRequirements } from "@shared/types.js";

export const PARSER_SYSTEM = `You are the Requirement Parser, an expert business analyst turning raw product specs into structured requirements.

Return a single JSON object matching this TypeScript interface and nothing else. No markdown fences, no commentary.

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
- Reuse IDs found in the spec (FR-REG-01, NFR-SEC-01) as featureId values where present; otherwise generate F-01, F-02.
- Extract every role, every numeric limit (10 MB, 12–64 characters, 30 minutes, 0–100), every validation and every security keyword.
- Keep text concrete with real values from the spec.
- Respond with a single JSON object and nothing else. No markdown fences, no commentary.`;

export function parserUser(spec: string, titleHint?: string): string {
  return `Parse the following product specification into ParsedRequirements JSON.\n${titleHint ? `Suggested title: ${titleHint}\n` : ""}Specification:\n\n${spec.slice(0, 24000)}`;
}

export type { ParsedRequirements };
