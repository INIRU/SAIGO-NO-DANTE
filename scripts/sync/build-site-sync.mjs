#!/usr/bin/env node
/**
 *   node scripts/sync/build-site-sync.mjs <out-dir> [--win]
 * <out-dir> gets apply-extraction.mjs, the three sync bundles, sync-extracted-identities.cjs and sharp (win32-x64 with --win),
 * plus the theme pack composer the extraction tool runs while extracting (build-theme-packs.py, its overlay sources and font).
 * --win adds a portable CPython with Pillow in python/, since the extraction PC has no Python.
 * Overlay sources: LIMBUS_COMPOSITION_ASSET_DIR, default ../assets/recovery-2026-09-10/theme-composition.
 * Put a .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, REVALIDATION_SECRET and NEXT_PUBLIC_SITE_URL beside them.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'

// Official CPython embeddable build and the matching Pillow wheel (PyPI sha256; Pillow 11.3 is what the composer is verified with).
const PYTHON = { url: 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip', sha256: '4acbed6dd1c744b0376e3b1cf57ce906f9dc9e95e68824584c8099a63025a3c3' }
const PILLOW = { url: 'https://files.pythonhosted.org/packages/8c/ce/e7dfc873bdd9828f3b6e5c2bbb74e47a98ec23cc5c74fc4e54462f0d9204/pillow-11.3.0-cp312-cp312-win_amd64.whl', sha256: 'a6444696fce635783440b7f7a9fc24b3ad10a9ea3f0ab66c5905be1c19ccf17d' }

/** Downloads a file and unzips it into dir after checking its sha256. */
async function unzipVerified({ url, sha256 }, dir) {
  const response = await fetch(url)
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual !== sha256) throw Error(`${url}: sha256 ${actual}, expected ${sha256}`)
  const file = join(dir, 'download.zip')
  writeFileSync(file, bytes)
  execFileSync('unzip', ['-q', '-o', file, '-d', dir])
  unlinkSync(file)
}

const out = process.argv[2] && resolve(process.argv[2])
if (!out) throw Error('usage: node scripts/sync/build-site-sync.mjs <out-dir> [--win]')
// sharp is native, so it is installed for the target OS next to the bundles instead of bundled.
const common = { bundle: true, platform: 'node', target: 'node22', external: ['sharp'], logLevel: 'warning' }
await build({
  ...common, format: 'esm', outdir: out, outExtension: { '.js': '.mjs' },
  entryPoints: Object.fromEntries(['apply-extraction', 'identity-data', 'mirror-dungeon-data', 'rebuild-mirror-events', 'bootstrap-data', 'extraction-restore'].map(name => [name, `scripts/sync/${name}.ts`])),
  // Bundled CommonJS dependencies still call require().
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
})
await build({ ...common, format: 'cjs', entryPoints: ['scripts/assets/sync-extracted-identities.cjs'], outfile: join(out, 'sync-extracted-identities.cjs') })
const sharp = JSON.parse(readFileSync('node_modules/sharp/package.json', 'utf8')).version
execFileSync('npm', ['install', '--prefix', out, '--no-save', '--no-package-lock', '--no-audit', '--no-fund', `sharp@${sharp}`,
  ...(process.argv.includes('--win') ? ['--os=win32', '--cpu=x64'] : [])], { stdio: 'inherit' })

const composition = resolve(process.env.LIMBUS_COMPOSITION_ASSET_DIR ?? '../assets/recovery-2026-09-10/theme-composition')
mkdirSync(join(out, 'theme-composition'), { recursive: true })
for (const name of ['MainUI_MirrorDungeon4_4.png', 'MainUI_MirrorDungeon6_17.png', 'Baton.png']) copyFileSync(join(composition, name), join(out, 'theme-composition', name))
copyFileSync('scripts/assets/build-theme-packs.py', join(out, 'build-theme-packs.py'))
copyFileSync('public/fonts/SCDream5.woff2', join(out, 'SCDream5.woff2'))
if (process.argv.includes('--win') && !existsSync(join(out, 'python', 'python.exe'))) {
  // The embeddable build's ._pth puts its own folder on sys.path, so the unpacked wheel (PIL/) imports without pip or site.
  mkdirSync(join(out, 'python'), { recursive: true })
  await unzipVerified(PYTHON, join(out, 'python'))
  await unzipVerified(PILLOW, join(out, 'python'))
}
console.log(`site-sync bundle: ${out}`)
