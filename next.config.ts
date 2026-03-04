import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lpgqcleszdlldneiwgep.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    qualities: [25, 50, 75],
  },
  async headers() {
    return [
      {
        // Supabase Storage 이미지 — 1년 캐시 (immutable)
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://lpgqcleszdlldneiwgep.supabase.co https://lh3.googleusercontent.com",
              "font-src 'self'",
              "connect-src 'self' https://lpgqcleszdlldneiwgep.supabase.co",
              "frame-src https://www.youtube.com",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
