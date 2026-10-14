import { Agent } from "@mastra/core/agent";
import { gemmaModel } from "../model.js";
import { CODEGEN_SYSTEM } from "../prompts/codegen.js";

export const playwrightCodegen = new Agent({
  id: "playwrightCodegen",
  name: "Playwright Codegen",
  instructions: CODEGEN_SYSTEM,
  model: gemmaModel,
});
