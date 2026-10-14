export const SAMPLE_SPEC_TITLE = "Enterprise Vendor Onboarding & KAM Site Survey Portal";

export const SAMPLE_SPEC = `# Enterprise Vendor Onboarding & KAM Site Survey Portal — Product Requirements (v2.3)

## 1. Background
Meridian Industrial Coatings onboards 300–400 new suppliers per year across 14 countries. Today
onboarding runs over email and spreadsheets, takes a median of 23 business days, and Compliance
rejects 31% of submissions for missing documents. The portal replaces that process with a
self-service vendor workflow, a structured site survey performed by the Key Account Manager
(KAM), and a two-stage approval with a full audit trail.

## 2. User Roles
- **Vendor Admin** — external supplier user who registers the company, uploads documents and tracks status.
- **Key Account Manager (KAM)** — internal; performs on-site surveys, scores the vendor, recommends approval.
- **Procurement Reviewer** — internal; validates commercial terms and bank details; first-stage approver.
- **Compliance Officer** — internal; validates certifications and sanctions screening; final approver.
- **System Administrator** — manages users, roles, country configurations and retention policies.

## 3. Functional Requirements

### 3.1 Vendor Registration (FR-REG)
- FR-REG-01: A Vendor Admin can create an account with corporate email, password and company name. Free-mail domains (gmail.com, yahoo.com, outlook.com, hotmail.com) must be rejected with the message "Please use a corporate email address".
- FR-REG-02: Passwords must be 12–64 characters and include at least one uppercase letter, one digit and one symbol.
- FR-REG-03: Email verification link expires after 24 hours; an expired link shows a "Resend verification" action.
- FR-REG-04: Company legal name is required, 2–120 characters. Duplicate legal names within the same country trigger a warning but do not block registration.
- FR-REG-05: Tax identifier is required and validated per country: India GSTIN (15 characters, pattern \`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$\`), EU VAT (country prefix + 8–12 alphanumerics), US EIN (\`^\\d{2}-\\d{7}$\`). Unsupported countries accept free text up to 32 characters.

### 3.2 Document Upload (FR-DOC)
- FR-DOC-01: Required documents: Certificate of Incorporation, Tax Registration, Bank Confirmation Letter, ISO 9001 certificate (optional for vendors with annual contract value under USD 50,000).
- FR-DOC-02: Accepted formats PDF, JPG, PNG. Maximum 10 MB per file, maximum 8 files per document type. Files over the limit must show "File exceeds 10 MB limit" without starting the upload.
- FR-DOC-03: Each document has an expiry date. Documents expiring within 30 days are flagged amber; expired documents block submission.
- FR-DOC-04: Uploaded files are virus-scanned asynchronously; a file flagged as infected is quarantined, the vendor is notified, and submission is blocked until replaced.
- FR-DOC-05: Vendors can replace a document until the application is in "Under Review"; afterwards replacement requires the reviewer to "Request Changes".

### 3.3 Bank Details (FR-BNK)
- FR-BNK-01: Bank account fields: account holder name (must match company legal name, case-insensitive, ignoring punctuation), IBAN or account number + routing/IFSC/SWIFT, bank name, currency (ISO 4217).
- FR-BNK-02: IBAN is validated with the mod-97 checksum. Invalid IBANs show "IBAN checksum failed".
- FR-BNK-03: Any change to bank details after approval moves the vendor to "Re-verification Required" and notifies the Procurement Reviewer within 5 minutes.
- FR-BNK-04: Bank details are masked in all views except the Procurement Reviewer's detail panel (last 4 characters visible elsewhere).

### 3.4 KAM Site Survey (FR-SRV)
- FR-SRV-01: A KAM can start a site survey only for vendors in status "Documents Complete".
- FR-SRV-02: The survey has 5 sections (Facility, Quality Systems, EHS, Capacity, Financial Stability), each with 4–8 scored questions on a 0–5 scale. Section score = average × 20; overall score = weighted average (Facility 15%, Quality 30%, EHS 25%, Capacity 15%, Financial 15%), 0–100.
- FR-SRV-03: Each section requires at least one geo-tagged photo captured within 500 m of the vendor's registered address; photos outside the radius are accepted but flagged "Location mismatch".
- FR-SRV-04: The survey auto-saves every 30 seconds and can be resumed offline; conflicts on sync keep the latest timestamp and log both versions.
- FR-SRV-05: Overall score below 60 auto-generates a "Corrective Action Plan" task with a 45-day due date; score 60–74 requires a KAM justification note (minimum 200 characters) before submission; score 75+ submits directly.
- FR-SRV-06: A survey can be submitted only once; re-surveys create a new version and keep the previous one read-only.

### 3.5 Approval Workflow (FR-APR)
- FR-APR-01: Status lifecycle: Draft → Documents Complete → Survey Submitted → Procurement Review → Compliance Review → Approved | Rejected | Changes Requested.
- FR-APR-02: Procurement Reviewer SLA 5 business days; Compliance Officer SLA 3 business days. Breaches escalate by email to the role's manager and show a red SLA badge.
- FR-APR-03: A reviewer cannot approve a vendor they themselves registered or surveyed (segregation of duties).
- FR-APR-04: Rejection requires a reason from a configurable list plus free text (minimum 20 characters). Rejected vendors may reapply after 90 days.
- FR-APR-05: Approval generates a Vendor ID (\`VND-{COUNTRY}-{6 digits}\`), emails the Vendor Admin, and pushes the vendor master record to the ERP via webhook with 3 retries (exponential backoff 1 min, 5 min, 25 min).

### 3.6 Audit Log & Reporting (FR-AUD)
- FR-AUD-01: Every state change, document upload, field edit and login records actor, timestamp (UTC), IP and before/after values. Audit entries are immutable.
- FR-AUD-02: Compliance Officers can export the audit log for a vendor as CSV; export is itself audited.
- FR-AUD-03: Dashboard shows onboarding funnel, median cycle time, SLA breaches and rejection reasons, filterable by country and date range.

## 4. Non-Functional Requirements
- NFR-SEC-01: Role-based access control enforced server-side; API responses must not include fields the role cannot view.
- NFR-SEC-02: Sessions expire after 30 minutes of inactivity; a 2-minute warning modal allows extension.
- NFR-SEC-03: Login is rate-limited to 5 failed attempts per 15 minutes per account, then locked for 30 minutes with an unlock email.
- NFR-SEC-04: All uploads are stored encrypted at rest; download links are signed and expire after 10 minutes.
- NFR-SEC-05: Inputs are sanitised against injection (OWASP Top 10); free-text fields render as plain text, never HTML.
- NFR-PERF-01: Document list and vendor search respond within 800 ms at p95 for 10,000 vendors.
- NFR-PERF-02: Survey offline mode supports up to 200 photos per device before sync.
- NFR-A11Y-01: WCAG 2.2 AA; all forms keyboard-navigable with visible focus and ARIA labels.
- NFR-I18N-01: UI available in English, German, Hindi and Spanish; dates and currency formatted per locale.
- NFR-RET-01: Rejected applications and their documents are purged after 24 months unless legal hold is set.

## 5. Out of Scope (v2.3)
Supplier performance scorecards, purchase-order integration, and mobile native apps.`;
