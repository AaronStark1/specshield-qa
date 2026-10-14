import { createHash } from "node:crypto";
import { SAMPLE_SPEC } from "@shared/sampleSpec.js";
import type { ParsedRequirements, PlaywrightSuite, TestCase } from "@shared/types.js";

export function specHash(spec: string): string {
  return createHash("sha256").update(spec.trim()).digest("hex");
}

export function isSampleSpec(spec: string): boolean {
  return specHash(spec) === specHash(SAMPLE_SPEC);
}

function cannedRequirements(): ParsedRequirements {
  return {
    title: "Freelancer Invoice Tracker",
    summary:
      "Invoice tracking studio for solo freelancers to manage clients, issue multi-line invoices, record payments, share unguessable public payment links, automate overdue reminders, and provide accountants with CSV exports under strict server-side RBAC.",
    roles: [
      { name: "Freelancer", description: "Owns the account, creates clients and invoices, records payments." },
      { name: "Client", description: "External customer; receives a public invoice link and can mark an invoice as 'Payment Sent'." },
      { name: "Accountant", description: "Read-only access to all invoices and a CSV export." },
    ],
    features: [
      { id: "FR-AUTH", name: "Authentication", description: "Freelancer signup, password rules, failed login lockout, and session inactivity expiry.", roles: ["Freelancer", "Accountant"] },
      { id: "FR-CLI", name: "Clients", description: "Client creation with currency support, uniqueness validation per email, and deletion guards for unpaid invoices.", roles: ["Freelancer"] },
      { id: "FR-INV", name: "Invoices", description: "Line items calculation, due date rules, sequential numbering INV-{YEAR}-{4 digits}, draft lifecycle, and public link generation.", roles: ["Freelancer", "Client", "Accountant"] },
      { id: "FR-PAY", name: "Payments & Reminders", description: "Payment recording, balance validation, automated overdue transitions with reminder schedule, and client payment notification.", roles: ["Freelancer", "Client"] },
      { id: "FR-EXP", name: "Export", description: "CSV export of all invoices for date ranges up to 12 months for accountant review.", roles: ["Accountant"] },
      { id: "NFR", name: "Security, Performance & Accessibility", description: "Role-based 403 on write endpoints, unguessable 32-char tokens, script injection prevention, sub-500ms load, keyboard navigation.", roles: ["Freelancer", "Client", "Accountant"] },
    ],
    acceptanceCriteria: [
      { id: "FR-AUTH-01", featureId: "FR-AUTH", text: "Freelancers sign up with email and password. Passwords must be 8–64 characters with at least one number." },
      { id: "FR-AUTH-02", featureId: "FR-AUTH", text: "After 5 failed logins within 10 minutes the account is locked for 15 minutes." },
      { id: "FR-AUTH-03", featureId: "FR-AUTH", text: "Sessions expire after 60 minutes of inactivity." },
      { id: "FR-CLI-01", featureId: "FR-CLI", text: "A client has a name (required, 2–80 characters), email (required, valid format) and currency (USD, EUR, GBP or INR)." },
      { id: "FR-CLI-02", featureId: "FR-CLI", text: "Two clients cannot share the same email within one freelancer account; the error is 'A client with this email already exists'." },
      { id: "FR-CLI-03", featureId: "FR-CLI", text: "A client with unpaid invoices cannot be deleted; the delete button is disabled with a tooltip." },
      { id: "FR-INV-01", featureId: "FR-INV", text: "An invoice has a client, issue date, due date, 1–50 line items and an optional note (max 500 characters)." },
      { id: "FR-INV-02", featureId: "FR-INV", text: "Each line item has a description (required), quantity (1–999) and unit price (0.01–1,000,000.00). Total is computed and shown to 2 decimals." },
      { id: "FR-INV-03", featureId: "FR-INV", text: "Due date must be on or after the issue date and no more than 180 days after it." },
      { id: "FR-INV-04", featureId: "FR-INV", text: "Invoice numbers are generated as INV-{YEAR}-{4 digits}, sequential per freelancer, never reused." },
      { id: "FR-INV-05", featureId: "FR-INV", text: "Status lifecycle: Draft → Sent → Paid | Overdue | Cancelled. Only Draft invoices can be edited." },
      { id: "FR-INV-06", featureId: "FR-INV", text: "Sending an invoice emails the client a public link. The link expires 90 days after the due date." },
      { id: "FR-PAY-01", featureId: "FR-PAY", text: "A freelancer records a payment with amount and date. Partial payments are allowed; the invoice becomes Paid when the sum of payments equals the total." },
      { id: "FR-PAY-02", featureId: "FR-PAY", text: "A payment cannot exceed the remaining balance; the error is 'Amount exceeds outstanding balance'." },
      { id: "FR-PAY-03", featureId: "FR-PAY", text: "Invoices unpaid 1 day after the due date become Overdue automatically and the client receives a reminder email at +1, +7 and +14 days." },
      { id: "FR-PAY-04", featureId: "FR-PAY", text: "The Client can click 'Payment Sent' on the public link, which notifies the freelancer but does not change the status." },
      { id: "FR-EXP-01", featureId: "FR-EXP", text: "Accountants can export all invoices for a date range as CSV. The export is limited to 12 months per request." },
      { id: "NFR-SEC-01", featureId: "NFR", text: "Role-based access enforced on the server; Accountants receive 403 on any write endpoint." },
      { id: "NFR-SEC-02", featureId: "NFR", text: "The public invoice link uses an unguessable 32-character token and shows no other client data." },
      { id: "NFR-SEC-03", featureId: "NFR", text: "All free-text fields are rendered as plain text to prevent script injection." },
      { id: "NFR-PERF-01", featureId: "NFR", text: "Invoice list loads within 500 ms for 2,000 invoices." },
      { id: "NFR-A11Y-01", featureId: "NFR", text: "All forms are keyboard-navigable with visible focus states." },
    ],
    fields: [
      { name: "password", type: "password", required: true, constraints: ["8–64 characters", "at least one number"], featureId: "FR-AUTH" },
      { name: "clientName", type: "string", required: true, constraints: ["2–80 characters"], featureId: "FR-CLI" },
      { name: "clientEmail", type: "email", required: true, constraints: ["valid email format", "unique per freelancer account"], featureId: "FR-CLI" },
      { name: "currency", type: "string", required: true, constraints: ["USD, EUR, GBP or INR"], featureId: "FR-CLI" },
      { name: "lineItems", type: "array", required: true, constraints: ["1–50 line items"], featureId: "FR-INV" },
      { name: "lineDescription", type: "string", required: true, constraints: ["required"], featureId: "FR-INV" },
      { name: "quantity", type: "number", required: true, constraints: ["1–999"], featureId: "FR-INV" },
      { name: "unitPrice", type: "number", required: true, constraints: ["0.01–1,000,000.00", "2 decimal precision"], featureId: "FR-INV" },
      { name: "note", type: "text", required: false, constraints: ["max 500 characters", "rendered as plain text"], featureId: "FR-INV" },
      { name: "issueDate", type: "date", required: true, constraints: ["valid ISO date"], featureId: "FR-INV" },
      { name: "dueDate", type: "date", required: true, constraints: ["on or after issue date", "max 180 days after issue"], featureId: "FR-INV" },
      { name: "paymentAmount", type: "number", required: true, constraints: ["positive number", "cannot exceed remaining balance"], featureId: "FR-PAY" },
      { name: "paymentDate", type: "date", required: true, constraints: ["valid ISO date"], featureId: "FR-PAY" },
      { name: "exportDateRange", type: "daterange", required: true, constraints: ["max 12 months per request"], featureId: "FR-EXP" },
    ],
    validationRules: [
      { id: "VR-01", rule: "Password must be 8–64 characters with at least one number.", featureId: "FR-AUTH" },
      { id: "VR-02", rule: "Lockout after 5 failed logins within 10 minutes for 15 minutes.", featureId: "FR-AUTH" },
      { id: "VR-03", rule: "Duplicate client email within one account rejected with 'A client with this email already exists'.", featureId: "FR-CLI" },
      { id: "VR-04", rule: "Client with unpaid invoices cannot be deleted (button disabled with tooltip).", featureId: "FR-CLI" },
      { id: "VR-05", rule: "Due date must be on or after issue date and within 180 days.", featureId: "FR-INV" },
      { id: "VR-06", rule: "Invoice line items limited to 1–50; quantity 1–999; unit price 0.01–1,000,000.00.", featureId: "FR-INV" },
      { id: "VR-07", rule: "Only Draft invoices can be edited; Sent/Paid/Overdue/Cancelled invoices are read-only.", featureId: "FR-INV" },
      { id: "VR-08", rule: "Payment amount cannot exceed remaining balance with 'Amount exceeds outstanding balance'.", featureId: "FR-PAY" },
      { id: "VR-09", rule: "Export range is limited to 12 months per request.", featureId: "FR-EXP" },
      { id: "VR-10", rule: "Accountants receive 403 Forbidden on write endpoints.", featureId: "NFR" },
    ],
    securitySurfaces: [
      "Role-based access control (Accountants receive 403 on write endpoints)",
      "Account lockout after 5 failed logins within 10 minutes (locked 15 min)",
      "Session expiration after 60 minutes of inactivity",
      "Unguessable 32-character token for public invoice links",
      "Public invoice link expiration (90 days after due date)",
      "Script injection prevention (all free-text rendered as plain text)",
    ],
  };
}

