/**
 * Index prescript mode is on hold (USER 2026-11-04: too much of it depends on readings that are not yet fair; the work
 * goes to the Assist mode first). The code stays; the mode shows in development, and in production only with
 * NEXT_PUBLIC_PRESCRIPT_MODE=1.
 */
export function prescriptModeOn(env: { NODE_ENV?: string; NEXT_PUBLIC_PRESCRIPT_MODE?: string } = {
  NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_PRESCRIPT_MODE: process.env.NEXT_PUBLIC_PRESCRIPT_MODE,
}): boolean {
  return env.NODE_ENV !== 'production' || env.NEXT_PUBLIC_PRESCRIPT_MODE === '1'
}
