import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { requirementParser } from "../agents/requirementParser.js";
import { qaMatrixArchitect } from "../agents/qaMatrixArchitect.js";
import { playwrightCodegen } from "../agents/playwrightCodegen.js";
import { PARSER_SYSTEM, parserUser } from "../prompts/parser.js";
import { MATRIX_SYSTEM, matrixUser } from "../prompts/matrix.js";
import { CODEGEN_SYSTEM, codegenUser } from "../prompts/codegen.js";
import { parsedRequirementsSchema, testCaseArraySchema, playwrightSuiteSchema } from "@shared/schemas.js";
import { parseWithSchema } from "../../services/json.js";
import { parseRequirements } from "../../services/fallback/parseRequirements.js";
import { buildMatrix } from "../../services/fallback/buildMatrix.js";
import { generatePlaywright } from "../../services/fallback/generatePlaywright.js";
import { getSampleCanned, isSampleSpec } from "../../services/fallback/sampleCanned.js";
import { events } from "../../services/events.js";
import { TelemetryCollector, currentTraceIds, withAgentSpan, withChatSpan } from "../../services/telemetry.js";
import { env } from "../../env.js";
import { modelDisplayName, modelSettings } from "../model.js";
import type { AgentMode, ParsedRequirements, PlaywrightSuite, StepId, TestCase } from "@shared/types.js";

const workflowInputSchema = z.object({
  runId: z.string(),
  spec: z.string(),
  title: z.string(),
  mode: z.enum(["gemma", "fallback"]),
});

const parseOutputSchema = z.object({
  runId: z.string(),
  spec: z.string(),
  title: z.string(),
  mode: z.enum(["gemma", "fallback"]),
  requirements: parsedRequirementsSchema,
});

const matrixOutputSchema = z.object({
  runId: z.string(),
  spec: z.string(),
  title: z.string(),
  mode: z.enum(["gemma", "fallback"]),
  requirements: parsedRequirementsSchema,
  testCases: testCaseArraySchema,
});

const codegenOutputSchema = z.object({
  runId: z.string(),
  spec: z.string(),
  title: z.string(),
  mode: z.enum(["gemma", "fallback"]),
  requirements: parsedRequirementsSchema,
  testCases: testCaseArraySchema,
  playwright: playwrightSuiteSchema,
});

interface AgentLike {
  generate: (msg: string, opts?: Record<string, unknown>) => Promise<{ text: string; usage?: unknown }>;
  stream?: (msg: string, opts?: Record<string, unknown>) => Promise<{ textStream?: AsyncIterable<string>; usage?: unknown }>;
}

function estimateTokens(promptChars: number, textChars: number): { inputTokens: number; outputTokens: number } {
  return { inputTokens: Math.round(promptChars / 4), outputTokens: Math.round(textChars / 4) };
}

