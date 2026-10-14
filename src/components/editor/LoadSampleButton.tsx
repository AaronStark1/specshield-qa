import { FileUp, Play, Trash2 } from "lucide-react";
import { SAMPLE_SPEC, SAMPLE_SPEC_TITLE } from "@shared/sampleSpec.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { usePipeline } from "../../hooks/usePipeline.ts";
import { Button, GhostButton } from "../ui/Button.tsx";
import { Kbd } from "../ui/Kbd.tsx";

export function LoadSampleButton() {
  const { setSpec, setTitle } = usePipelineStore();
  return (
    <GhostButton
      onClick={() => {
        setSpec(SAMPLE_SPEC);
        setTitle(SAMPLE_SPEC_TITLE);
      }}
    >
      <FileUp size={15} /> Load Sample Enterprise Spec
    </GhostButton>
  );
}

export function RunControls() {
  const { spec, title, setTitle, setSpec, running } = usePipelineStore();
  const { run, cancel } = usePipeline();
  const canRun = spec.trim().length >= 80 && !running;

  return (
    <div className="mt-3 space-y-2">
      <label className="block text-xs text-[#9ca3af]">
        Run title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Vendor Onboarding v2.3"
          className="mt-1 w-full rounded-lg border border-[#1f2937] bg-black/30 px-2 py-1.5 text-sm text-white placeholder:text-[#6b7280]"
        />
      </label>
      <div className="flex gap-2">
        {running ? (
          <GhostButton onClick={cancel} className="flex-1">Cancel</GhostButton>
        ) : (
          <Button disabled={!canRun} onClick={() => void run()} className="flex-1" title="Cmd/Ctrl+Enter">
            <Play size={15} /> Run Pipeline <Kbd>⌘↵</Kbd>
          </Button>
        )}
        <GhostButton disabled={running} onClick={() => { setSpec(""); setTitle(""); }} title="Clear">
          <Trash2 size={15} /> Clear
        </GhostButton>
      </div>
      {spec.trim().length > 0 && spec.trim().length < 80 && (
        <p className="text-xs text-amber-300">Need {(80 - spec.trim().length).toLocaleString()} more characters to run.</p>
      )}
    </div>
  );
}
