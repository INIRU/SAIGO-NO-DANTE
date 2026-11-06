/** Hidden easter eggs. Found ones are remembered in this browser (localStorage) and shown as hidden achievements. */
export const EASTER_EGGS = ['faust-faces', 'clock-head', 'twisted-star', 'konami', 'lost-manager'] as const
export type EasterEgg = typeof EASTER_EGGS[number]
export const EGGS_KEY = 'easter-eggs-found'

export function readEggs(storage: Pick<Storage, 'getItem'> | null | undefined): EasterEgg[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(EGGS_KEY) ?? '[]')
    return Array.isArray(value) ? EASTER_EGGS.filter(egg => value.includes(egg)) : []
  } catch {
    return []
  }
}

/** Records an egg; true only the first time it is found. */
export function recordEgg(storage: Pick<Storage, 'getItem' | 'setItem'>, egg: EasterEgg): boolean {
  const found = readEggs(storage)
  if (found.includes(egg)) return false
  try { storage.setItem(EGGS_KEY, JSON.stringify([...found, egg])) } catch { return false }
  return true
}
