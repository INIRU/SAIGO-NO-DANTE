/**
 * seed-legal-docs.mjs
 * 이용약관·개인정보 처리방침 초기 데이터를 Supabase에 삽입합니다.
 * 사용: node --env-file=.env.local scripts/seed-legal-docs.mjs
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS limbus.legal_docs (
  type         TEXT PRIMARY KEY CHECK (type IN ('privacy', 'terms')),
  title        TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  sections     JSONB NOT NULL DEFAULT '[]',
  updated_at   TIMESTAMPTZ DEFAULT now()
);
`

const PRIVACY = {
  type: 'privacy',
  title: '개인정보 처리방침',
  last_updated: '2025년 1월 1일',
  sections: [
    {
      heading: '1. 개요',
      body: '최애의 관리자(이하 \'서비스\')는 Limbus Company 팬 커뮤니티를 위한 비공식 팬 사이트입니다. 본 방침은 서비스 이용 시 수집되는 개인정보의 처리에 관한 사항을 안내합니다.',
    },
    {
      heading: '2. 수집하는 정보',
      body: 'Google 소셜 로그인을 통해 다음 정보를 수집합니다.',
      items: ['이메일 주소 (계정 식별 목적)', '프로필 이름', '프로필 사진 URL'],
    },
    {
      heading: '3. 이용 목적',
      items: ['로그인 및 사용자 계정 관리', '덱 게시판 게시물 작성·수정·삭제', '덱 추천(좋아요) 기능 제공'],
    },
    {
      heading: '4. 보관 기간',
      body: '수집된 정보는 회원 탈퇴 시 즉시 삭제됩니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관 후 삭제합니다.',
    },
    {
      heading: '5. 제3자 제공',
      body: '서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 인증 처리를 위해 Google의 OAuth 서비스를 이용합니다.',
    },
    {
      heading: '6. 이용자의 권리',
      items: ['개인정보 열람 요청', '개인정보 수정 요청', '계정 삭제(회원 탈퇴) 요청'],
    },
    {
      heading: '7. 쿠키',
      body: '서비스는 로그인 세션 유지를 위해 쿠키를 사용합니다. 브라우저 설정에서 쿠키를 비활성화할 수 있으나, 이 경우 로그인 기능이 제한될 수 있습니다.',
    },
  ],
}

const TERMS = {
  type: 'terms',
  title: '이용약관',
  last_updated: '2025년 1월 1일',
  sections: [
    {
      heading: '제1조 (목적)',
      body: '본 약관은 최애의 관리자(이하 \'서비스\')가 제공하는 Limbus Company 팬 커뮤니티 서비스의 이용 조건 및 절차, 이용자와 서비스 간의 권리·의무 등을 규정함을 목적으로 합니다.',
    },
    {
      heading: '제2조 (서비스 성격)',
      body: '서비스는 Project Moon의 게임 Limbus Company를 기반으로 한 비공식 팬 사이트입니다. Project Moon 및 Limbus Company와 공식적인 제휴 관계에 있지 않으며, 상업적 목적 없이 운영됩니다.',
    },
    {
      heading: '제3조 (이용 자격)',
      body: '서비스는 Google 계정을 보유한 누구나 이용할 수 있습니다. 다음 경우에는 이용이 제한될 수 있습니다.',
      items: ['본 약관에 위반되는 방식으로 서비스를 이용한 경우', '타인의 명예를 훼손하거나 불쾌감을 주는 콘텐츠를 게시한 경우', '서비스의 정상적인 운영을 방해한 경우'],
      itemAccent: 'red',
    },
    {
      heading: '제4조 (서비스 내용)',
      items: ['수감자(캐릭터) 인격·EGO 데이터베이스', '덱 빌더 및 덱 공유 게시판', '인격·EGO 사용률 메타 분석'],
    },
    {
      heading: '제5조 (이용자 콘텐츠)',
      body: '이용자가 게시판에 등록한 덱 및 설명의 저작권은 해당 이용자에게 있습니다. 단, 서비스 내 표시 및 공유를 위해 서비스에 비독점적 이용 권한을 부여합니다.',
    },
    {
      heading: '제6조 (서비스 변경 및 종료)',
      body: '서비스는 팬 사이트 특성상 별도의 고지 없이 기능이 변경되거나 서비스가 종료될 수 있습니다. 서비스 종료 시 최소 7일 전 공지를 위해 노력합니다.',
    },
    {
      heading: '제7조 (면책)',
      body: '서비스는 게임 데이터의 정확성을 보장하지 않으며, 데이터 오류로 인한 손해에 대해 책임지지 않습니다.',
    },
  ],
}

async function main() {
  // 1. 테이블 생성
  console.log('📋 테이블 생성 중...')
  const { error: migErr } = await supabase.rpc('exec_sql', { sql: MIGRATION_SQL })
  if (migErr) {
    console.log('  ⚠️  RPC 없음. Supabase SQL Editor에서 직접 실행하세요:')
    console.log(MIGRATION_SQL)
    console.log('  → 계속 진행합니다.\n')
  } else {
    console.log('  ✓ 완료\n')
  }

  // 2. 데이터 삽입
  for (const doc of [PRIVACY, TERMS]) {
    const { error } = await supabase
      .schema('limbus')
      .from('legal_docs')
      .upsert({ ...doc, updated_at: new Date().toISOString() })
    if (error) {
      console.error(`❌ ${doc.type} 삽입 실패:`, error.message)
    } else {
      console.log(`✅ ${doc.type} 삽입 완료`)
    }
  }

  console.log('\n💡 테이블 생성 SQL (Supabase SQL Editor에서 실행):')
  console.log(MIGRATION_SQL)
}

main().catch(console.error)
