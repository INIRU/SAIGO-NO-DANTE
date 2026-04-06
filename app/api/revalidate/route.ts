import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'


export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    // Verify secret token
    if (secret !== process.env.REVALIDATION_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    // Get paths to revalidate from request body, or default to '/'
    const body = await request.json().catch(() => ({}))
    const paths: string[] = body.paths ?? ['/']

    for (const path of paths) {
      revalidatePath(path)
    }

    return NextResponse.json({ revalidated: paths, timestamp: Date.now() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
