export const SAMPLE_SPEC_TITLE = "Freelancer Invoice Tracker";

export const SAMPLE_SPEC = `# Freelancer Invoice Tracker — Product Requirements (v1.0)

## Background
Solo freelancers lose track of which invoices are unpaid. The Invoice Tracker lets a freelancer
create clients, issue invoices, record payments and get overdue reminders.

## User Roles
- **Freelancer** — owns the account, creates clients and invoices, records payments.
- **Client** — external; receives a public invoice link and can mark an invoice as "Payment Sent".
- **Accountant** — read-only access to all invoices and a CSV export.

## Functional Requirements

### 3.1 Authentication (FR-AUTH)
- FR-AUTH-01: Freelancers sign up with email and password. Passwords must be 8–64 characters with at least one number.
- FR-AUTH-02: After 5 failed logins within 10 minutes the account is locked for 15 minutes.
- FR-AUTH-03: Sessions expire after 60 minutes of inactivity.

### 3.2 Clients (FR-CLI)
- FR-CLI-01: A client has a name (required, 2–80 characters), email (required, valid format) and currency (USD, EUR, GBP or INR).
- FR-CLI-02: Two clients cannot share the same email within one freelancer account; the error is "A client with this email already exists".
- FR-CLI-03: A client with unpaid invoices cannot be deleted; the delete button is disabled with a tooltip.

### 3.3 Invoices (FR-INV)
- FR-INV-01: An invoice has a client, issue date, due date, 1–50 line items and an optional note (max 500 characters).
- FR-INV-02: Each line item has a description (required), quantity (1–999) and unit price (0.01–1,000,000.00). Total is computed and shown to 2 decimals.
- FR-INV-03: Due date must be on or after the issue date and no more than 180 days after it.
- FR-INV-04: Invoice numbers are generated as INV-{YEAR}-{4 digits}, sequential per freelancer, never reused.
- FR-INV-05: Status lifecycle: Draft → Sent → Paid | Overdue | Cancelled. Only Draft invoices can be edited.
- FR-INV-06: Sending an invoice emails the client a public link. The link expires 90 days after the due date.

### 3.4 Payments & Reminders (FR-PAY)
- FR-PAY-01: A freelancer records a payment with amount and date. Partial payments are allowed; the invoice becomes Paid when the sum of payments equals the total.
- FR-PAY-02: A payment cannot exceed the remaining balance; the error is "Amount exceeds outstanding balance".
- FR-PAY-03: Invoices unpaid 1 day after the due date become Overdue automatically and the client receives a reminder email at +1, +7 and +14 days.
- FR-PAY-04: The Client can click "Payment Sent" on the public link, which notifies the freelancer but does not change the status.

### 3.5 Export (FR-EXP)
- FR-EXP-01: Accountants can export all invoices for a date range as CSV. The export is limited to 12 months per request.

## Non-Functional Requirements
- NFR-SEC-01: Role-based access enforced on the server; Accountants receive 403 on any write endpoint.
- NFR-SEC-02: The public invoice link uses an unguessable 32-character token and shows no other client data.
- NFR-SEC-03: All free-text fields are rendered as plain text to prevent script injection.
- NFR-PERF-01: Invoice list loads within 500 ms for 2,000 invoices.
- NFR-A11Y-01: All forms are keyboard-navigable with visible focus states.`;