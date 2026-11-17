import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal.tsx";
import { useInView, usePrefersReducedMotion } from "./hooks.ts";

interface Metric {
  /** Text before and after the animated number. */
  prefix?: string;
  suffix?: string;
  from: number;
  to: number;
  decimals?: number;
  label: string;
  note: string;
}

const METRICS: Metric[] = [
  { from: 0, to: 100, suffix: "%", label: "Offline Execution", note: "Runs with the network unplugged" },
  { from: 9.99, to: 0, decimals: 2, label: "Cloud Spend", note: "No API key, no token bill" },
  { from: 0, to: 30, suffix: "+", label: "Test Cases Generated per Run", note: "Invoice Tracker sample" },
  { from: 60, to: 15, prefix: "< ", suffix: "s", label: "Turnaround Time", note: "Offline engine, spec to suite" },
];

const COUNT_MS = 1400;

function Counter({ metric, active }: { metric: Metric; active: boolean }) {
  const reducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(metric.from);

  useEffect(() => {
    if (!active) return;
    if (reducedMotion) {
      setValue(metric.to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(metric.from + (metric.to - metric.from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reducedMotion, metric.from, metric.to]);

  return (
    <span className="font-display tabular text-[clamp(40px,5vw,64px)] leading-none text-white">
      {metric.prefix}
      {value.toFixed(metric.decimals ?? 0)}
      {metric.suffix}
    </span>
  );
}

/** Section 4 — the privacy and ROI numbers, counted up when the bar scrolls into view. */
export function MetricsSection() {
  const barRef = useRef<HTMLDListElement>(null);
  const active = useInView(barRef, { threshold: 0.3, once: true });

  return (
    <section id="security" className="landing-section" aria-labelledby="metrics-title">
      <div className="ambient-bloom -right-32 top-16" aria-hidden />
      <div className="landing-container">
        <Reveal>
          <p className="section-eyebrow">Privacy &amp; ROI</p>
          <h2 id="metrics-title" className="section-title mt-4 max-w-[760px]">
            Nothing leaves. Nothing is billed.
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <dl
            ref={barRef}
            className="mt-12 grid overflow-hidden rounded-[18px] border border-white/[0.08] bg-[rgba(13,19,31,0.9)] sm:grid-cols-2 lg:grid-cols-4"
          >
            {METRICS.map((metric) => (
              <div
                key={metric.label}
                className="flex flex-col-reverse justify-end gap-4 border-b border-white/[0.08] p-7 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <dt>
                  <span className="block text-[14px] font-medium text-white">{metric.label}</span>
                  <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{metric.note}</span>
                </dt>
                <dd>
                  <Counter metric={metric} active={active} />
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
