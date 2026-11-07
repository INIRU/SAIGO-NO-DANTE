import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry/scrub";

/**
 * The browser Sentry, loaded by instrumentation-client.ts once the page is idle so the SDK (about 80KB gzip) stays out of every
 * page's first load. Errors raised before this runs are kept by lib/sentry/early.ts and sent right after the start.
 */
export function startSentry() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
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

    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // 세션 리플레이는 따로 불러온다(아래 loadReplay)
    integrations: [],

    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,

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
  loadReplay();
  return Sentry;
}

// Replay is the largest part of the Sentry bundle; it loads in its own chunk after the start.
// @sentry/replay (named @sentry-internal/replay before 10.76) is declared in package.json with the same range as @sentry/nextjs.
function loadReplay() {
  import("@sentry/replay").then(({ replayIntegration }) => {
    Sentry.addIntegration(replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      networkCaptureBodies: false,
      networkRequestHeaders: [],
      networkResponseHeaders: [],
    }));
  }).catch(() => {});
}
