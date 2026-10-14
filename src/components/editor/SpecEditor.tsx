import { usePipelineStore } from "../../state/pipelineStore.ts";
import { countLines } from "../../lib/format.ts";

export function SpecEditor() {
  const { spec, setSpec } = usePipelineStore();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-[#9ca3af]">
        <span>Product spec (Markdown / PRD)</span>
        <span className="font-mono">{countLines(spec)} lines · {spec.length.toLocaleString()} chars</span>
      </div>
      <textarea
        value={spec}
        onChange={(e) => setSpec(e.target.value)}
        placeholder={"Paste a PRD here — roles, requirements, limits (10 MB, 12–64 chars), security notes…\n\nMinimum 80 characters. The spec never leaves this machine."}
        spellCheck={false}
        className="code h-[380px] w-full resize-y rounded-xl border border-[#1f2937] bg-black/40 p-3 font-mono text-[12.5px] leading-relaxed text-[#e5e7eb] placeholder:text-[#6b7280] focus:border-emerald-500/60 focus:outline-none"
      />
    </div>
  );
}
