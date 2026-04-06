import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Keep heavy server-only native addons out of the client bundle
  serverExternalPackages: ['sharp'],

  // Cache Components (includes PPR): enables `"use cache"` directive and Partial Prerendering
  cacheComponents: true,

  // Custom cacheLife profiles matching previous revalidate values
  cacheLife: {
    'page-1m':  { stale: 60,   revalidate: 60,   expire: 300   },
    'page-5m':  { stale: 300,  revalidate: 300,  expire: 1800  },
    'page-10m': { stale: 600,  revalidate: 600,  expire: 3600  },
    'page-1h':  { stale: 3600, revalidate: 3600, expire: 86400 },
  },

  experimental: {
    // Tree-shake barrel-file packages so only used exports are bundled
    optimizePackageImports: [
      'lucide-react',
      'sonner',
      'framer-motion',
      '@ai-sdk/react',
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lpgqcleszdlldneiwgep.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
    // deviceSizes/imageSizes control which widths next/image generates in srcset
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [64, 96, 128, 256, 384],
    qualities: [20, 25, 40, 50, 60, 75, 90],
    minimumCacheTTL: 2592000, // 30일 — 게임 에셋 이미지는 거의 변경 없음
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://lpgqcleszdlldneiwgep.supabase.co https://lh3.googleusercontent.com",
              "font-src 'self'",
              "connect-src 'self' https://lpgqcleszdlldneiwgep.supabase.co https://va.vercel-scripts.com",
              "worker-src 'self' blob:",
              "frame-src https://www.youtube.com",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  sourcemaps: {
    disable: process.env.NODE_ENV !== 'production' || !process.env.SENTRY_AUTH_TOKEN,
  },
});
