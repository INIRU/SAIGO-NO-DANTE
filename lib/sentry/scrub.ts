// Personal data out of every browser event (user, cookies, query strings, auth headers).
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

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
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

// A URL (absolute, or a path) followed by its query and/or fragment: the query is cut off.
const URL_QUERY = /((?:https?:\/\/|\/)[^\s?#"'<>]*)[?#][^\s"'<>]*/g
// Stack frames keep their file URLs as they are (source maps match them); the SDK block is ours; sdkProcessingMetadata is the
// SDK's own working data (scopes that point at each other), never sent.
const LEFT_ALONE = new Set(["exception", "stacktrace", "debug_meta", "sdk", "sdkProcessingMetadata"]);
// Fields that hold only a query string.
const QUERY_FIELD = /(^|\.)query(_string)?$/;

function stripIn(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return value.replace(URL_QUERY, "$1");
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  // an object met again (shared, or pointing back at itself) was already cleaned
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = stripIn(value[i], seen);
  } else {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (LEFT_ALONE.has(key)) continue;
      if (QUERY_FIELD.test(key)) delete record[key];
      else record[key] = stripIn(record[key], seen);
    }
  }
  return value;
}

/**
 * Page URLs carry filters, search words and deck codes in their queries: every URL in an event (span descriptions and URLs,
 * breadcrumbs, a replay's URLs, a recording's custom events) loses its query and fragment. Changes the event in place.
 */
export function stripUrlQueries<T>(event: T): T {
  return stripIn(event, new WeakSet()) as T;
}
