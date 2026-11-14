'use client'

import Link from 'next/link'

/** The game's top-left back button: back_frame around a dark plate and the striped icon_back arrow; back_hover on hover. */
export default function BackButton({ href, base, label, onClick }: { href?: string; base: string; label: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : Link
  return (
    <Tag href={(onClick ? undefined : href ?? '') as string} type={onClick ? 'button' : undefined} onClick={onClick} aria-label={label} title={label}
      className="story-back group pointer-events-auto relative block h-[3.25rem] w-[5.75rem] shrink-0 @3xl:h-[3.75rem] @3xl:w-[6.625rem]">
      <span className="absolute inset-[9%_6%] bg-[#0b0906] [clip-path:polygon(4%_0,96%_0,100%_12%,100%_88%,96%_100%,4%_100%,0_88%,0_12%)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/back-icon.webp`} alt="" className="absolute left-1/2 top-1/2 h-[48%] -translate-x-1/2 -translate-y-1/2" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/back-frame.webp`} alt="" className="absolute inset-0 h-full w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/back-hover.webp`} alt="" className="absolute inset-0 h-full w-full opacity-0 mix-blend-screen transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" />
    </Tag>
  )
}
