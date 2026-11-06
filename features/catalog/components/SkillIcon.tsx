'use client'

import { useState } from 'react'
import Image from 'next/image'

interface SkillIconProps {
  url: string
  fallbackUrl?: string
  sinColor: string
  label: string
}

export default function SkillIcon({ url, fallbackUrl, sinColor, label }: SkillIconProps) {
  const [src, setSrc] = useState(url)
  const [failed, setFailed] = useState(false)

  // url이 바뀌면 리셋
  const [prevUrl, setPrevUrl] = useState(url)
  if (prevUrl !== url) {
    setPrevUrl(url)
    setSrc(url)
    setFailed(false)
  }

  if (!src || failed) {
    return (
      <div
        className="rounded shrink-0 flex items-center justify-center"
        style={{ width: 28, height: 28, background: `${sinColor}18`, border: `1px solid ${sinColor}40` }}
      >
        <span className="font-mono font-bold" style={{ fontSize: '0.625rem', color: `${sinColor}60` }}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt=""
      width={28}
      height={28}
      className="rounded shrink-0"
      style={{ border: `1px solid ${sinColor}40` }}
      onError={() => {
        if (fallbackUrl && src !== fallbackUrl) {
          setSrc(fallbackUrl)
        } else {
          setFailed(true)
        }
      }}
    />
  )
}
