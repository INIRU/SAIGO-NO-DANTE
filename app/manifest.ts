import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '최애의 관리자 | SAIGO NO DANTE',
    short_name: '최애의 관리자',
    description: 'Limbus Company 팬 아카이브 — 수감자 DB, 덱 빌더, 덱 공유',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0b08',
    theme_color: '#c8900a',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icons/icon-72x72.webp', sizes: '72x72', type: 'image/webp' },
      { src: '/icons/icon-96x96.webp', sizes: '96x96', type: 'image/webp' },
      { src: '/icons/icon-128x128.webp', sizes: '128x128', type: 'image/webp' },
      { src: '/icons/icon-144x144.webp', sizes: '144x144', type: 'image/webp' },
      { src: '/icons/icon-152x152.webp', sizes: '152x152', type: 'image/webp' },
      { src: '/icons/icon-192x192.webp', sizes: '192x192', type: 'image/webp', purpose: 'any' },
      { src: '/icons/icon-384x384.webp', sizes: '384x384', type: 'image/webp' },
      { src: '/icons/icon-512x512.webp', sizes: '512x512', type: 'image/webp', purpose: 'any' },
    ],
  }
}
