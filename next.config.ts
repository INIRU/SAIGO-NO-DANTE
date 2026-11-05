import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from 'next-intl/plugin';
import { HTML_LIMITED_BOTS } from './lib/seo/html-limited-bots';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');
// Vercel and the self-hosted server (behind Cloudflare) are HTTPS-only; local `next start` stays on http.
const isHttpsDeployment = process.env.VERCEL === '1' || process.env.SELF_HOSTED === '1';
const isProduction = process.env.NODE_ENV === 'production';

// The AdSense code (adsbygoogle.js) and what it loads: ad scripts, ad frames, the consent message (Funding Choices) and
// the traffic-quality checks. AdSense supports only a nonce-based strict CSP, which would make every prerendered page
// per-request; these host families are the fallback. an allowlist Google may outgrow, check the console's
// CSP reports after AdSense changes.
const ADSENSE_HOSTS = 'https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.googleadservices.com https://*.adtrafficquality.google https://fundingchoicesmessages.google.com'
const contentSecurityPolicyDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? " 'wasm-unsafe-eval'" : " 'unsafe-eval'"} https://va.vercel-scripts.com https://static.cloudflareinsights.com ${ADSENSE_HOSTS}`,
  "style-src 'self' 'unsafe-inline'",
  // Any https picture: the ads' pictures come from the advertisers' hosts (and https: covers storage, avatars and news images).
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  // assets.saigo-no-dante.com: the skill motion videos and their layer data on R2, read by the motion player.
  `connect-src 'self' https://lpgqcleszdlldneiwgep.supabase.co https://va.vercel-scripts.com https://cloudflareinsights.com https://assets.saigo-no-dante.com ${ADSENSE_HOSTS} https://*.google.com`,
  "worker-src 'self' blob:",
  `frame-src https://www.youtube.com https://www.youtube-nocookie.com ${ADSENSE_HOSTS} https://www.google.com`,
  "media-src 'self' https://assets.saigo-no-dante.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isHttpsDeployment ? ["upgrade-insecure-requests"] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The production server (4GB) builds next to the live app; TypeScript 7's separate tsc (~1.75GB) ran it out of memory
  // and froze the site (2026-10-22). Its deploy script sets SKIP_BUILD_TYPECHECK=1: CI's TypeCheck job checks every PR.
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === '1' },
  // The self-hosted server runs the standalone output (built on GitHub): only the files the app needs, node_modules included,
  // so the server neither builds nor installs packages. Vercel ignores this.
  output: process.env.SELF_HOSTED === '1' ? 'standalone' : undefined,
  // The tunnel host is for looking at the dev server from another machine (cloudflared quick tunnel).
  allowedDevOrigins: ['127.0.0.1', '*.trycloudflare.com'],

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

  // Googlebot and the other listed crawlers get metadata in <head> instead of the cached shell (lib/seo/html-limited-bots.ts)
  htmlLimitedBots: HTML_LIMITED_BOTS,

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
    // WebP only: sources are already WebP, and AVIF took about 50% longer to encode on every optimizer cache miss.
    // With hundreds of distinct game images per page, cold misses (first view, new widths) were the slow loads.
    formats: ['image/webp'],
  },
  // The player moved to its own page; a link or search result with ?skill= keeps working (the query goes along).
  async redirects() {
    const skill = [{ type: 'query' as const, key: 'skill' }]
    return [
      { source: '/motion/skills', has: skill, destination: '/motion/skills/watch', permanent: true },
      { source: '/:lang(ko|en|ja)/motion/skills', has: skill, destination: '/:lang/motion/skills/watch', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        // Public game UI sprites and icons (versioned with ?v= or file hashes when corrected): browsers reuse them for a
        // day without a revalidation round trip per sprite, then revalidate in the background.
        source: '/:dir(assets|icons|images|placeholders)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=2592000' },
        ],
      },
      {
        // robots.txt lets crawlers fetch the API (a rendered page reads from it); the responses themselves stay out of the index.
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
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
