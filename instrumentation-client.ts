import * as Sentry from "@sentry/nextjs";

const REDACTED = "[Filtered]";
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|secret|token|api[-_]?key|service[-_]?role|password|session|jwt/i;

type ScrubbableEvent = {
  user?: {
    email?: string;
    ip_address?: string | null;
    username?: string;
  };
  request?: {
    url?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    data?: unknown;
    query_string?: unknown;
  };
};

function scrubHeaders(headers?: Record<string, string>) {
  if (!headers) return;

  for (const key of Object.keys(headers)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      headers[key] = REDACTED;
    }
  }
}

function stripQueryString(url?: string) {
  if (!url) return url;

  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0];
  }
}

function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  if (event.request) {
    event.request.url = stripQueryString(event.request.url);
    scrubHeaders(event.request.headers);
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
  }

  return event;
}

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

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // 세션 리플레이는 첫 화면 이후에 따로 불러온다(아래 loadReplay)
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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Replay is the largest part of the Sentry bundle; load it as a separate chunk once the page is idle.
// @sentry/replay (named @sentry-internal/replay before 10.76) is declared in package.json with the same range as @sentry/nextjs.
function loadReplay() {
  if (process.env.NODE_ENV !== "production") return;
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
if (typeof window !== "undefined") {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
  const start = () => (idle ? idle(loadReplay, { timeout: 8000 }) : setTimeout(loadReplay, 4000));
  if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
}
