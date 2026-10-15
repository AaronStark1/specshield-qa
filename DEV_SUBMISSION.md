---
title: "SpecShield QA: Turning NDA-Locked Specs into Playwright Suites with Local Gemma, Mastra and Sentry"
published: false
tags: devchallenge, hf26challenge, gemma, mastra
cover_image: https://raw.githubusercontent.com/AaronStark1/specshield-qa/main/docs/studio-overview.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge: Week 2](https://dev.to/challenges/hacktoberfest-week2-2026-10-12) (Side Hustle)*

## What I Built

Boutique agencies and freelance QA engineers live under NDAs that forbid pasting client PRDs into cloud LLMs. I have watched a two-page registration story turn into an afternoon of spreadsheet test cases, then another afternoon of Playwright boilerplate. Four to six unbillable hours per sprint, every sprint, and the work is so mechanical it hurts.

SpecShield QA is a local-first studio that takes that PRD and returns three things: structured requirements with roles, features and validation rules; a filterable QA matrix across Functional, Boundary, Negative and Security (14 cases from live Gemma on the bundled sample, 30 in the deterministic demo mode); and a downloadable Playwright suite built on the Page Object Model with one class per screen, `getByTestId` locators, login fixtures and a `// covers FIT-FUNC-001` comment on every test.

The whole pipeline runs on Gemma locally through Ollama, so the spec never leaves the laptop and inference costs $0.00. Every agent step is traced with Sentry Agent Tracing, past runs persist to a local JSON file, and the app stays fully usable when Ollama is not installed thanks to a deterministic fallback that is honest about its `mode`.

### The Side Hustle Business Model

The buyer is a freelance QA engineer billing $85 an hour, or a five-person agency that onboards two clients' worth of regression suites a month. The bundled Freelancer Invoice Tracker spec serves as a deliberately small, public stand-in for a confidential client PRD, so anyone can run it without NDA concern; a live Gemma run produces 14 test cases and 5 page objects. At 12 minutes per case plus 25 minutes per page object and 45 minutes of review ((14 × 12 + 5 × 25 + 45) / 60), that is 5.6 hours, or $476 of billable value, per run. Charge $29 a month for the seat and the tool pays for itself if it saves twenty minutes.

Agencies get the second tier: shared run history in `data/runs.json`, compare-with-previous diffs, Markdown and CSV exports for client sign-off, and a telemetry drawer they can screenshot into a status report. The pitch is not "AI writes tests". It is "your NDA stays intact, your junior spends Friday on exploratory testing instead of boilerplate, and you can prove it with a trace".

| Metric | Local Gemma via Ollama | Closed cloud API |
|---|---|---|
| Cost per 1,000 spec runs (6,915 tokens/run: 4,511 in / 2,404 out) | $0.00 | ~$50 (1,000 × (4,511/1e6×$3 + 2,404/1e6×$15)) |
| NDA exposure | None — localhost only, DSN empty by default | Spec text leaves the laptop on every call |
| Data residency | Laptop disk (`data/runs.json`) | Vendor region, retention policy applies |
| Rate limits | None — unlimited iterations | Per-minute caps stall the matrix step |
| Offline | Works on a train, in an air-gapped client office | Requires connectivity |
| Model swap / fine-tune | One env var (`GEMMA_MODEL=gemma3:4b`) | New SKU, new price |
| Margin on a $29 seat | ~$29 minus hosting ($0) | ~$29 minus ~$0.05/run in tokens, metered |

The token math uses the real `usage` counts from a live `gemma2:9b` run of the bundled sample on a 16 GB MacBook Air M4 (4,511 input, 2,404 output, 220.9 s end to end) at the $3/$15 per MTok assumption from `.env.example`. On live Gemma the counts come from `usage` directly; in fallback they are estimated as chars/4 so the comparison stays meaningful and is labelled "est.".

## Demo

