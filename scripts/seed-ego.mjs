/**
 * seed-ego.mjs
 * 1. EGO 테이블에 folder_name, image_url 컬럼 추가 (없으면)
 * 2. 로컬 EGO 폴더를 스캔해서 ego 레코드 upsert
 *
 * 사용: node --env-file=.env.local scripts/seed-ego.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET       = 'limbus-assets'
const SOURCE_DIR   = '/Users/iniru/Documents/Limbus/assets/Identities & EGO Art'

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

// 폴더명 → 한국어 이름 (알려진 것만, 나머지는 영어 그대로)
const EGO_KR_MAP = {
  'Sunshower':              '소나기',
  'Bygone Days':            '지난날',
  'Crow_s Eye View':        '까마귀의 시선',
  '4th Match Flame':        '4번째 매치 불꽃',
  'Dimension Shredder':     '차원 분쇄기',
  'Fell Bullet':            '타락한 탄환',
  'Great Trichiliocosm':    '대삼천',
  'Wishing Cairn':          '염원의 돌무덤',
  'Everlasting':            '영원',
  'Command Meltdown':       '명령 붕괴',
  'Fluid Sac':              '액체 낭',
  'Hex Nail':               '저주의 못',
  'Representation Emitter': '표상 방사기',
  'Snare':                  '올가미',
  'Telepole':               '텔레폴',
  'Thoracalgia':            '흉통',
  '9 2':                    '9:2',
  'Electric Screaming':     '전기 비명',
  'In the Name of Love and Hate': '사랑과 증오의 이름으로',
  'La Sangre de Sancho':    '산초의 피',
  'Lifetime Stew':          '평생 스튜',
  'Red Sheet':              '붉은 시트',
  'Yearning-Mircalla':      '열망-미르칼라',
  'Blind Obsession':        '맹목적 집착',
  'Contempt, Awe':          '경멸, 경외',
  'Forest for the Flames':  '불꽃을 위한 숲',
  'Red Eyes':               '붉은 눈',
  'Red Eyes (Open)':        '붉은 눈 (열린)',
  'Soda':                   '소다',
  'Capote':                 '카포테',
  'Chains of Others':       '타인의 사슬',
  'Crushbound Past':        '부서진 과거',
  'Pursuance':              '추구',
  'Regret':                 '후회',
  'You Want To Get Beat Hurtily': '아프게 맞고 싶으신가요',
  'Cavernous Wailing':      '동굴의 울부짖음',
  'Effervescent Corrosion': '거품 부식',
  'Land of Illusion':       '환상의 땅',
  'Roseate Desire':         '장밋빛 욕망',
  'Tears of the Tarnished Blood': '더럽혀진 피의 눈물',
  'To Remain Oneself':      '자신으로 남기 위해',
  'AEDD':                   'AEDD',
  'Asymmetrical Inertia':   '비대칭적 관성',
  'Binds':                  '속박',
  'Bodysack':               '시체 자루',
  'Holiday':                '휴가',
  'Move-in Reg':            '입주 규정',
  'Ya Śūnyatā Tad Rūpam':   '야 슈냐타 타드 루팜',
  'Ardor Blossom Star':     '열정의 꽃별',
  'Christmas Nightmare':    '크리스마스 악몽',
  'Hundred-Footed Death Maggot': '백족 죽음 구더기',
  'Snagharpoon':            '스내그하푼',
  'Tidal Elegy':            '조류의 비가',
  'Wingbeat':               '날갯짓',
  'Indicant_s Trial':       '인디칸트의 시련',
  'Rime Shank':             '서리 단검',
  'Sanguine Desire':        '핏빛 욕망',
  'What is Cast':           '던져진 것',
  'Branch of Knowledge':    '지식의 가지',
  'Impending Day':          '다가오는 날',
  'Lantern':                '랜턴',
  'Ebony Stem':             '흑단 줄기',
  'I_ll Go fer Scissors, How _Bout You': '가위 낼게, 넌?',
  'Magic Bullet':           '마법의 탄환',
  'To Páthos Máthos':       '토 파토스 마토스',
  'Garden of Thorns':       '가시 정원',
  'Legerdemain':            '레제르드맹',
  'Solemn Lament':          '엄숙한 애도',
  'Suddenly, One Day':      '어느 날, 갑자기',
  'Unbrilliant Glory':      '빛나지 않는 영광',
}

// 폴더 내에서 awaken_profile 파일 찾기
function findProfileFile(folderPath) {
  try {
    const files = readdirSync(folderPath)
    // awaken_profile 우선, 없으면 awaken_info, 없으면 profile_summary
    const priority = ['_awaken_profile', '_awaken_info', '_profile_summary', '_cg']
    for (const suffix of priority) {
      const match = files.find(f => f.includes(suffix) && !f.includes('erosion'))
      if (match) return basename(match, extname(match)) // 확장자 없는 이름 반환
    }
  } catch {}
  return null
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ .env.local에서 SUPABASE URL/KEY를 설정해주세요.')
    process.exit(1)
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // 1. ALTER TABLE로 컬럼 추가 (이미 있으면 무시)
  console.log('📋 DB 마이그레이션: folder_name, image_url, name_kr 컬럼 추가...')
  await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS folder_name TEXT;
      ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS image_url   TEXT;
      ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS name_kr     TEXT;
    `
  }).then(({ error }) => {
    // rpc exec_sql가 없을 수 있으므로 에러 무시하고 계속
    if (error) console.log('  (마이그레이션 RPC 없음 — Supabase SQL Editor에서 직접 실행하세요)')
  })

  // 2. 폴더 스캔 → upsert
  const STORAGE_BASE = `${SUPABASE_URL.replace('.supabase.co', '.supabase.co')}/storage/v1/object/public/${BUCKET}`

  const records = []
  for (const [sinnerName, sinnerId] of Object.entries(SINNER_ID_MAP)) {
    const egoDir = join(SOURCE_DIR, sinnerName, 'EGO')
    let folders
    try { folders = readdirSync(egoDir).filter(e => statSync(join(egoDir, e)).isDirectory()) }
    catch { continue }

    for (const folderName of folders) {
      const folderPath = join(egoDir, folderName)
      const profileFile = findProfileFile(folderPath)
      const imageUrl = profileFile
        ? `${STORAGE_BASE}/sinners/${sinnerId}/ego/${encodeURIComponent(folderName)}/${profileFile}.webp`
        : null
      const nameKr = EGO_KR_MAP[folderName] ?? null

      records.push({
        sinner_id:   sinnerId,
        name:        folderName.replace(/_/g, "'"),  // Crow_s → Crow's
        name_kr:     nameKr,
        folder_name: folderName,
        image_url:   imageUrl,
      })
    }
  }

  console.log(`\n📁 ${records.length}개 EGO 레코드 upsert 중...`)

  // name + sinner_id 기준으로 upsert (중복 방지)
  let done = 0, errors = 0
  for (const rec of records) {
    // 기존 레코드 조회
    const { data: existing } = await supabase
      .schema('limbus').from('ego')
      .select('id')
      .eq('sinner_id', rec.sinner_id)
      .eq('name', rec.name)
      .maybeSingle()

    if (existing) {
      // 업데이트
      const { error } = await supabase.schema('limbus').from('ego')
        .update({ folder_name: rec.folder_name, image_url: rec.image_url, name_kr: rec.name_kr })
        .eq('id', existing.id)
      if (error) { console.error(`  ❌ UPDATE ${rec.name}: ${error.message}`); errors++ }
      else done++
    } else {
      // 신규 삽입
      const { error } = await supabase.schema('limbus').from('ego')
        .insert(rec)
      if (error) { console.error(`  ❌ INSERT ${rec.name}: ${error.message}`); errors++ }
      else done++
    }
    process.stdout.write(`\r  진행: ${done + errors}/${records.length} (성공 ${done} / 실패 ${errors})   `)
  }

  console.log(`\n\n✅ 완료: ${done}/${records.length} upsert`)
  if (errors > 0) console.log(`⚠️  실패 ${errors}개`)

  console.log('\n💡 이미지가 아직 없다면 먼저 실행하세요:')
  console.log('   node --env-file=.env.local scripts/upload-assets.mjs')
  console.log('\n💡 DB 컬럼 추가가 필요하면 Supabase SQL Editor에서:')
  console.log('   ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS folder_name TEXT;')
  console.log('   ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS image_url TEXT;')
  console.log('   ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS name_kr TEXT;')
}

main().catch(console.error)
