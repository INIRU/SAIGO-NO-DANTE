import type { SupportedLang } from './types'

interface LocalizableEntity {
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
}

export function getLocalizedName(entity: LocalizableEntity, lang: SupportedLang): string {
  if (lang === 'en' && entity.name_en) return entity.name_en
  if (lang === 'ja' && entity.name_jp) return entity.name_jp
  return entity.name_kr
}

/* ── Affiliation localization ── */

const AFFILIATION_MAP: Record<string, { en: string; ja: string }> = {
  'LCB': { en: 'LCB', ja: 'LCB' },
  'LCCB': { en: 'LCCB', ja: 'LCCB' },
  'LCA': { en: 'LCA', ja: 'LCA' },
  'LCE': { en: 'LCE', ja: 'LCE' },
  '검계': { en: 'Blade Lineage', ja: '剣界' },
  '검지': { en: 'Index', ja: '人差し指' },
  '소지': { en: 'Little Finger', ja: '小指' },
  '약지': { en: 'Ring Finger', ja: '薬指' },
  '중지': { en: 'Middle Finger', ja: '中指' },
  '엄지': { en: 'Thumb', ja: '親指' },
  '거미집': { en: 'Cobweb', ja: '蜘蛛の巣' },
  '워더링하이츠': { en: 'Wuthering Heights', ja: 'ワザリングハイツ' },
  '피쿼드호': { en: 'Pequod', ja: 'ピクォド号' },
  '에드가 가문': { en: 'Edgar Family', ja: 'エドガー家' },
  '가씨 가문': { en: 'Ga Family', ja: 'ガ家' },
  '쌍갈고리 해적단': { en: 'Hook Pirates', ja: '双鉤海賊団' },
  '장미스패너 공방': { en: 'Rosespanner Workshop', ja: '薔薇スパナ工房' },
  '콩콩이파': { en: 'Dongbaek Clan', ja: 'コンコン派' },
  '데드레빗츠': { en: 'Dead Rabbits', ja: 'デッドラビッツ' },
  '밤의 송곳': { en: "Night's Awl", ja: '夜の錐' },
  '혈귀': { en: 'Bloodfiend', ja: '血鬼' },
  '흑수': { en: 'Black Swan', ja: '黒水' },
  '흑운회': { en: 'Dark Cloud', ja: '黒雲会' },
  '기술해방연합': { en: 'Tech Liberation Alliance', ja: '技術解放連合' },
  '도서관 옛 손님': { en: 'Library Patron', ja: '図書館の旧客' },
  '로보토미 본사': { en: 'Lobotomy HQ', ja: 'ロボトミー本社' },
  '마침표 사무소': { en: 'Full-Stop Office', ja: '終止符事務所' },
  '멀티크랙 사무소': { en: 'Multicrack Office', ja: 'マルチクラック事務所' },
  '불주먹 사무소': { en: 'Fist of Flame Office', ja: '火拳事務所' },
  '새벽 사무소': { en: 'Dawn Office', ja: '夜明け事務所' },
  '송곳니 사냥 사무소': { en: 'Fang Hunt Office', ja: '牙狩り事務所' },
  '어금니 사무소': { en: 'Molar Office', ja: '奥歯事務所' },
  '정사무소': { en: 'Jeong Office', ja: '情事務所' },
  '23구 뒷골목': { en: 'District 23 Backstreets', ja: '23区裏路地' },
  '20구 유로지비': { en: 'District 20 Yurodivy', ja: '20区ユロージヴィ' },
  '디에치 협회': { en: 'Dieci Association', ja: 'ディエチ協会' },
  '리우 협회': { en: 'Liu Association', ja: 'リウ協会' },
  '섕크 협회': { en: 'Cinq Association', ja: 'サンク協会' },
  '세븐 협회': { en: 'Seven Association', ja: 'セブン協会' },
  '시 협회': { en: 'Shi Association', ja: 'シ協会' },
  '외우피 협회': { en: 'Öufi Association', ja: 'オイフィ協会' },
  '제뱌찌 협회': { en: 'Devyat Association', ja: 'ジェヴャチ協会' },
  '츠바이 협회': { en: 'Zwei Association', ja: 'ツヴァイ協会' },
  'H사': { en: 'H Corp.', ja: 'H社' },
  'J사': { en: 'J Corp.', ja: 'J社' },
  'K사': { en: 'K Corp.', ja: 'K社' },
  'N사': { en: 'N Corp.', ja: 'N社' },
  'R사': { en: 'R Corp.', ja: 'R社' },
  'T사': { en: 'T Corp.', ja: 'T社' },
  'W사': { en: 'W Corp.', ja: 'W社' },
  '구 G사': { en: 'Former G Corp.', ja: '旧G社' },
  '구 L사': { en: 'Former L Corp.', ja: '旧L社' },
}

export function getLocalizedAffiliation(affiliation: string, lang: SupportedLang): string {
  if (lang === 'ko') return affiliation
  return AFFILIATION_MAP[affiliation]?.[lang] ?? affiliation
}

/* ── Keyword name/description localization ── */

interface LocalizableKeyword {
  nameEn?: string | null
  nameJp?: string | null
  descEn?: string | null
  descJp?: string | null
}

export function getLocalizedKeywordName(koreanName: string, info: LocalizableKeyword | undefined, lang: SupportedLang): string {
  if (!info) return koreanName
  if (lang === 'en' && info.nameEn) return info.nameEn
  if (lang === 'ja' && info.nameJp) return info.nameJp
  return koreanName
}

export function getLocalizedKeywordDesc(koreanDesc: string, info: LocalizableKeyword | undefined, lang: SupportedLang): string {
  if (!info) return koreanDesc
  if (lang === 'en' && info.descEn) return info.descEn
  if (lang === 'ja' && info.descJp) return info.descJp
  return koreanDesc
}
