import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: true,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  integrations: [Sentry.replayIntegration()],

  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection",
    "AbortError",
    "ChunkLoadError",
    /Loading chunk \d+ failed/,
    // YouTube iframe cross-origin SecurityError (Sentry BrowserApiErrors instrumentation)
    /Blocked a frame with origin.*from accessing a cross-origin frame/,
    "SecurityError: Blocked a frame",
    // Invalid deck code gzip decompression
    /compressed data was not valid/,
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