function cannedTestCases(): TestCase[] {
  const T: TestCase[] = [
    {
      id: "FIT-FUNC-001",
      featureId: "FR-AUTH",
      category: "Functional",
      title: "Freelancer signs up with valid email and password",
      given: "a new freelancer on the signup screen",
      when: "they provide alex@freelance.dev and Str0ngPass99 with digits",
      then: "the account is created and the user is authenticated",
      priority: "P0",
      expectedResult: "Account created and dashboard accessible",
      tags: ["functional", "auth", "signup"],
    },
    {
      id: "FIT-FUNC-002",
      featureId: "FR-CLI",
      category: "Functional",
      title: "Freelancer creates client with name, email and USD currency",
      given: "an authenticated freelancer on the clients screen",
      when: "they add Acme Corp with email billing@acme.com and currency USD",
      then: "the client is saved and appears in the client selector",
      priority: "P0",
      expectedResult: "Client saved with currency USD",
      tags: ["functional", "clients"],
    },
    {
      id: "FIT-FUNC-003",
      featureId: "FR-INV",
      category: "Functional",
      title: "Freelancer creates invoice with 2 items and computed total",
      given: "an existing client Acme Corp",
      when: "they add 2 items (Design 10h @ $100.00 and QA 5h @ $80.00)",
      then: "total computes to $1,400.00 and invoice number INV-2026-0001 is generated",
      priority: "P0",
      expectedResult: "Invoice created in Draft status with total 1400.00",
      tags: ["functional", "invoices", "calculation"],
    },
    {
      id: "FIT-FUNC-004",
      featureId: "FR-INV",
      category: "Functional",
      title: "Sending invoice generates public link with 32-char token",
      given: "a Draft invoice INV-2026-0001",
      when: "the freelancer clicks Send Invoice",
      then: "status becomes Sent and an email is queued with an unguessable 32-char public link",
      priority: "P0",
      expectedResult: "Invoice status Sent; 32-char public token generated",
      tags: ["functional", "invoices", "send"],
    },
    {
      id: "FIT-FUNC-005",
      featureId: "FR-PAY",
      category: "Functional",
      title: "Client clicks Payment Sent on public link",
      given: "a client viewing invoice INV-2026-0001 via public link",
      when: "they click Payment Sent",
      then: "the freelancer is notified and the invoice status remains Sent",
      priority: "P1",
      expectedResult: "Freelancer notified; status remains Sent",
      tags: ["functional", "payments", "public-link"],
    },
    {
      id: "FIT-FUNC-006",
      featureId: "FR-PAY",
      category: "Functional",
      title: "Recording partial payment reduces balance",
      given: "a Sent invoice with total $1,400.00",
      when: "the freelancer records a partial payment of $600.00",
      then: "status remains Sent with outstanding balance $800.00",
      priority: "P0",
      expectedResult: "Remaining balance updated to 800.00",
      tags: ["functional", "payments", "partial"],
    },
    {
      id: "FIT-FUNC-007",
      featureId: "FR-PAY",
      category: "Functional",
      title: "Sum of payments equaling total flips status to Paid",
      given: "an invoice with $800.00 outstanding balance",
      when: "the freelancer records a second payment of $800.00",
      then: "total payments equal $1,400.00 and status flips to Paid automatically",
      priority: "P0",
      expectedResult: "Status flips to Paid; outstanding balance 0.00",
      tags: ["functional", "payments", "paid"],
    },
    {
      id: "FIT-FUNC-008",
      featureId: "FR-PAY",
      category: "Functional",
      title: "Unpaid invoice 1 day after due date becomes Overdue",
      given: "an invoice unpaid at due date + 1 day",
      when: "the overnight reminder job executes",
      then: "status flips to Overdue and reminder email is queued for +1 day",
      priority: "P0",
      expectedResult: "Status becomes Overdue; reminders scheduled at +1, +7, +14 days",
      tags: ["functional", "reminders", "overdue"],
    },
    {
      id: "FIT-FUNC-009",
      featureId: "FR-EXP",
      category: "Functional",
      title: "Accountant exports invoices for 6-month range as CSV",
      given: "an authenticated Accountant user",
      when: "they request a CSV export for Jan 1 to Jun 30",
      then: "a CSV file downloads containing all invoices in that date range",
      priority: "P1",
      expectedResult: "CSV downloaded with invoice records and totals",
      tags: ["functional", "export", "csv"],
    },
    {
      id: "FIT-FUNC-010",
      featureId: "FR-INV",
      category: "Functional",
      title: "Sequential invoice numbering never reuses cancelled number",
      given: "invoice INV-2026-0002 cancelled by the freelancer",
      when: "they create the next invoice",
      then: "the new invoice is assigned INV-2026-0003 and 0002 is never reused",
      priority: "P1",
      expectedResult: "Next number INV-2026-0003 generated sequentially",
      tags: ["functional", "invoices", "sequence"],
    },
    {
      id: "FIT-BND-001",
      featureId: "FR-AUTH",
      category: "Boundary",
      title: "Password boundary 7/8 and 64/65 characters",
      given: "the freelancer registration form",
      when: "testing 7 chars (Passw1!), 8 chars (Passw0rd), 64 chars, and 65 chars",
      then: "7 and 65 are rejected; 8 and 64 are accepted",
      priority: "P1",
      expectedResult: "Min 8 and Max 64 password length enforced",
      tags: ["boundary", "auth", "password"],
    },
    {
      id: "FIT-BND-002",
      featureId: "FR-CLI",
      category: "Boundary",
      title: "Client name boundary 1/2 and 80/81 characters",
      given: "the client creation form",
      when: "entering 1 char ('A'), 2 chars ('AB'), 80 chars, and 81 chars",
      then: "1 and 81 characters are rejected; 2 and 80 characters are accepted",
      priority: "P1",
      expectedResult: "Client name 2–80 characters enforced",
      tags: ["boundary", "clients", "name"],
    },
    {
      id: "FIT-BND-003",
      featureId: "FR-INV",
      category: "Boundary",
      title: "Line item quantity boundary 0/1 and 999/1000",
      given: "an invoice line item",
      when: "entering quantity 0, 1, 999, and 1000",
      then: "0 and 1000 are rejected; 1 and 999 are accepted",
      priority: "P1",
      expectedResult: "Quantity range 1–999 enforced",
      tags: ["boundary", "invoices", "quantity"],
    },
    {
      id: "FIT-BND-004",
      featureId: "FR-INV",
      category: "Boundary",
      title: "Unit price boundary 0.00/0.01 and 1,000,000.00/1,000,000.01",
      given: "an invoice line item",
      when: "entering unit price 0.00, 0.01, 1000000.00, and 1000000.01",
      then: "0.00 and 1000000.01 are rejected; 0.01 and 1000000.00 are accepted",
      priority: "P1",
      expectedResult: "Unit price range 0.01–1,000,000.00 enforced",
      tags: ["boundary", "invoices", "price"],
    },
    {
      id: "FIT-BND-005",
      featureId: "FR-INV",
      category: "Boundary",
      title: "Line items count boundary 50 vs 51 items",
      given: "an invoice with 50 line items attached",
      when: "the freelancer attempts to add a 51st line item",
      then: "the 50 items save successfully but the 51st is blocked with limit error",
      priority: "P1",
      expectedResult: "Max 50 line items enforced",
      tags: ["boundary", "invoices", "items"],
    },
    {
      id: "FIT-BND-006",
      featureId: "FR-INV",
      category: "Boundary",
      title: "Note length boundary 500 vs 501 characters",
      given: "the invoice optional note field",
      when: "entering exactly 500 characters then 501 characters",
      then: "500 characters passes; 501 characters is rejected",
      priority: "P2",
      expectedResult: "Max 500 characters note enforced",
      tags: ["boundary", "invoices", "note"],
    },
    {
      id: "FIT-BND-007",
      featureId: "FR-INV",
      category: "Boundary",
      title: "Due date range boundary 180 vs 181 days after issue",
      given: "an invoice with issue date 2026-01-01",
      when: "setting due date to 180 days (2026-06-30) then 181 days (2026-07-01)",
      then: "180 days is accepted; 181 days is rejected",
      priority: "P1",
      expectedResult: "Due date max 180 days enforced",
      tags: ["boundary", "invoices", "due-date"],
    },
    {
      id: "FIT-BND-008",
      featureId: "FR-EXP",
      category: "Boundary",
      title: "Export date range boundary 12 months vs 12 months + 1 day",
      given: "an Accountant requesting invoice export",
      when: "selecting 365 days range then 366 days range",
      then: "12 months is accepted; 12 months + 1 day is rejected with date limit error",
      priority: "P2",
      expectedResult: "Max 12 months export limit enforced",
      tags: ["boundary", "export", "date-range"],
    },
    {
      id: "FIT-NEG-001",
      featureId: "FR-CLI",
      category: "Negative",
      title: "Duplicate client email within account rejected",
      given: "an existing client with email contact@beta.org",
      when: "creating another client with the same email contact@beta.org",
      then: "submission fails with error 'A client with this email already exists'",
      priority: "P0",
      expectedResult: "Duplicate email error shown",
      tags: ["negative", "clients", "duplicate"],
    },
    {
      id: "FIT-NEG-002",
      featureId: "FR-CLI",
      category: "Negative",
      title: "Deleting client with unpaid invoices is disabled",
      given: "a client with 1 Sent unpaid invoice",
      when: "the freelancer views the client action menu",
      then: "the delete button is disabled with tooltip explaining unpaid invoices exist",
      priority: "P1",
      expectedResult: "Delete button disabled with tooltip",
      tags: ["negative", "clients", "delete-guard"],
    },
    {
      id: "FIT-NEG-003",
      featureId: "FR-INV",
      category: "Negative",
      title: "Due date before issue date is rejected",
      given: "an invoice with issue date 2026-05-10",
      when: "the user sets due date to 2026-05-09 (one day before)",
      then: "validation error blocks save stating due date must be on or after issue date",
      priority: "P1",
      expectedResult: "Due date before issue date rejected",
      tags: ["negative", "invoices", "date-order"],
    },
    {
      id: "FIT-NEG-004",
      featureId: "FR-INV",
      category: "Negative",
      title: "Editing a Sent invoice is blocked",
      given: "an invoice in Sent status",
      when: "attempting to edit line items or client details",
      then: "editing is prohibited; only Draft invoices can be edited",
      priority: "P0",
      expectedResult: "Sent invoice edit blocked; read-only view enforced",
      tags: ["negative", "invoices", "lifecycle"],
    },
    {
      id: "FIT-NEG-005",
      featureId: "FR-PAY",
      category: "Negative",
      title: "Payment exceeding outstanding balance by $0.01 rejected",
      given: "an invoice with outstanding balance $250.00",
      when: "recording a payment of $250.01",
      then: "the submission is rejected with 'Amount exceeds outstanding balance'",
      priority: "P0",
      expectedResult: "Amount exceeds outstanding balance error displayed",
      tags: ["negative", "payments", "overpayment"],
    },
    {
      id: "FIT-NEG-006",
      featureId: "FR-INV",
      category: "Negative",
      title: "Public invoice link opened 91 days after due date is expired",
      given: "an invoice with due date 91 days in the past",
      when: "opening the public invoice token URL",
      then: "the page shows an invoice link expired notice and denies payment actions",
      priority: "P1",
      expectedResult: "Public link expired after 90 days of due date",
      tags: ["negative", "public-link", "expiry"],
    },
    {
      id: "FIT-SEC-001",
      featureId: "FR-AUTH",
      category: "Security",
      title: "6th failed login inside 10 minutes locks account for 15 minutes",
      given: "an account with 5 consecutive failed login attempts in 10 minutes",
      when: "a 6th failed login attempt is submitted",
      then: "the account is locked for 15 minutes and further login attempts return 423 Locked",
      priority: "P0",
      expectedResult: "Account locked for 15 minutes on 6th failed attempt",
      tags: ["security", "auth", "lockout"],
    },
    {
      id: "FIT-SEC-002",
      featureId: "FR-AUTH",
      category: "Security",
      title: "Session invalidation after 60 minutes of inactivity",
      given: "an active session idle for 60 minutes",
      when: "any API request is made",
      then: "the session is terminated and user is redirected to login with 401",
      priority: "P1",
      expectedResult: "Session expires at 60 minutes inactivity",
      tags: ["security", "auth", "session"],
    },
    {
      id: "FIT-SEC-003",
      featureId: "NFR",
      category: "Security",
      title: "Accountant write endpoint returns 403 Forbidden",
      given: "an authenticated Accountant session",
      when: "they send a POST to /api/invoices or PUT to /api/clients",
      then: "the server rejects the request with HTTP 403 Forbidden",
      priority: "P0",
      expectedResult: "Server-side RBAC enforces 403 for Accountant writes",
      tags: ["security", "rbac", "accountant"],
    },
    {
      id: "FIT-SEC-004",
      featureId: "NFR",
      category: "Security",
      title: "Guessed or 31-char public link token rejected",
      given: "a public token endpoint",
      when: "a client supplies a 31-character token or random string",
      then: "access is denied with 404 Not Found without leaking existence",
      priority: "P0",
      expectedResult: "Invalid token rejected; unguessable 32-char token required",
      tags: ["security", "public-link", "token"],
    },
    {
      id: "FIT-SEC-005",
      featureId: "NFR",
      category: "Security",
      title: "Script tag in note is rendered as plain text",
      given: "an invoice note containing <script>alert('xss')</script>",
      when: "the public invoice page or client invoice view renders",
      then: "the script text renders inert as plain text without script execution",
      priority: "P0",
      expectedResult: "XSS sanitized; rendered as plain text",
      tags: ["security", "xss", "sanitization"],
    },
    {
      id: "FIT-SEC-006",
      featureId: "NFR",
      category: "Security",
      title: "Public invoice link isolates single invoice and reveals no other client data",
      given: "a valid public invoice link for Acme Corp",
      when: "the client inspects the response payload",
      then: "only that specific invoice details are returned; no other client data or invoices are exposed",
      priority: "P0",
      expectedResult: "Public invoice link exposes only target invoice data",
      tags: ["security", "isolation", "public-link"],
    },
  ];
  return T;
}

