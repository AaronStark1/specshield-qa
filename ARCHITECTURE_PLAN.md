# SpecShield QA — E2E Architecture & Pre-Flight Plan

> **Local-First Spec-to-Test & Playwright E2E Studio for Dev Agencies & Freelance QA Engineers.**
> Hacktoberfest Open-Source AI Challenge · Week 2 · Theme: *Side Hustle* · Deadline **October 18, 2026**
> Challenge page: https://dev.to/challenges/hacktoberfest-week2-2026-10-12

This document is the pre-flight checklist and the system blueprint. Read it once before you run
`OPENCODE_PROMPT.md` through OpenCode (Muse Spark 1.3). Everything here was verified against the
live challenge page, the Mastra docs, the Sentry Agent Tracing docs and the DevRelay site on
2026-10-14. Items marked **VERIFY** could not be confirmed from public docs and need a 30-second
check on your machine.

---

## 0. The pitch in one paragraph (keep this in your head while building)

Boutique agencies and freelance QA engineers sign NDAs that forbid pasting client PRDs into
cloud LLMs. They still burn 4–6 unbillable hours per sprint turning those PRDs into test
scenarios and Playwright boilerplate. SpecShield QA runs a three-agent Mastra workflow on a
**local Gemma model via Ollama**, so the spec never leaves the laptop, every run costs **$0.00 in
tokens**, and the output is a filterable QA matrix plus a downloadable `.spec.ts` suite. Sentry
Agent Tracing makes the pipeline observable (latency, tokens, step status) without shipping the
spec content anywhere you have not opted into. That is the whole "why open innovation matters"
argument, and it is also the reason someone would pay $29/month for it.

### Prize map (confirmed on the challenge page)

| Category | Prize | What the judges look for | How SpecShield QA hits it |
|---|---|---|---|
| **Best Use of Gemma** (featured) | $200 | Run Gemma locally, fine-tune it, or serve it through a provider | All three agents run `gemma2:9b` (or `gemma3`) locally through Ollama's OpenAI-compatible endpoint |
| **Mastra** (partner) | $100 | "Orchestrate an agent over open models" | `specShieldWorkflow` = three Mastra agents chained with `createWorkflow().then().then().then().commit()` |
| **Sentry Agent Tracing** (partner) | $100 | Show agent setup, performance (latency, tokens, cost), what you found, how you debugged. "Include traces or screenshots in your write-up." | Manual `gen_ai.invoke_agent` / `gen_ai.chat` spans under an `ai.pipeline` root span, screenshots pasted into `DEV_SUBMISSION.md` |
| **Entire** (partner, bonus) | $100 | "Share the agent sessions behind your project in the write-up" | The DevRelay-saved OpenCode session doubles as evidence for this category. List it under Prize Categories only if you actually embed the session. |
| **First user** (bonus) | — | Land a real user and report how it went | Template section in `DEV_SUBMISSION.md`; see §5 |

Judging weights, in order: **writing quality (heaviest)**, relevance to theme, creativity,
technical execution, partner tech. Budget your last two hours for the article, not the code.

---

## 1. Pre-Flight Developer Checklist

Work through these top to bottom. Total time: roughly 25 minutes plus the Gemma download.

### 1.1 Machine baseline (already confirmed on this Mac)

| Tool | Status | Note |
|---|---|---|
| Node | v24.15.0 | Fine. Vite 6 / Hono / tsx all support it. |
| npm | 11.12.1 | Fine. |
| Ollama | **not installed** | Step 1.2 fixes this. |
| git user.email | `djaaronmirage123@gmail.com` | Set for this repo only (`git config user.email`). Global config untouched. |

### 1.2 Pull and serve Gemma locally via Ollama

