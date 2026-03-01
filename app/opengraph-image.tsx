import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '최애의 관리자 — Limbus Company 팬 아카이브'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0d0b08 0%, #1a1510 50%, #0d0b08 100%)',
          position: 'relative',
        }}
      >
        {/* 장식 보더 */}
        <div
          style={{
            position: 'absolute',
            inset: '16px',
            border: '1px solid rgba(200,144,10,0.3)',
            borderRadius: '8px',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '20px',
            border: '1px solid rgba(200,144,10,0.1)',
            borderRadius: '6px',
            display: 'flex',
          }}
        />

        {/* 배경 장식 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(200,144,10,0.08) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* 상단 태그 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '1px',
              background: 'rgba(200,144,10,0.5)',
              display: 'flex',
            }}
          />
          <span
            style={{
              color: 'rgba(200,144,10,0.6)',
              fontSize: '14px',
              letterSpacing: '0.4em',
              fontFamily: 'monospace',
            }}
          >
            LIMBUS COMPANY FAN ARCHIVE
          </span>
          <div
            style={{
              width: '40px',
              height: '1px',
              background: 'rgba(200,144,10,0.5)',
              display: 'flex',
            }}
          />
        </div>

        {/* 메인 타이틀 */}
        <h1
          style={{
            fontSize: '72px',
            fontWeight: 'bold',
            color: '#c8900a',
            letterSpacing: '0.08em',
            margin: '0 0 8px 0',
            textShadow: '0 0 60px rgba(200,144,10,0.3)',
          }}
        >
          SAIGO NO DANTE
        </h1>

        {/* 한글 타이틀 */}
        <p
          style={{
            fontSize: '28px',
            color: 'rgba(232,196,120,0.7)',
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
            gap: '16px',
          }}
        >
          {['수감자 DB', '덱 빌더', '덱 공유'].map((tag) => (
            <div
              key={tag}
              style={{
                padding: '8px 20px',
                border: '1px solid rgba(200,144,10,0.3)',
                borderRadius: '4px',
                color: 'rgba(200,144,10,0.8)',
                fontSize: '16px',
                background: 'rgba(200,144,10,0.05)',
                display: 'flex',
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