export function getSampleCanned(): { requirements: ParsedRequirements; testCases: TestCase[]; playwright: PlaywrightSuite } {
  const requirements = cannedRequirements();
  const testCases = cannedTestCases();

  const pageObjects = [
    {
      className: "LoginPage",
      fileName: "login.page.ts",
      code: `import { type Page, type Locator, expect } from "@playwright/test";

/** Page Object for Authentication (Freelancer & Accountant login) */
export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Sign In" });
    this.emailInput = page.getByTestId("login-email");
    this.passwordInput = page.getByTestId("login-password");
    this.submitButton = page.getByRole("button", { name: "Sign in" });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, pass: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(pass);
    await this.submitButton.click();
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }
}
`,
    },
    {
      className: "ClientsPage",
      fileName: "clients.page.ts",
      code: `import { type Page, type Locator, expect } from "@playwright/test";

/** Page Object for Clients Management */
export class ClientsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly currencySelect: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Clients" });
    this.nameInput = page.getByTestId("clientName");
    this.emailInput = page.getByTestId("clientEmail");
    this.currencySelect = page.getByTestId("currency");
    this.createButton = page.getByRole("button", { name: "Add Client" });
  }

  async goto() {
    await this.page.goto("/clients");
  }

  async createClient(name: string, email: string, currency: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.currencySelect.selectOption(currency);
    await this.createButton.click();
  }

  async expectLoaded() {
    await expect(this.page.getByTestId("clients-root")).toBeVisible();
  }
}
`,
    },
    {
      className: "InvoiceEditorPage",
      fileName: "invoice-editor.page.ts",
      code: `import { type Page, type Locator, expect } from "@playwright/test";

/** Page Object for Invoice Creation and Editing */
export class InvoiceEditorPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly clientSelect: Locator;
  readonly issueDateInput: Locator;
  readonly dueDateInput: Locator;
  readonly noteInput: Locator;
  readonly addItemButton: Locator;
  readonly saveDraftButton: Locator;
  readonly sendInvoiceButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Invoice Editor" });
    this.clientSelect = page.getByTestId("invoiceClient");
    this.issueDateInput = page.getByTestId("issueDate");
    this.dueDateInput = page.getByTestId("dueDate");
    this.noteInput = page.getByTestId("note");
    this.addItemButton = page.getByRole("button", { name: "Add Item" });
    this.saveDraftButton = page.getByRole("button", { name: "Save Draft" });
    this.sendInvoiceButton = page.getByRole("button", { name: "Send Invoice" });
  }

  async goto() {
    await this.page.goto("/invoices/new");
  }

  async expectLoaded() {
    await expect(this.page.getByTestId("invoice-editor-root")).toBeVisible();
  }
}
`,
    },
    {
      className: "PaymentsPage",
      fileName: "payments.page.ts",
      code: `import { type Page, type Locator, expect } from "@playwright/test";

/** Page Object for Payments & Balance Tracking */
export class PaymentsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly amountInput: Locator;
  readonly dateInput: Locator;
  readonly recordButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Payments" });
    this.amountInput = page.getByTestId("paymentAmount");
    this.dateInput = page.getByTestId("paymentDate");
    this.recordButton = page.getByRole("button", { name: "Record Payment" });
  }

  async goto() {
    await this.page.goto("/payments");
  }

  async expectLoaded() {
    await expect(this.page.getByTestId("payments-root")).toBeVisible();
  }
}
`,
    },
    {
      className: "PublicInvoicePage",
      fileName: "public-invoice.page.ts",
      code: `import { type Page, type Locator, expect } from "@playwright/test";

/** Page Object for Public Client Invoice View */
export class PublicInvoicePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly paymentSentButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Invoice Details" });
    this.paymentSentButton = page.getByRole("button", { name: "Payment Sent" });
  }

  async gotoToken(token: string) {
    await this.page.goto(\`/i/\${token}\`);
  }

  async expectLoaded() {
    await expect(this.page.getByTestId("public-invoice-root")).toBeVisible();
  }
}
`,
    },
    {
      className: "ExportPage",
      fileName: "export.page.ts",
      code: `import { type Page, type Locator, expect } from "@playwright/test";

/** Page Object for Accountant CSV Export */
export class ExportPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Export Invoices" });
    this.startDateInput = page.getByTestId("startDate");
    this.endDateInput = page.getByTestId("endDate");
    this.exportButton = page.getByRole("button", { name: "Export CSV" });
  }

  async goto() {
    await this.page.goto("/export");
  }

  async exportCsv() {
    const download = this.page.waitForEvent("download");
    await this.exportButton.click();
    return download;
  }

  async expectLoaded() {
    await expect(this.page.getByTestId("export-root")).toBeVisible();
  }
}
`,
    },
  ];

  const fileName = "invoice-tracker.spec.ts";
  const imports = pageObjects
    .map((p) => `import { ${p.className} } from "./pages/${p.fileName.replace(/\\.ts$/, "")}";`)
    .join("\n");

  const byFeature = new Map<string, TestCase[]>();
  for (const c of testCases) {
    const arr = byFeature.get(c.featureId) ?? [];
    arr.push(c);
    byFeature.set(c.featureId, arr);
  }

  const featurePomMap: Record<string, string> = {
    "FR-AUTH": "LoginPage",
    "FR-CLI": "ClientsPage",
    "FR-INV": "InvoiceEditorPage",
    "FR-PAY": "PaymentsPage",
    "FR-EXP": "ExportPage",
    NFR: "PublicInvoicePage",
  };

  const describeBlocks = requirements.features
    .map((f) => {
      const list = byFeature.get(f.id) ?? [];
      const poClass = featurePomMap[f.id] || "LoginPage";
      const tests = list
        .map((t) => {
          return [
            `  test(${JSON.stringify(t.title.slice(0, 90))}, async ({ page }) => {`,
            `    // covers ${t.id}`,
            `    const pom = new ${poClass}(page);`,
            `    await pom.goto();`,
            `    // Given: ${t.given.slice(0, 110)}`,
            `    // When: ${t.when.slice(0, 110)}`,
            `    await expect(page.getByTestId("status-${t.id.toLowerCase()}")).toBeVisible();`,
            `    // Then: ${t.then.slice(0, 110)}`,
            `    await expect(page.getByTestId("result-${t.id.toLowerCase()}")).toContainText(${JSON.stringify(t.expectedResult.slice(0, 40))});`,
            `  });`,
            ``,
          ].join("\n");
        })
        .join("\n");

      return [
        `test.describe(${JSON.stringify(f.name)}, () => {`,
        `  test.beforeEach(async ({ page }) => {`,
        `    await page.goto("/login");`,
        `    await page.getByTestId("login-email").fill("alex@freelance.dev");`,
        `    await page.getByTestId("login-password").fill("Str0ngPass99");`,
        `    await page.getByRole("button", { name: "Sign in" }).click();`,
        `  });`,
        ``,
        tests,
        `});`,
        ``,
      ].join("\n");
    })
    .join("\n");

  const specCode = [
    `import { test, expect } from "@playwright/test";`,
    imports,
    ``,
    `/**`,
    ` * ${requirements.title}`,
    ` * Generated by SpecShield QA — ${testCases.length} tests across ${requirements.features.length} features.`,
    ` * Run with: npx playwright test ${fileName}`,
    ` */`,
    ``,
    describeBlocks,
  ].join("\n");

  const combinedCode = [
    `import { test, expect, type Page, type Locator } from "@playwright/test";`,
    ``,
    `/* ── Page Objects (inlined for single-file download) ─────────────────── */`,
    ``,
    ...pageObjects.flatMap((p) => {
      const body = p.code.split("\n").filter((l) => !l.startsWith("import {")).join("\n");
      return [body];
    }),
    ``,
    `/* ── Tests ───────────────────────────────────────────────────────────── */`,
    ``,
    describeBlocks,
  ].join("\n");

  const coverage = testCases.map((c) => ({ testCaseId: c.id, testName: c.title.slice(0, 90) }));

  return {
    requirements,
    testCases,
    playwright: {
      fileName,
      pageObjects,
      specCode,
      combinedCode,
      coverage,
    },
  };
}
