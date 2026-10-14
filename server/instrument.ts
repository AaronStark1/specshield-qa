import * as Sentry from "@sentry/node";
const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "local",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "1.0"),
    release: "specshield-qa@" + (process.env.npm_package_version ?? "0.1.0"),
    // sendDefaultPii enables prompt/response previews in the AI Agents view.
    // Kept as an any-cast: the option name moved across Sentry major versions.
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII !== "false",
  } as unknown as Parameters<typeof Sentry.init>[0]);
}
export const sentryEnabled = Boolean(dsn);
