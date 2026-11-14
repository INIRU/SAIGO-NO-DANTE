import { NextResponse } from 'next/server'

/** An error answer: `{ error }` (plus `code` when the screen picks its message by code) with the status. */
export function fail(status: number, error: string, code?: string) {
  return NextResponse.json({ error, ...(code ? { code } : {}) }, { status })
}
