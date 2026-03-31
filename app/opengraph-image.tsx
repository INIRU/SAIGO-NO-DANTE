import { ImageResponse } from 'next/og'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const alt = '최애의 관리자 — Limbus Company 팬 아카이브'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

import { STORAGE_BASE } from '@/lib/constants/game'

// 거미집 검지 아비 이상 (각성)
const PORTRAIT_URL = `${STORAGE_BASE}/sinners/yi-sang/identities/${encodeURIComponent('The House of Spiders The Index Nursefather')}/10115_gacksung.webp`

async function fetchAsJpegDataUri(url: string, w: number, h: number): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return ''
    const buf = Buffer.from(await res.arrayBuffer())
    const jpeg = await sharp(buf).resize(w, h, { fit: 'cover', position: 'top' }).jpeg({ quality: 80 }).toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return ''
  }
}

export default async function OgImage() {
  const portrait = await fetchAsJpegDataUri(PORTRAIT_URL, 420, 630)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: 'linear-gradient(135deg, #0d0b08 0%, #1a1510 40%, #0d0b08 100%)',
          overflow: 'hidden',
        }}
      >
        {/* 포트레이트 (우측) */}
        {portrait && (
          <div
            style={{
              position: 'absolute',
              right: '0',
              top: '0',
              width: '480px',
              height: '630px',
              display: 'flex',
              overflow: 'hidden',
            }}
          >
            <img
              src={portrait}
              width={480}
              height={630}
              style={{
                objectFit: 'cover',
                objectPosition: 'top center',
                opacity: 0.85,
              }}
            />
            {/* 좌측 페이드 */}
            <div
              style={{
                position: 'absolute',
                left: '0',
                top: '0',
                width: '200px',
                height: '100%',
                background: 'linear-gradient(90deg, #0d0b08 0%, transparent 100%)',
                display: 'flex',
              }}
            />
            {/* 하단 페이드 */}
            <div
              style={{
                position: 'absolute',
                left: '0',
                bottom: '0',
                width: '100%',
                height: '120px',
                background: 'linear-gradient(0deg, #0d0b08 0%, transparent 100%)',
                display: 'flex',
              }}
            />
          </div>
        )}

        {/* 배경 글로우 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '30%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(200,144,10,0.06) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* 장식 보더 */}
        <div
          style={{
            position: 'absolute',
            inset: '16px',
            border: '1px solid rgba(200,144,10,0.2)',
            borderRadius: '8px',
            display: 'flex',
          }}
        />

        {/* 텍스트 영역 (좌측) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '60px 80px',
            position: 'relative',
            zIndex: 1,
            maxWidth: '720px',
          }}
        >
          {/* 상단 태그 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '28px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '1px',
                background: 'rgba(200,144,10,0.5)',
                display: 'flex',
              }}
            />
            <span
              style={{
                color: 'rgba(200,144,10,0.5)',
                fontSize: '13px',
                letterSpacing: '0.35em',
                fontFamily: 'monospace',
              }}
            >
              LIMBUS COMPANY FAN ARCHIVE
            </span>
          </div>

          {/* 메인 타이틀 */}
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: '#c8900a',
              letterSpacing: '0.06em',
              margin: '0 0 12px 0',
              textShadow: '0 0 80px rgba(200,144,10,0.4)',
              lineHeight: 1.1,
            }}
          >
            SAIGO NO
            <br />
            DANTE
          </h1>

          {/* 한글 타이틀 */}
          <p
            style={{
              fontSize: '26px',
              color: 'rgba(232,196,120,0.65)',
              margin: '0 0 40px 0',
              fontWeight: 600,
            }}
          >
            최애의 관리자
          </p>

          {/* 기능 태그 */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
            }}
          >
            {['수감자 DB', '덱 빌더', '거울 던전', '메타 분석'].map((tag) => (
              <div
                key={tag}
                style={{
                  padding: '6px 16px',
                  border: '1px solid rgba(200,144,10,0.25)',
                  borderRadius: '4px',
                  color: 'rgba(200,144,10,0.7)',
                  fontSize: '14px',
                  background: 'rgba(200,144,10,0.04)',
                  display: 'flex',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            left: '80px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              color: 'rgba(200,144,10,0.3)',
              fontSize: '13px',
              letterSpacing: '0.1em',
              fontFamily: 'monospace',
            }}
          >
            saigo-no-dante.vercel.app
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
