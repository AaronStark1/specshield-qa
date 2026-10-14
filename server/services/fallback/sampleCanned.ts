import { createHash } from "node:crypto";
import { SAMPLE_SPEC } from "@shared/sampleSpec.js";
import type { ParsedRequirements, PlaywrightSuite, TestCase } from "@shared/types.js";
import { generatePlaywright } from "./generatePlaywright.js";

export function specHash(spec: string): string {
  return createHash("sha256").update(spec.trim()).digest("hex");
}

export function isSampleSpec(spec: string): boolean {
  return specHash(spec) === specHash(SAMPLE_SPEC);
}

function cannedRequirements(): ParsedRequirements {
  return {
    title: "Enterprise Vendor Onboarding & KAM Site Survey Portal",
    summary:
      "Self-service vendor onboarding replacing email and spreadsheets: registration with corporate email and per-country tax validation, document upload with expiry and virus scan, masked bank details with mod-97 IBAN checks, scored KAM site surveys with geo-tagged photos, two-stage approval with SLAs and segregation of duties, and an immutable audit log with reporting.",
    roles: [
      { name: "Vendor Admin", description: "External supplier user who registers the company, uploads documents and tracks status." },
      { name: "Key Account Manager (KAM)", description: "Internal; performs on-site surveys, scores the vendor, recommends approval." },
      { name: "Procurement Reviewer", description: "Internal; validates commercial terms and bank details; first-stage approver." },
      { name: "Compliance Officer", description: "Internal; validates certifications and sanctions screening; final approver." },
      { name: "System Administrator", description: "Manages users, roles, country configurations and retention policies." },
    ],
    features: [
      { id: "FR-REG", name: "Vendor Registration", description: "Corporate-email signup, password rules, verification expiry, legal name and per-country tax ID validation.", roles: ["Vendor Admin", "System Administrator"] },
      { id: "FR-DOC", name: "Document Upload", description: "Required document set, 10 MB / 8-file limits, expiry flags, virus scan quarantine and replacement rules.", roles: ["Vendor Admin", "Procurement Reviewer"] },
      { id: "FR-BNK", name: "Bank Details", description: "Holder-name match, mod-97 IBAN validation, re-verification on change, masked views except procurement panel.", roles: ["Vendor Admin", "Procurement Reviewer"] },
      { id: "FR-SRV", name: "KAM Site Survey", description: "5 scored sections 0–5, weighted 0–100 overall, geo-tagged photos, offline autosave, CAP and justification gates.", roles: ["Key Account Manager (KAM)"] },
      { id: "FR-APR", name: "Approval Workflow", description: "Draft to Approved lifecycle, 5-day and 3-day SLAs with escalation, segregation of duties, rejection and ERP webhook.", roles: ["Procurement Reviewer", "Compliance Officer"] },
      { id: "FR-AUD", name: "Audit Log & Reporting", description: "Immutable audit entries, CSV export, funnel / cycle-time / SLA / rejection dashboard.", roles: ["Compliance Officer", "System Administrator"] },
    ],
    acceptanceCriteria: [
      { id: "FR-REG-01", featureId: "FR-REG", text: "Vendor Admin creates an account with corporate email, password and company name; gmail.com, yahoo.com, outlook.com, hotmail.com rejected with 'Please use a corporate email address'." },
      { id: "FR-REG-02", featureId: "FR-REG", text: "Passwords must be 12–64 characters and include at least one uppercase letter, one digit and one symbol." },
      { id: "FR-REG-03", featureId: "FR-REG", text: "Email verification link expires after 24 hours; expired link shows a 'Resend verification' action." },
      { id: "FR-REG-04", featureId: "FR-REG", text: "Company legal name required, 2–120 characters; duplicate names within the same country warn but do not block." },
      { id: "FR-REG-05", featureId: "FR-REG", text: "Tax identifier validated per country: India GSTIN 15 chars, EU VAT prefix + 8–12 alphanumerics, US EIN ^\\d{2}-\\d{7}$; other countries free text up to 32 chars." },
      { id: "FR-DOC-01", featureId: "FR-DOC", text: "Required documents: Certificate of Incorporation, Tax Registration, Bank Confirmation Letter, ISO 9001 (optional under USD 50,000)." },
      { id: "FR-DOC-02", featureId: "FR-DOC", text: "Accepted formats PDF, JPG, PNG; max 10 MB per file, max 8 files per type; over-limit shows 'File exceeds 10 MB limit' without starting upload." },
      { id: "FR-DOC-03", featureId: "FR-DOC", text: "Documents expiring within 30 days flagged amber; expired documents block submission." },
      { id: "FR-DOC-04", featureId: "FR-DOC", text: "Uploads virus-scanned asynchronously; infected files quarantined, vendor notified, submission blocked until replaced." },
      { id: "FR-BNK-01", featureId: "FR-BNK", text: "Account holder name must match company legal name case-insensitive ignoring punctuation; currency is ISO 4217." },
      { id: "FR-BNK-02", featureId: "FR-BNK", text: "IBAN validated with mod-97 checksum; invalid IBANs show 'IBAN checksum failed'." },
      { id: "FR-BNK-03", featureId: "FR-BNK", text: "Bank-detail change after approval moves vendor to 'Re-verification Required' and notifies Procurement within 5 minutes." },
      { id: "FR-BNK-04", featureId: "FR-BNK", text: "Bank details masked except in Procurement Reviewer detail panel (last 4 visible elsewhere)." },
      { id: "FR-SRV-02", featureId: "FR-SRV", text: "Survey has 5 sections of 4–8 questions scored 0–5; section score = average × 20; overall = weighted average (15/30/25/15/15), 0–100." },
      { id: "FR-SRV-03", featureId: "FR-SRV", text: "Each section requires one geo-tagged photo within 500 m of registered address; outside radius flagged 'Location mismatch'." },
      { id: "FR-SRV-05", featureId: "FR-SRV", text: "Score below 60 creates a Corrective Action Plan due in 45 days; 60–74 needs 200-char KAM justification; 75+ submits directly." },
      { id: "FR-APR-02", featureId: "FR-APR", text: "Procurement SLA 5 business days, Compliance SLA 3 business days; breaches email the manager and show a red SLA badge." },
      { id: "FR-APR-04", featureId: "FR-APR", text: "Rejection needs a listed reason plus 20-char free text; reapply after 90 days." },
      { id: "FR-APR-05", featureId: "FR-APR", text: "Approval generates Vendor ID VND-{COUNTRY}-{6 digits}, emails the admin and pushes to ERP webhook with 3 retries (1/5/25 min)." },
      { id: "FR-AUD-01", featureId: "FR-AUD", text: "Every state change, upload, edit and login records actor, UTC timestamp, IP and before/after; entries immutable." },
      { id: "NFR-SEC-02", featureId: "FR-AUD", text: "Sessions expire after 30 minutes of inactivity with a 2-minute warning modal." },
      { id: "NFR-SEC-03", featureId: "FR-AUD", text: "Login rate-limited to 5 failed attempts per 15 minutes, then locked 30 minutes with unlock email." },
      { id: "NFR-SEC-05", featureId: "FR-AUD", text: "Inputs sanitised against injection (OWASP Top 10); free text renders as plain text, never HTML." },
    ],
    fields: [
      { name: "corporateEmail", type: "email", required: true, constraints: ["must not be gmail.com/yahoo.com/outlook.com/hotmail.com"], featureId: "FR-REG" },
      { name: "password", type: "password", required: true, constraints: ["12–64 characters", "1 uppercase", "1 digit", "1 symbol"], featureId: "FR-REG" },
      { name: "companyLegalName", type: "string", required: true, constraints: ["2–120 characters", "duplicate warns within country"], featureId: "FR-REG" },
      { name: "taxIdentifier", type: "string", required: true, constraints: ["GSTIN 15 chars", "EU VAT 8–12 alphanumerics", "US EIN ^\\d{2}-\\d{7}$", "other max 32 chars"], featureId: "FR-REG" },
      { name: "documentFile", type: "file", required: true, constraints: ["PDF/JPG/PNG", "10 MB per file", "8 files per type"], featureId: "FR-DOC" },
      { name: "documentExpiryDate", type: "date", required: true, constraints: ["amber within 30 days", "expired blocks submission"], featureId: "FR-DOC" },
      { name: "accountHolderName", type: "string", required: true, constraints: ["must match legal name, case-insensitive"], featureId: "FR-BNK" },
      { name: "iban", type: "string", required: true, constraints: ["mod-97 checksum", "'IBAN checksum failed' on error"], featureId: "FR-BNK" },
      { name: "sitePhoto", type: "file", required: true, constraints: ["geo-tagged", "within 500 m", "1 per section min"], featureId: "FR-SRV" },
      { name: "justificationNote", type: "text", required: false, constraints: ["min 200 characters when score 60–74"], featureId: "FR-SRV" },
      { name: "rejectionReason", type: "text", required: false, constraints: ["from list + min 20 chars free text"], featureId: "FR-APR" },
      { name: "vendorId", type: "string", required: false, constraints: ["VND-{COUNTRY}-{6 digits}"], featureId: "FR-APR" },
    ],
    validationRules: [
      { id: "VR-01", rule: "Free-mail domains rejected with 'Please use a corporate email address'.", featureId: "FR-REG" },
      { id: "VR-02", rule: "Password 12–64 chars with uppercase, digit and symbol.", featureId: "FR-REG" },
      { id: "VR-03", rule: "Verification link expires after 24 hours.", featureId: "FR-REG" },
      { id: "VR-04", rule: "GSTIN/EIN/VAT patterns enforced per country; 32-char free text otherwise.", featureId: "FR-REG" },
      { id: "VR-05", rule: "Files over 10 MB show 'File exceeds 10 MB limit' without starting upload; max 8 per type.", featureId: "FR-DOC" },
      { id: "VR-06", rule: "IBAN mod-97 checksum; failures show 'IBAN checksum failed'.", featureId: "FR-BNK" },
      { id: "VR-07", rule: "Survey score gates: <60 CAP in 45 days; 60–74 needs 200-char note; 75+ direct submit.", featureId: "FR-SRV" },
      { id: "VR-08", rule: "Rejection needs listed reason + 20-char text; reapply after 90 days.", featureId: "FR-APR" },
      { id: "VR-09", rule: "Login 5 failures/15 min locks 30 min with unlock email.", featureId: "FR-AUD" },
      { id: "VR-10", rule: "Sessions expire after 30 min idle with 2-min warning.", featureId: "FR-AUD" },
    ],
    securitySurfaces: [
      "Role-based access control enforced server-side",
      "Login rate-limiting and account lockout (5 failed / 15 min)",
      "Session expiry after 30 minutes with 2-minute warning",
      "File upload validation, virus scan and quarantine",
      "Masked bank details except for privileged role",
      "Input sanitisation against injection (OWASP Top 10)",
      "Encrypted storage for uploads at rest",
      "Signed, expiring download links (10 minutes)",
      "Immutable audit log with actor, timestamp, IP",
      "Segregation of duties on approval",
    ],
  };
}

