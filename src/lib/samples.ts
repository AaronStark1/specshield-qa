import { SAMPLE_SPECS, type SampleSpec } from "@shared/sampleSpec.ts";
import { usePipelineStore } from "../state/pipelineStore.ts";

export const DEFAULT_SAMPLE_ID = SAMPLE_SPECS[0]!.id;

/** The bundled sample whose text is exactly `spec`, if any. */
export function matchSample(spec: string): SampleSpec | null {
  return SAMPLE_SPECS.find((sample) => sample.spec === spec) ?? null;
}

export function findSample(id: string | null | undefined): SampleSpec | null {
  return SAMPLE_SPECS.find((sample) => sample.id === id) ?? null;
}

/** Loads a bundled sample (spec text and run title) into the editor. */
export function loadSample(sample: SampleSpec): void {
  const store = usePipelineStore.getState();
  store.setSpec(sample.spec);
  store.setTitle(sample.title);
}
