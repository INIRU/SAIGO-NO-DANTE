import { describe, expect, it } from 'vitest'
import type { KeywordInfo } from '@/lib/keywords/catalog'
import { findPlainKeywords, KEYWORD_TEXT_KEYWORDS, plainKeywordMatcher, PLAIN_KEYWORDS, quotedRanges } from '@/lib/keywords/plain-keywords'

// Names as keyword_meta spells them (ko name, name_en, name_jp). 버림, 경멸, 새벽 사무소 are real keywords that are NOT in PLAIN_KEYWORDS.
const CATALOG: Record<string, KeywordInfo> = {
  진동: { desc: '', nameEn: 'Tremor', nameJp: '振動' },
  '진동 폭발': { desc: '', nameEn: 'Tremor Burst', nameJp: '振動爆発' },
  침잠: { desc: '', nameEn: 'Sinking', nameJp: '沈潜' },
  침잠쇄도: { desc: '', nameEn: 'Sinking Deluge', nameJp: '沈潜殺到' },
  출혈: { desc: '', nameEn: 'Bleed', nameJp: '出血' },
  화상: { desc: '', nameEn: 'Burn', nameJp: '火傷' },
  충전: { desc: '', nameEn: 'Charge', nameJp: '充電' },
  호흡: { desc: '', nameEn: 'Poise', nameJp: '呼吸' },
  신속: { desc: '', nameEn: 'Haste', nameJp: 'クイック' },
  보호: { desc: '', nameEn: 'Protection', nameJp: '保護' },
  '참격 보호': { desc: '', nameEn: 'Slash Protection', nameJp: '斬撃保護' },
  못: { desc: '', nameEn: 'Nails', nameJp: '釘' },
  광신: { desc: '', nameEn: 'Fanatic', nameJp: '狂信' },
  저주: { desc: '', nameEn: 'Curse', nameJp: '呪い' },
  탄환: { desc: '', nameEn: 'Ammo', nameJp: '弾丸' },
  '피해량 증가': { desc: '', nameEn: 'Damage Up', nameJp: 'ダメージ量増加' },
  '탐구한 지식': { desc: '', nameEn: 'Insight', nameJp: '探求した知識' },
  마비: { desc: '', nameEn: 'Paralyze', nameJp: '麻痺' },
  속박: { desc: '', nameEn: 'Bind', nameJp: '束縛' },
  '참격 취약': { desc: '', nameEn: 'Slash Fragility', nameJp: '斬撃脆弱' },
  '방어 레벨 증가': { desc: '', nameEn: 'Defense Level Up', nameJp: '防御レベル増加' },
  '앙갚음 대상': { desc: '', nameEn: 'Vengeance Mark', nameJp: '仕返し対象' },
  포자: { desc: '', nameEn: 'Spore', nameJp: '胞子' },
  마탄: { desc: '', nameEn: 'Magic Bullet', nameJp: '魔弾' },
  주시: { desc: '', nameEn: 'Gaze', nameJp: '注視' },
  '시[始]': { desc: '', nameEn: 'Launcher [始]', nameJp: '始' },
  버림: { desc: '', nameEn: 'Discard', nameJp: '捨てる' },
  경멸: { desc: '', nameEn: 'Contempt', nameJp: '軽蔑' },
  '새벽 사무소': { desc: '', nameEn: 'Dawn Office', nameJp: '夜明事務所' },
}
const ALL = new Set(Object.keys(CATALOG))

/** The matched words of `text` as written. */
function words(text: string, locale: 'ko' | 'en' | 'ja', allowed: ReadonlySet<string> = ALL, blocked: [number, number][] = []): string[] {
  return findPlainKeywords(text, plainKeywordMatcher(CATALOG, locale), allowed, blocked).map(hit => text.slice(hit.from, hit.to))
}

