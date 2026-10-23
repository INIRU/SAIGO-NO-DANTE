/**
 * The self-hosted server's memory, one line every few minutes in its log (`journalctl -u saigo-web | grep memory`). The
 * JS heap is what ran out on 2026-10-23 (`heap out of memory` at the 1GB limit); rss alone cannot tell it from the image
 * optimizer's native memory (external/arrayBuffers).
 */
const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))}MB`

export function memoryLine(usage: NodeJS.MemoryUsage = process.memoryUsage()): string {
  return `[memory] heapUsed=${mb(usage.heapUsed)} heapTotal=${mb(usage.heapTotal)} rss=${mb(usage.rss)} external=${mb(usage.external)} arrayBuffers=${mb(usage.arrayBuffers)}`
}

/** Logs `memoryLine()` every `intervalMs`; the timer does not keep the process alive. */
export function startMemoryLog(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  const timer = setInterval(() => console.log(memoryLine()), intervalMs)
  timer.unref()
  return timer
}
