import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');
const isVercelDeployment = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production';

const contentSecurityPolicyDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? " 'wasm-unsafe-eval'" : " 'unsafe-eval'"} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lpgqcleszdlldneiwgep.supabase.co https://lh3.googleusercontent.com https://i.ytimg.com",
  "font-src 'self'",
  "connect-src 'self' https://lpgqcleszdlldneiwgep.supabase.co https://va.vercel-scripts.com",
  "worker-src 'self' blob:",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isVercelDeployment ? ["upgrade-insecure-requests"] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],

  // NOTE: turbopack.root intentionally unset — worktree node_modules symlink to parent
  //       repo breaks Turbopack when root is forced to __dirname. The "multiple lockfiles"
  //       warning is cosmetic only in this layout.

  // Phase 4 (Next.js 16 sweep): React Compiler considered but DEFERRED.
  // Enabling `reactCompiler: true` caused `npm run build` to crash with
  // "FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed -
  // JavaScript heap out of memory" during the TypeScript type-check phase
  // (V8 hits the 4GB default ceiling). Keep disabled until we either:
  //   (a) raise NODE_OPTIONS=--max-old-space-size in Vercel build env, and/or
  //   (b) split the monorepo/TSC passes.
  // babel-plugin-react-compiler devDep is kept installed for a future retry.
  // reactCompiler: true,

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
    'page-1d':  { stale: 86400, revalidate: 86400, expire: 604800 },
  },

  experimental: {
    // Tree-shake barrel-file packages so only used exports are bundled
    optimizePackageImports: [
      'lucide-react',
      'sonner',
      'motion',
      '@radix-ui/react-dialog',
      'nuqs',
    ],
  },

  images: {
    // Source sprite corrections use content-versioned URLs to invalidate stale crops.
    localPatterns: [
      { pathname: '/assets/game-ui/**' },
      { pathname: '/assets/skill-frames/**' },
      { pathname: '/**', search: '' },
    ],
    // DNS64/NAT64 can make public Supabase Storage resolve to local-looking IPv6 addresses.
    dangerouslyAllowLocalIP: true,
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
    qualities: [50, 60, 75, 90],
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
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicyDirectives.join('; '),
          },
        ],
      },
    ]
  },
};

export default withNextIntl(withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  sourcemaps: {
    disable: process.env.NODE_ENV !== 'production' || !process.env.SENTRY_AUTH_TOKEN,
  },
}));
