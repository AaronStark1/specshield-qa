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
export const AUTH_FLOW_SPEC_TITLE = "Account Authentication Flow";

export const AUTH_FLOW_SPEC = `# Account Authentication Flow — Product Requirements (v1.0)

## Background
A B2B dashboard needs a sign-in experience that is quick for returning users and strict about
account takeover. This spec covers sign-up, sign-in, two-factor codes and password reset.

## User Roles
- **Member** — signs up, signs in and manages their own credentials.
- **Admin** — can unlock accounts and force a password reset for any member.
- **Support Agent** — read-only view of sign-in history; cannot change credentials.

## Functional Requirements

### 3.1 Sign Up (FR-REG)
- FR-REG-01: Members sign up with a work email and a password. Passwords must be 12–64 characters with at least one uppercase letter, one number and one symbol.
- FR-REG-02: The email must be verified within 24 hours using a single-use link; unverified accounts cannot sign in.
- FR-REG-03: Signing up with an email that already exists shows "An account with this email already exists".

### 3.2 Sign In (FR-LOG)
- FR-LOG-01: Members sign in with email and password. A wrong password shows "Email or password is incorrect" without revealing which one failed.
- FR-LOG-02: After 5 failed logins within 15 minutes the account is locked for 30 minutes and the member is emailed an unlock link.
- FR-LOG-03: Sessions expire after 30 minutes of inactivity, with a warning shown 2 minutes before. "Remember this device" keeps the member logged in for 30 days.

### 3.3 Two-Factor Codes (FR-MFA)
- FR-MFA-01: Members can enable an authenticator app. The one-time code is 6 digits and is valid for 30 seconds.
- FR-MFA-02: After 3 wrong codes the sign-in attempt is cancelled and the member must start again.
- FR-MFA-03: Enabling two-factor issues 10 single-use recovery codes; each is 8–12 characters.

### 3.4 Password Reset (FR-RST)
- FR-RST-01: A reset link is emailed on request and expires after 20 minutes. The response is identical whether or not the email exists.
- FR-RST-02: A new password cannot match any of the last 5 passwords; the error is "Choose a password you have not used recently".
- FR-RST-03: Completing a reset signs the member out of every other session.

### 3.5 Account Administration (FR-ADM)
- FR-ADM-01: Admins can unlock a locked account; the action requires a reason of 10–200 characters.
- FR-ADM-02: Support Agents can view the last 90 days of sign-in history but receive 403 on any write endpoint.

## Non-Functional Requirements
- NFR-SEC-01: Passwords are stored hashed; login and reset endpoints are throttled per IP address.
- NFR-SEC-02: Session tokens are rotated on sign-in and every privilege change.
- NFR-SEC-03: All free-text fields are rendered as plain text to prevent script injection.
- NFR-PERF-01: Sign-in completes within 800 ms at the 95th percentile.
- NFR-A11Y-01: All forms are keyboard-navigable with visible focus states and announced errors.`;

export const CHECKOUT_SPEC_TITLE = "Storefront Checkout";

export const CHECKOUT_SPEC = `# Storefront Checkout — Product Requirements (v1.0)

## Background
An online store is rebuilding its checkout to reduce abandoned carts. This spec covers the cart,
shipping details, discount codes, payment and order confirmation.

## User Roles
- **Shopper** — adds items to the cart and places orders, as a guest or with an account.
- **Store Manager** — creates discount codes and issues refunds.
- **Fulfilment Clerk** — read-only access to paid orders and their shipping details.

## Functional Requirements

### 3.1 Cart (FR-CRT)
- FR-CRT-01: A cart holds 1–50 distinct items. Each item has a quantity of 1–99.
- FR-CRT-02: Quantity cannot exceed available stock; the error is "Only {n} left in stock".
- FR-CRT-03: A guest cart is kept for 14 days and merges into the account cart on sign-in.

### 3.2 Shipping Details (FR-SHP)
- FR-SHP-01: Shipping requires a full name (2–80 characters), address line, city, postal code and country.
- FR-SHP-02: The postal code is validated against the selected country; the error is "Enter a valid postal code".
- FR-SHP-03: Standard shipping is free for orders over 50 USD; express delivery arrives within 2 days.

### 3.3 Discount Codes (FR-DSC)
- FR-DSC-01: A discount code is 6–20 characters and is not case sensitive. Only one code applies per order.
- FR-DSC-02: An expired or unknown code shows "This code is not valid" and leaves the total unchanged.
- FR-DSC-03: A percentage discount is capped at 70% of the subtotal and never applies to shipping.

### 3.4 Payment (FR-PAY)
- FR-PAY-01: Shoppers pay by card. The card number is 13–19 digits and must pass a checksum before submission.
- FR-PAY-02: A declined card shows "Your card was declined" and keeps the cart and shipping details intact.
- FR-PAY-03: The pay button is disabled after the first click; a duplicate submission within 30 seconds never creates a second order.
- FR-PAY-04: The payment page times out after 15 minutes of inactivity and the shopper returns to the cart.

### 3.5 Order Confirmation (FR-ORD)
- FR-ORD-01: A paid order receives a number formatted as ORD-{YEAR}-{6 digits} and a confirmation email.
- FR-ORD-02: Shoppers can cancel an order within 30 minutes of payment; after that the cancel button is hidden.
- FR-ORD-03: Store Managers can refund up to the paid amount; the error is "Refund exceeds the amount paid".

## Non-Functional Requirements
- NFR-SEC-01: Card details are never stored or logged; only a payment token is kept.
- NFR-SEC-02: Access rules are enforced on the server; Fulfilment Clerks receive 403 on any write endpoint.
- NFR-SEC-03: All free-text fields are rendered as plain text to prevent script injection.
- NFR-PERF-01: The order summary updates within 300 ms of any cart change.
- NFR-A11Y-01: The whole checkout is keyboard-navigable with visible focus states.`;

export interface SampleSpec {
  id: string;
  /** Short label for the loader chip. */
  label: string;
  title: string;
  spec: string;
}

/** One-click sample specs offered by the studio's spec editor. The first entry is the default demo. */
export const SAMPLE_SPECS: readonly SampleSpec[] = [
  { id: "invoice-tracker", label: "Invoice Tracker", title: SAMPLE_SPEC_TITLE, spec: SAMPLE_SPEC },
  { id: "auth-flow", label: "Auth Flow", title: AUTH_FLOW_SPEC_TITLE, spec: AUTH_FLOW_SPEC },
  { id: "checkout", label: "Checkout", title: CHECKOUT_SPEC_TITLE, spec: CHECKOUT_SPEC },
];