```bash
# 1. Install Ollama (macOS). Either the official installer or Homebrew.
brew install ollama            # or download from https://ollama.com/download

# 2. Start the server (keep this terminal open, or run `brew services start ollama`).
OLLAMA_CONTEXT_LENGTH=8192 ollama serve     # default context is 4096, too small for the codegen step

# 3. In a second terminal, pull Gemma. gemma2:9b is ~5.4 GB and fits a 16 GB Mac comfortably.
ollama pull gemma2:9b

#    Alternative if you want the newer family (needs Ollama >= 0.6):
#    ollama pull gemma3:12b     # ~8 GB, better JSON adherence, slower on 16 GB machines
#    ollama pull gemma3:4b      # ~3 GB, fastest; good enough for the demo video

# 4. Smoke-test the OpenAI-compatible endpoint SpecShield QA will talk to.
curl -s http://localhost:11434/v1/models | jq '.data[].id'
curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma2:9b","messages":[{"role":"user","content":"Reply with the JSON {\"ok\":true}"}]}' \
  | jq '.choices[0].message.content, .usage'
```

You should see `prompt_tokens` and `completion_tokens` in `usage`. Those numbers are what the
Sentry spans and the ROI widget consume. If `ollama pull` is slow, start OpenCode on the
scaffold in parallel; the app's fallback mode works without the model.

**Keep-alive tip for the demo video:** run `ollama run gemma2:9b ""` once before recording so the
model is warm. Cold loads add 5–15 seconds to the first agent step.

### 1.3 How `@mastra/core` is wired into the backend

Mastra is the orchestration layer. It owns the agent definitions, the sequential workflow, and
the run lifecycle. Nothing else in the app calls the model directly.

```
server/mastra/
├── index.ts          new Mastra({ agents: {...}, workflows: { specShieldWorkflow } })
├── model.ts          resolves the Gemma model config from env (Ollama OpenAI-compatible URL)
├── agents/
│   ├── requirementParser.ts     Agent #1  → ParsedRequirements (roles, criteria, fields, rules)
│   ├── qaMatrixArchitect.ts     Agent #2  → TestCase[] (Functional / Boundary / Negative / Security)
│   └── playwrightCodegen.ts     Agent #3  → PlaywrightSuite (POM classes + spec file)
└── workflows/
    └── specShieldWorkflow.ts    createWorkflow().then(parse).then(matrix).then(codegen).commit()
```

**Model config (Mastra object form, verified in the Mastra model-providers docs):**

```ts
// server/mastra/model.ts
export const gemmaModel = {
  id: `custom/${process.env.GEMMA_MODEL ?? "gemma2:9b"}`,   // "custom/<ollama model name>"
  url: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  apiKey: "ollama",                                         // Ollama ignores it but some clients require non-empty
};
// Agent usage: new Agent({ id, name, instructions, model: gemmaModel })
```

