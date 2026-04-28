import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import { getIdentityPortraitUrl } from '@/lib/utils/images'
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  clampText,
  fetchImageDataUri,
  isSupportedLang,
  ogFontOptions,
} from '@/lib/utils/og-image'

export const runtime = 'nodejs'
export const alt = '덱 공유 이미지'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

type SlotRow = {
  slot_order: number
  gacksung: boolean | null
  identities: {
    sinner_id: string
    folder_name: string | null
    game_id: string | null
    keywords: string[] | null
  } | {
    sinner_id: string
    folder_name: string | null
    game_id: string | null
    keywords: string[] | null
  }[] | null
}

type DeckRow = {
  title: string
  tags: string[] | null
  vote_count: number | null
  view_count: number | null
  profiles: { username: string | null } | { username: string | null }[] | null
  deck_identities: SlotRow[] | null
}

function fallbackImage(message: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          background: '#0d0b08',
          color: '#e8b030',
          fontFamily: 'Paperlogy',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, letterSpacing: '0.16em', color: 'rgba(232,176,48,0.58)' }}>
          SAIGO NO DANTE
        </div>
        <div style={{ display: 'flex', fontSize: 50, marginTop: 20 }}>{message}</div>
      </div>
    ),
    { ...size, ...ogFontOptions },
  )
}

