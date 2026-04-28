import { ImageResponse } from 'next/og'
import { STORAGE_BASE } from '@/lib/constants/game'
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  fetchImageDataUri,
  isSupportedLang,
  localizedSiteLabels,
  ogFontOptions,
} from '@/lib/utils/og-image'

export const runtime = 'nodejs'
export const alt = 'SAIGO NO DANTE localized social preview'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

const HERO_ART_URL = `${STORAGE_BASE}/sinners/yi-sang/identities/${encodeURIComponent('The House of Spiders The Index Nursefather')}/10115_gacksung.webp`

export default async function LocalizedOgImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const labels = localizedSiteLabels(lang)

  const heroArt = await fetchImageDataUri(HERO_ART_URL, {
    width: 520,
    height: 630,
    quality: 82,
    position: 'top',
  })

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
              'radial-gradient(circle at 18% 12%, rgba(232,176,48,0.18), transparent 26%), linear-gradient(135deg, #0d0b08 0%, #1a1510 52%, #090706 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 560,
            height: 630,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          {heroArt ? (
            <img
              src={heroArt}
              alt=""
              width={560}
              height={630}
              style={{
                objectFit: 'cover',
                objectPosition: '50% 0%',
                filter: 'saturate(0.92) contrast(1.06)',
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', background: '#17110b' }} />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              background:
                'linear-gradient(90deg, #0d0b08 0%, rgba(13,11,8,0.72) 17%, rgba(13,11,8,0.06) 48%, rgba(13,11,8,0.2) 100%), linear-gradient(0deg, #0d0b08 0%, transparent 28%)',
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 54,
            left: 60,
            width: 450,
            height: 504,
            display: 'flex',
            borderLeft: '1px solid rgba(232,176,48,0.32)',
            borderTop: '1px solid rgba(232,176,48,0.22)',
            background: 'linear-gradient(135deg, rgba(232,176,48,0.08), transparent 58%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 22,
            display: 'flex',
            border: '1px solid rgba(200,144,10,0.2)',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: 760,
            padding: '56px 72px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              color: 'rgba(232,176,48,0.72)',
              fontFamily: 'PerfectDOS',
              fontSize: 16,
              letterSpacing: '0.18em',
              marginBottom: 26,
            }}
          >
            <span>{labels.eyebrow}</span>
            <span style={{ width: 72, height: 1, display: 'flex', background: 'rgba(232,176,48,0.35)' }} />
            <span>{labels.locale}</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              color: '#e8b030',
              fontFamily: 'Paperlogy',
              fontSize: 76,
              lineHeight: 0.94,
              letterSpacing: '0.025em',
              marginBottom: 24,
            }}
          >
            <span>SAIGO NO</span>
            <span>DANTE</span>
          </div>
          <div
            style={{
              display: 'flex',
              maxWidth: 570,
              color: 'rgba(244,234,213,0.78)',
              fontSize: 26,
              lineHeight: 1.35,
              marginBottom: 38,
            }}
          >
            {labels.subtitle}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {labels.features.map((feature, index) => (
              <div
                key={feature}
                style={{
                  display: 'flex',
                  padding: '9px 16px',
                  border: '1px solid rgba(232,176,48,0.26)',
                  background: index === 0 ? 'rgba(232,176,48,0.14)' : 'rgba(232,176,48,0.055)',
                  color: index === 0 ? '#f2d27a' : 'rgba(242,210,122,0.78)',
                  fontSize: 18,
                }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 60,
            bottom: 42,
            display: 'flex',
            color: 'rgba(244,234,213,0.46)',
            fontFamily: 'PerfectDOS',
            fontSize: 16,
            letterSpacing: '0.08em',
          }}
        >
          saigo-no-dante.com/{lang}
        </div>
      </div>
    ),
    { ...size, ...ogFontOptions },
  )
}
