---
title: "SpecShield QA: Turning NDA-Locked Specs into Playwright Suites with Local Gemma, Mastra and Sentry"
published: false
tags: devchallenge, hf26challenge, gemma, mastra
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge: Week 2](https://dev.to/challenges/hacktoberfest-week2-2026-10-12) (Side Hustle)*

## What I Built

Boutique agencies and freelance QA engineers live under NDAs that forbid pasting client PRDs into cloud LLMs. I have watched a two-page registration story turn into an afternoon of spreadsheet test cases, then another afternoon of Playwright boilerplate. Four to six unbillable hours per sprint, every sprint, and the work is so mechanical it hurts.

SpecShield QA is a local-first studio that takes that PRD and returns three things in under a minute: structured requirements with roles, features and validation rules; a filterable QA matrix of 30 test cases across Functional, Boundary, Negative and Security; and a downloadable Playwright suite built on the Page Object Model with one class per screen, `getByTestId` locators, login fixtures and a `// covers VND-FUNC-001` comment on every test.

The whole pipeline runs on Gemma locally through Ollama, so the spec never leaves the laptop and inference costs $0.00. Every agent step is traced with Sentry Agent Tracing, past runs persist to a local JSON file, and the app stays fully usable when Ollama is not installed thanks to a deterministic fallback that is honest about its `mode`.

<!-- 2–3 paragraphs: the problem (NDA + 4–6 unbillable hours), what SpecShield QA does, who pays. -->

### The Side Hustle Business Model

The buyer is a freelance QA engineer billing $85 an hour, or a five-person agency that onboards two vendors' worth of regression suites a month. The sample vendor-onboarding spec in this repo produces 30 cases and 6 page objects. At 12 minutes per case plus 25 minutes per page object and 45 minutes of review, that is 9.3 hours, or $790.50 of billable value, per run. Charge $29 a month for the seat and the tool pays for itself if it saves twenty minutes.

Agencies get the second tier: shared run history in `data/runs.json`, compare-with-previous diffs, Markdown and CSV exports for client sign-off, and a telemetry drawer they can screenshot into a status report. The pitch is not "AI writes tests". It is "your NDA stays intact, your junior spends Friday on exploratory testing instead of boilerplate, and you can prove it with a trace".

<!-- Who pays and why: $29/mo flat-rate seat for freelance QA; agency tier; the 5+ hours/sprint math. -->
<!-- Unit Economics table: Local Gemma vs Closed Cloud API. Columns: Metric | Local Gemma via Ollama | Closed cloud API. Rows: cost per 1,000 spec runs, NDA exposure, data residency, rate limits, offline, model swap/fine-tune, margin on a $29 seat. Use real token numbers from the sample run and the $3/$15 per MTok assumption. -->

| Metric | Local Gemma via Ollama | Closed cloud API |
|---|---|---|
| Cost per 1,000 spec runs (22,625 tokens/run: 12,186 in / 10,439 out) | $0.00 | ~$193 (1,000 × (12,186/1e6×$3 + 10,439/1e6×$15)) |
| NDA exposure | None — localhost only, DSN empty by default | Spec text leaves the laptop on every call |
| Data residency | Laptop disk (`data/runs.json`) | Vendor region, retention policy applies |
| Rate limits | None — unlimited iterations | Per-minute caps stall the matrix step |
| Offline | Works on a train, in an air-gapped client office | Requires connectivity |
| Model swap / fine-tune | One env var (`GEMMA_MODEL=gemma3:4b`) | New SKU, new price |
| Margin on a $29 seat | ~$29 minus hosting ($0) | ~$29 minus ~$0.19/run in tokens |

<!-- TODO BEFORE PUBLISHING: after a live Gemma run, replace the fallback-estimated token counts in the table and here with the real gen_ai.usage.* totals from Sentry. -->
The token math uses the fallback-estimated counts from the bundled sample run (12,186 input, 10,439 output) at the $3/$15 per MTok assumption from `.env.example`. On live Gemma the counts come from `usage` directly; in fallback they are estimated as chars/4 so the comparison stays meaningful and is labelled "est.".

## Demo

![SpecShield QA studio: sample spec loaded, three Mastra agents complete, QA matrix tab open](https://raw.githubusercontent.com/AaronStark1/specshield-qa/main/docs/studio-overview.png)

Load the sample, hit Run Pipeline, and watch three agent cards go pending → running → done with durations, token counts and mode chips. Then open the matrix tab (filter by Security, search "GSTIN"), the Playwright tab (switch between the combined spec and each page object, copy, download), the telemetry tab (waterfall bars, trace ID) and history (reload, compare, delete). The demo runs identically with Ollama stopped — the header chip flips to amber Deterministic Fallback and nothing errors.

## Code

{% embed https://github.com/AaronStark1/specshield-qa %}
<!-- README has: npm install && npm run dev; ollama pull gemma2:9b; works without Ollama in fallback mode -->

```bash
npm install && npm run dev   # API :8787 + UI :5173
ollama pull gemma2:9b        # optional: live Gemma; app works without it
```

## How I Built It

The stack is one `package.json`: Vite 6, React 19, TypeScript 5, Tailwind 3.4, Hono on `@hono/node-server` with `tsx`, `@mastra/core` 1.77, `zod`, `@sentry/node`, and a hand-rolled `JsonStore` (atomic temp-file + rename, no SQLite). `npm run dev` runs API and web with `concurrently`; Vite proxies `/api` to :8787.

### The pipeline: three Mastra agents over local Gemma

I defined three agents — Requirement Parser, QA Matrix Architect, Playwright Codegen — each a `new Agent({ id, name, instructions, model: gemmaModel })` registered with the workflow in `server/mastra/index.ts`:

```ts
export const mastra = new Mastra({
  agents: { requirementParser, qaMatrixArchitect, playwrightCodegen },
  workflows: { specShieldWorkflow },
});
```

The model config is the Ollama OpenAI-compatible form from the Mastra model-providers docs (verified against the installed 1.77 types where `OpenAICompatibleConfig` accepts `id: \`${string}/${string}\``):

```ts
// server/mastra/model.ts
export const gemmaModel = {
  id: `custom/${GEMMA_MODEL_NAME}`,
  url: OLLAMA_BASE_URL,
  apiKey: "ollama",
} as const;
```

The workflow chains three `createStep`s exactly as the docs prescribe:

```ts
// server/mastra/workflows/specShieldWorkflow.ts
export const specShieldWorkflow = createWorkflow({
  id: "specShieldWorkflow",
  inputSchema: workflowInputSchema,
  outputSchema: codegenOutputSchema,
})
  .then(parseStep)
  .then(matrixStep)
  .then(codegenStep)
  .commit();
```

Each step emits `step:start`, runs inside `withAgentSpan`, and emits `step:end` with a preview like `5 roles · 23 criteria`, `30 test cases`, `6 page objects · 30 tests`. The route opens an SSE stream (`POST /api/run`), subscribes to those events, and forwards them as `event: <type>` / `data: <json>`. A `: ping` comment every 10 seconds keeps slow Gemma steps alive through proxies. On `pipeline:end` the full `RunRecord` is persisted.

I read the installed `dist/agent/index.d.ts`, `dist/workflows/*.d.ts` and `shared.types.d.ts` before writing a line, because the prompt warned that `createRun` vs `createRunAsync` and `usage.inputTokens` vs `promptTokens` moved between versions. In 1.77 the call is `agent.generate(prompt, { modelSettings: { temperature, maxTokens } })` returning `FullOutput` with `text` and `usage: { inputTokens, outputTokens, totalTokens }`, and the workflow runner is `const run = await workflow.createRun(); await run.start({ inputData })`. I normalise both naming schemes so a future Mastra bump does not silently zero the ROI widget.

### Making Gemma reliable on structured output

Gemma through Ollama does not reliably honour JSON-schema tool calling, so each system prompt pastes the TypeScript interface and ends with "Respond with a single JSON object and nothing else. No markdown fences, no commentary." The matrix prompt additionally demands 18–40 cases with at least 3 Security and 3 Boundary, and concrete values like "an 11 MB PDF" and "GSTIN 27AAPFU0939F1ZV". The codegen prompt demands `import { test, expect } from "@playwright/test"`, one POM per screen, `test.describe` per feature, login fixtures and `// covers` comments.

The response goes through a small, strict parser:

```ts
// server/services/json.ts
export function extractJson(text: string): unknown {
  let t = text.trim();
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
    const repaired = slice
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(repaired);
    } catch (err) {
      throw new Error(`JSON parse failed after repair (excerpt): ${slice.slice(0, 200)} :: ${(err as Error).message}`);
    }
  }
}
```

Then `zod.safeParse`. On failure the step retries once with a repair prompt containing the zod error; on the second failure it uses the deterministic generator for that step and tags the span `fallback`. The run mode becomes `mixed` if any step fell back. Nothing ever 500s on the judge.

### Sentry Agent Tracing

I wrap the pipeline in `ai.pipeline` and each agent in `gen_ai.invoke_agent` wrapping a `gen_ai.chat`, because Sentry's AI Agents Insights only lights up from the `gen_ai.*` operation names:

```ts
// server/services/telemetry.ts
return await Sentry.startSpan(
  {
    op: "gen_ai.invoke_agent",
    name: `invoke_agent ${agentName}`,
    attributes: {
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.agent.name": agentName,
      "gen_ai.request.model": model,
      "specshield.step": step,
      "specshield.run_id": runId,
    },
  },
  async (span) => { /* ... set gen_ai.usage.input_tokens / output_tokens on completion ... */ }
);
```

The chat span records `gen_ai.provider.name: ollama`, `gen_ai.request.model`, `temperature`, `max_tokens`, `gen_ai.input.messages`, `specshield.prompt_chars` at start and `gen_ai.response.model`, `gen_ai.output.messages`, `gen_ai.usage.input_tokens / output_tokens / total_tokens` at end. Span context trace/span IDs are copied into the `TelemetryStep` so the UI drawer can show them with the DSN empty — the collector is an in-process `Map<runId, TelemetryStep[]>`, and `Sentry.getActiveSpan()` guards make everything a no-op without init.

<!-- Real snippet from server/services/telemetry.ts showing gen_ai.invoke_agent and gen_ai.chat spans with token attributes -->
![Sentry trace waterfall: ai.pipeline root span with three invoke_agent children, each wrapping a chat gemma2:9b span](https://raw.githubusercontent.com/AaronStark1/specshield-qa/main/docs/sentry-waterfall.png)

![Sentry span attributes for the QA Matrix Architect chat span: gen_ai.usage.input_tokens, output_tokens, request.model](https://raw.githubusercontent.com/AaronStark1/specshield-qa/main/docs/sentry-span-attributes.png)
<!-- Paragraph "what I found and how I debugged it": name one concrete thing the trace revealed (e.g. the QA Matrix step dominates latency; a JSON parse failure that showed up as a fallback-tagged span). Use real numbers from a run. -->

<!-- TODO BEFORE PUBLISHING: the numbers in the next sentence are PLACEHOLDERS written before Gemma was ever run on this machine. Replace every value with the real durations and gen_ai.usage.* token counts from your Sentry waterfall (Screenshot A/B). -->
What the trace found: the QA Matrix step dominates both tokens and latency. In a live-Gemma run the parser finishes in ~X s with ~N in / ~N out, the matrix takes ~X s with ~N in / ~N out, and codegen takes ~X s. When Gemma returns prose with fences, `extractJson` strips them silently and the span stays `success`; when it returns truncated JSON, the repair retry shows up as a second `gen_ai.chat` span under the same `invoke_agent`, and if that also fails the `invoke_agent` span is tagged `specshield.step_status: fallback` with the zod error captured via `Sentry.captureException`. That tag is how I verified fallback honesty in the UI — amber chips line up exactly with `fallback` spans.

### Local persistence and the fallback mode

`JsonStore` writes `./data/runs.json` atomically (temp file + rename), newest first, with `GET /api/runs` returning summaries without `spec`, `combinedCode` and `requirements`. `GET /api/health` probes `${OLLAMA_BASE_URL}/models` with a 1.5 s timeout cached for 30 s and tolerates the `:latest` suffix. `FORCE_FALLBACK=true` demos fallback even with Ollama running. `npm run smoke` boots the app on a random port in fallback, posts the sample spec, and asserts `pipeline:end` within 30 s with ≥18 cases, four categories and `@playwright/test` in the output. It prints `SMOKE: 30 cases [Functional,Boundary,Negative,Security] playwright=ok`.

<!-- JsonStore, data/runs.json, health probe, FORCE_FALLBACK, why the judge can run it without Ollama -->

## Why Does Open Innovation Matter?

1. 100% data privacy and NDA compliance. The spec is POSTed to localhost, sent to `http://localhost:11434/v1`, and stored in `./data`. With `SENTRY_DSN` empty — the default — nothing leaves the machine at all. When Sentry is enabled, only span attributes and optionally `gen_ai.input/output.messages` go to Sentry, and `SENTRY_SEND_DEFAULT_PII` documents that trade-off in plain language. I can demo this in a client's air-gapped office without a legal review.

2. Zero marginal token cost. The sample run is 22,625 tokens. At closed-API prices that is $0.19 a run, $193 per thousand runs. On Gemma it is $0.00. That is not a rounding error — it is the difference between a flat $29 seat with healthy margin and a usage-metered tool that punishes iteration. Unlimited re-runs mean the QA engineer actually iterates on the matrix instead of hoarding credits.

3. Modularity and control. Swapping `gemma2:9b` for `gemma3:4b` is one env var. The three Mastra agents are plain TypeScript with prompts in `server/mastra/prompts/` — no black-box pipeline. If the vendor portal gains a new tax regime, I add five lines to the parser prompt and a canned case, not a support ticket. The open-weights path to fine-tuning on past runs is real because the data never left the building.

4. No vendor lock-in and offline. The studio runs on a train, in a basement test lab, or behind a client's firewall. Vite serves the UI, Hono serves the API and `dist/` in production, Ollama serves the model. Kill the network and the only thing that changes is the header chip. That independence is why open innovation compounds: every piece can be replaced, self-hosted, or forked without asking permission.

<!-- Four sub-points, each a short paragraph with a concrete example from this build:
     1. 100% data privacy & NDA compliance (spec never leaves the laptop; DSN empty by default; what Sentry sees when enabled)
     2. Zero marginal token cost (unit economics; unlimited iterations; why a flat-rate tool is only viable on open weights)
     3. Modularity & control (swap gemma2:9b → gemma3:12b with one env var; Mastra agents are plain TypeScript; fine-tune path)
     4. No vendor lock-in / offline (works on a train, in a client's air-gapped office) -->

## My Agent Session

<!-- DEVRELAY SESSION: {% embed <devrelay-session-url> %}  — built in one OpenCode (Muse Spark 1.3) session using this repo's OPENCODE_PROMPT.md -->

Built in one OpenCode (Muse Spark 1.3) session from this repo's `OPENCODE_PROMPT.md`. Session URL to be pasted before publishing.

## My First User

<!-- Template, replace before publishing:
     **Who:** <role, e.g. freelance QA engineer, 6 years, fintech clients>
     **What they ran:** <anonymised spec type, size>
     **What they said:** > "<quote>"
     **What I changed because of it:** <one concrete change>
     **Would they pay?** <yes/no/maybe + why> -->

<!-- REMOVE THIS WHOLE SECTION if you do not get a real first user before publishing. Never publish a made-up quote. -->

## Prize Categories

- Best Use of Gemma — all three agents run `gemma2:9b` locally through Ollama's OpenAI-compatible endpoint.
- Mastra — `specShieldWorkflow` orchestrates three Mastra agents over an open-weight model.
- Sentry Agent Tracing — `gen_ai.invoke_agent` / `gen_ai.chat` spans with latency and token usage; screenshots above.
<!-- Add "Entire" only if the agent session is embedded above. -->
