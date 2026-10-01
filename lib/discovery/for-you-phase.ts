export type ForYouPhase = 'hidden' | 'choosing' | 'ready' | 'empty'

/**
 * What the personal shelf of a board shows. Only a logged-in visitor with history on gets one; while the picks are on
 * their way (or the skeleton's minimum time is running) it holds its place, then shows them or folds away.
 */
export function forYouPhase({ personal, status, loaded, held, count }: {
  personal: boolean
  status: 'loading' | 'authenticated' | 'unauthenticated'
  /** The request finished, with picks or an error. */
  loaded: boolean
  /** The skeleton is on screen and has not been up for its minimum time yet. */
  held: boolean
  count: number
}): ForYouPhase {
  if (!personal || status !== 'authenticated') return 'hidden'
  if (!loaded || held) return 'choosing'
  return count > 0 ? 'ready' : 'empty'
}
