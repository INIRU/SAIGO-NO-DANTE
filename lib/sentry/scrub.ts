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
