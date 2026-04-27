import { createClient } from '@supabase/supabase-js'
import { readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import sharp from 'sharp'

// ── 설정 ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
const BUCKET      = 'limbus-assets'
const SOURCE_DIR  = '/Users/iniru/Documents/Limbus/assets/Identities & EGO Art'
const ICONS_DIR   = '/Users/iniru/Documents/Limbus/assets/Icons'
const CONCURRENCY = 4
const WEBP_QUALITY = 85

// 폴더명 → sinner ID 매핑
const SINNER_ID_MAP = {
  'Yi Sang':    'yi-sang',
  'Faust':      'faust',
  'Don Quixote':'don-quixote',
  'Ryoshu':     'ryoshu',
  'Meursault':  'meursault',
  'Hong Lu':    'hong-lu',
  'Heathcliff': 'heathcliff',
  'Ishmael':    'ishmael',
  'Rodion':     'rodion',
  'Sinclair':   'sinclair',
  'Outis':      'outis',
  'Gregor':     'gregor',
}

// 스토리지 키에 허용되지 않는 특수문자 치환
function sanitizeKey(name) {
  return name
    .replace(/【/g, '(')
    .replace(/】/g, ')')
    .replace(/[^\w\s\-.()/]/g, '_')
}

// ── 파일 목록 수집 ─────────────────────────────────────────
function collectFiles(dir, baseStoragePath, results = []) {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    const safeEntry = sanitizeKey(entry)
    if (stat.isDirectory()) {
      collectFiles(fullPath, `${baseStoragePath}/${safeEntry}`, results)
    } else if (['.png', '.jpg', '.jpeg'].includes(extname(entry).toLowerCase())) {
      const nameWithoutExt = basename(safeEntry, extname(safeEntry))
      results.push({
        localPath: fullPath,
        storagePath: `${baseStoragePath}/${nameWithoutExt}.webp`,
      })
    }
  }
  return results
}

// ── 병렬 업로드 ────────────────────────────────────────────
async function uploadBatch(supabase, files) {
  let done = 0
  const total = files.length
  const errors = []

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async ({ localPath, storagePath }) => {
      try {
        // PNG → WebP 변환
        const webpBuffer = await sharp(localPath)
          .webp({ quality: WEBP_QUALITY, lossless: false })
          .toBuffer()

        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, webpBuffer, {
            contentType: 'image/webp',
            upsert: true,
          })

        if (error) {
          errors.push({ storagePath, error: error.message })
        } else {
          done++
        }
      } catch (err) {
        errors.push({ storagePath, error: String(err) })
      }
      process.stdout.write(`\r  진행: ${done + errors.length}/${total} (성공 ${done} / 실패 ${errors.length})   `)
    }))
  }
  return { done, errors }
}

// ── 메인 ──────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ .env.local에서 SUPABASE URL/KEY를 설정해주세요.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // 버킷 연결 테스트 (파일 1개 업로드로 확인)
  console.log(`버킷 '${BUCKET}' 연결 확인 중...`)
  const testBuf = Buffer.from('test')
  const { error: testErr } = await supabase.storage
    .from(BUCKET)
    .upload('_test.txt', testBuf, { upsert: true })
  if (testErr) {
    console.error(`❌ 버킷 연결 실패: ${testErr.message}`)
    console.error('   Supabase Dashboard → Storage → New bucket → 이름: limbus-assets, Public: ON')
    process.exit(1)
  }
  await supabase.storage.from(BUCKET).remove(['_test.txt'])
  console.log(`✓ 버킷 '${BUCKET}' 연결 확인\n`)

  // 모드 선택: --icons 플래그로 아이콘만 업로드
  const mode = process.argv[2]

  const allFiles = []

  if (mode === '--icons') {
    // Icons 폴더 업로드
    console.log('📁 Icons 폴더 스캔 중...')
    try { collectFiles(ICONS_DIR, 'icons', allFiles) } catch (e) {
      console.error(`❌ Icons 폴더 읽기 실패: ${e.message}`)
      process.exit(1)
    }
  } else {
    // 기존: 인격/EGO 아트 업로드
    for (const [sinnerName, sinnerId] of Object.entries(SINNER_ID_MAP)) {
      const sinnerPath = join(SOURCE_DIR, sinnerName)
      try { statSync(sinnerPath) } catch { continue }

      try { collectFiles(join(sinnerPath, 'Identities'), `sinners/${sinnerId}/identities`, allFiles) } catch {}
      try { collectFiles(join(sinnerPath, 'EGO'),        `sinners/${sinnerId}/ego`,        allFiles) } catch {}
    }
  }

  console.log(`📁 총 ${allFiles.length}개 파일 → WebP 변환 후 업로드\n`)

  const start = Date.now()
  const { done, errors } = await uploadBatch(supabase, allFiles)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\n\n✅ 완료: ${done}/${allFiles.length}개 업로드 (${elapsed}초)`)
  if (errors.length > 0) {
    console.log(`⚠️  실패 ${errors.length}개:`)
    errors.slice(0, 10).forEach(e => console.log(`   - ${e.storagePath}: ${e.error}`))
  }
}

main().catch(console.error)