describe('plain keywords of older skill text', () => {
  it('finds 진동 and 침잠쇄도 in the skill text of 개화 E.G.O:: 동백 (the owner example)', () => {
    const own = new Set(['진동', '침잠', '침잠쇄도'])
    expect(words('진동 횟수 6을 얻음', 'ko', own)).toEqual(['진동'])
    expect(words('침잠 횟수 1 증가', 'ko', own)).toEqual(['침잠'])
    expect(words('이 6 이상이면, 침잠쇄도\n자신의 진동 횟수가 10 이상이면, 피해량의 40%만큼 추가 피해', 'ko', own)).toEqual(['침잠쇄도', '진동'])
  })

  it('takes the longest name first and never draws a part of a longer keyword', () => {
    expect(words('진동 폭발 시 진동 횟수 2 증가', 'ko')).toEqual(['진동 폭발', '진동'])
    expect(words('침잠쇄도', 'ko')).toEqual(['침잠쇄도'])
    // 참격 보호 is a keyword of its own (not in the list): neither it nor the 보호 inside it is drawn.
    expect(words('참격 보호 2 얻음', 'ko')).toEqual([])
    expect(words('Tremor Burst; after Tremor Burst, Inflict 2 Tremor', 'en')).toEqual(['Tremor Burst', 'Tremor Burst', 'Tremor'])
  })

  it('finds nothing without an allowed set, and only the keywords of that set', () => {
    expect(words('진동 횟수 6을 얻음', 'ko', new Set())).toEqual([])
    expect(findPlainKeywords('진동 횟수 6을 얻음', plainKeywordMatcher(CATALOG, 'ko'), undefined)).toEqual([])
    expect(words('진동 3 부여, 침잠 2 부여', 'ko', new Set(['침잠']))).toEqual(['침잠'])
  })

  it('does not start inside a word: Hangul, kana or kanji right before the name stops the match', () => {
    expect(words('자신의진동 3 부여', 'ko')).toEqual([])
    expect(words('대상에게 진동 3 부여', 'ko')).toEqual(['진동'])
    expect(words('(진동 3)', 'ko')).toEqual(['진동'])
    expect(words('3진동', 'ko')).toEqual(['진동'])
    expect(words('対象に出血 1を付与', 'ja')).toEqual([])
    expect(words('、出血 1を付与', 'ja')).toEqual(['出血'])
    expect(words('「出血', 'ja')).toEqual([])
  })

  it('does not run on into another word: only a space, digit, punctuation or a particle may follow', () => {
    expect(words('충전하는 동안', 'ko')).toEqual([])
    expect(words('충전소에서', 'ko')).toEqual([])
    expect(words('충전을 보유한 아군', 'ko')).toEqual(['충전'])
    expect(words('자신의 호흡이 5 이상', 'ko')).toEqual(['호흡'])
    expect(words('充電器を使う', 'ja')).toEqual([])
    expect(words('充電を保有した', 'ja')).toEqual(['充電'])
  })

  it('draws counted keywords (ordinary words) only next to their number', () => {
    expect(words('다음 턴에 신속 1 얻음', 'ko')).toEqual(['신속'])
    expect(words('보호 2를 얻음', 'ko')).toEqual(['보호'])
    expect(words('탄환이 0이면', 'ko')).toEqual(['탄환'])
    expect(words('대상에게 못이 5 이상 있으면', 'ko')).toEqual(['못'])
    // Real rejected cases of the corpus audit: shield, cannot, the cultists, bullet kinds.
    expect(words('(턴당 최대 체력의 3%)만큼 보호막을 얻음', 'ko')).toEqual([])
    expect(words('스킬을 소모하지 못했으면, 신속하게', 'ko')).toEqual([])
    expect(words('생존한 N사 광신도가 자신을 포함', 'ko')).toEqual([])
    expect(words('N사 광신도면 광신 1 부여', 'ko')).toEqual(['광신'])
    expect(words('해당 특수 탄환이 없는 경우에', 'ko')).toEqual([])
    expect(words('체력 비율만큼 피해량 증가', 'ko')).toEqual([])
    expect(words('다음 턴에 피해량 증가 1 얻음', 'ko')).toEqual(['피해량 증가'])
    // A gift named after a keyword: no number, no keyword.
    expect(words('E.G.O 기프트 저주 인형이 발동한 경우', 'ko')).toEqual([])
    expect(words('저주 3 부여', 'ko')).toEqual(['저주'])
    expect(words('呪いの人形', 'ja')).toEqual([])
    expect(words('呪い 3を付与', 'ja')).toEqual(['呪い'])
  })

  it('leaves keywords that are not on the list as written', () => {
    for (const text of ['스킬 1개를 버림', '소수점 버림)', '새벽 사무소 소속 아군에게', 'E.G.O::경멸, 경외 료슈', '捨てる', '夜明事務所所属']) {
      expect(words(text, 'ko')).toEqual([])
      expect(words(text, 'ja')).toEqual([])
    }
    for (const name of ['버림', '경멸', '새벽 사무소', '주시', '포자', '마탄', '흉탄']) expect(PLAIN_KEYWORDS).not.toHaveProperty(name)
    expect(words('Discard 1 Skill. Dawn Office allies. E.G.O::Contempt', 'en')).toEqual([])
  })

  it('matches English names as whole words, with the capitals the game writes', () => {
    expect(words('Inflict 2 Bleed next turn', 'en')).toEqual(['Bleed'])
    expect(words('Gain +3 Charge Count', 'en')).toEqual(['Charge'])
    expect(words('At 5+ Burn, Coin Power +1', 'en')).toEqual(['Burn'])
    expect(words('Inflict 1 Burning damage', 'en')).toEqual([])
    expect(words('Inflict 1 Bleeding', 'en')).toEqual([])
    expect(words('inflict 3 bleed', 'en')).toEqual([])
    // One-word English names are ordinary words: no number, no keyword.
    expect(words('Charge the enemy, then Burn it', 'en')).toEqual([])
    expect(words('Gain Haste and Protection', 'en')).toEqual([])
    expect(words('Gain 2 Haste and 1 Protection', 'en')).toEqual(['Haste', 'Protection'])
    expect(words('Gain (Insight x 8% of Max HP)', 'en')).toEqual([])
    expect(words('Inflict 2 Slash Protection', 'en')).toEqual([])
  })

  it('does not touch a quotation: skill, passive and E.G.O names stay as written', () => {
    expect(words("‘진동 폭발’로 발동 후 진동 3 부여", 'ko')).toEqual(['진동'])
    expect(words('"Tremor Burst" instead, then 2 Tremor', 'en')).toEqual(['Tremor'])
    expect(words("Use 'Sinking Deluge' and inflict 2 Sinking", 'en')).toEqual(['Sinking'])
    expect(words('「出血」で、出血 1を付与', 'ja')).toEqual(['出血'])
    expect(words('"침잠쇄도"가 발동하면 침잠 2 부여', 'ko')).toEqual(['침잠'])
    // An apostrophe is no quote; a quote opened in an earlier part of the text hides what comes before its closing mark.
    expect(words("target's 2 Bleed", 'en')).toEqual(['Bleed'])
    expect(words("출혈 3 부여’ 후 출혈 2 부여", 'ko')).toEqual(['출혈'])
    expect(quotedRanges("a 'b c' d")).toEqual([[2, 7]])
    expect(quotedRanges('open ‘never closed')).toEqual([[5, 18]])
  })

  it('keeps out of ranges the caller blocks (the identity own skill names win)', () => {
    const text = '침잠의 파도 후 침잠 3 부여'
    expect(words(text, 'ko')).toEqual(['침잠', '침잠'])
    expect(words(text, 'ko', ALL, [[0, 6]])).toEqual(['침잠'])
  })

  it('reads a Japanese keyword spelled with a space as the whole keyword', () => {
    expect(words('振動 爆発。\n振動 回数が2増加', 'ja')).toEqual(['振動 爆発', '振動'])
  })

  it('never draws a name two keywords share', () => {
    const clash: Record<string, KeywordInfo> = { 가: { desc: '', nameEn: 'Same' }, 나: { desc: '', nameEn: 'Same' } }
    expect(findPlainKeywords('Inflict 2 Same', plainKeywordMatcher(clash, 'en'), new Set(['가', '나']), [], { 가: 'free', 나: 'free' })).toEqual([])
  })

  // Snippets of the corpus audit over every identity and E.G.O skill and passive text (ko/en/ja): what it drew and what it rejected.
  it('corpus audit: draws these stored lines', () => {
    expect(words('다음 턴에 신속 1, 방어 레벨 증가 2 부여', 'ko')).toEqual(['신속', '방어 레벨 증가'])
    expect(words('대상에게 참격 취약 이 있으면 스킬 위력 +2', 'ko')).toEqual(['참격 취약'])
    expect(words('자신의 호흡 이 5 이상이면, 합 위력 +1', 'ko')).toEqual(['호흡'])
    expect(words('대상이 앙갚음 대상 이면, 다음 턴에 마비 1을 얻음', 'ko')).toEqual(['앙갚음 대상', '마비'])
    expect(words('화상, 출혈, 진동, 파열, 침잠 중 무작위 1개 부여', 'ko')).toEqual(['화상', '출혈', '진동', '침잠'])
    expect(words('Inflict 1 Bleed next turn. If target has Vengeance Mark, inflict 2 Paralyze', 'en')).toEqual(['Bleed', 'Vengeance Mark', 'Paralyze'])
    expect(words('Gain 1 Poise and +1 Poise Count', 'en')).toEqual(['Poise', 'Poise'])
    expect(words('At 0 Ammo, this Skill', 'en')).toEqual(['Ammo'])
    expect(words('Trigger Tremor Burst; after Tremor Burst, reduce 3 Tremor', 'en')).toEqual(['Tremor Burst', 'Tremor Burst', 'Tremor'])
    expect(words('クイック 1, 防御レベル増加 2を付与', 'ja')).toEqual(['クイック', '防御レベル増加'])
    expect(words('2名へ麻痺 2、束縛 2を付与', 'ja')).toEqual(['束縛'])
    expect(words('出血 1を付与\n呼吸 回数が1増加', 'ja')).toEqual(['出血', '呼吸'])
  })

  it('corpus audit: leaves these stored lines as written', () => {
    // Words that are keywords in the game but ordinary words in prose, or part of a name: never on the list.
    expect(words('높은 순으로 버림.\n다음 턴에 주시 부여', 'ko')).toEqual([])
    expect(words('E.G.O:: 마탄 오티스 인격인 경우, 포자탄을 소모하는 스킬', 'ko')).toEqual([])
    expect(words('Gain (Spore Round x 2) as E.G.O::Magic Bullet Outis; Gaze of Awe', 'en')).toEqual([])
    // A counted name without its number, a longer word, a name in a name.
    expect(words('생존한 N사 광신도 수당 피해량 +5%, 대상에게 못 이 있는 경우', 'ko')).toEqual([])
    expect(words('G.O 기프트 저주 인형이 발동한 경우, 해당 특수 탄환이 없는 경우에', 'ko')).toEqual([])
    // A single kanji is an ordinary word (and this one stands in a quoted skill name).
    expect(words('速で「赤撃 - 始 」をランダムな', 'ja')).toEqual([])
    // Even listed as free, a one-character name (and a one-word English name) counts only next to its number.
    const listed = { '시[始]': 'free' as const, 못: 'free' as const }
    const matches = (text: string, locale: 'ko' | 'ja') => findPlainKeywords(text, plainKeywordMatcher(CATALOG, locale), ALL, [], listed).length
    expect([matches('始 1を付与', 'ja'), matches('始を使う', 'ja'), matches('못 2 부여', 'ko'), matches('못 하면', 'ko')]).toEqual([1, 0, 1, 0])
    expect(words('対象に麻痺 2を付与', 'ja')).toEqual([])
  })

  it('builds the search once per catalog and language', () => {
    expect(plainKeywordMatcher(CATALOG, 'ko')).toBe(plainKeywordMatcher(CATALOG, 'ko'))
    expect(plainKeywordMatcher(CATALOG, 'en')).not.toBe(plainKeywordMatcher(CATALOG, 'ko'))
  })
})

