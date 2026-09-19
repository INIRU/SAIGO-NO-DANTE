'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getSkillFrameInnerUrl, getSkillFrameBadgeUrl, getDetailStatIconUrl } from '@/lib/utils/images'

interface SkillFrameProps {
  skillIconUrl: string
  skillIconFallback?: string
  sin: string
  /** 1 | 2 | 3 | 4 (defense) */
  skillSlot: number
  sinColor: string
  label: string
  /** rem 단위 전체 크기 (기본 3.5rem) */
  attackType?: 'slash' | 'pierce' | 'blunt' | null
  size?: string
}

export default function SkillFrame({
  skillIconUrl,
  skillIconFallback,
  sin,
  skillSlot,
  sinColor,
  label,
  size = '3.5rem',
  attackType,
}: SkillFrameProps) {
  const [iconSrc, setIconSrc] = useState(skillIconUrl)
  const [iconFailed, setIconFailed] = useState(false)

  // url 변경 추적
  const [prevUrl, setPrevUrl] = useState(skillIconUrl)
  if (prevUrl !== skillIconUrl) {
    setPrevUrl(skillIconUrl)
    setIconSrc(skillIconUrl)
    setIconFailed(false)
  }

  const innerUrl = getSkillFrameInnerUrl(sin, skillSlot)

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <Image
        src={getSkillFrameInnerUrl(sin, skillSlot, 'base')}
        alt="" width={128} height={128}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      {/* Skill icon remains centered inside the original atlas cell. */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div
          className="relative overflow-hidden"
          style={{ width: '50%', height: '50%', clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' }}
        >
          {iconFailed ? (
            <div
              className="w-full h-full flex items-center justify-center rounded"
              style={{ background: `${sinColor}18`, border: `1px solid ${sinColor}40` }}
            >
              <span className="font-mono font-bold" style={{ fontSize: '0.5rem', color: `${sinColor}60` }}>
                {label}
              </span>
            </div>
          ) : (
            <Image
              src={iconSrc}
              alt=""
              width={64}
              height={64}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
              }}
              onError={() => {
                if (skillIconFallback && iconSrc !== skillIconFallback) {
                  setIconSrc(skillIconFallback)
                } else {
                  setIconFailed(true)
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Original frame shading and transparent edges, tinted to the sin. */}
      <Image
        src={innerUrl}
        alt=""
        width={128}
        height={128}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      {attackType && (
        <div className="absolute z-20 pointer-events-none" style={{ left: '50%', top: '73%', width: '23%', height: '23%', transform: 'translateX(-50%)' }}>
          <Image src={getSkillFrameBadgeUrl(sin)} alt="" width={28} height={28} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
          <Image src={getDetailStatIconUrl(attackType)} alt="" width={16} height={16} className="absolute inset-0 m-auto" style={{ width: '55%', height: '55%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
