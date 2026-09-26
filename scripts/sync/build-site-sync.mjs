#!/usr/bin/env node
/**
 *   node scripts/sync/build-site-sync.mjs <out-dir> [--win]
 * <out-dir> gets apply-extraction.mjs, the three sync bundles, sync-extracted-identities.cjs and sharp (win32-x64 with --win).
 * Put a .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, REVALIDATION_SECRET and NEXT_PUBLIC_SITE_URL beside them.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'

const out = process.argv[2] && resolve(process.argv[2])
if (!out) throw Error('usage: node scripts/sync/build-site-sync.mjs <out-dir> [--win]')
// sharp is native, so it is installed for the target OS next to the bundles instead of bundled.
const common = { bundle: true, platform: 'node', target: 'node22', external: ['sharp'], logLevel: 'warning' }
await build({
  ...common, format: 'esm', outdir: out, outExtension: { '.js': '.mjs' },
  entryPoints: Object.fromEntries(['apply-extraction', 'identity-data', 'mirror-dungeon-data', 'rebuild-mirror-events'].map(name => [name, `scripts/sync/${name}.ts`])),
  // Bundled CommonJS dependencies still call require().
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
})
await build({ ...common, format: 'cjs', entryPoints: ['scripts/assets/sync-extracted-identities.cjs'], outfile: join(out, 'sync-extracted-identities.cjs') })
const sharp = JSON.parse(readFileSync('node_modules/sharp/package.json', 'utf8')).version
execFileSync('npm', ['install', '--prefix', out, '--no-save', '--no-package-lock', '--no-audit', '--no-fund', `sharp@${sharp}`,
  ...(process.argv.includes('--win') ? ['--os=win32', '--cpu=x64'] : [])], { stdio: 'inherit' })
console.log(`site-sync bundle: ${out}`)