If the installed `@mastra/core` version rejects the object form, the fallback is an AI SDK
provider instance, which Mastra also accepts as `model`:

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
const ollama = createOpenAICompatible({ name: "ollama", baseURL: OLLAMA_BASE_URL });
export const gemmaModel = ollama(GEMMA_MODEL);
```

**Workflow API (verified in the Mastra workflows docs):**

```ts
import { createWorkflow, createStep } from "@mastra/core/workflows";
const run = await specShieldWorkflow.createRun();
const result = await run.start({ inputData: { runId, spec } });
// result.status === "success" | "failed" | "suspended"; result.steps[stepId].{status,output}
```

The one-shot prompt tells OpenCode to read the installed type definitions before writing
Mastra code, because the API has moved between 0.x and 1.x (`createRun` vs `createRunAsync`,
`usage.promptTokens` vs `usage.inputTokens`). That instruction is the single biggest
protection against a broken build.

**Structured output strategy:** Gemma through Ollama does not reliably honor JSON-schema tool
calling. Each agent is prompted to return *only* a JSON object, the response goes through
`extractJson()` (strips code fences, finds the outermost `{...}`), then `zod.safeParse`. One
repair retry, then the deterministic fallback for that step. The run is tagged
`mode: "gemma" | "fallback" | "mixed"` so the UI and Sentry both know what happened.

### 1.4 Sentry: free project → DSN → first trace → the winning screenshot

1. **Create the project.** Sign in at https://sentry.io (free Developer plan is enough).
   *Projects → Create Project → platform **Node.js** (plain Node, not Express) → name it
   `specshield-qa` → Create.*
2. **Copy the DSN.** On the "Configure SDK" screen, copy the `dsn: "https://...@o....ingest.sentry.io/..."`
   value. You can find it again later under *Settings → Projects → specshield-qa → Client Keys (DSN)*.
3. **Put it in `.env`:**
   ```bash
   cp .env.example .env
   # then edit:
   SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
   SENTRY_TRACES_SAMPLE_RATE=1.0
   SENTRY_SEND_DEFAULT_PII=true     # required so span inputs/outputs show in the AI Agents view
   ```
4. **Run a spec.** `npm run dev`, open http://localhost:5173, click **Load Sample Enterprise
   Spec**, click **Run Pipeline**. Do this with Ollama running so the trace has real token
   counts. Do it twice: once normally, once with Ollama stopped, so you also have a
   *fallback-mode* trace to talk about in the "how I debugged it" paragraph.
5. **Find the trace.** In Sentry: *Insights → AI → Agents* (sometimes labelled **AI Agents** or
   **Agent Monitoring** in the sidebar). You should see three agents: `Requirement Parser`,
   `QA Matrix Architect`, `Playwright Codegen`, each with run count, average duration and
   tokens. Click the latest trace, or go to *Explore → Traces* and filter `span.op:ai.pipeline`.
6. **Take the two screenshots that win the category:**
   - **Screenshot A — the waterfall.** The trace detail view showing the root span
     `specShieldWorkflow` (`ai.pipeline`) with three nested `invoke_agent …` spans and the
     `chat gemma2:9b` span inside each. Hover so the duration bars are visible. Crop to the
     waterfall. This is the image judges expect.
   - **Screenshot B — the span attributes.** Click the `chat gemma2:9b` span under
     `invoke_agent QA Matrix Architect` and capture the attributes panel showing
     `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.request.model`,
     `specshield.prompt_chars`, `specshield.test_case_count`.
   - Optional **Screenshot C** — the *Agents* overview table with the three agents and their
     token totals. Good for the "performance" paragraph.
7. Save them as `docs/sentry-waterfall.png`, `docs/sentry-span-attributes.png`,
   `docs/sentry-agents-overview.png`. `DEV_SUBMISSION.md` already has the image callouts.

**Span design (verified against Sentry's Node manual-instrumentation page):**

| Level | `op` | `name` | Key attributes |
|---|---|---|---|
| Root | `ai.pipeline` | `specShieldWorkflow` | `specshield.run_id`, `specshield.spec_chars`, `specshield.mode` |
| Per agent | `gen_ai.invoke_agent` | `invoke_agent Requirement Parser` (etc.) | `gen_ai.operation.name=invoke_agent`, `gen_ai.agent.name`, `gen_ai.request.model`, `specshield.step_status` |
| Per LLM call | `gen_ai.chat` | `chat gemma2:9b` | `gen_ai.operation.name=chat`, `gen_ai.provider.name=ollama`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.total_tokens`, `gen_ai.input.messages`, `gen_ai.output.messages`, `specshield.prompt_chars` |

Why not plain `ai.agent.run` / `ai.chat_completions`? Those names are fine as custom ops, but
Sentry's **AI Agents Insights** dashboard only populates from the `gen_ai.*` operation names and
attributes. Using them means the Agents table, token charts and cost view all light up with
zero extra work. The root span keeps the `ai.pipeline` op so the trace is easy to filter.

