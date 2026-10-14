import { Agent } from "@mastra/core/agent";
import { gemmaModel } from "../model.js";
import { MATRIX_SYSTEM } from "../prompts/matrix.js";

export const qaMatrixArchitect = new Agent({
  id: "qaMatrixArchitect",
  name: "QA Matrix Architect",
  instructions: MATRIX_SYSTEM,
  model: gemmaModel,
});
