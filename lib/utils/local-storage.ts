type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'setItem'>

/** The browser's localStorage, or null on the server or when the browser blocks it. */
function browserStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

/** The JSON value under a key; null when there is none, it is not JSON, or the storage cannot be read. */
export function readJson(key: string, storage: Reader | null = browserStorage()): unknown {
  try { return JSON.parse(storage?.getItem(key) ?? 'null') } catch { return null }
}

/** Stores a JSON value; false (nothing thrown) when there is no storage, it is full or blocked, or the value is not JSON. */
export function writeJson(key: string, value: unknown, storage: Writer | null = browserStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch { return false }
}
