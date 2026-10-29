import { NAV_GROUPS } from '@/components/layout/nav-shared'
import { translations } from '@/lib/i18n/translations'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import type { IndexEntry } from './engine'

type Lang = 'ko' | 'en' | 'ja'
type Labels = Record<Lang, string>
const MESSAGES = { ko, en, ja } as const

const message = (lang: Lang, key: string): string => {
  let node: unknown = MESSAGES[lang]
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part]
  return typeof node === 'string' ? node : ''
}
const labels = (key: string): Labels => ({ ko: message('ko', key), en: message('en', key), ja: message('ja', key) })

// 메뉴 이름이 아닌 말로도 찾게 한다
const ALIASES: Record<string, string[]> = {
  '/sinners': ['인격', 'E.G.O', '도감', 'Identity', '人格'],
  '/mirror-dungeon': ['거울 던전', '미러 던전', 'MD', '기프트', 'ミラダン'],
  '/keywords': ['버프', '디버프', '상태이상', 'Buff', 'Debuff'],
  '/decks': ['덱', '편성', 'Deck', '編成'],
  '/planner/community': ['플래너', '플랜', '공략', 'Plan'],
  '/friends': ['친구', 'Friend'],
  '/collection': ['보유', '컬렉션'],
  '/meta': ['메타', '통계', '티어', '사용률', 'Meta', 'Tier'],
  '/tools/experience': ['경험치', '레벨', 'EXP'],
  '/tools/lunacy': ['광기', '월정액', 'Lunacy'],
  '/tools/damage': ['딜', '데미지', 'DPS', 'Damage'],
  '/tools/clash': ['합', '승률', '코인', 'Clash', '合'],
  '/developers': ['API', '개발자'],
  '/motion/skills': ['모션', '스킬 영상', 'Motion'],
  '/random': ['랜덤', 'Random'],
  '/calendar': ['캘린더', '일정', '소식', 'Calendar'],
  '/mirror-dungeon?tab=themes': ['테마', 'Theme'],
  '/mirror-dungeon?tab=events': ['선택지', 'Event'],
}

const fromTranslations = (key: keyof typeof translations): Labels => translations[key] as Labels

function pageList(): { href: string; label: Labels; group?: Labels }[] {
  const list: { href: string; label: Labels; group?: Labels }[] = [{ href: '/', label: labels('nav.home') }]
  for (const group of NAV_GROUPS) {
    for (const item of group.items) list.push({ href: item.href, label: labels(item.labelKey), group: labels(group.labelKey) })
  }
  const db = labels('nav.db.mirrorDungeon')
  list.push(
    { href: '/mirror-dungeon?tab=themes', label: fromTranslations('mirrorDungeon.tab.themes'), group: db },
    { href: '/mirror-dungeon?tab=events', label: fromTranslations('mirrorDungeon.tab.events'), group: db },
    { href: '/calendar', label: labels('nav.other.calendar') },
  )
  return list
}

export function pageEntries(lang: Lang): IndexEntry[] {
  return pageList().map(page => ({
    type: 'page',
    href: page.href,
    label: page.label[lang],
    sublabel: page.group?.[lang],
    names: page.label,
    context: (ALIASES[page.href] ?? []).map(text => ({ field: 'alias' as const, text })),
  }))
}
