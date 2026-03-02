import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const alt = '덱 공유 이미지'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

function portraitUrl(
  sinner_id: string,
  folder_name: string | null,
  game_id: string | null,
  gacksung: boolean,
): string {
  if (!game_id || !folder_name) return ''
  const prefix = gacksung ? 'gacksung' : 'normal'
  const folder = encodeURIComponent(folder_name)
  return `${STORAGE_BASE}/sinners/${sinner_id}/identities/${folder}/${game_id}_${prefix}_info.webp`
}

type SlotRow = {
  slot_order: number
  gacksung: boolean
  identities: {
    sinner_id: string
    folder_name: string | null
    game_id: string | null
    keywords: string[] | null
  } | null
}

const THEME_KEYWORDS = new Set(['침잠', '출혈', '파열', '화상', '진동', '충전', '호흡'])

export default async function DeckOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data: deck } = await supabase
    .schema('limbus')
    .from('decks')
    .select(`
      title, tags, vote_count, view_count,
      profiles!decks_user_id_fkey(username),
      deck_identities(slot_order, gacksung, identities(sinner_id, folder_name, game_id, keywords))
    `)
    .eq('id', id)
    .single()

  if (!deck) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0b08', color: '#c8900a', fontSize: 40 }}>
          덱을 찾을 수 없습니다
        </div>
      ),
      { ...size },
    )
  }

  const sorted = [...(deck.deck_identities as unknown as SlotRow[] ?? [])].sort((a, b) => {
    if (a.slot_order === 99 && b.slot_order !== 99) return 1
    if (b.slot_order === 99 && a.slot_order !== 99) return -1
    return a.slot_order - b.slot_order
  })
  const slots = Array.from({ length: 12 }, (_, i) => sorted[i] ?? null)

  // 테마 키워드
  const kwFreq: Record<string, number> = {}
  for (const slot of sorted) {
    const id_ = Array.isArray(slot?.identities) ? slot.identities[0] : slot?.identities
    for (const kw of id_?.keywords ?? []) {
      if (THEME_KEYWORDS.has(kw)) kwFreq[kw] = (kwFreq[kw] ?? 0) + 1
    }
  }
  const topKeywords = Object.entries(kwFreq)
    .filter(([, n]) => n >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([kw]) => kw)

  const profile = Array.isArray(deck.profiles) ? deck.profiles[0] : deck.profiles
  const username = (profile as { username: string } | null)?.username ?? null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d0b08',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 12 포트레이트 배경 (상단 60%) */}
        <div style={{ display: 'flex', width: '100%', height: '380px', position: 'relative' }}>
          {slots.map((slot, i) => {
            const id_ = slot ? (Array.isArray(slot.identities) ? slot.identities[0] : slot.identities) : null
            const imgUrl = id_
              ? portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, slot?.gacksung ?? false)
              : ''
            return (
              <div
                key={i}
                style={{
                  width: '100px',
                  height: '380px',
                  overflow: 'hidden',
                  display: 'flex',
                  position: 'relative',
                }}
              >
                {imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl}
                    alt=""
                    width={100}
                    height={380}
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      filter: 'brightness(0.6) saturate(0.85)',
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#080604', display: 'flex' }} />
                )}
                {/* 스트립 구분선 */}
                {i > 0 && (
                  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '1px', background: 'rgba(0,0,0,0.6)', display: 'flex' }} />
                )}
              </div>
            )
          })}
          {/* 하단 그라디언트 */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '200px',
              background: 'linear-gradient(to bottom, transparent 0%, #0d0b08 100%)',
              display: 'flex',
            }}
          />
          {/* 좌우 그라디언트 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to right, rgba(13,11,8,0.7) 0%, transparent 15%, transparent 85%, rgba(13,11,8,0.7) 100%)',
              display: 'flex',
            }}
          />
        </div>

        {/* 하단 정보 영역 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '0 60px',
            marginTop: '-60px',
            position: 'relative',
            flex: 1,
          }}
        >
          {/* 사이트명 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <span style={{ color: 'rgba(200,144,10,0.5)', fontSize: '13px', letterSpacing: '0.25em', fontFamily: 'monospace' }}>
              SAIGO NO DANTE
            </span>
            <div style={{ width: '30px', height: '1px', background: 'rgba(200,144,10,0.3)', display: 'flex' }} />
            <span style={{ color: 'rgba(200,144,10,0.35)', fontSize: '13px', letterSpacing: '0.15em', fontFamily: 'monospace' }}>
              DECK
            </span>
          </div>

          {/* 덱 타이틀 */}
          <h1
            style={{
              fontSize: '44px',
              fontWeight: 'bold',
              color: '#f0ece0',
              margin: '0 0 16px 0',
              lineClamp: 2,
              overflow: 'hidden',
              textShadow: '0 2px 20px rgba(0,0,0,0.8)',
            }}
          >
            {deck.title}
          </h1>

          {/* 태그 + 키워드 */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {topKeywords.map(kw => (
              <span
                key={kw}
                style={{
                  background: 'rgba(136,88,40,0.2)',
                  color: '#c8a450',
                  border: '1px solid rgba(136,88,40,0.4)',
                  borderRadius: '4px',
                  padding: '4px 12px',
                  fontSize: '16px',
                }}
              >
                {kw}
              </span>
            ))}
            {(deck.tags as string[]).slice(0, 4).map(tag => (
              <span
                key={tag}
                style={{
                  background: 'rgba(200,144,10,0.1)',
                  color: 'rgba(200,144,10,0.7)',
                  border: '1px solid rgba(200,144,10,0.25)',
                  borderRadius: '20px',
                  padding: '4px 14px',
                  fontSize: '15px',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* 하단 메타 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: 'auto', paddingBottom: '24px' }}>
            {username && (
              <span style={{ color: '#4a4060', fontSize: '16px' }}>
                {username}
              </span>
            )}
            <span style={{ color: '#2a2035', fontSize: '14px', fontFamily: 'monospace' }}>
              ♥ {deck.vote_count}
            </span>
            <span style={{ color: '#2a2035', fontSize: '14px', fontFamily: 'monospace' }}>
              👁 {deck.view_count}
            </span>
          </div>
        </div>

        {/* 장식 보더 */}
        <div
          style={{
            position: 'absolute',
            inset: '12px',
            border: '1px solid rgba(200,144,10,0.15)',
            borderRadius: '6px',
            display: 'flex',
            pointerEvents: 'none',
          }}
        />
      </div>
    ),
    { ...size },
  )
}
