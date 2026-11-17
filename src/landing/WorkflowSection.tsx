import type { ReactNode } from "react";
import { Reveal } from "./Reveal.tsx";

function SpecVisual() {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-white/[0.08] bg-black/50 p-4 font-mono text-[11px] leading-[1.7] text-[var(--text-muted)]">
      <p className="text-white"># Invoice Tracker — PRD v1.0</p>
      <p className="mt-1 text-emerald-300/90">### 3.1 Authentication</p>
      <p className="truncate">- Passwords must be 8–64 characters…</p>
      <p className="truncate">- After 5 failed logins the account locks…</p>
      <p className="mt-1 text-emerald-300/90">### 3.3 Invoices</p>
      <p className="truncate">- Due date no more than 180 days after…</p>
    </div>
  );
}

const CATEGORIES = [
  { name: "Functional", count: 10, bar: "bg-emerald-400", text: "text-emerald-300" },
  { name: "Boundary", count: 8, bar: "bg-amber-400", text: "text-amber-300" },
  { name: "Negative", count: 6, bar: "bg-violet-400", text: "text-violet-300" },
  { name: "Security", count: 6, bar: "bg-cyan-400", text: "text-cyan-300" },
] as const;

function MatrixVisual() {
  return (
    <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-black/50 p-4">
      {CATEGORIES.map((c) => (
        <div key={c.name} className="flex items-center gap-3 font-mono text-[11px]">
          <span className={`w-[74px] shrink-0 ${c.text}`}>{c.name}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <span className={`block h-full rounded-full ${c.bar}`} style={{ width: `${c.count * 10}%` }} />
          </span>
          <span className="w-5 shrink-0 text-right text-white">{c.count}</span>
        </div>
      ))}
    </div>
  );
}

function CodeVisual() {
  return (
    <pre className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/50 p-4 font-mono text-[11px] leading-[1.7] text-[var(--text-muted)]">
      <span className="text-violet-300">import</span> {"{ LoginPage }"} <span className="text-violet-300">from</span>{" "}
      <span className="text-amber-200">"./pages/login.page"</span>;{"\n\n"}
      <span className="text-emerald-300">test</span>(<span className="text-amber-200">"locks after 5 failed logins"</span>,{"\n"}
      {"  "}
      <span className="text-violet-300">async</span> ({"{ page }"}) =&gt; {"{"}
      {"\n"}
      {"  "}
      <span className="text-violet-300">const</span> login = <span className="text-violet-300">new</span> LoginPage(page);{"\n"}
      {"  "}
      <span className="text-violet-300">await</span> <span className="text-emerald-300">expect</span>(login.error){"\n"}
      {"    "}.<span className="text-sky-300">toBeVisible</span>();{"\n"}
      {"}"});
    </pre>
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

/** Section 2 — the three-step workflow in plain language. */
export function WorkflowSection() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 border-t border-white/[0.06] bg-[var(--bg-canvas)] py-24 md:py-32"
      aria-labelledby="workflow-title"
    >
      <div className="landing-container">
        <Reveal>
          <p className="section-eyebrow">How it works</p>
          <h2 id="workflow-title" className="section-title mt-4 max-w-[760px]">
            From spec to test suite in three steps
          </h2>
        </Reveal>

        <ol className="mt-12 grid gap-5 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step.number} delay={i * 120} className="min-w-0 list-none">
              <article className="hairline-card flex h-full min-w-0 flex-col p-7">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-[34px] leading-none text-[var(--accent-light)]">{step.number}</span>
                  <span className="font-mono text-[12px] text-[var(--text-dim)]">/</span>
                  <h3 className="text-[19px] font-semibold tracking-tight text-white">{step.title}</h3>
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)]">{step.body}</p>
                <div className="mt-auto min-w-0 pt-7">{step.visual}</div>
              </article>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