![SpecShield QA demo: the Invoice Tracker sample runs through three Mastra agents on local Gemma 2 9B, then the QA matrix is filtered to Security, a case is expanded, and the Playwright code, Sentry telemetry and run history tabs are shown](https://raw.githubusercontent.com/AaronStark1/specshield-qa/main/docs/specshield-demo-loop.gif)

*A real run on local Gemma, with the six-minute wait fast-forwarded about 57x. It was recorded headless by a Playwright script, so a Playwright test generator filmed its own demo. Recording on the same laptop slowed Gemma down, which is why these timings are longer than the traced run further down.*

Load the sample (Load Sample Spec (Invoice Tracker)), hit Run Pipeline, and watch three agent cards go pending → running → done with durations, token counts and mode chips. Then open the matrix tab (filter by Security, search "overdue" or "password"), the Playwright tab (switch between the combined spec and each page object, copy, download), the telemetry tab (waterfall bars, trace ID, codegen strategy) and history (reload, compare, delete). The demo runs identically with Ollama stopped — the header chip flips to amber Deterministic Fallback and nothing errors.

## Code

{% embed https://github.com/AaronStark1/specshield-qa %}

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

Each step emits `step:start`, runs inside `withAgentSpan`, and emits `step:end` with a preview like `3 roles · 22 criteria`, `30 test cases`, `6 page objects · 30 tests`. The route opens an SSE stream (`POST /api/run`), subscribes to those events, and forwards them as `event: <type>` / `data: <json>`. A `: ping` comment every 10 seconds keeps slow Gemma steps alive through proxies. On `pipeline:end` the full `RunRecord` is persisted.

I read the installed `dist/agent/index.d.ts`, `dist/workflows/*.d.ts` and `shared.types.d.ts` before writing a line, because the prompt warned that `createRun` vs `createRunAsync` and `usage.inputTokens` vs `promptTokens` moved between versions. In 1.77 the call is `agent.generate(prompt, { modelSettings: { temperature, maxTokens } })` returning `FullOutput` with `text` and `usage: { inputTokens, outputTokens, totalTokens }`, and the workflow runner is `const run = await workflow.createRun(); await run.start({ inputData })`. I normalise both naming schemes so a future Mastra bump does not silently zero the ROI widget.

### Making Gemma reliable on structured output

Gemma through Ollama does not reliably honour JSON-schema tool calling, so each system prompt pastes the TypeScript interface, instructs minified single-line JSON, and ends with "Respond with a single minified JSON on a single line and nothing else. No markdown fences, no commentary." The matrix prompt requests 12–20 test cases with at least 2 per category, and concrete values like "a 65-character password", "quantity 1000", and "a payment $0.01 over the outstanding balance". The codegen prompt generates test body blocks with `// covers` comments, paired with deterministic Page Object Model classes.

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

![Sentry trace waterfall: POST /api/run, then the ai.pipeline specShieldWorkflow span, then three invoke_agent spans, each wrapping a chat gemma2:9b span and the HTTP call to Ollama](https://raw.githubusercontent.com/AaronStark1/specshield-qa/main/docs/sentry-waterfall.png)

![Sentry span attributes for the QA Matrix Architect chat span: gen_ai.usage.input_tokens, output_tokens, request.model](https://raw.githubusercontent.com/AaronStark1/specshield-qa/main/docs/sentry-span-attributes.png)

![Sentry Agents dashboard: the live run listed with its agents, 4 LLM calls, 7.1K total tokens and $0 total cost](https://raw.githubusercontent.com/AaronStark1/specshield-qa/main/docs/sentry-agents-overview.png)

#### What the trace found, and how I debugged it

My first live run looked fine in the UI and was quietly wrong. All three agent cards finished, but every one had an amber Fallback chip. The Ollama server log showed why: each chat completion was cut off at the two-minute mark. My Mac (a 16 GB MacBook Air M4) generates about 13 tokens per second with `gemma2:9b`, and the parser alone wanted more output than two minutes allows. The app's 120-second timeout killed the call, the repair retry was killed too, and the step fell back. Every run would have been 100% deterministic output while the header proudly said "Gemma".

The fix was to spend fewer tokens rather than wait longer. I made every agent return minified single-line JSON, gave each step its own token budget, capped live matrices at 12 to 20 cases, and let Gemma write only the Playwright test bodies while page-object classes come from templates. I also stopped retrying after a timeout, raised the per-call timeout to five minutes, and raised Ollama's context window from 4,096 to 8,192 tokens.

The Sentry trace above is the run that confirmed it. The whole pipeline took 3.87 minutes with all three agents on Gemma:

| Agent | Duration | Input tokens | Output tokens |
|---|---|---|---|
| Requirement Parser | 83.8 s | 1,133 | 932 |
| QA Matrix Architect | 73.1 s | 1,270 | 1,016 |
| Playwright Codegen | 75.4 s | 2,216 | 611 |

Two details in the waterfall answered questions I could not answer from logs. First, each `http.client` call to Ollama spans the full length of its `gen_ai.chat` span, so the time is all model generation, not my app. Second, Sentry computed the generation speed itself: the QA Matrix span reports 13.9 tokens per second. The latency budget is set by hardware, so the only lever that matters is how many tokens I ask for.

The Agents dashboard adds one more line I did not plan for. Sentry lists 7.1K tokens for the run and a total cost of $0, because there is no per-token price for a model running on my own laptop.

If a step does fail on Gemma now, it shows up in the trace rather than hiding behind a finished card. A validation failure adds a second `gen_ai.chat` span under the same agent for the repair attempt. If that fails too, the agent span is tagged `specshield.step_status: fallback` and the error is sent to Sentry, matching the amber chip in the UI.

### Local persistence and the fallback mode

`JsonStore` writes `./data/runs.json` atomically (temp file + rename), newest first, with `GET /api/runs` returning summaries without `spec`, `combinedCode` and `requirements`. `GET /api/health` probes `${OLLAMA_BASE_URL}/models` with a 1.5 s timeout cached for 30 s and tolerates the `:latest` suffix. `FORCE_FALLBACK=true` demos fallback even with Ollama running. `npm run smoke` boots the app on a random port in fallback, posts the sample spec, and asserts `pipeline:end` within 30 s with ≥18 cases, four categories and `@playwright/test` in the output. It prints `SMOKE: 30 cases [Functional,Boundary,Negative,Security] playwright=ok`.

## Why Does Open Innovation Matter?

1. 100% data privacy and NDA compliance. The spec is POSTed to localhost, sent to `http://localhost:11434/v1`, and stored in `./data`. With `SENTRY_DSN` empty — the default — nothing leaves the machine at all. When Sentry is enabled, only span attributes and optionally `gen_ai.input/output.messages` go to Sentry, and `SENTRY_SEND_DEFAULT_PII` documents that trade-off in plain language. I can demo this in a client's air-gapped office without a legal review.

2. Zero marginal token cost. The live sample run is 6,915 tokens. At closed-API prices that is about five cents a run, roughly $50 per thousand runs. Five cents sounds trivial until you remember the sample is deliberately small: a real client PRD is several times longer, every re-run is billed again, and an agency multiplies it by every client. On Gemma it is $0.00 no matter how often you iterate. That is the difference between a flat $29 seat with predictable margin and a usage-metered tool that quietly punishes iteration. Unlimited re-runs mean the QA engineer actually iterates on the matrix instead of hoarding credits.

3. Modularity and control. Swapping `gemma2:9b` for `gemma3:4b` is one env var. The three Mastra agents are plain TypeScript with prompts in `server/mastra/prompts/` — no black-box pipeline. If the invoice tracker gains a new discount or currency rule, I add five lines to the parser prompt and a canned case, not a support ticket. The open-weights path to fine-tuning on past runs is real because the data never left the building.

4. No vendor lock-in and offline. The studio runs on a train, in a basement test lab, or behind a client's firewall. Vite serves the UI, Hono serves the API and `dist/` in production, Ollama serves the model. Kill the network and the only thing that changes is the header chip. That independence is why open innovation compounds: every piece can be replaced, self-hosted, or forked without asking permission.

## My Agent Session

{% agent_session specshield-qa-one-shot-build-in-opencode-muse-spark-13-dardxr %}

[Open the full session on DEV](https://dev.to/agent_sessions/specshield-qa-one-shot-build-in-opencode-muse-spark-13-dardxr) if the embed above does not load.

This is the complete one-shot build: one prompt (Part 1 of [`OPENCODE_PROMPT.md`](https://github.com/AaronStark1/specshield-qa/blob/main/OPENCODE_PROMPT.md)) to a passing acceptance checklist, 162 messages and 162 tool calls with OpenCode running Muse Spark 1.3. The follow-up that swapped the sample spec and fixed live Gemma latency (Part 2 of the same file) ran in Antigravity after my OpenCode quota ran out, so it is not in this transcript. Local paths are redacted, and long file contents and tool outputs are truncated.

## Prize Categories

- Best Use of Gemma — all three agents run `gemma2:9b` locally through Ollama's OpenAI-compatible endpoint.
- Mastra — `specShieldWorkflow` orchestrates three Mastra agents over an open-weight model.
- Sentry Agent Tracing — `gen_ai.invoke_agent` / `gen_ai.chat` spans with latency and token usage; screenshots above.