describe('keywords named in a keyword description', () => {
  const KW: Record<string, KeywordInfo> = {
    ...CATALOG,
    '지령의 가호': { desc: '', nameEn: 'Grace of the Prescript', nameJp: '指令の加護' },
    '지령 표식': { desc: '', nameEn: 'Mark of the Prescript', nameJp: '指令の印' },
    지령: { desc: '', nameEn: 'Prescript', nameJp: '指令' },
    잔불: { desc: '', nameEn: 'Embers', nameJp: '残り火' },
    '시선의 경멸': { desc: '', nameEn: 'Contempt of the Gaze', nameJp: '視線の軽蔑' },
    부하: { desc: '', nameEn: 'Load', nameJp: '負荷' },
  }
  const ALL_KW = new Set(Object.keys(KW))
  const found = (text: string, locale: 'ko' | 'en' | 'ja', loose = true) =>
    findPlainKeywords(text, plainKeywordMatcher(KW, locale, loose), ALL_KW, [], KEYWORD_TEXT_KEYWORDS).map(hit => text.slice(hit.from, hit.to))

  it('finds the battle keywords and the specific keyword names other keywords mention, in all three languages', () => {
    expect(found('- 화상 위력, 화상 횟수 또는 출혈을 부여하는 기본 스킬', 'ko')).toEqual(['화상', '화상', '출혈'])
    expect(found('편성할 수 있는 지령의 가호 최댓값: 9, 지령 표식이 새겨진', 'ko')).toEqual(['지령의 가호', '지령 표식'])
    expect(found('Max Grace of the Prescript: 9; inflict 2 Burn', 'en')).toEqual(['Grace of the Prescript', 'Burn'])
    expect(found('編成できる指令の加護の最大値', 'ja')).toEqual(['指令の加護'])
  })

  it('reads Japanese particles before a keyword and 威力・回数 after it, in keyword descriptions only', () => {
    expect(found('対象に出血 1を付与', 'ja')).toEqual(['出血'])
    expect(found('自分の火傷回数が3以上なら、敵の出血と火傷の合計', 'ja')).toEqual(['火傷', '出血', '火傷'])
    expect(found('振動威力', 'ja')).toEqual(['振動'])
    // Still not inside a longer word.
    expect(found('充電器を使う', 'ja')).toEqual([])
    // The skill text keeps the audited rule.
    expect(found('対象に出血 1を付与', 'ja', false)).toEqual([])
  })

  it('never draws a name that is also an E.G.O gift or an ordinary word', () => {
    // 잔불·지령·시선의 경멸 are keywords whose names are (or sit inside) gift names: never drawn.
    expect(found('잔불 수치만큼 화상 위력 증가', 'ko')).toEqual(['화상'])
    expect(found('Gain Embers equal to Burn Potency', 'en')).toEqual(['Burn'])
    expect(found('지령 수행 시 시선의 경멸이 유지되는 동안', 'ko')).toEqual([])
    expect(found('E.G.O 기프트로 인한 회복 제외', 'ko')).toEqual([])
    for (const name of ['상처', '경멸', '경멸의 시선', '시선', '시선의 경멸', '가호', '지령', '얽힘', '예지안', '맥동', '원한', '포박', '타오름', '버림', '잔불', '잔향', '파탄']) {
      expect(KEYWORD_TEXT_KEYWORDS[name], name).toBeUndefined()
    }
    // An ordinary word counts only next to its number.
    expect(found('충전 횟수 1, 부하 1 얻음', 'ko')).toEqual(['충전', '부하'])
    expect(found('부하가 걸리면', 'ko')).toEqual([])
  })

  it('keeps every name of the skill list', () => {
    for (const [name, tier] of Object.entries(PLAIN_KEYWORDS)) expect(KEYWORD_TEXT_KEYWORDS[name]).toBe(tier)
  })
})
