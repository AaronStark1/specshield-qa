import type { CSSProperties, ReactNode } from "react";
import { clsx } from "clsx";
import { SpotlightGroup } from "./Spotlight.tsx";
import { Reveal } from "./Reveal.tsx";
import { Window } from "./Window.tsx";
import { useReveal } from "./hooks.ts";

function SpecVisual() {
  return (
    <Window title="invoice-tracker.prd.md">
      <div className="p-4 font-mono text-[11px] leading-[1.75] text-[var(--text-muted)]">
        <p className="truncate text-white"># Freelancer Invoice Tracker — PRD v1.0</p>
        <p className="mt-1 truncate text-emerald-300">### 3.1 Authentication (FR-AUTH)</p>
        <p className="truncate">
          - <span className="text-cyan-300">FR-AUTH-01</span>: Passwords must be <span className="text-amber-300">8–64</span> characters
        </p>
        <p className="truncate">
          - <span className="text-cyan-300">FR-AUTH-02</span>: After <span className="text-amber-300">5</span> failed logins the account locks
        </p>
        <p className="mt-1 truncate text-emerald-300">### 3.3 Invoices (FR-INV)</p>
        <p className="truncate">
          - <span className="text-cyan-300">FR-INV-03</span>: Due date within <span className="text-amber-300">180</span> days of issue
        </p>
      </div>
    </Window>
  );
}

