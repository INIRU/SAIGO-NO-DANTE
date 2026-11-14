import { NextResponse } from 'next/server'
import { fetchCollectionData } from '@/features/tools/server'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'

/** The public collection catalog (my page's collection tab); the /collection page gets the same data from its server render. */
export async function GET() {
  try {
    return NextResponse.json(await fetchCollectionData(), { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch {
    return NextResponse.json({ error: '데이터를 불러올 수 없습니다.' }, { status: 500 })
  }
}