function cannedTestCases(): TestCase[] {
  const T: TestCase[] = [
    { id: "VND-FUNC-001", featureId: "FR-REG", category: "Functional", title: "Vendor registers with corporate email and valid GSTIN", given: "a new Vendor Admin on the registration page", when: "they submit corporate email ops@shakti-metals.in, password Str0ng!Passw0rd-12, legal name Shakti Metals Pvt Ltd and GSTIN 27AAPFU0939F1ZV", then: "the account is created, a verification email is queued and status becomes Draft", priority: "P0", expectedResult: "Account created; verification email sent within 1 minute", tags: ["functional", "registration", "happy-path"] },
    { id: "VND-FUNC-002", featureId: "FR-DOC", category: "Functional", title: "Vendor uploads all required documents under limits", given: "a Draft vendor with 4 valid files (PDF under 10 MB each)", when: "they upload Certificate of Incorporation, Tax Registration, Bank Letter and ISO 9001 with expiry dates 12 months out", then: "all files reach 100%, virus scan passes and status becomes Documents Complete", priority: "P0", expectedResult: "Documents Complete; no amber flags", tags: ["functional", "documents"] },
    { id: "VND-FUNC-003", featureId: "FR-BNK", category: "Functional", title: "Valid IBAN passes mod-97 and is stored masked", given: "a vendor with legal name Meridian Coatings GmbH", when: "they enter IBAN DE89370400440532013000 matching holder name", then: "validation passes and the stored record masks all but the last 4", priority: "P0", expectedResult: "IBAN accepted; masked as ••••3000 except procurement panel", tags: ["functional", "bank"] },
    { id: "VND-FUNC-004", featureId: "FR-SRV", category: "Functional", title: "KAM completes a 5-section survey scoring 82", given: "a vendor in Documents Complete with the KAM on site", when: "the KAM answers all sections, attaches 5 geo-tagged photos and submits at overall 82", then: "the survey submits directly with no justification gate", priority: "P0", expectedResult: "Survey Submitted at score 82", tags: ["functional", "survey"] },
    { id: "VND-FUNC-005", featureId: "FR-APR", category: "Functional", title: "Two-stage approval issues VND-IN-482913 and pushes ERP", given: "a Survey Submitted vendor with passing scores", when: "Procurement approves on day 2 and Compliance approves on day 1", then: "Vendor ID VND-IN-482913 is issued, the admin is emailed and the ERP webhook succeeds", priority: "P0", expectedResult: "Approved; Vendor ID issued; webhook 200 on first try", tags: ["functional", "approval"] },
    { id: "VND-FUNC-006", featureId: "FR-AUD", category: "Functional", title: "Compliance exports the audit log as CSV", given: "a Compliance Officer viewing vendor VND-IN-482913", when: "they export the audit log for Q3 filtered by India", then: "a CSV downloads and the export itself is appended to the audit log", priority: "P1", expectedResult: "CSV with actor, UTC timestamp, IP, before/after; export audited", tags: ["functional", "audit"] },
    { id: "VND-FUNC-007", featureId: "FR-REG", category: "Functional", title: "Duplicate legal name warns but does not block", given: "an existing Shakti Metals Pvt Ltd in India", when: "a second admin registers the same legal name in India", then: "an inline warning appears and registration continues", priority: "P1", expectedResult: "Warning shown; registration allowed", tags: ["functional", "registration"] },
    { id: "VND-FUNC-008", featureId: "FR-SRV", category: "Functional", title: "Offline survey autosaves and syncs keeping latest", given: "a KAM offline with 30-second autosave on", when: "they answer 12 questions offline then reconnect after a reviewer edit", then: "the latest timestamp wins and both versions are logged", priority: "P1", expectedResult: "Sync keeps latest; conflict log has both versions", tags: ["functional", "offline"] },
    { id: "VND-BND-001", featureId: "FR-REG", category: "Boundary", title: "11-character password is rejected, 12 accepted", given: "the registration form", when: "the user tries Str0ng!Pw-1 (11 chars) then Str0ng!Pass-1 (12 chars)", then: "the first is rejected and the second passes complexity", priority: "P1", expectedResult: "Min 12 enforced", tags: ["boundary", "password"] },
    { id: "VND-BND-002", featureId: "FR-REG", category: "Boundary", title: "121-character legal name rejected, 120 accepted", given: "the company name field", when: "the user enters 121 chars then exactly 120 chars", then: "121 is rejected, 120 is accepted", priority: "P1", expectedResult: "Max 120 enforced", tags: ["boundary", "legal-name"] },
    { id: "VND-BND-003", featureId: "FR-DOC", category: "Boundary", title: "11 MB PDF rejected before upload starts", given: "an 11 MB PDF on the document step", when: "the vendor selects the file", then: "the UI shows File exceeds 10 MB limit with zero bytes uploaded", priority: "P1", expectedResult: "10 MB cap enforced pre-upload", tags: ["boundary", "upload"] },
    { id: "VND-BND-004", featureId: "FR-DOC", category: "Boundary", title: "9th file of one type is blocked at 8", given: "8 incorporation files already attached", when: "the vendor adds a 9th", then: "the 9th is refused with a count message", priority: "P2", expectedResult: "Max 8 per type enforced", tags: ["boundary", "upload"] },
    { id: "VND-BND-005", featureId: "FR-SRV", category: "Boundary", title: "Survey score 59 triggers CAP, 60 needs note, 75 direct", given: "three identical surveys rescored at 59, 60 and 75", when: "the KAM submits each", then: "59 creates a 45-day CAP task, 60 requires a 200-char note, 75 submits directly", priority: "P1", expectedResult: "Score gates 60/75 enforced", tags: ["boundary", "scoring"] },
    { id: "VND-BND-006", featureId: "FR-APR", category: "Boundary", title: "19-char rejection text rejected, 20 accepted", given: "a reviewer rejecting a vendor", when: "they type 19 chars then 20 chars of free text", then: "19 is rejected, 20 with a listed reason submits", priority: "P2", expectedResult: "Min 20 enforced", tags: ["boundary", "rejection"] },
    { id: "VND-NEG-001", featureId: "FR-REG", category: "Negative", title: "gmail.com address rejected with corporate message", given: "the registration form", when: "the user enters ops.shakti@gmail.com", then: "submission is blocked with Please use a corporate email address", priority: "P0", expectedResult: "Free-mail rejected with exact message", tags: ["negative", "email"] },
    { id: "VND-NEG-002", featureId: "FR-REG", category: "Negative", title: "Invalid GSTIN 27AAPFU0939F1ZA rejected", given: "an Indian vendor form", when: "the user enters GSTIN 27AAPFU0939F1ZA (bad checksum char)", then: "the field errors and submission is blocked", priority: "P1", expectedResult: "GSTIN pattern enforced", tags: ["negative", "tax"] },
    { id: "VND-NEG-003", featureId: "FR-REG", category: "Negative", title: "Expired verification link offers resend", given: "a 25-hour-old verification link", when: "the vendor opens it", then: "a Resend verification action appears and a new link works", priority: "P1", expectedResult: "24-hour expiry with resend", tags: ["negative", "verification"] },
    { id: "VND-NEG-004", featureId: "FR-DOC", category: "Negative", title: "Expired certificate blocks submission", given: "a Tax Registration expired yesterday", when: "the vendor tries to mark Documents Complete", then: "submission is blocked until the document is replaced", priority: "P0", expectedResult: "Expired doc blocks", tags: ["negative", "expiry"] },
    { id: "VND-NEG-005", featureId: "FR-BNK", category: "Negative", title: "IBAN DE89370400440532013001 fails checksum", given: "the bank details form", when: "the user enters IBAN DE89370400440532013001 (bad check digits)", then: "the UI shows IBAN checksum failed", priority: "P1", expectedResult: "mod-97 enforced with exact message", tags: ["negative", "iban"] },
    { id: "VND-NEG-006", featureId: "FR-APR", category: "Negative", title: "Self-approval by surveying KAM is denied", given: "a KAM who performed the site survey", when: "they attempt to approve the same vendor", then: "approval is denied for segregation of duties", priority: "P0", expectedResult: "SoD enforced", tags: ["negative", "sod"] },
    { id: "VND-SEC-001", featureId: "FR-REG", category: "Security", title: "6th failed login in 15 minutes locks account 30 min", given: "an account with 5 failed logins in the last 15 minutes", when: "the attacker fails a 6th time", then: "the account locks for 30 minutes and an unlock email is sent", priority: "P0", expectedResult: "Lockout + unlock email", tags: ["security", "rate-limit"] },
    { id: "VND-SEC-002", featureId: "FR-DOC", category: "Security", title: "Infected file quarantined and blocks submission", given: "an upload flagged by the virus scanner", when: "the vendor uploads EICAR-test-flagged sample.pdf", then: "the file is quarantined, the vendor is notified and submission stays blocked", priority: "P0", expectedResult: "Quarantine + notify + block", tags: ["security", "upload"] },
    { id: "VND-SEC-003", featureId: "FR-BNK", category: "Security", title: "Vendor Admin cannot read full IBAN via API", given: "a Vendor Admin session", when: "they GET /api/vendors/VND-IN-482913/bank-details", then: "the response masks all but the last 4 and the attempt is logged", priority: "P1", expectedResult: "Masked except procurement panel", tags: ["security", "rbac"] },
    { id: "VND-SEC-004", featureId: "FR-AUD", category: "Security", title: "Script input stored sanitised and rendered inert", given: "a free-text field", when: "the user submits <script>alert(1)</script>", then: "the value renders as plain text and no script executes", priority: "P1", expectedResult: "OWASP sanitisation", tags: ["security", "injection"] },
    { id: "VND-SEC-005", featureId: "FR-AUD", category: "Security", title: "30-minute idle expiry with 2-minute warning", given: "a session idle for 28 minutes", when: "the user keeps idling", then: "a warning modal offers extension; at 30 min the session ends", priority: "P2", expectedResult: "Idle expiry + warning", tags: ["security", "session"] },
    { id: "VND-SEC-006", featureId: "FR-DOC", category: "Security", title: "11-minute-old download link is denied", given: "a signed document link issued 11 minutes ago", when: "the vendor opens it", then: "access is denied and a fresh link must be issued", priority: "P2", expectedResult: "10-minute signed links", tags: ["security", "signed-url"] },
    { id: "VND-FUNC-009", featureId: "FR-SRV", category: "Functional", title: "Photo 600 m away accepted but flagged", given: "a section photo taken 600 m from the registered address", when: "the KAM attaches it", then: "the photo is accepted with a Location mismatch flag", priority: "P2", expectedResult: "500 m radius with flag", tags: ["functional", "geo"] },
    { id: "VND-FUNC-010", featureId: "FR-APR", category: "Functional", title: "SLA breach escalates and shows red badge", given: "a procurement review open for 6 business days", when: "the dashboard renders", then: "a red SLA badge shows and the manager has an escalation email", priority: "P2", expectedResult: "5-day/3-day SLA escalation", tags: ["functional", "sla"] },
    { id: "VND-NEG-007", featureId: "FR-BNK", category: "Negative", title: "Post-approval bank change triggers re-verification", given: "an Approved vendor", when: "bank details change at T+0", then: "status becomes Re-verification Required and Procurement is notified within 5 minutes", priority: "P1", expectedResult: "Re-verification + 5-min notify", tags: ["negative", "bank-change"] },
    { id: "VND-SEC-007", featureId: "FR-APR", category: "Security", title: "Reviewer cannot approve own registration", given: "a reviewer who registered the vendor", when: "they attempt first-stage approval", then: "approval is denied for segregation of duties", priority: "P1", expectedResult: "SoD on registration", tags: ["security", "sod"] },
  ];
  return T;
}