async function generateWithAgent(
  agent: AgentLike,
  prompt: string,
  systemLen: number,
  stepMaxTokens: number,
  onProgress?: (outputTokens: number, tokensPerSecond: number) => void
): Promise<{ text: string; inputTokens: number; outputTokens: number; responseModel: string }> {
  const settings = modelSettings();
  const timeoutMs = env.OLLAMA_TIMEOUT_MS;
  const maxTokens = stepMaxTokens;
  const opts: Record<string, unknown> = {
    modelSettings: { temperature: settings.temperature, maxTokens },
  };
  try {
    (opts as { abortSignal?: AbortSignal }).abortSignal = AbortSignal.timeout(timeoutMs);
  } catch {
    // ignore
  }

  if (typeof agent.stream === "function") {
    const t0 = Date.now();
    let lastEmit = t0;
    const streamPromise = agent.stream(prompt, opts);
    const timeoutPromise = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`Ollama timeout after ${timeoutMs}ms`)), timeoutMs + 2000)
    );
    const res = await Promise.race([streamPromise, timeoutPromise]);
    let text = "";
    if (res && res.textStream) {
      for await (const chunk of res.textStream) {
        text += chunk;
        const now = Date.now();
        if (now - lastEmit >= 1000) {
          lastEmit = now;
          const estTokens = Math.round(text.length / 4);
          const elapsedSec = (now - t0) / 1000;
          const tokPerSec = elapsedSec > 0 ? Number((estTokens / elapsedSec).toFixed(1)) : 0;
          if (onProgress) {
            onProgress(estTokens, tokPerSec);
          }
        }
      }
    } else {
      text = String((res as { text?: unknown })?.text ?? "");
    }

    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const usage = await (res as { usage?: unknown })?.usage;
      if (usage && typeof usage === "object") {
        const u = usage as Record<string, unknown>;
        inputTokens = Number(u.inputTokens ?? u.promptTokens ?? 0) || 0;
        outputTokens = Number(u.outputTokens ?? u.completionTokens ?? 0) || 0;
      }
    } catch {
      // ignore
    }
    if (inputTokens === 0 && outputTokens === 0) {
      const est = estimateTokens(prompt.length + systemLen, text.length);
      inputTokens = est.inputTokens;
      outputTokens = est.outputTokens;
    }
    return { text, inputTokens, outputTokens, responseModel: modelDisplayName() };
  }

  const run = async () => {
    const res = await Promise.race([
      agent.generate(prompt, opts),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Ollama timeout after ${timeoutMs}ms`)), timeoutMs + 2000)),
    ]);
    const text = (res as { text?: unknown }).text;
    const usage = (res as { usage?: Record<string, unknown> }).usage ?? {};
    const inputTokens =
      Number((usage as Record<string, unknown>).inputTokens ?? (usage as Record<string, unknown>).promptTokens ?? 0) || 0;
    const outputTokens =
      Number((usage as Record<string, unknown>).outputTokens ?? (usage as Record<string, unknown>).completionTokens ?? 0) || 0;
    const str = typeof text === "string" ? text : String(text ?? "");
    if (inputTokens === 0 && outputTokens === 0) {
      const est = estimateTokens(prompt.length + systemLen, str.length);
      return { text: str, inputTokens: est.inputTokens, outputTokens: est.outputTokens, responseModel: modelDisplayName() };
    }
    return { text: str, inputTokens, outputTokens, responseModel: modelDisplayName() };
  };
  return run();
}

function startStep(runId: string, step: StepId, agentName: string, promptChars: number): void {
  const now = Date.now();
  const ids = currentTraceIds();
  TelemetryCollector.update(runId, step, {
    status: "running",
    startedAt: now,
    promptChars,
    sentryTraceId: ids.traceId,
    sentrySpanId: ids.spanId,
  });
  const cur = TelemetryCollector.get(runId).find((s) => s.step === step);
  if (cur) events.emit(runId, { type: "step:start", runId, step: { ...cur } });
}

function endStep(
  runId: string,
  step: StepId,
  patch: {
    status: "success" | "fallback" | "error";
    mode: AgentMode;
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    codegenStrategy?: string;
    error?: string;
  },
  preview?: { label: string; value: string }
): void {
  const ids = currentTraceIds();
  const endedAt = Date.now();
  TelemetryCollector.update(runId, step, {
    status: patch.status,
    mode: patch.mode,
    endedAt,
    durationMs: patch.durationMs,
    inputTokens: patch.inputTokens,
    outputTokens: patch.outputTokens,
    codegenStrategy: patch.codegenStrategy,
    error: patch.error,
    sentryTraceId: ids.traceId,
    sentrySpanId: ids.spanId,
  });
  const cur = TelemetryCollector.get(runId).find((s) => s.step === step);
  if (cur) events.emit(runId, { type: "step:end", runId, step: { ...cur }, preview });
}

const parseStep = createStep({
  id: "requirementParser",
  inputSchema: workflowInputSchema,
  outputSchema: parseOutputSchema,
  execute: async ({ inputData }) => {
    const { runId, spec, title, mode } = inputData as z.infer<typeof workflowInputSchema>;
    const agentName = "Requirement Parser";
    const model = modelDisplayName();
    const userPrompt = parserUser(spec, title);
    const promptChars = PARSER_SYSTEM.length + userPrompt.length;
    const t0 = Date.now();
    startStep(runId, "requirementParser", agentName, promptChars);

    const done = async (
      requirements: ParsedRequirements,
      stepMode: AgentMode,
      status: "success" | "fallback",
      inputTokens: number,
      outputTokens: number,
      error?: string
    ) => {
      const durationMs = Date.now() - t0;
      endStep(
        runId,
        "requirementParser",
        { status, mode: stepMode, durationMs, inputTokens, outputTokens, error },
        { label: "requirements", value: `${requirements.roles.length} roles · ${requirements.acceptanceCriteria.length} criteria` }
      );
      return { runId, spec, title, mode, requirements };
    };

    if (mode === "fallback") {
      if (isSampleSpec(spec)) {
        const canned = getSampleCanned();
        return done(canned.requirements, "fallback", "fallback", 0, 0);
      }
      const req = parseRequirements(spec);
      if (title) req.title = title;
      return done(req, "fallback", "fallback", 0, 0);
    }

    try {
      const onProgress = (outputTokens: number, tokensPerSecond: number) => {
        TelemetryCollector.update(runId, "requirementParser", { progress: { outputTokens, tokensPerSecond } });
        events.emit(runId, { type: "step:progress", runId, step: "requirementParser", outputTokens, tokensPerSecond });
      };

      const out = await withAgentSpan(runId, "requirementParser", agentName, model, async (api) => {
        const chat = await withChatSpan(model, [{ role: "user", content: userPrompt }], promptChars, () =>
          generateWithAgent(
            requirementParser as unknown as AgentLike,
            userPrompt,
            PARSER_SYSTEM.length,
            env.GEMMA_MAX_TOKENS_PARSER,
            onProgress
          )
        );
        const parsed = parseWithSchema(parsedRequirementsSchema, chat.text);
        if (parsed.ok) {
          api.setUsage(chat.inputTokens, chat.outputTokens);
          api.setStatus("success");
          return { status: "success" as const, inputTokens: chat.inputTokens, outputTokens: chat.outputTokens, value: parsed.data };
        }

        // Repair retry once with short prompt (zod error + invalid output, no original prompt)
        const repairPrompt = `Your previous output failed JSON/schema validation:
Error: ${parsed.error}

Invalid output:
${chat.text.slice(0, 3000)}

Return ONLY the corrected, valid minified JSON object matching ParsedRequirements on a single line.`;

        const chat2 = await withChatSpan(model, [{ role: "user", content: repairPrompt }], repairPrompt.length, () =>
          generateWithAgent(
            requirementParser as unknown as AgentLike,
            repairPrompt,
            PARSER_SYSTEM.length,
            env.GEMMA_MAX_TOKENS_PARSER,
            onProgress
          )
        );
        const parsed2 = parseWithSchema(parsedRequirementsSchema, chat2.text);
        if (parsed2.ok) {
          api.setUsage(chat.inputTokens + chat2.inputTokens, chat.outputTokens + chat2.outputTokens);
          api.setStatus("success");
          return { status: "success" as const, inputTokens: chat.inputTokens + chat2.inputTokens, outputTokens: chat.outputTokens + chat2.outputTokens, value: parsed2.data };
        }
        throw new Error(`Requirement JSON invalid: ${parsed2.error}`);
      });
      return done(out.value, "gemma", "success", out.inputTokens, out.outputTokens);
    } catch (err) {
      if (isSampleSpec(spec)) {
        const canned = getSampleCanned();
        return done(canned.requirements, "fallback", "fallback", 0, 0, (err as Error).message);
      }
      const req = parseRequirements(spec);
      if (title) req.title = title;
      return done(req, "fallback", "fallback", 0, 0, (err as Error).message);
    }
  },
});

const matrixStep = createStep({
  id: "qaMatrixArchitect",
  inputSchema: parseOutputSchema,
  outputSchema: matrixOutputSchema,
  execute: async ({ inputData }) => {
    const { runId, spec, title, mode, requirements } = inputData as z.infer<typeof parseOutputSchema>;
    const agentName = "QA Matrix Architect";
    const model = modelDisplayName();
    const reqJson = JSON.stringify(requirements);
    const userPrompt = matrixUser(reqJson);
    const promptChars = MATRIX_SYSTEM.length + userPrompt.length;
    const t0 = Date.now();
    startStep(runId, "qaMatrixArchitect", agentName, promptChars);

    const done = async (
      testCases: TestCase[],
      stepMode: AgentMode,
      status: "success" | "fallback",
      inputTokens: number,
      outputTokens: number,
      error?: string
    ) => {
      const durationMs = Date.now() - t0;
      endStep(
        runId,
        "qaMatrixArchitect",
        { status, mode: stepMode, durationMs, inputTokens, outputTokens, error },
        { label: "matrix", value: `${testCases.length} test cases` }
      );
      return { runId, spec, title, mode, requirements, testCases };
    };

    if (mode === "fallback") {
      if (isSampleSpec(spec)) {
        const canned = getSampleCanned();
        return done(canned.testCases, "fallback", "fallback", 0, 0);
      }
      return done(buildMatrix(requirements), "fallback", "fallback", 0, 0);
    }

    try {
      const onProgress = (outputTokens: number, tokensPerSecond: number) => {
        TelemetryCollector.update(runId, "qaMatrixArchitect", { progress: { outputTokens, tokensPerSecond } });
        events.emit(runId, { type: "step:progress", runId, step: "qaMatrixArchitect", outputTokens, tokensPerSecond });
      };

      const out = await withAgentSpan(runId, "qaMatrixArchitect", agentName, model, async (api) => {
        const chat = await withChatSpan(model, [{ role: "user", content: userPrompt }], promptChars, () =>
          generateWithAgent(
            qaMatrixArchitect as unknown as AgentLike,
            userPrompt,
            MATRIX_SYSTEM.length,
            env.GEMMA_MAX_TOKENS_MATRIX,
            onProgress
          )
        );
        const schema = z.object({ testCases: testCaseArraySchema });
        const parsed = parseWithSchema(schema, chat.text);
        const list = parsed.ok ? parsed.data.testCases : null;
        const bare = !list ? parseWithSchema(testCaseArraySchema, chat.text) : null;
        const finalList = list ?? (bare && bare.ok ? bare.data : null);
        if (finalList && finalList.length >= 8) {
          api.setUsage(chat.inputTokens, chat.outputTokens);
          api.setStatus("success");
          return { status: "success" as const, inputTokens: chat.inputTokens, outputTokens: chat.outputTokens, value: finalList.slice(0, 40) };
        }

        // Short repair prompt with zod error + invalid output
        const repairPrompt = `Your previous output failed validation${parsed.ok ? "" : `: ${(parsed as { error: string }).error}`}:
Invalid output:
${chat.text.slice(0, 3000)}

Return 12–20 test cases across all four categories as a single-line minified JSON: {"testCases":[...]}`;

        const chat2 = await withChatSpan(model, [{ role: "user", content: repairPrompt }], repairPrompt.length, () =>
          generateWithAgent(
            qaMatrixArchitect as unknown as AgentLike,
            repairPrompt,
            MATRIX_SYSTEM.length,
            env.GEMMA_MAX_TOKENS_MATRIX,
            onProgress
          )
        );
        const p2 = parseWithSchema(schema, chat2.text);
        const l2 = p2.ok ? p2.data.testCases : null;
        const b2 = !l2 ? parseWithSchema(testCaseArraySchema, chat2.text) : null;
        const f2 = l2 ?? (b2 && b2.ok ? b2.data : null);
        if (f2 && f2.length >= 8) {
          api.setUsage(chat.inputTokens + chat2.inputTokens, chat.outputTokens + chat2.outputTokens);
          api.setStatus("success");
          return { status: "success" as const, inputTokens: chat.inputTokens + chat2.inputTokens, outputTokens: chat.outputTokens + chat2.outputTokens, value: f2.slice(0, 40) };
        }
        throw new Error(`Matrix JSON invalid: ${!p2.ok ? (p2 as { error: string }).error : "too few cases"}`);
      });
      return done(out.value, "gemma", "success", out.inputTokens, out.outputTokens);
    } catch (err) {
      if (isSampleSpec(spec)) {
        const canned = getSampleCanned();
        return done(canned.testCases, "fallback", "fallback", 0, 0, (err as Error).message);
      }
      return done(buildMatrix(requirements), "fallback", "fallback", 0, 0, (err as Error).message);
    }
  },
});

const codegenStep = createStep({
  id: "playwrightCodegen",
  inputSchema: matrixOutputSchema,
  outputSchema: codegenOutputSchema,
  execute: async ({ inputData }) => {
    const { runId, spec, title, mode, requirements, testCases } = inputData as z.infer<typeof matrixOutputSchema>;
    const agentName = "Playwright Codegen";
    const model = modelDisplayName();
    const userPrompt = codegenUser(JSON.stringify(requirements), JSON.stringify(testCases));
    const promptChars = CODEGEN_SYSTEM.length + userPrompt.length;
    const t0 = Date.now();
    startStep(runId, "playwrightCodegen", agentName, promptChars);

    const done = async (
      playwright: PlaywrightSuite,
      stepMode: AgentMode,
      status: "success" | "fallback",
      inputTokens: number,
      outputTokens: number,
      codegenStrategy?: string,
      error?: string
    ) => {
      const durationMs = Date.now() - t0;
      endStep(
        runId,
        "playwrightCodegen",
        { status, mode: stepMode, durationMs, inputTokens, outputTokens, codegenStrategy, error },
        { label: "playwright", value: `${playwright.pageObjects.length} page objects · ${playwright.coverage.length} tests` }
      );
      return { runId, spec, title, mode, requirements, testCases, playwright };
    };

    if (mode === "fallback") {
      if (isSampleSpec(spec)) {
        const canned = getSampleCanned();
        return done(canned.playwright, "fallback", "fallback", 0, 0);
      }
      return done(generatePlaywright(requirements, testCases), "fallback", "fallback", 0, 0);
    }

    try {
      const onProgress = (outputTokens: number, tokensPerSecond: number) => {
        TelemetryCollector.update(runId, "playwrightCodegen", { progress: { outputTokens, tokensPerSecond } });
        events.emit(runId, { type: "step:progress", runId, step: "playwrightCodegen", outputTokens, tokensPerSecond });
      };

      const out = await withAgentSpan(runId, "playwrightCodegen", agentName, model, async (api) => {
        const chat = await withChatSpan(model, [{ role: "user", content: userPrompt }], promptChars, () =>
          generateWithAgent(
            playwrightCodegen as unknown as AgentLike,
            userPrompt,
            CODEGEN_SYSTEM.length,
            env.GEMMA_MAX_TOKENS_CODEGEN,
            onProgress
          )
        );

        const extractTestBody = (text: string): string => {
          try {
            const parsed = parseWithSchema(z.object({ testBody: z.string().optional(), specCode: z.string().optional() }), text);
            if (parsed.ok && (parsed.data.testBody || parsed.data.specCode)) {
              return (parsed.data.testBody || parsed.data.specCode || "").trim();
            }
          } catch {
            // ignore
          }
          const m = text.match(/test\.describe[\s\S]+/);
          if (m) {
            return m[0].replace(/```+$/, "").trim();
          }
          return "";
        };

        let testBody = extractTestBody(chat.text);
        let totalIn = chat.inputTokens;
        let totalOut = chat.outputTokens;

        if (!testBody || !testBody.includes("test")) {
          const repairPrompt = `Your previous output did not contain valid Playwright test.describe blocks.
Invalid output:
${chat.text.slice(0, 3000)}

Return ONLY a minified JSON object on a single line: {"testBody":"test.describe(...) ..."}`;

          const chat2 = await withChatSpan(model, [{ role: "user", content: repairPrompt }], repairPrompt.length, () =>
            generateWithAgent(
              playwrightCodegen as unknown as AgentLike,
              repairPrompt,
              CODEGEN_SYSTEM.length,
              env.GEMMA_MAX_TOKENS_CODEGEN,
              onProgress
            )
          );
          totalIn += chat2.inputTokens;
          totalOut += chat2.outputTokens;
          testBody = extractTestBody(chat2.text);
        }

        if (!testBody || !testBody.includes("test")) {
          throw new Error("Model failed to generate Playwright test body");
        }

        // Generate deterministic template POMs from requirements
        const templateSuite = generatePlaywright(requirements, []);
        const pageObjects = templateSuite.pageObjects;
        const fileName = templateSuite.fileName;
        const imports = pageObjects
          .map((p) => `import { ${p.className} } from "./pages/${p.fileName.replace(/\.ts$/, "")}";`)
          .join("\n");

        // Compute coverage from // covers comments
        const coversMatches = [...testBody.matchAll(/\/\/\s*covers\s+([A-Za-z0-9_-]+)/g)];
        const coveredIds = new Set(coversMatches.map((m) => m[1]).filter((x): x is string => Boolean(x)));
        const coverage: { testCaseId: string; testName: string }[] = [];
        for (const id of coveredIds) {
          const tc = testCases.find((c) => c.id === id);
          coverage.push({ testCaseId: id, testName: tc ? tc.title.slice(0, 90) : `Test covering ${id}` });
        }
        if (coverage.length === 0) {
          for (const c of testCases.slice(0, 10)) {
            coverage.push({ testCaseId: c.id, testName: c.title.slice(0, 90) });
          }
        }

        const specCode = [
          `import { test, expect } from "@playwright/test";`,
          imports,
          ``,
          `/**`,
          ` * ${requirements.title}`,
          ` * Generated by SpecShield QA — ${coverage.length} tests across ${requirements.features.length} features.`,
          ` * Run with: npx playwright test ${fileName}`,
          ` */`,
          ``,
          testBody,
        ].join("\n");

        const combinedCode = [
          `import { test, expect, type Page, type Locator } from "@playwright/test";`,
          ``,
          `/* ── Page Objects (inlined for single-file download) ─────────────────── */`,
          ``,
          ...pageObjects.flatMap((p) => {
            const body = p.code.split("\n").filter((l) => !l.startsWith("import {")).join("\n");
            return [body];
          }),
          ``,
          `/* ── Tests ───────────────────────────────────────────────────────────── */`,
          ``,
          testBody,
        ].join("\n");

        const playwright: PlaywrightSuite = {
          fileName,
          pageObjects,
          specCode,
          combinedCode,
          coverage,
        };

        api.setUsage(totalIn, totalOut);
        api.setStatus("success");
        api.setAttribute("specshield.codegen_strategy", "gemma-tests+template-pom");

        return {
          status: "success" as const,
          inputTokens: totalIn,
          outputTokens: totalOut,
          value: playwright,
          codegenStrategy: "gemma-tests+template-pom",
        };
      });

      return done(out.value, "gemma", "success", out.inputTokens, out.outputTokens, out.codegenStrategy);
    } catch (err) {
      if (isSampleSpec(spec)) {
        const canned = getSampleCanned();
        return done(canned.playwright, "fallback", "fallback", 0, 0, undefined, (err as Error).message);
      }
      return done(generatePlaywright(requirements, testCases), "fallback", "fallback", 0, 0, undefined, (err as Error).message);
    }
  },
});

export const specShieldWorkflow = createWorkflow({
  id: "specShieldWorkflow",
  inputSchema: workflowInputSchema,
  outputSchema: codegenOutputSchema,
})
  .then(parseStep)
  .then(matrixStep)
  .then(codegenStep)
  .commit();

export type SpecShieldInput = z.infer<typeof workflowInputSchema>;
export type SpecShieldOutput = z.infer<typeof codegenOutputSchema>;