**Privacy note for the article:** the spec text is sent to Sentry only inside
`gen_ai.input.messages` when `SENTRY_SEND_DEFAULT_PII=true`. The app ships with
`SENTRY_DSN` empty, so by default nothing leaves the machine. State this explicitly in the
"Why Open Innovation Matters" section; it is a strong, honest talking point.

### 1.5 Record the OpenCode build session with DevRelay

DevRelay is an MCP gateway plus skill pack that lets a coding agent (OpenCode is listed as
supported) enter DEV challenges, publish to DEV, and **save an agent transcript to DEV so it can
be embedded in a post**. Sign-in is through MLH; publishing requires your DEV account to be
linked in your MLH profile.

**Already installed, project-locally (done 2026-10-14).** The stock installer wants to write to
`~/.devrelay`, edit `~/.config/opencode/opencode.jsonc`, append to shell profiles and add a
launchd auto-updater. Instead it was run with `HOME` redirected into the repo and every global
side effect disabled, so nothing outside `specshield-qa/` was touched:

```
.devrelay-home/.devrelay/bin/dev_mlh_mcp_server   gateway binary (v0.1.20, macos-aarch64)
.devrelay-home/.devrelay/                          MLH/DEV credentials land here after login
opencode.json                                      project-level OpenCode config wiring the MCP server
.gitignore                                         ignores both of the above
```

`opencode.json` launches the gateway with `HOME` pointed at `.devrelay-home`,
`DEVRELAY_DISABLE_AUTO_UPDATE=1` and `DEVRELAY_SKILLS_AUTO_SYNC=0`, so credentials, locks and
logs stay inside the project. To reproduce on another machine:

```bash
curl -fsSL https://devrelay.com/install.sh -o /tmp/devrelay-install.sh
mkdir -p .devrelay-home
HOME="$PWD/.devrelay-home" sh /tmp/devrelay-install.sh --hosts=none --no-auto-update --no-path-update --no-skills
# then update the absolute paths in opencode.json
```

**One manual step left: sign in.** Run this once from the repo root (it opens a browser for
the MLH OAuth flow, then stores the token under `.devrelay-home/.devrelay/`):

```bash
HOME="$PWD/.devrelay-home" .devrelay-home/.devrelay/bin/devrelay login
HOME="$PWD/.devrelay-home" .devrelay-home/.devrelay/bin/devrelay status   # should show MLH + linked DEV profile
```

