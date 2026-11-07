import { earlyErrors } from "@/lib/sentry/early";

// The browser Sentry starts once the page is idle (owner, 2026-11-07: "로딩 뒤에 켜기"), so its SDK (about 80KB gzip) is not in
// every page's first load. Errors before the start are kept and sent right after it (lib/sentry/early.ts); a navigation before
// it is not traced.
let routerTransitionStart: ((href: string, navigationType: string) => void) | undefined

export function onRouterTransitionStart(href: string, navigationType: string) {
  routerTransitionStart?.(href, navigationType);
}

if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  const stopListening = earlyErrors.listen(window);
  const load = () => {
    import("@/lib/sentry/client-init").then(({ startSentry }) => {
      const sentry = startSentry();
      routerTransitionStart = sentry.captureRouterTransitionStart;
      // Sentry's own handlers catch window errors from here; the early listeners stop so nothing is sent twice
      stopListening();
      earlyErrors.connect(error => sentry.captureException(error));
    }).catch(() => {});
  };
  const idle = window.requestIdleCallback;
  const start = () => (idle ? idle(load, { timeout: 4000 }) : setTimeout(load, 2000));
  if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
}
