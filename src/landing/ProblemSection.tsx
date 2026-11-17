import { Reveal } from "./Reveal.tsx";
import { SpotlightGroup } from "./Spotlight.tsx";

function Route({ steps, blocked }: { steps: string[]; blocked?: boolean }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em]">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden className={blocked ? "text-red-400/80" : "text-emerald-300/80"}>
              ──▶
            </span>
          )}
          <span
            className={
              blocked
                ? "rounded-md border border-red-500/25 bg-red-500/[0.06] px-2 py-1 text-red-200"
                : "rounded-md border border-emerald-400/30 bg-black/25 px-2 py-1 text-emerald-50"
            }
          >
            {step}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Section 1 — why pasting client specs into a cloud model is the problem SpecShield removes. */
export function ProblemSection() {
  return (
    <section id="problem" className="landing-section" aria-labelledby="problem-title">
      <div className="ambient-bloom -left-40 top-10" aria-hidden />
      <div className="landing-container">
        <Reveal>
          <p className="section-eyebrow">The problem</p>
          <h2 id="problem-title" className="section-title mt-4 max-w-[760px]">
            <span className="text-matrix-gradient">The Cloud QA Dilemma</span>
          </h2>
          <p className="mt-5 max-w-[620px] text-[16px] leading-relaxed text-[var(--text-muted)]">
            AI can draft a test suite in seconds. The catch is where the spec has to travel to get there.
          </p>
        </Reveal>

        <SpotlightGroup className="mt-12 grid gap-5 lg:grid-cols-2">
          <Reveal className="min-w-0">
            <article className="hairline-card spotlight-card h-full overflow-hidden p-7 md:p-9">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">
                  <i className="fa-solid fa-cloud-arrow-up" aria-hidden />
                </span>
                <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-red-300">The Risk</h3>
              </div>
              <p className="mt-6 text-[20px] font-medium leading-snug text-white md:text-[23px]">
                Pasting NDA documents, enterprise workflows, or unreleased feature specs into commercial cloud LLMs violates client
                security agreements.
              </p>
              <Route steps={["Client PRD", "Internet", "Third-party LLM"]} blocked />
            </article>
          </Reveal>

          <Reveal delay={120} className="min-w-0">
            <article className="spotlight-card spotlight-card-bright h-full overflow-hidden rounded-[18px] border border-emerald-400/40 bg-gradient-to-br from-emerald-500 to-emerald-700 p-7 md:p-9">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-black/20 text-white">
                  <i className="fa-solid fa-shield-halved" aria-hidden />
                </span>
                <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-emerald-50">The Solution</h3>
              </div>
              <p className="mt-6 text-[20px] font-medium leading-snug text-white md:text-[23px]">
                SpecShield runs Gemma locally on your laptop via Ollama or a deterministic offline engine. Your spec never touches a
                socket.
              </p>
              <Route steps={["Client PRD", "Your laptop", "Playwright suite"]} />
            </article>
          </Reveal>
        </SpotlightGroup>

        <Reveal delay={160}>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-[var(--text-muted)]">
            <li className="flex items-center gap-2">
              <i className="fa-solid fa-lock text-[var(--accent-light)]" aria-hidden /> Local-first by design
            </li>
            <li className="flex items-center gap-2">
              <i className="fa-solid fa-microchip text-[var(--accent-light)]" aria-hidden /> Gemma via Ollama
            </li>
            <li className="flex items-center gap-2">
              <i className="fa-solid fa-plug-circle-xmark text-[var(--accent-light)]" aria-hidden /> Works with the network unplugged
            </li>
            <li className="flex items-center gap-2">
              <i className="fa-brands fa-github text-[var(--accent-light)]" aria-hidden /> Open source · MIT
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
