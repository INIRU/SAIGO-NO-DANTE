import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry/scrub";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  // Sentry 11 replaced sendDefaultPii with dataCollection; these keep the old "no personal data" behaviour.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: { deny: ["x-forwarded-for", "x-real-ip", "forwarded", "cf-connecting-ip"] }, response: true },
  },

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Sentry 11 streams spans by default, which ignores beforeSendTransaction (our scrubber); keep the old transaction behaviour.
  traceLifecycle: "static",

  includeLocalVariables: false,

  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});
