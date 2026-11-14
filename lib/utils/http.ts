/** A failed request: the message is the status code, so callers that only show or log it keep working. */
export class HttpError extends Error {
  constructor(readonly status: number, message = String(status)) {
    super(message)
  }
}

/** The parsed JSON body of a GET (or any `init`); throws an HttpError when the response is not ok. */
export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) throw new HttpError(response.status)
  return response.json() as Promise<T>
}

/**
 * Sends a JSON body and returns the JSON answer ({} when it is not JSON). `errorMessage` builds the thrown message from
 * the answer of a failed request; without it the message is the status code.
 */
export async function sendJson<T = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  options: { headers?: Record<string, string>; errorMessage?: (data: unknown, status: number) => string } = {},
): Promise<T> {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...options.headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data: unknown = await response.json().catch(() => ({}))
  if (!response.ok) throw new HttpError(response.status, options.errorMessage?.(data, response.status))
  return data as T
}