const CHIPS = [
  { name: "Functional", count: 10, tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  { name: "Boundary", count: 8, tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  { name: "Negative", count: 6, tone: "border-violet-500/40 bg-violet-500/10 text-violet-300" },
  { name: "Security", count: 6, tone: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" },
] as const;

const ROWS = [
  { id: "FIT-FUNC-001", dot: "bg-emerald-400", title: "Freelancer signs up with valid email and password" },
  { id: "FIT-BND-001", dot: "bg-amber-400", title: "Password boundary 7/8 and 64/65 characters" },
  { id: "FIT-NEG-001", dot: "bg-violet-400", title: "Duplicate client email within account rejected" },
  { id: "FIT-SEC-001", dot: "bg-cyan-400", title: "6th failed login inside 10 minutes locks account" },
] as const;

function MatrixVisual() {
  return (
    <Window title="qa-matrix · 30 cases">
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((chip) => (
            <span key={chip.name} className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium", chip.tone)}>
              {chip.name}
              <span className="tabular opacity-80">{chip.count}</span>
            </span>
          ))}
        </div>
        <ul className="mt-3 space-y-1.5 font-mono text-[10.5px]">
          {ROWS.map((row) => (
            <li key={row.id} className="flex items-center gap-2 text-[var(--text-muted)]">
              <span aria-hidden className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", row.dot)} />
              <span className="shrink-0 text-white">{row.id}</span>
              <span className="truncate font-sans text-[11px]">{row.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </Window>
  );
}

function CodeVisual() {
  return (
    <Window title="invoice-tracker.spec.ts">
      <pre className="overflow-hidden p-4 font-mono text-[11px] leading-[1.75] text-[var(--text-muted)]">
        <span className="text-violet-300">import</span> {"{ LoginPage }"} <span className="text-violet-300">from</span>{" "}
        <span className="text-amber-200">"./pages/login.page"</span>;{"\n\n"}
        <span className="text-emerald-300">test</span>(<span className="text-amber-200">"Freelancer signs up…"</span>,{" "}
        <span className="text-violet-300">async</span> ({"{ page }"}) =&gt; {"{"}
        {"\n  "}
        <span className="text-violet-300">const</span> pom = <span className="text-violet-300">new</span>{" "}
        <span className="text-amber-100">LoginPage</span>(page);{"\n  "}
        <span className="text-violet-300">await</span> pom.<span className="text-sky-300">goto</span>();{"\n  "}
        <span className="text-violet-300">await</span> <span className="text-emerald-300">expect</span>(page.<span className="text-sky-300">getByTestId</span>(
        {"\n    "}
        <span className="text-cyan-300">"status-fit-func-001"</span>)).<span className="text-sky-300">toBeVisible</span>();{"\n"}
        {"}"});
      </pre>
    </Window>
  );
}

interface Step {
  number: string;
  title: string;
  body: ReactNode;
  visual: ReactNode;
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "Input the Spec",
    body: "Paste any raw PRD, user story, or markdown spec (or load the 1-click Invoice Tracker demo).",
    visual: <SpecVisual />,
  },
  {
    number: "02",
    title: "Matrix Generation",
    body: "The engine extracts structured requirements into a filterable test matrix: Functional, Boundary, Negative, and Security cases.",
    visual: <MatrixVisual />,
  },
  {
    number: "03",
    title: "Instant Playwright Code",
    body: (
      <>
        Download production-ready <code className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[0.85em] text-white">.spec.ts</code> files
        using the Page Object Model (POM) pattern with auto-generated locators and assertions.
      </>
    ),
    visual: <CodeVisual />,
  },
];

/** The trace that links the three steps: a dim base, a line that draws in, and a pulse that keeps travelling. */
function CircuitRail({ orientation }: { orientation: "horizontal" | "vertical" }) {
  const horizontal = orientation === "horizontal";
  // The horizontal trace returns to the centre line at each column's left edge, where the nodes sit.
  const path = horizontal ? "M0 7 H150 L165 2 H300 L315 7 H483 L498 12 H633 L648 7 H816 L831 2 H960 L975 7 H1000" : "M7 0 V1000";
  return (
    <svg
      aria-hidden
      viewBox={horizontal ? "0 0 1000 14" : "0 0 14 1000"}
      preserveAspectRatio="none"
      className={clsx(
        "circuit-rail",
        horizontal ? "left-0 top-[calc(var(--step-size)+20px)] hidden h-[14px] w-full lg:block" : "left-0 top-0 h-full w-[14px] lg:hidden",
      )}
    >
      <path className="rail-base" d={path} />
      <path className="rail-draw" d={path} pathLength={1} />
      <path className="rail-pulse" d={path} pathLength={1} />
    </svg>
  );
}

/** Section 2 — the three-step workflow in plain language. */
export function WorkflowSection() {
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <section id="how-it-works" className="landing-section" aria-labelledby="workflow-title">
      <div className="ambient-bloom left-1/2 top-[38%] -translate-x-1/2" aria-hidden />
      <div className="landing-container">
        <Reveal>
          <p className="section-eyebrow">How it works</p>
          <h2 id="workflow-title" className="section-title mt-4 max-w-[760px]">
            <span className="text-matrix-gradient">From spec to test suite in three steps</span>
          </h2>
        </Reveal>

        <SpotlightGroup className="mt-14">
          <div
            ref={ref}
            className={clsx("relative", visible && "is-visible")}
            style={{ "--step-size": "clamp(64px, 7vw, 84px)" } as CSSProperties}
          >
            <CircuitRail orientation="horizontal" />
            <CircuitRail orientation="vertical" />
            <ol className="grid gap-x-5 gap-y-14 pl-10 lg:grid-cols-3 lg:pl-0">
              {STEPS.map((step, i) => (
                <li key={step.number} className="relative min-w-0 list-none">
                  <p className="step-number" aria-hidden>
                    {step.number}
                  </p>
                  <div className="absolute left-[-39.5px] top-[calc(var(--step-size)/2-6.5px)] lg:static lg:my-5 lg:flex lg:h-[13px] lg:items-center">
                    <span className="rail-node block" style={{ "--node-delay": `${300 + i * 550}ms` } as CSSProperties} />
                  </div>
                  <Reveal delay={i * 140} className="mt-5 min-w-0 lg:mt-0">
                    <article className="hairline-card spotlight-card flex h-full min-w-0 flex-col p-6">
                      <h3 className="text-[19px] font-semibold tracking-tight text-white">
                        <span className="sr-only">Step {i + 1}: </span>
                        {step.title}
                      </h3>
                      <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">{step.body}</p>
                      <div className="mt-6 min-w-0">{step.visual}</div>
                    </article>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </SpotlightGroup>
      </div>
    </section>
  );
}
