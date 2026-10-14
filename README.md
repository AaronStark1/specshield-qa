# SpecShield QA — Local-First Spec-to-Test & Playwright E2E Studio

Local-first studio that turns a pasted PRD into **structured requirements**, a **filterable QA test matrix**, and a **downloadable Playwright `.spec.ts` suite (Page Object Model)** — with **zero cloud calls** by default.

Three **Mastra** agents run on **Google Gemma locally through Ollama**, traced with **Sentry Agent Tracing**. No Ollama? The app still runs in a polished **deterministic fallback mode**. No Sentry DSN? Spans become no-ops and the UI reads an in-process collector.

## Quick start

```bash
npm install
cp .env.example .env   # optional
npm run dev            # API :8787 + UI :5173
```

Open http://localhost:5173 → **Load Sample Spec (Invoice Tracker)** → **Run Pipeline**.

With Ollama for live Gemma inference:

```bash
OLLAMA_CONTEXT_LENGTH=8192 ollama serve
ollama pull gemma2:9b   # or gemma3:4b for faster runs on resource-constrained laptops
npm run dev
```

Single-port production mode:

```bash
npm run build
npm start              # serves dist/ + API on :8787
```

## How fallback works

`GET /api/health` probes `${OLLAMA_BASE_URL}/models` (1.5 s timeout, 30 s cache) and checks `GEMMA_MODEL` is listed. If unreachable, missing, or `FORCE_FALLBACK=true`, the pipeline uses deterministic generators:

- `parseRequirements()` — headings → features, bold bullets → roles, `FR-XXX-nn` bullets → criteria, numbers-with-units → constraints, keywords → security surfaces.
- `buildMatrix()` — happy-path per feature, boundary at min−1/max+1, negative per required field, security per surface. Deterministic IDs from the title prefix.
- `generatePlaywright()` — template POMs + `test.describe` suites with `// covers` comments.
- `sampleCanned.ts` — hand-polished result for the bundled Freelancer Invoice Tracker sample spec (sha256 match), so the one-click demo is always excellent: 3 roles, 6 features, 30 cases, 6 page objects.

Every artifact carries `mode: "gemma" | "fallback" | "mixed"`. The header chip is honest: green `Gemma 2 9B · Local` or amber `Deterministic Fallback`.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama OpenAI-compatible endpoint |
| `GEMMA_MODEL` | `gemma2:9b` | Model name (`gemma3:4b` faster on lighter laptops, `gemma3:12b` also supported) |
| `GEMMA_TEMPERATURE` | `0.2` | Sampling temperature |
| `GEMMA_MAX_TOKENS` | `undefined` | Optional global override for all steps |
| `GEMMA_MAX_TOKENS_PARSER` | `2048` | Max output tokens for Requirement Parser |
| `GEMMA_MAX_TOKENS_MATRIX` | `3072` | Max output tokens for QA Matrix Architect |
| `GEMMA_MAX_TOKENS_CODEGEN` | `2560` | Max output tokens for Playwright Codegen |
| `OLLAMA_TIMEOUT_MS` | `300000` | Per-call timeout, then per-step fallback |
| `SENTRY_DSN` | `` | Empty = fully air-gapped; spans are no-ops |
| `SENTRY_ENVIRONMENT` | `local` | Sentry environment |
| `SENTRY_TRACES_SAMPLE_RATE` | `1.0` | Trace sample rate |
| `SENTRY_SEND_DEFAULT_PII` | `true` | Prompt/response previews in AI Agents view |
| `PORT` | `8787` | API port |
| `DATA_DIR` | `./data` | `runs.json` location (atomic write temp+rename) |
| `FORCE_FALLBACK` | `false` | Demo fallback even with Ollama running |
| `ROI_*` | see `.env.example` | ROI defaults, editable in UI |

## Architecture

```
Vite :5173 ──/api──▶ Hono :8787 ──▶ Mastra specShieldWorkflow ──▶ Gemma via Ollama :11434/v1
  React Studio UI        │              1 Requirement Parser ─┐       (or deterministic fallback)
   SpecEditor            │              2 QA Matrix Architect ─┤
   Matrix|Playwright     │              3 Playwright Codegen ──┘
   Telemetry|History     ├── Sentry ai.pipeline ▶ gen_ai.invoke_agent ▶ gen_ai.chat
   RoiCalculator         └── JsonStore → ./data/runs.json (no DB)
```

## Scripts

- `npm run dev` — API + web with `concurrently`
- `npm run typecheck` — both tsconfigs
- `npm run lint` — eslint (warnings ok)
- `npm run build` — typecheck + vite build
- `npm run smoke` — fallback end-to-end (≥18 cases, 4 categories, real Playwright code)
- `npx tsx scripts/sample-run.ts` — live SSE probe printing per-step duration and tokens

## Screenshots

- `docs/studio-overview.png` — studio after a sample run
- `docs/sentry-waterfall.png` — Sentry trace waterfall
- `docs/sentry-span-attributes.png` — span attributes with `gen_ai.usage.*`

## License

MIT © 2026 SpecShield QA contributors
