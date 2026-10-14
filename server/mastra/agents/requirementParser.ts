import { Agent } from "@mastra/core/agent";
import { gemmaModel } from "../model.js";
import { PARSER_SYSTEM } from "../prompts/parser.js";

export const requirementParser = new Agent({
  id: "requirementParser",
  name: "Requirement Parser",
  instructions: PARSER_SYSTEM,
  model: gemmaModel,
});