export function getSampleCanned(): { requirements: ParsedRequirements; testCases: TestCase[]; playwright: PlaywrightSuite } {
  const requirements = cannedRequirements();
  const testCases = cannedTestCases();
  const playwright = generatePlaywright(requirements, testCases);
  // Override with polished hand-tuned page objects for the demo
  const polished: PlaywrightSuite = {
    ...playwright,
    fileName: "vendor-onboarding.spec.ts",
    pageObjects: [
      {
        className: "RegistrationPage",
        fileName: "registration.page.ts",
        code: `import { type Page, type Locator, expect } from "@playwright/test";\n\n/** Page Object for Vendor Registration */\nexport class RegistrationPage {\n  readonly page: Page;\n  readonly heading: Locator;\n  readonly corporateEmailInput = this.page.getByTestId("corporateEmail");\n\n  constructor(page: Page) {\n    this.page = page;\n    this.heading = page.getByRole("heading", { name: "Vendor Registration" });\n  }\n\n  async goto() {\n    await this.page.goto("/vendor-registration");\n    await expect(this.heading).toBeVisible();\n  }\n\n  async register(email: string, password: string, legalName: string, taxId: string) {\n    await this.page.getByTestId("corporateEmail").fill(email);\n    await this.page.getByTestId("password").fill(password);\n    await this.page.getByTestId("companyLegalName").fill(legalName);\n    await this.page.getByTestId("taxIdentifier").fill(taxId);\n    await this.page.getByRole("button", { name: "Create account" }).click();\n  }\n\n  async expectLoaded() {\n    await expect(this.page.getByTestId("vendor-registration-root")).toBeVisible();\n  }\n}\n`,
      },
      {
        className: "DocumentUploadPage",
        fileName: "document-upload.page.ts",
        code: `import { type Page, type Locator, expect } from "@playwright/test";\n\n/** Page Object for Document Upload */\nexport class DocumentUploadPage {\n  readonly page: Page;\n  readonly heading: Locator;\n\n  constructor(page: Page) {\n    this.page = page;\n    this.heading = page.getByRole("heading", { name: "Document Upload" });\n  }\n\n  async goto() {\n    await this.page.goto("/document-upload");\n    await expect(this.heading).toBeVisible();\n  }\n\n  async upload(docType: string, filePath: string) {\n    await this.page.getByTestId(\`doc-\${docType}\`).setInputFiles(filePath);\n    await expect(this.page.getByTestId("upload-progress")).toContainText("100%");\n  }\n\n  async expectLoaded() {\n    await expect(this.page.getByTestId("document-upload-root")).toBeVisible();\n  }\n}\n`,
      },
      {
        className: "BankDetailsPage",
        fileName: "bank-details.page.ts",
        code: `import { type Page, type Locator, expect } from "@playwright/test";\n\n/** Page Object for Bank Details */\nexport class BankDetailsPage {\n  readonly page: Page;\n  readonly heading: Locator;\n\n  constructor(page: Page) {\n    this.page = page;\n    this.heading = page.getByRole("heading", { name: "Bank Details" });\n  }\n\n  async goto() {\n    await this.page.goto("/bank-details");\n    await expect(this.heading).toBeVisible();\n  }\n\n  async fillIban(holder: string, iban: string) {\n    await this.page.getByTestId("accountHolderName").fill(holder);\n    await this.page.getByTestId("iban").fill(iban);\n    await this.page.getByRole("button", { name: "Validate" }).click();\n  }\n\n  async expectLoaded() {\n    await expect(this.page.getByTestId("bank-details-root")).toBeVisible();\n  }\n}\n`,
      },
      {
        className: "SiteSurveyPage",
        fileName: "site-survey.page.ts",
        code: `import { type Page, type Locator, expect } from "@playwright/test";\n\n/** Page Object for KAM Site Survey */\nexport class SiteSurveyPage {\n  readonly page: Page;\n  readonly heading: Locator;\n\n  constructor(page: Page) {\n    this.page = page;\n    this.heading = page.getByRole("heading", { name: "KAM Site Survey" });\n  }\n\n  async goto() {\n    await this.page.goto("/kam-site-survey");\n    await expect(this.heading).toBeVisible();\n  }\n\n  async scoreSection(section: string, score: number) {\n    await this.page.getByTestId(\`section-\${section}\`).getByRole("radio", { name: String(score) }).click();\n  }\n\n  async expectLoaded() {\n    await expect(this.page.getByTestId("kam-site-survey-root")).toBeVisible();\n  }\n}\n`,
      },
      {
        className: "ApprovalQueuePage",
        fileName: "approval-queue.page.ts",
        code: `import { type Page, type Locator, expect } from "@playwright/test";\n\n/** Page Object for Approval Workflow */\nexport class ApprovalQueuePage {\n  readonly page: Page;\n  readonly heading: Locator;\n\n  constructor(page: Page) {\n    this.page = page;\n    this.heading = page.getByRole("heading", { name: "Approval Workflow" });\n  }\n\n  async goto() {\n    await this.page.goto("/approval-workflow");\n    await expect(this.heading).toBeVisible();\n  }\n\n  async approve(vendorId: string) {\n    await this.page.getByTestId(\`approve-\${vendorId}\`).click();\n    await expect(this.page.getByTestId("vendor-id")).toContainText("VND-");\n  }\n\n  async expectLoaded() {\n    await expect(this.page.getByTestId("approval-workflow-root")).toBeVisible();\n  }\n}\n`,
      },
      {
        className: "AuditLogPage",
        fileName: "audit-log.page.ts",
        code: `import { type Page, type Locator, expect } from "@playwright/test";\n\n/** Page Object for Audit Log & Reporting */\nexport class AuditLogPage {\n  readonly page: Page;\n  readonly heading: Locator;\n\n  constructor(page: Page) {\n    this.page = page;\n    this.heading = page.getByRole("heading", { name: "Audit Log" });\n  }\n\n  async goto() {\n    await this.page.goto("/audit-log-reporting");\n    await expect(this.heading).toBeVisible();\n  }\n\n  async exportCsv() {\n    const download = this.page.waitForEvent("download");\n    await this.page.getByRole("button", { name: "Export CSV" }).click();\n    return download;\n  }\n\n  async expectLoaded() {\n    await expect(this.page.getByTestId("audit-log-reporting-root")).toBeVisible();\n  }\n}\n`,
      },
    ],
  };
  // Rebuild specCode/combinedCode around polished POMs but keep coverage
  const rebuilt = generatePlaywright(requirements, testCases);
  return {
    requirements,
    testCases,
    playwright: { ...rebuilt, fileName: polished.fileName, pageObjects: polished.pageObjects },
  };
}
