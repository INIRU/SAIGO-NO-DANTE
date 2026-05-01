import { ImageResponse } from 'next/og'
import { getIdentityById, getSinnerById } from '@/lib/db/queries'
import { getLocalizedAffiliation, getLocalizedName } from '@/lib/i18n/localize'
import { getIdentityInfoUrl, getIdentityProfileUrl } from '@/lib/utils/images'
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  clampText,
  fetchImageDataUri,
  isSupportedLang,
  ogFontOptions,
} from '@/lib/utils/og-image'

export const runtime = 'nodejs'
export const alt = '인격 공유 이미지'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

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

export default async function IdentityOgImage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>
}) {
  const { lang: rawLang, slug, id } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'

  const [sinner, identity] = await Promise.all([
    getSinnerById(slug),
    getIdentityById(id),
  ])

  if (!sinner || !identity) {
    return fallbackImage(lang === 'en' ? 'Identity not found' : lang === 'ja' ? '人格が見つかりません' : '인격을 찾을 수 없습니다')
  }

  const artUrl = getIdentityInfoUrl(identity) || getIdentityProfileUrl(identity)
  const art = await fetchImageDataUri(artUrl, {
    width: 560,
    height: 630,
    quality: 82,
    position: 'top',
  })

  const sinnerName = getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)
  const identityName = getLocalizedName(identity, lang)
  const affiliation = identity.affiliation ? getLocalizedAffiliation(identity.affiliation, lang) : null
  const keywords = (identity.keywords ?? []).slice(0, 4)
  const rarity = `${'0'.repeat(Math.max(1, identity.rarity))}`
  const label = lang === 'en' ? 'IDENTITY ARCHIVE' : lang === 'ja' ? '人格アーカイブ' : '인격 아카이브'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: '#0d0b08',
          color: '#f4ead5',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background:
              'radial-gradient(circle at 72% 18%, rgba(232,176,48,0.2), transparent 28%), linear-gradient(135deg, #17100a 0%, #0d0b08 56%, #080604 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 575,
            height: 630,
            display: 'flex',
            overflow: 'hidden',
            background: '#130f0a',
          }}
        >
          {art ? (
            <img
              src={art}
              alt=""
              width={575}
              height={630}
              style={{
                objectFit: 'cover',
                objectPosition: '50% 0%',
                filter: 'saturate(0.94) contrast(1.08)',
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', background: '#15100b' }} />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              background: 'linear-gradient(90deg, transparent 0%, rgba(13,11,8,0.08) 46%, #0d0b08 100%), linear-gradient(0deg, #0d0b08 0%, transparent 34%)',
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 22,
            display: 'flex',
            border: '1px solid rgba(232,176,48,0.18)',
          }}
        />
        <div
          style={{
            position: 'relative',
            marginLeft: 515,
            padding: '64px 70px 52px 44px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              color: 'rgba(232,176,48,0.68)',
              fontFamily: 'PerfectDOS',
              fontSize: 16,
              letterSpacing: '0.16em',
              marginBottom: 44,
            }}
          >
            <span>SAIGO NO DANTE</span>
            <span style={{ width: 62, height: 1, display: 'flex', background: 'rgba(232,176,48,0.28)' }} />
            <span>{label}</span>
          </div>
          <div style={{ display: 'flex', color: '#e8b030', fontFamily: 'Paperlogy', fontSize: 34, marginBottom: 16 }}>
            {sinnerName}
          </div>
          <div
            style={{
              display: 'flex',
              color: '#f6eddc',
              fontFamily: 'Paperlogy',
              fontSize: 58,
              lineHeight: 1.04,
              marginBottom: 28,
            }}
          >
            {clampText(identityName, 46)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
            <span
              style={{
                display: 'flex',
                padding: '8px 14px',
                border: '1px solid rgba(232,176,48,0.34)',
                background: 'rgba(232,176,48,0.12)',
                color: '#f1cc68',
                fontFamily: 'PerfectDOS',
                fontSize: 18,
                letterSpacing: '0.08em',
              }}
            >
              {rarity}
            </span>
            {affiliation && (
              <span style={{ display: 'flex', color: 'rgba(244,234,213,0.62)', fontSize: 19 }}>
                {affiliation}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {keywords.map((keyword) => (
              <span
                key={keyword}
                style={{
                  display: 'flex',
                  padding: '7px 12px',
                  border: '1px solid rgba(244,234,213,0.16)',
                  background: 'rgba(244,234,213,0.06)',
                  color: 'rgba(244,234,213,0.74)',
                  fontSize: 17,
                }}
              >
                {keyword}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', marginTop: 'auto', color: 'rgba(244,234,213,0.42)', fontFamily: 'PerfectDOS', fontSize: 16, letterSpacing: '0.08em' }}>
            identity/{identity.game_id ?? id.slice(0, 8)}
          </div>
        </div>
      </div>
    ),
    { ...size, ...ogFontOptions },
  )
}
