import { ImageResponse } from 'next/og'
import { getEGOById, getSinnerById } from '@/lib/db/queries'
import { GRADE_COLORS } from '@/lib/constants/game'
import { getLocalizedName } from '@/lib/i18n/localize'
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  clampText,
  fetchImageDataUri,
  isSupportedLang,
  ogFontOptions,
} from '@/lib/utils/og-image'

export const runtime = 'nodejs'
export const alt = 'EGO 공유 이미지'
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

export default async function EgoOgImage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; egoId: string }>
}) {
  const { lang: rawLang, slug, egoId } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'

  try {
    const [sinner, ego] = await Promise.all([
      getSinnerById(slug),
      getEGOById(egoId),
    ])

    if (!sinner || !ego) {
      return fallbackImage(lang === 'en' ? 'EGO not found' : lang === 'ja' ? 'EGOが見つかりません' : 'EGO를 찾을 수 없습니다')
    }

    const art = await fetchImageDataUri(ego.image_url || ego.cor_image_url || '', {
      width: 690,
      height: 630,
      quality: 82,
      position: 'top',
    })
    const sinnerName = getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)
    const egoName = getLocalizedName({ name_kr: ego.name_kr ?? ego.name, name_en: ego.name_en, name_jp: ego.name_jp }, lang)
    const gradeColor = GRADE_COLORS[ego.grade] ?? '#c8900a'
    const label = lang === 'en' ? 'EGO ARCHIVE' : lang === 'ja' ? 'EGOアーカイブ' : 'EGO 아카이브'
    const sinLabel = ego.sin_affinity ? ego.sin_affinity.toUpperCase() : 'NO SIN'

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
                'radial-gradient(circle at 76% 16%, rgba(200,48,64,0.22), transparent 26%), radial-gradient(circle at 28% 86%, rgba(232,176,48,0.13), transparent 24%), linear-gradient(135deg, #120d09 0%, #0d0b08 60%, #070605 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: 690,
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
                width={690}
                height={630}
                style={{
                  objectFit: 'cover',
                  objectPosition: '50% 0%',
                  filter: 'saturate(0.96) contrast(1.08) brightness(0.88)',
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
                background: 'linear-gradient(90deg, #0d0b08 0%, rgba(13,11,8,0.7) 22%, rgba(13,11,8,0.08) 62%, rgba(13,11,8,0.2) 100%), linear-gradient(0deg, #0d0b08 0%, transparent 30%)',
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
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              width: 650,
              padding: '58px 0 58px 72px',
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
                marginBottom: 42,
              }}
            >
              <span>SAIGO NO DANTE</span>
              <span style={{ width: 62, height: 1, display: 'flex', background: 'rgba(232,176,48,0.28)' }} />
              <span>{label}</span>
            </div>
            <div style={{ display: 'flex', color: 'rgba(244,234,213,0.72)', fontSize: 28, marginBottom: 14 }}>
              {sinnerName}
            </div>
            <div
              style={{
                display: 'flex',
                color: '#f6eddc',
                fontFamily: 'Paperlogy',
                fontSize: 68,
                lineHeight: 1,
                marginBottom: 30,
              }}
            >
              {clampText(egoName, 34)}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span
                style={{
                  display: 'flex',
                  padding: '9px 15px',
                  border: `1px solid ${gradeColor}`,
                  background: 'rgba(244,234,213,0.06)',
                  color: gradeColor,
                  fontFamily: 'PerfectDOS',
                  fontSize: 19,
                  letterSpacing: '0.08em',
                }}
              >
                {ego.grade}
              </span>
              <span
                style={{
                  display: 'flex',
                  padding: '9px 15px',
                  border: '1px solid rgba(232,176,48,0.3)',
                  background: 'rgba(232,176,48,0.1)',
                  color: '#f1cc68',
                  fontFamily: 'PerfectDOS',
                  fontSize: 19,
                  letterSpacing: '0.08em',
                }}
              >
                {sinLabel}
              </span>
            </div>
            <div style={{ display: 'flex', marginTop: 42, width: 120, height: 2, background: 'rgba(232,176,48,0.32)' }} />
          </div>
        </div>
      ),
      { ...size, ...ogFontOptions },
    )
  } catch {
    return fallbackImage(lang === 'en' ? 'EGO preview unavailable' : lang === 'ja' ? 'EGOプレビューを表示できません' : 'EGO 미리보기를 만들 수 없습니다')
  }
}
