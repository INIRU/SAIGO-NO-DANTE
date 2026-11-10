import { connection } from 'next/server'

/** The build the server runs now (next.config `env`), for a page still showing an older one (components/pwa/UpdateNotice). */
export async function GET() {
  // read per request, never prerendered: a cached answer would hide a new deploy
  await connection()
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? null }, { headers: { 'Cache-Control': 'no-store' } })
}
