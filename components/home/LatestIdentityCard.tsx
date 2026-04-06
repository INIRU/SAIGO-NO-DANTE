'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { IdentityWithSinner } from '@/lib/types'
import { BLUR_PLACEHOLDER } from '@/lib/utils/images'

function formatDate(d: string) {
  const dateOnly = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return `${year}.${month}.${day}`
  }
  const timestamp = Date.parse(d)
  if (Number.isNaN(timestamp)) return d
  const kst = new Date(timestamp + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}`
}

interface LatestIdentityCardProps {
  identity: IdentityWithSinner
  portraitUrl: string
  logoUrl: string
  rarityIconSrc: string | null
}

export function LatestIdentityCard({ identity, portraitUrl, logoUrl, rarityIconSrc }: LatestIdentityCardProps) {
  return (
    <Link
      href={`/sinners/${identity.sinner_id}/identities/${identity.id}`}
      className="latest-card group block"
      suppressHydrationWarning
    >
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: '3/4',
          background: 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)',
          border: '1px solid var(--border)',
          borderRadius: '0.25rem',
          transition: 'border-color 0.25s, box-shadow 0.25s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--gold-dim)'
          e.currentTarget.style.boxShadow = '0 0 1.25rem rgba(200,144,10,0.2), inset 0 0 1.25rem rgba(200,144,10,0.05)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {portraitUrl ? (
          <Image
            src={portraitUrl}
            alt={identity.name_kr}
            fill
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
            style={{ objectPosition: '50% 10%' }}
            sizes="200px"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(160deg, #1e1810 0%, #0d0a06 100%)' }}
          >
            <span className="font-serif font-light" style={{ fontSize: '2.5rem', color: 'rgba(200,144,10,0.08)' }}>
              {identity.name_kr?.[0] ?? '?'}
            </span>
          </div>
        )}

        <div className="absolute top-2 left-2 z-10">
          <Image
            src={logoUrl}
            alt=""
            width={20}
            height={20}
            style={{ width: '1.25rem', height: '1.25rem', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))', opacity: 0.75 }}
          />
        </div>

        {rarityIconSrc && (
          <div className="absolute top-2 right-2 z-10">
            <Image
              src={rarityIconSrc}
              alt={`${identity.rarity}성`}
              width={48}
              height={16}
              unoptimized
              style={{ height: '0.6875rem', width: 'auto', objectFit: 'contain' }}
            />
          </div>
        )}

        <div
          className="absolute z-10"
          style={{ bottom: '-1px', left: '-1px', right: '-1px', height: 'calc(60% + 1px)', background: 'linear-gradient(to top, rgba(13,11,8,1) 0%, rgba(13,11,8,0.85) 40%, rgba(13,11,8,0.2) 75%, transparent 100%)' }}
        />

        <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 z-20">
          <div
            className="font-serif font-light leading-tight group-hover:text-yellow-300 transition-colors"
            style={{ color: 'var(--gold-light)', fontSize: '0.8125rem' }}
          >
            {identity.name_kr}
          </div>
          <div className="flex items-center gap-1" style={{ marginTop: '0.125rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.5625rem', fontFamily: 'var(--font-title)' }}>
              {identity.sinner?.name_kr ?? identity.sinner_id}
            </span>
            {identity.release_date && (
              <>
                <span style={{ color: '#3a2a15', fontSize: '0.375rem' }}>·</span>
                <span className="font-mono" style={{ color: '#3a2a15', fontSize: '0.5rem' }}>
                  {formatDate(identity.release_date)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
