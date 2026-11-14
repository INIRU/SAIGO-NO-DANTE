// 스토리 맵 화면이 같이 쓰는 문구와 보조 계산. 화면 조각(StoryClient, StagePanel, DungeonView)이 서로를 가져오지 않도록 여기로 뺐다.

import type { StoryNode, StorySubchapter, Texts } from '@/lib/story-map'
import type { SinType } from '@/lib/types'
import type { AttackTypeKey } from '@/components/ui/AttackTypeIcon'

export type Lang = 'ko' | 'en' | 'ja'

export const L = {
  ko: {
    title: '스토리 맵', back: '장 선택으로', close: '닫기', enterDungeon: '입장', dungeonMap: '던전 맵 보기', floorCount: (n: number) => `${n}층`, chapterName: (n: string) => `${n}장`,
    recommended: '추천 레벨', effective: '유효', atk: { slash: '참격', pierce: '관통', blunt: '타격' } as Record<AttackTypeKey, string>, sin: { wrath: '분노', lust: '색욕', sloth: '나태', gluttony: '탐식', gloom: '우울', pride: '오만', envy: '질투' } as Record<SinType, string>, ex: 'EX 클리어 조건', enemies: '적 정보', turnLimit: (n: number) => `${n}턴 제한`, boss: '보스전',
    wave: (i: number) => `${i}웨이브`, hidden: '처음엔 보이지 않음', story: '스토리', storyOnly: '전투 없이 이야기만 진행되는 스테이지입니다.', spoiler: '아직 열지 않은 장입니다. 장 선택에서 이 장을 누르면 보입니다.',
    spoilerTitle: '스포일러 주의', spoilerBody: '아직 열지 않은 장입니다. 열면 이 장의 스테이지와 적이 보이고, 그 앞의 장도 모두 열립니다.', openAnyway: '그래도 열기',
    ending: '엔딩', otherFloor: '그 외', endingNote: '백화점을 돌아다니며 만나는 전투입니다. 엔딩마다 다릅니다.',
    difficulty: ['노말', '하드'], groups: '편', group: (n: number) => ['상편', '중편', '하편'][n - 1] ?? `${n}편`, pickHint: '스테이지를 누르면 적 정보가 열립니다', loading: '지도를 불러오는 중',
  },
  en: {
    title: 'Story Map', back: 'Back to chapters', close: 'Close', enterDungeon: 'Enter', dungeonMap: 'View dungeon map', floorCount: (n: number) => `${n} floors`, chapterName: (n: string) => `Ch. ${n}`,
    recommended: 'Recommended', effective: 'Weak to', atk: { slash: 'Slash', pierce: 'Pierce', blunt: 'Blunt' } as Record<AttackTypeKey, string>, sin: { wrath: 'Wrath', lust: 'Lust', sloth: 'Sloth', gluttony: 'Gluttony', gloom: 'Gloom', pride: 'Pride', envy: 'Envy' } as Record<SinType, string>, ex: 'EX clear', enemies: 'Enemies', turnLimit: (n: number) => `${n}-turn limit`, boss: 'Boss battle',
    wave: (i: number) => `Wave ${i}`, hidden: 'hidden at first', story: 'Story', storyOnly: 'A story stage with no battle.', spoiler: 'Not opened yet. Pick this chapter on the chapter list to show it.',
    spoilerTitle: 'Spoiler warning', spoilerBody: 'You have not opened this chapter yet. Opening it shows its stages and enemies, and opens every chapter before it.', openAnyway: 'Open anyway',
    ending: 'Ending', otherFloor: 'Other', endingNote: 'The battles met while walking the store, different for each ending.',
    difficulty: ['Normal', 'Hard'], groups: 'Parts', group: (n: number) => `Part ${n}`, pickHint: 'Pick a stage to see its enemies', loading: 'Loading the map',
  },
  ja: {
    title: 'ストーリーマップ', back: '章の選択へ', close: '閉じる', enterDungeon: '入場', dungeonMap: 'ダンジョンマップを見る', floorCount: (n: number) => `${n}階`, chapterName: (n: string) => `${n}章`,
    recommended: '推奨レベル', effective: '有効', atk: { slash: '斬撃', pierce: '貫通', blunt: '打撃' } as Record<AttackTypeKey, string>, sin: { wrath: '憤怒', lust: '色欲', sloth: '怠惰', gluttony: '暴食', gloom: '憂鬱', pride: '傲慢', envy: '嫉妬' } as Record<SinType, string>, ex: 'EXクリア条件', enemies: '敵情報', turnLimit: (n: number) => `${n}ターン制限`, boss: 'ボス戦',
    wave: (i: number) => `ウェーブ${i}`, hidden: '最初は見えない', story: 'ストーリー', storyOnly: '戦闘のないストーリーステージです。', spoiler: 'まだ開いていない章です。章の選択でこの章を押すと表示されます。',
    spoilerTitle: 'ネタバレ注意', spoilerBody: 'まだ開いていない章です。開くとこの章のステージと敵が表示され、それ以前の章もすべて開きます。', openAnyway: 'それでも開く',
    ending: 'エンディング', otherFloor: 'その他', endingNote: '百貨店を歩き回って出会う戦闘です。エンディングごとに異なります。',
    difficulty: ['ノーマル', 'ハード'], groups: '編', group: (n: number) => ['上編', '中編', '下編'][n - 1] ?? `${n}編`, pickHint: 'ステージを押すと敵情報が開きます', loading: 'マップを読み込み中',
  },
}

export const text = (t: Texts | null | undefined, lang: Lang) => t?.[lang] ?? t?.ko ?? t?.en ?? ''

// Effective attribute marks: the shared brown attack type icon and the site's sin icons.
export const ATK_ICONS: Record<string, AttackTypeKey> = { SLASH: 'slash', PENETRATE: 'pierce', HIT: 'blunt' }
export const SIN_KEYS: Record<string, SinType> = { CRIMSON: 'wrath', SCARLET: 'lust', AMBER: 'sloth', SHAMROCK: 'gluttony', AZURE: 'gloom', INDIGO: 'pride', VIOLET: 'envy' }

/** The stage's effective attack types and sins: those every shown enemy takes more than normal damage from.
 * GUESS: the game's own rule for its "effective" row was not read from code. */
export function effective(node: StoryNode, sub: StorySubchapter) {
  const units = (node.battle?.waves ?? []).flat().filter(u => !u.hidden).map(u => sub.enemies[String(u.id)]?.resist).filter(r => !!r)
  const weak = (k: string, side: 'atk' | 'sin') => units.length > 0 && units.every(r => (r[side][k] ?? 1) > 1)
  return {
    atk: Object.entries(ATK_ICONS).filter(([k]) => weak(k, 'atk')).map(([k, icon]) => ({ key: k, icon })),
    sin: Object.entries(SIN_KEYS).filter(([k]) => weak(k, 'sin')).map(([k, sin]) => ({ key: k, sin })),
  }
}
