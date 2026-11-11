import { SINNER_SLUGS } from '@/lib/constants/game'

type Texts = { ko: string; en: string; ja: string }
/** What fills the card: the 12 sinners, the newest identities, the newest E.G.O, theme packs, or the newest story chapter's map. */
export type OgArt = 'sinners' | 'identities' | 'ego' | 'themepacks' | 'story'

const card = (ko: string, en: string, ja: string, art: OgArt = 'sinners') => ({ title: { ko, en, ja } as Texts, art })

/** Pages whose share card is their name over a picture. Names follow the menu (`nav` messages). */
export const OG_SECTIONS: Record<string, { title: Texts; art: OgArt }> = {
  '/sinners': card('수감자', 'Sinners', '囚人'),
  '/sinners/identities': card('인격', 'Identities', '人格', 'identities'),
  '/sinners/ego': card('E.G.O', 'E.G.O', 'E.G.O', 'ego'),
  '/decks': card('덱 게시판', 'Deck Board', 'デッキ掲示板', 'identities'),
  '/decks/new': card('덱 빌더', 'Deck Builder', 'デッキビルダー', 'identities'),
  '/meta': card('메타 분석', 'Meta Analysis', 'メタ分析', 'identities'),
  '/collection': card('보유 현황', 'Collection', 'コレクション', 'identities'),
  '/random': card('랜덤 편성', 'Random Team', 'ランダム編成', 'identities'),
  '/motion/skills': card('스킬 모션', 'Skill Motion', 'スキルモーション', 'identities'),
  '/mirror-dungeon': card('거울 던전', 'Mirror Dungeon', 'ミラーダンジョン', 'themepacks'),
  '/planner': card('거울 던전 플래너', 'Mirror Dungeon Planner', 'ミラーダンジョンプランナー', 'identities'),
  '/planner/community': card('거던 플래너 게시판', 'Mirror Dungeon Plans', 'ミラダンプラン掲示板', 'identities'),
  '/planner/run': card('어시스트 모드', 'Assist Mode', 'アシストモード', 'identities'),
  '/story': card('스토리 맵', 'Story Map', 'ストーリーマップ', 'story'),
  '/keywords': card('키워드', 'Keywords', 'キーワード'),
  '/calendar': card('소식 캘린더', 'News Calendar', 'ニュースカレンダー'),
  '/announcements': card('공지', 'Announcements', 'お知らせ'),
  '/friends': card('친구 코드', 'Friend Codes', 'フレンドコード'),
  '/tools/experience': card('경험치 계산기', 'EXP Calculator', '経験値計算機'),
  '/tools/lunacy': card('월간 광기 계산기', 'Monthly Lunacy Planner', '月間狂気計算機'),
  '/tools/damage': card('피해량 계산기', 'Damage Calculator', 'ダメージ計算機'),
  '/tools/clash': card('합 계산기', 'Clash Calculator', '合計算機'),
  '/prescript': card('검지 지령', 'Index Prescripts', '人差し指の指令'),
  '/developers': card('개발자 도구', 'Developer Tools', '開発者ツール'),
  '/support': card('문의', 'Support', 'お問い合わせ'),
}

/** The share card of a page (`/og/...`, without the locale), or null where the page shares the site card. */
export function ogCardPath(path: string): string | null {
  const page = path.split('?')[0]
  if (OG_SECTIONS[page]) return `/og${page}`
  const [, section, id, rest] = page.split('/')
  if (!id || rest) return null
  if (section === 'sinners') return SINNER_SLUGS.includes(id) ? `/og${page}` : null
  if (section === 'story') return /^\d+$/.test(id) ? `/og${page}` : null
  if (section === 'announcements') return `/og${page}`
  return null
}