export default async function DeckOgImage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: rawLang, id } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )

  const { data: deck, error } = await supabase
    .schema('limbus')
    .from('decks')
    .select(`
      title, tags, vote_count, view_count,
      profiles!decks_user_id_fkey(username),
      deck_identities(slot_order, gacksung, identities(sinner_id, folder_name, game_id, keywords))
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !deck) return fallbackImage(lang === 'en' ? 'Deck not found' : lang === 'ja' ? 'デッキが見つかりません' : '덱을 찾을 수 없습니다')

  const deckRow = deck as unknown as DeckRow
  const sorted = [...(deckRow.deck_identities ?? [])].sort((a, b) => {
    if (a.slot_order === 99 && b.slot_order !== 99) return 1
    if (b.slot_order === 99 && a.slot_order !== 99) return -1
    return a.slot_order - b.slot_order
  })
  const slots = Array.from({ length: 12 }, (_, i) => sorted[i] ?? null)

  const keywordFrequency = new Map<string, number>()
  for (const slot of sorted) {
    const identity = Array.isArray(slot?.identities) ? slot.identities[0] : slot?.identities
    for (const keyword of identity?.keywords ?? []) {
      const normalized = normalizeThemeKeyword(keyword)
      if (THEME_KW_SET.has(normalized)) {
        keywordFrequency.set(normalized, (keywordFrequency.get(normalized) ?? 0) + 1)
      }
    }
  }

  const topKeywords = [...keywordFrequency.entries()]
    .filter(([, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([keyword]) => keyword)

  const imagePromises = slots.map((slot) => {
    const identity = slot ? (Array.isArray(slot.identities) ? slot.identities[0] : slot.identities) : null
    const url = identity
      ? getIdentityPortraitUrl(identity.sinner_id, identity.folder_name, identity.game_id, slot?.gacksung ?? false)
      : ''
    return fetchImageDataUri(url, { width: 126, height: 430, quality: 72, position: 'top' })
  })
  const imageDataUris = await Promise.all(imagePromises)

  const profile = Array.isArray(deckRow.profiles) ? deckRow.profiles[0] : deckRow.profiles
  const username = profile?.username ?? null
  const tags = (deckRow.tags ?? []).slice(0, 4)
  const socialLabel = lang === 'en' ? 'SHARED DECK' : lang === 'ja' ? '共有デッキ' : '공유 덱'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d0b08',
          color: '#f4ead5',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background:
              'radial-gradient(circle at 15% 10%, rgba(232,176,48,0.12), transparent 22%), linear-gradient(180deg, #18120c 0%, #0d0b08 62%)',
          }}
        />
        <div style={{ display: 'flex', width: '100%', height: 410, position: 'relative' }}>
          {slots.map((slot, index) => {
            const dataUri = imageDataUris[index]
            return (
              <div
                key={`${slot?.slot_order ?? 'empty'}-${index}`}
                style={{
                  width: 100,
                  height: 410,
                  display: 'flex',
                  position: 'relative',
                  overflow: 'hidden',
                  background: index % 2 === 0 ? '#15100b' : '#0f0b08',
                }}
              >
                {dataUri ? (
                  <img
                    src={dataUri}
                    alt=""
                    width={100}
                    height={410}
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      filter: 'brightness(0.74) saturate(0.88) contrast(1.04)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(232,176,48,0.18)',
                      fontFamily: 'PerfectDOS',
                      fontSize: 34,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                )}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', borderLeft: '1px solid rgba(0,0,0,0.52)' }} />
              </div>
            )
          })}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              background:
                'linear-gradient(0deg, #0d0b08 0%, rgba(13,11,8,0.82) 22%, transparent 58%), linear-gradient(90deg, rgba(13,11,8,0.72) 0%, transparent 18%, transparent 82%, rgba(13,11,8,0.76) 100%)',
            }}
          />
        </div>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            padding: '0 62px 34px',
            marginTop: -78,
            flex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <span style={{ color: 'rgba(232,176,48,0.68)', fontFamily: 'PerfectDOS', fontSize: 16, letterSpacing: '0.2em' }}>
              SAIGO NO DANTE
            </span>
            <span style={{ width: 64, height: 1, background: 'rgba(232,176,48,0.32)', display: 'flex' }} />
            <span style={{ color: 'rgba(244,234,213,0.48)', fontFamily: 'PerfectDOS', fontSize: 15, letterSpacing: '0.16em' }}>
              {socialLabel}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              maxWidth: 960,
              color: '#f6eddc',
              fontFamily: 'Paperlogy',
              fontSize: 50,
              lineHeight: 1.08,
              marginBottom: 18,
            }}
          >
            {clampText(deckRow.title, 64)}
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {topKeywords.map((keyword) => (
              <span
                key={keyword}
                style={{
                  display: 'flex',
                  padding: '7px 13px',
                  border: '1px solid rgba(232,176,48,0.32)',
                  background: 'rgba(232,176,48,0.12)',
                  color: '#f1cc68',
                  fontSize: 18,
                }}
              >
                {keyword}
              </span>
            ))}
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'flex',
                  padding: '7px 13px',
                  border: '1px solid rgba(244,234,213,0.16)',
                  background: 'rgba(244,234,213,0.06)',
                  color: 'rgba(244,234,213,0.74)',
                  fontSize: 17,
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 'auto',
              paddingTop: 22,
            }}
          >
            {username && (
              <span
                style={{
                  display: 'flex',
                  padding: '10px 16px',
                  border: '1px solid rgba(244,234,213,0.18)',
                  background: 'rgba(244,234,213,0.08)',
                  color: 'rgba(244,234,213,0.84)',
                  fontSize: 20,
                }}
              >
                {username}
              </span>
            )}
            <span
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 9,
                padding: '10px 16px',
                border: '1px solid rgba(232,176,48,0.34)',
                background: 'rgba(232,176,48,0.14)',
                color: '#f1cc68',
                fontFamily: 'PerfectDOS',
                fontSize: 22,
                letterSpacing: '0.04em',
              }}
            >
              <span style={{ color: 'rgba(244,234,213,0.62)', fontSize: 15, fontFamily: 'Pretendard' }}>votes</span>
              {deckRow.vote_count ?? 0}
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 9,
                padding: '10px 16px',
                border: '1px solid rgba(232,176,48,0.26)',
                background: 'rgba(232,176,48,0.09)',
                color: '#ead28a',
                fontFamily: 'PerfectDOS',
                fontSize: 22,
                letterSpacing: '0.04em',
              }}
            >
              <span style={{ color: 'rgba(244,234,213,0.58)', fontSize: 15, fontFamily: 'Pretendard' }}>views</span>
              {deckRow.view_count ?? 0}
            </span>
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 18, border: '1px solid rgba(232,176,48,0.18)', display: 'flex', pointerEvents: 'none' }} />
      </div>
    ),
    { ...size, ...ogFontOptions },
  )
}
