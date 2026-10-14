import { z } from "zod";

export const roleSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export const featureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  roles: z.array(z.string()),
});

export const acceptanceCriterionSchema = z.object({
  id: z.string(),
  featureId: z.string(),
  text: z.string(),
});

export const fieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  constraints: z.array(z.string()),
  featureId: z.string(),
});

export const validationRuleSchema = z.object({
  id: z.string(),
  rule: z.string(),
  featureId: z.string(),
});

export const parsedRequirementsSchema = z.object({
  title: z.string(),
  summary: z.string(),
  roles: z.array(roleSchema),
  features: z.array(featureSchema),
  acceptanceCriteria: z.array(acceptanceCriterionSchema),
  fields: z.array(fieldSchema),
  validationRules: z.array(validationRuleSchema),
  securitySurfaces: z.array(z.string()),
});

export const testCategorySchema = z.enum(["Functional", "Boundary", "Negative", "Security"]);
export const prioritySchema = z.enum(["P0", "P1", "P2", "P3"]);

export const testCaseSchema = z.object({
  id: z.string(),
  featureId: z.string(),
  category: testCategorySchema,
  title: z.string(),
  given: z.string(),
  when: z.string(),
  then: z.string(),
  priority: prioritySchema,
  expectedResult: z.string(),
  tags: z.array(z.string()),
});

export const testCaseArraySchema = z.array(testCaseSchema);

export const testMatrixSchema = z.object({
  testCases: testCaseArraySchema,
});

export const pageObjectSchema = z.object({
  className: z.string(),
  fileName: z.string(),
  code: z.string(),
});

export const playwrightSuiteSchema = z.object({
  fileName: z.string(),
  pageObjects: z.array(pageObjectSchema),
  specCode: z.string(),
  combinedCode: z.string(),
  coverage: z.array(z.object({ testCaseId: z.string(), testName: z.string() })),
});

export const runInputSchema = z.object({
  spec: z.string().min(80),
  title: z.string().optional(),
});
