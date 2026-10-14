import { Mastra } from "@mastra/core/mastra";
import { requirementParser } from "./agents/requirementParser.js";
import { qaMatrixArchitect } from "./agents/qaMatrixArchitect.js";
import { playwrightCodegen } from "./agents/playwrightCodegen.js";
import { specShieldWorkflow } from "./workflows/specShieldWorkflow.js";

export const mastra = new Mastra({
  agents: { requirementParser, qaMatrixArchitect, playwrightCodegen },
  workflows: { specShieldWorkflow },
});

export { requirementParser, qaMatrixArchitect, playwrightCodegen, specShieldWorkflow };