If `status` shows the DEV account as not linked, link it in your MLH profile first
(https://my.mlh.io), then re-run `status`. Without the link, the gateway can read DEV but
cannot save a session or publish.

**Recording workflow (do this in order, in ONE OpenCode session):**

1. Open OpenCode in `specshield-qa` with Muse Spark 1.3 selected.
2. Paste the full contents of `OPENCODE_PROMPT.md` as the first message. Let it run to
   completion. Do not start a new session midway; the transcript is the artifact.
3. When the build and `DEV_SUBMISSION.md` are done, send a final message:
   *"Save this agent session to DEV with DevRelay so I can embed it in my Hacktoberfest Week 2
   post."* The gateway asks for confirmation, then returns a DEV session URL.
4. Paste that URL into the **My Agent Session** section of `DEV_SUBMISSION.md`. The challenge
   page says to embed it with the `agent_session` tag or link to it; use the embed form shown
   in the official submission template (`{% embed <session-url> %}` is the standard DEV liquid
   tag and the template may show an `agent_session`-specific form). **VERIFY** the exact tag in
   the template dropdown on the challenge page before publishing.
5. Backup: OpenCode's own `/share` command produces a public conversation link. Keep it in a
   note in case the DevRelay save fails; it is better than no session link.

---

## 2. System Architecture

### 2.1 Stack decision

**Vite + React 19 + TypeScript + Tailwind (client)** and **Hono on `@hono/node-server` + tsx
(server)** in one repository, one `package.json`, one `npm run dev`.

Why not Next.js App Router: Sentry's Node SDK and Mastra both want to be initialised in a plain
Node process (`instrument.ts` imported first). In Next.js that means `instrumentation.ts`,
`serverExternalPackages`, and bundler edge cases that a one-shot build has no time to debug. A
Hono server is 40 lines, streams SSE natively, and the trace hierarchy stays clean. The client
stays a static bundle, which also makes the "nothing leaves your laptop" claim literally true.

### 2.2 Runtime topology

```
┌──────────────────────────── npm run dev (concurrently) ────────────────────────────┐
│                                                                                    │
│  Vite dev server :5173 ──── proxy /api ────▶  Hono API :8787                       │
│  React Studio UI                             ├── GET  /api/health      (ollama? model? mode)
│   ├ SpecEditor + Load Sample                 ├── POST /api/run         (SSE stream of pipeline events)
│   ├ PipelineProgress (3 agents)              ├── GET  /api/runs        (local history)
│   ├ Tabs: Matrix | Playwright | Telemetry | History   GET /api/runs/:id
│   ├ RoiCalculator + PrivacyBadge             └── DELETE /api/runs/:id
│   └ SSE client (fetch + ReadableStream)             │
│                                                      ▼
│                                        Mastra  specShieldWorkflow
│                                        ┌─────────────────────────────┐
│                                        │ 1 Requirement Parser Agent  │
│                                        │ 2 QA Matrix Architect Agent │──▶ Gemma via Ollama
│                                        │ 3 Playwright Codegen Agent  │    http://localhost:11434/v1
│                                        └──────────┬──────────────────┘    (or deterministic fallback)
│                                                   │
│                       Sentry spans (ai.pipeline ▶ gen_ai.invoke_agent ▶ gen_ai.chat)
│                       TelemetryCollector (in-process, feeds the UI drawer even with no DSN)
│                       JsonStore → ./data/runs.json (atomic writes, zero-config)
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Request lifecycle for one run

1. Client `POST /api/run { spec, title }`. Server generates `runId`, registers an event
   emitter for it, opens an SSE response.
2. Server opens root span `ai.pipeline`, calls `specShieldWorkflow.createRun().start()`.
3. Each step: emit `step:start` → open `gen_ai.invoke_agent` span → build prompt → open
   `gen_ai.chat` span → `agent.generate()` → record usage on both spans → parse/validate →
   emit `step:end { durationMs, inputTokens, outputTokens, mode }`.
4. On success: compute ROI, persist `RunRecord` to `data/runs.json`, emit `pipeline:end`
   with the full result, close the stream.
5. On any failure inside a step: that step falls back to the deterministic generator, the
   span gets `specshield.step_status=fallback` and the error is captured with
   `Sentry.captureException`. The pipeline never 500s on the judge.

### 2.4 Fallback mode (the judge-proofing)

`GET /api/health` probes `${OLLAMA_BASE_URL}/models` with a 1.5 s timeout and checks that
`GEMMA_MODEL` is in the list. Result cached 30 s. The header badge reads
**"Gemma 2 9B · Local"** (green) or **"Deterministic Fallback · Start Ollama for live
inference"** (amber). The fallback generator is not a stub: it derives roles, fields, numeric
limits and security surfaces from the actual spec text with regexes and heuristics, and for the
bundled sample spec it ships a hand-written, high-quality canned result so the one-click demo
always looks finished. Every artifact carries `mode` so nothing is ever misrepresented as
Gemma output.

### 2.5 File tree

```
specshield-qa/
├── ARCHITECTURE_PLAN.md            ← this file
├── OPENCODE_PROMPT.md              ← the one-shot prompt
├── DEV_SUBMISSION.md               ← generated by OpenCode (publication-ready article)
├── README.md
├── LICENSE                         (MIT)
├── .env.example
├── .gitignore                      (node_modules, dist, .env, data/*.json, docs/*.png optional)
├── package.json                    single package; scripts below
├── tsconfig.json                   base (paths: @shared/*)
├── tsconfig.app.json               client (DOM, react-jsx)
├── tsconfig.server.json            server (node, ESM)
├── vite.config.ts                  react() + tailwind + /api proxy → 8787
├── tailwind.config.ts / postcss.config.js
├── index.html
├── docs/                           screenshots for the article
├── data/                           runs.json created at first run (gitignored)
├── shared/                         imported by both sides, zero runtime deps except zod
│   ├── types.ts                    ParsedRequirements, TestCase, PlaywrightSuite, RunRecord, TelemetryStep, PipelineEvent
│   ├── schemas.ts                  zod schemas for every agent output
│   ├── sampleSpec.ts               Enterprise Vendor Onboarding & KAM Site Survey Portal PRD
│   └── roi.ts                      computeRoi(result, assumptions) — pure, unit-testable
├── server/
│   ├── instrument.ts               Sentry.init (first import; no-op when DSN empty)
│   ├── index.ts                    Hono app, routes, static serve of dist/ in production
│   ├── env.ts                      typed env loader with defaults
│   ├── routes/
│   │   ├── health.ts
│   │   ├── run.ts                  SSE pipeline runner
│   │   └── runs.ts                 history CRUD
│   ├── services/
│   │   ├── ollama.ts               detectOllama(), listModels()
│   │   ├── telemetry.ts            TelemetryCollector + Sentry span helpers (withAgentSpan, withChatSpan)
│   │   ├── store.ts                JsonStore<RunRecord> with atomic write
│   │   ├── json.ts                 extractJson(), parseWithSchema()
│   │   └── fallback/
│   │       ├── parseRequirements.ts
│   │       ├── buildMatrix.ts
│   │       ├── generatePlaywright.ts
│   │       └── sampleCanned.ts     canned result for the bundled sample spec
│   └── mastra/
│       ├── index.ts
│       ├── model.ts
│       ├── agents/{requirementParser,qaMatrixArchitect,playwrightCodegen}.ts
│       ├── prompts/{parser,matrix,codegen}.ts
│       └── workflows/specShieldWorkflow.ts
└── src/                            React client
    ├── main.tsx, App.tsx, index.css
    ├── lib/{api.ts, sse.ts, download.ts, format.ts}
    ├── hooks/{useHealth.ts, usePipeline.ts, useRuns.ts}
    ├── state/pipelineStore.ts      (zustand or useReducer; keep it small)
    └── components/
        ├── layout/{Header.tsx, PrivacyBadge.tsx, RoiCalculator.tsx}
        ├── editor/{SpecEditor.tsx, LoadSampleButton.tsx}
        ├── pipeline/{PipelineProgress.tsx, AgentStepCard.tsx}
        ├── workspace/{WorkspaceTabs.tsx, QaMatrixTab.tsx, TestCaseRow.tsx, PlaywrightTab.tsx, CodeBlock.tsx, TelemetryDrawer.tsx, HistoryTab.tsx, RunDiff.tsx}
        └── ui/{Badge.tsx, Button.tsx, Tabs.tsx, EmptyState.tsx, Kbd.tsx}
```

### 2.6 `package.json` scripts

```json
{
  "scripts": {
    "dev": "concurrently -k -n api,web -c cyan,magenta \"npm:dev:api\" \"npm:dev:web\"",
    "dev:api": "tsx watch --env-file-if-exists=.env server/index.ts",
    "dev:web": "vite",
    "build": "npm run typecheck && vite build",
    "typecheck": "tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.server.json --noEmit",
    "start": "NODE_ENV=production tsx --env-file-if-exists=.env server/index.ts",
    "smoke": "tsx scripts/smoke.ts",
    "lint": "eslint ."
  }
}
```

`--env-file-if-exists` is native in Node 22.9+ (you have 24), so no `dotenv` dependency and no crash when `.env` is missing. `npm start` serves `dist/`
from Hono on :8787, which is the single-port mode you want for the demo video.

### 2.7 `.env.example`

```bash
# ── Local Gemma inference (Ollama OpenAI-compatible endpoint) ───────────────
OLLAMA_BASE_URL=http://localhost:11434/v1
GEMMA_MODEL=gemma2:9b            # or gemma3:12b / gemma3:4b
GEMMA_TEMPERATURE=0.2
GEMMA_MAX_TOKENS_PARSER=2048
GEMMA_MAX_TOKENS_MATRIX=3072
GEMMA_MAX_TOKENS_CODEGEN=2560
OLLAMA_TIMEOUT_MS=300000          # per call; gemma2:9b on an M4 runs ~13 tok/s

# ── Sentry Agent Tracing (leave DSN empty to run fully air-gapped) ──────────
SENTRY_DSN=
SENTRY_ENVIRONMENT=local
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_SEND_DEFAULT_PII=true     # needed for prompt/response previews in the AI Agents view

# ── App ──────────────────────────────────────────────────────────────────────
PORT=8787
DATA_DIR=./data
FORCE_FALLBACK=false             # set true to demo fallback mode even with Ollama running

# ── ROI defaults (editable in the UI) ───────────────────────────────────────
ROI_HOURLY_RATE_USD=85
ROI_MANUAL_MINUTES_PER_TEST_CASE=12
ROI_CLOUD_INPUT_USD_PER_MTOK=3
ROI_CLOUD_OUTPUT_USD_PER_MTOK=15
```

### 2.8 Core data contracts (OpenCode implements these exactly)

```ts
export type AgentMode = "gemma" | "fallback";
export type TestCategory = "Functional" | "Boundary" | "Negative" | "Security";
export type Priority = "P0" | "P1" | "P2" | "P3";

export interface ParsedRequirements {
  title: string;
  summary: string;
  roles: { name: string; description: string }[];
  features: { id: string; name: string; description: string; roles: string[] }[];
  acceptanceCriteria: { id: string; featureId: string; text: string }[];
  fields: { name: string; type: string; required: boolean; constraints: string[]; featureId: string }[];
  validationRules: { id: string; rule: string; featureId: string }[];
  securitySurfaces: string[];
}

export interface TestCase {
  id: string;                       // e.g. "VND-FUNC-001"
  featureId: string;
  category: TestCategory;
  title: string;
  given: string; when: string; then: string;
  priority: Priority;
  expectedResult: string;
  tags: string[];
}

export interface PlaywrightSuite {
  fileName: string;                 // "vendor-onboarding.spec.ts"
  pageObjects: { className: string; fileName: string; code: string }[];
  specCode: string;                 // full .spec.ts, imports POMs by relative path
  combinedCode: string;             // single-file version for download
  coverage: { testCaseId: string; testName: string }[];
}

export interface TelemetryStep {
  step: "requirementParser" | "qaMatrixArchitect" | "playwrightCodegen";
  agentName: string;
  status: "pending" | "running" | "success" | "fallback" | "error";
  mode: AgentMode;
  startedAt: number; endedAt?: number; durationMs?: number;
  model: string;
  promptChars: number;
  inputTokens: number; outputTokens: number;
  sentryTraceId?: string; sentrySpanId?: string;
  error?: string;
}

export interface RoiEstimate {
  testCaseCount: number;
  estimatedManualHours: number;
  hourlyRateUsd: number;
  billableValueUsd: number;
  totalTokens: number;
  cloudEquivalentCostUsd: number;   // what the same tokens would cost on a frontier cloud API
  localCostUsd: 0;
  pipelineSeconds: number;
}

export interface RunRecord {
  id: string; createdAt: string; title: string;
  specHash: string; specChars: number; spec: string;
  mode: AgentMode | "mixed";
  requirements: ParsedRequirements;
  testCases: TestCase[];
  playwright: PlaywrightSuite;
  telemetry: TelemetryStep[];
  roi: RoiEstimate;
  sentryTraceUrl?: string;
}

export type PipelineEvent =
  | { type: "pipeline:start"; runId: string; mode: AgentMode; model: string }
  | { type: "step:start"; runId: string; step: TelemetryStep }
  | { type: "step:end"; runId: string; step: TelemetryStep; preview?: unknown }
  | { type: "pipeline:end"; runId: string; record: RunRecord }
  | { type: "error"; runId: string; message: string };
```

---

## 3. Build-day run order

| # | Action | Time |
|---|---|---|
| 1 | `ollama pull gemma2:9b` in the background | 10 min (download) |
| 2 | Install DevRelay, restart OpenCode, sign in with MLH | 5 min |
| 3 | Paste `OPENCODE_PROMPT.md` into OpenCode (Muse Spark 1.3), let it run | 20–40 min |
| 4 | `npm run dev` → Load Sample → Run. Confirm green badge, three steps, matrix, code, telemetry, history | 5 min |
| 5 | Add Sentry DSN, run twice (Gemma + forced fallback), take screenshots A/B/C into `docs/` | 10 min |
| 6 | Ask OpenCode to save the session via DevRelay, paste URL into `DEV_SUBMISSION.md` | 3 min |
| 7 | Send the repo to one QA/dev friend, collect a quote, fill **My First User** | async |
| 8 | Record a 60–90 s demo (Load Sample → Run → tabs → download `.spec.ts` → Sentry waterfall) | 15 min |
| 9 | Push to GitHub (public), paste repo embed, publish from `DEV_SUBMISSION.md` with `published: true` | 5 min |

---

## 4. Risk register

| Risk | Mitigation already in the design |
|---|---|
| Mastra API drift breaks the build | Prompt forces OpenCode to read installed typings and pin versions; model config has an AI SDK fallback |
| Gemma returns prose instead of JSON | `extractJson` + zod + one repair retry + per-step deterministic fallback |
| Judge has no Ollama | Health probe → fallback mode with canned sample result; badge is honest about it |
| Sentry DSN missing | `Sentry.startSpan` is a no-op without init; UI drawer reads the in-process collector instead |
| 9B model slow on judge's machine | Measured ~13 tok/s on an M4; minified JSON, per-step token budgets, template POMs and a 300 s timeout bring a live run to ~3.7 min. `GEMMA_MODEL=gemma3:4b` documented as the faster option |
| Spec text leaks via Sentry | DSN empty by default; PII flag documented; article states it plainly |
| Article rushed | `DEV_SUBMISSION.md` generated with the official section order and placeholders, so only screenshots, links and the user quote are left |

---

## 5. Landing the first user (bonus points, cheap to get)

Send this to one freelance QA or agency developer you know, today:

> I built a local tool that turns a PRD into a QA test matrix and Playwright tests without the
> spec leaving your laptop. Takes 2 minutes: `git clone … && npm i && npm run dev`, click
> "Load Sample Spec", hit Run. Would you paste in one real (anonymised) spec and tell me
> (1) whether the matrix caught anything you'd have missed, (2) whether you'd pay $29/mo?

Their two answers go straight into the **My First User** section. Honest feedback, including
"no, I wouldn't pay", reads better to judges than a canned testimonial.

---

## 6. Sources checked for this plan

- Challenge page and prize categories: https://dev.to/challenges/hacktoberfest-week2-2026-10-12
- DevRelay install and MCP config: https://devrelay.com/
- Mastra model providers (custom OpenAI-compatible URL): https://mastra.ai/docs/getting-started/model-providers
- Mastra workflows (`createWorkflow`, `createStep`, `createRun`, `start`): https://mastra.ai/docs/workflows/overview
- Sentry Node manual agent instrumentation (`gen_ai.*` ops and attributes): https://docs.sentry.io/platforms/javascript/guides/node/agent-tracing/manual-instrumentation/
- Sentry agent naming: https://docs.sentry.io/product/agents/naming/
