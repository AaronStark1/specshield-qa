/**
 * Writes the landing page's sandbox data: the suite the offline engine produces for the bundled
 * Invoice Tracker spec. Re-run after changing that spec or its canned output:
 *
 *   npm run demo:data
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SAMPLE_SPEC_TITLE } from "../shared/sampleSpec.js";
import { getSampleCanned } from "../server/services/fallback/sampleCanned.js";

const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "landing", "sandbox", "demoSuite.json");
const { testCases, playwright } = getSampleCanned();

const suite = {
  title: SAMPLE_SPEC_TITLE,
  testCases,
  playwright: {
    fileName: playwright.fileName,
    specCode: playwright.specCode,
    pageObjects: playwright.pageObjects.map(({ fileName, code }) => ({ fileName, code })),
  },
};

writeFileSync(target, `${JSON.stringify(suite, null, 2)}\n`);
console.log(`Wrote ${testCases.length} cases and ${suite.playwright.pageObjects.length + 1} files to ${path.relative(process.cwd(), target)}`);
