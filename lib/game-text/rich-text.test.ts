import { describe, expect, it } from 'vitest'
import {
  closeGameText, collectRefIds, gameTextForScreen, gameTextToPlain, isRawGameText, mayBeRawGameText, parseGameText, refNameLabels, splitCoinBlocks,
  splitGameTextLines, type GameTextNode,
} from './rich-text'

const text = (value: string): GameTextNode => ({ type: 'text', text: value })
const ref = (id: string): GameTextNode => ({ type: 'ref', id })
const el = (
  tag: Extract<GameTextNode, { type: 'element' }>['tag'],
  children: GameTextNode[],
  value?: string,
): GameTextNode => (value === undefined ? { type: 'element', tag, children } : { type: 'element', tag, value, children })

// Strings below are copied from the 2026-09-24 extraction (JSON-decoded, so \" in the file is " here).
describe('parseGameText (REQ-SHARED-018)', () => {
  it('REQ-SHARED-018 returns no nodes for an empty string and one text node for plain text', () => {
    expect(parseGameText('')).toEqual([])
    expect(parseGameText('피해량 +5% (최대 20%)')).toEqual([text('피해량 +5% (최대 20%)')])
  })

  it('REQ-SHARED-018 reads <style="highlight"> (KR_Passive_Ego) with [Id] refs and newlines kept in text', () => {
    const raw =
      '[Sinking]이 5 이상 부여된 적에게 공격 적중 시 [Disarming] 1 부여 (턴 당 최대 5회)\n\n<style="highlight">흐트러짐 또는 패닉 상태인 적에게 공격 적중 시 다음 턴에 [AttackUp] 1 얻음 (턴 당 3회)</style>'
    expect(parseGameText(raw)).toEqual([
      ref('Sinking'),
      text('이 5 이상 부여된 적에게 공격 적중 시 '),
      ref('Disarming'),
      text(' 1 부여 (턴 당 최대 5회)\n\n'),
      el(
        'style',
        [text('흐트러짐 또는 패닉 상태인 적에게 공격 적중 시 다음 턴에 '), ref('AttackUp'), text(' 1 얻음 (턴 당 3회)')],
        'highlight',
      ),
    ])
  })

  it('REQ-SHARED-018 reads <style=...> with the quotes escaped or missing (defensive: the extraction only has the plain quoted form)', () => {
    const expected = [
      text('턴 시작시, 모든 아군이 '),
      ref('DefenseUp'),
      text(' '),
      el('style', [text('4')], 'upgradeHighlight'),
      text(' 얻음.'),
    ]
    expect(parseGameText('턴 시작시, 모든 아군이 [DefenseUp] <style="upgradeHighlight">4</style> 얻음.')).toEqual(expected)
    expect(parseGameText('턴 시작시, 모든 아군이 [DefenseUp] <style=\\"upgradeHighlight\\">4</style> 얻음.')).toEqual(expected)
    expect(parseGameText('턴 시작시, 모든 아군이 [DefenseUp] <style=upgradeHighlight>4</style> 얻음.')).toEqual(expected)
  })

  it('REQ-SHARED-018 keeps an empty <style></style> pair (KR skill desc ending) without text', () => {
    expect(parseGameText('이 코인에는 메인 타겟만 피해를 입음.<style="highlight"></style>')).toEqual([
      text('이 코인에는 메인 타겟만 피해를 입음.'),
      el('style', [], 'highlight'),
    ])
  })

  it('REQ-SHARED-018 reads <sprite> as a self-closing node and <link> as a wrapper, with mismatched closing order (KR_Passives)', () => {
    const raw =
      '대상의 <sprite name="Burst"><color=#e30000><u><link="Burst">파열</color></link></u>만큼 <sprite name="Breath"><color=#f8c200><u><link="Breath">호흡</color></link></u>을 얻음 (턴 당 최대 20)'
    expect(parseGameText(raw)).toEqual([
      text('대상의 '),
      { type: 'sprite', name: 'Burst' },
      el('color', [el('u', [el('link', [text('파열')], 'Burst')])], '#e30000'),
      text('만큼 '),
      { type: 'sprite', name: 'Breath' },
      el('color', [el('u', [el('link', [text('호흡')], 'Breath')])], '#f8c200'),
      text('을 얻음 (턴 당 최대 20)'),
    ])
  })

  it('REQ-SHARED-018 parses the same sprite/link markup from the JP extraction (JP_BattleKeywords)', () => {
    const raw =
      '<sprite name="RetaliationBook"><color=#e30000><u><link="RetaliationBook">仕返し帳簿</color></link></u>が付与された対象に攻撃が的中したとき、攻撃終了時に消滅\nターン終了時に残っていれば消滅'
    expect(parseGameText(raw)).toEqual([
      { type: 'sprite', name: 'RetaliationBook' },
      el('color', [el('u', [el('link', [text('仕返し帳簿')], 'RetaliationBook')])], '#e30000'),
      text('が付与された対象に攻撃が的中したとき、攻撃終了時に消滅\nターン終了時に残っていれば消滅'),
    ])
  })

  it('REQ-SHARED-018 reopens an element that a mismatched closing tag closed early, so later text keeps its format', () => {
    expect(parseGameText('<b><u>가</b>나</u>다')).toEqual([el('b', [el('u', [text('가')])]), el('u', [text('나')]), text('다')])
  })

  it('REQ-SHARED-018 reads <color>, <mark color>, <b>, <u> nesting (EN_Passives_Abnormality-a1c10p2)', () => {
    const raw =
      'This unit does not take damage from [Combustion] and [Laceration]\n\n<color=#ff6000><mark color=#ff000040><b><u>This unit is defeated when Staggered</color></mark></b></u>'
    expect(parseGameText(raw)).toEqual([
      text('This unit does not take damage from '),
      ref('Combustion'),
      text(' and '),
      ref('Laceration'),
      text('\n\n'),
      el('color', [el('mark', [el('b', [el('u', [text('This unit is defeated when Staggered')])])], '#ff000040')], '#ff6000'),
    ])
  })

  it('REQ-SHARED-018 accepts <mark=#hex> and an 8-digit colour, and <i>/<s> (KR_BattleKeywords)', () => {
    expect(parseGameText('<mark=#ff000040>강조</mark>')).toEqual([el('mark', [text('강조')], '#ff000040')])
    expect(parseGameText('<i><color=#d3a562>완전하지는 않지만 왕국을 다스릴 힘의 편린</color></i>')).toEqual([
      el('i', [el('color', [text('완전하지는 않지만 왕국을 다스릴 힘의 편린')], '#d3a562')]),
    ])
    expect(parseGameText('중지 - 원한 문신 [<s>큰 형님</s>]')).toEqual([
      text('중지 - 원한 문신 ['),
      el('s', [text('큰 형님')]),
      text(']'),
    ])
  })

  it('REQ-SHARED-018 accepts a named colour such as <color=red> (33 uses in the extraction)', () => {
    expect(parseGameText('<color=red>위험</color>')).toEqual([el('color', [text('위험')], 'red')])
  })

  it('REQ-SHARED-018 keeps <noparse> content literal while [Id] outside it stays a ref (KR_EGOgift_MirrorDungeon_7)', () => {
    const raw =
      '적에게 [Vibration] 위력, [Vibration] 횟수 또는 특수 진동을 부여하는 기본 스킬로 합 승리시 아래 특수 <noparse>진동</noparse> 중 무작위 특수 <noparse>진동</noparse>으로 [FusionVibration] (턴당 최대 1회)\n- [VibrationIgnition]'
    expect(parseGameText(raw)).toEqual([
      text('적에게 '),
      ref('Vibration'),
      text(' 위력, '),
      ref('Vibration'),
      text(' 횟수 또는 특수 진동을 부여하는 기본 스킬로 합 승리시 아래 특수 진동 중 무작위 특수 진동으로 '),
      ref('FusionVibration'),
      text(' (턴당 최대 1회)\n- '),
      ref('VibrationIgnition'),
    ])
  })

  it('REQ-SHARED-018 leaves tags, brackets and braces inside <noparse> as text, and an unclosed <noparse> runs to the end', () => {
    expect(parseGameText('<noparse><b>[Sinking]</b> {0}</noparse>[Sinking]')).toEqual([text('<b>[Sinking]</b> {0}'), ref('Sinking')])
    expect(parseGameText('가<noparse><b>나 [Sinking]')).toEqual([text('가<b>나 [Sinking]')])
  })

  it('REQ-SHARED-018 keeps [사용시], [On Hit], [코인 1] and [2페이즈 전용] as text but reads [Id] with digits and underscores', () => {
    expect(parseGameText('[사용시]')).toEqual([text('[사용시]')])
    expect(parseGameText('[On Hit] [코인 1] [2페이즈 전용] []')).toEqual([text('[On Hit] [코인 1] [2페이즈 전용] []')])
    expect(parseGameText('<color=#26cfff>[사용시]</color>')).toEqual([el('color', [text('[사용시]')], '#26cfff')])
    expect(parseGameText('적중시 자신의 [BloodDinner_Accumulation] 10당, 피해량 +1% (최대 20%)')).toEqual([
      text('적중시 자신의 '),
      ref('BloodDinner_Accumulation'),
      text(' 10당, 피해량 +1% (최대 20%)'),
    ])
  })

  it('REQ-SHARED-018 reads {0}, {0:F1} and {n} placeholders (KR_Bufs, KR_SkillTag)', () => {
    expect(parseGameText('대상의 참격 내성을 {0:F1} 감소')).toEqual([
      text('대상의 참격 내성을 '),
      { type: 'placeholder', raw: '{0:F1}', index: 0 },
      text(' 감소'),
    ])
    expect(parseGameText('{1}번 중 {0}')).toEqual([
      { type: 'placeholder', raw: '{1}', index: 1 },
      text('번 중 '),
      { type: 'placeholder', raw: '{0}', index: 0 },
    ])
    expect(parseGameText('[전열 {n}명]')).toEqual([text('[전열 '), { type: 'placeholder', raw: '{n}', index: null, name: 'n' }, text('명]')])
  })

  it('REQ-SHARED-018 gives a named slot such as {amount} its name and leaves index null (ChoiceEventEffect)', () => {
    expect(parseGameText('에고 기프트 {amount}개 획득')).toEqual([
      text('에고 기프트 '),
      { type: 'placeholder', raw: '{amount}', index: null, name: 'amount' },
      text('개 획득'),
    ])
  })

  it('REQ-SHARED-018 reads {{live}} and {{gift:9228}} site tokens with their inner name', () => {
    expect(parseGameText('{{live}} 만큼 [Burst]을 얻고 {{gift:9228}}을 받음')).toEqual([
      { type: 'placeholder', raw: '{{live}}', index: null, token: 'live' },
      text(' 만큼 '),
      ref('Burst'),
      text('을 얻고 '),
      { type: 'placeholder', raw: '{{gift:9228}}', index: null, token: 'gift:9228' },
      text('을 받음'),
    ])
  })

  it('REQ-SHARED-018 closes unclosed tags at the end of the string', () => {
    expect(parseGameText('<b>굵게 <color=#ff6000>주황')).toEqual([el('b', [text('굵게 '), el('color', [text('주황')], '#ff6000')])])
    expect(parseGameText('<link="Burst">파열')).toEqual([el('link', [text('파열')], 'Burst')])
  })

  it('REQ-SHARED-018 drops a closing tag of a known name that has no open element, like TMP (no literal </b>)', () => {
    expect(parseGameText('가</b>나')).toEqual([text('가나')])
    expect(parseGameText('<b>가</b></b>')).toEqual([el('b', [text('가')])])
    expect(parseGameText('</noparse>')).toEqual([])
    expect(parseGameText('가</size></font></ruby>나')).toEqual([text('가나')])
  })

  it('REQ-SHARED-018 drops the extra closing tags of <color><u><link>호흡</color></color></link></u> without a second link (KR_Skills_personality-04)', () => {
    const raw = '<sprite name="Breath"><color=#f8c200><u><link="Breath">호흡</color></color></link></u>을 얻음'
    expect(parseGameText(raw)).toEqual([
      { type: 'sprite', name: 'Breath' },
      el('color', [el('u', [el('link', [text('호흡')], 'Breath')])], '#f8c200'),
      text('을 얻음'),
    ])
  })

  it('REQ-SHARED-018 recognises a closing colour tag that carries a value, </color=#ebcaa2> (ChoiceEventEffect)', () => {
    expect(parseGameText('<color=#ebcaa2>가</color=#ebcaa2>나')).toEqual([el('color', [text('가')], '#ebcaa2'), text('나')])
    expect(parseGameText('가</color=#ebcaa2>나')).toEqual([text('가나')])
  })

  it('REQ-SHARED-018 reads <size=50%> as a size element carrying its value, also with escaped quotes and plain numbers (JP_*-BossRaid)', () => {
    expect(parseGameText('サ<size=50%>ル</size>')).toEqual([text('サ'), el('size', [text('ル')], '50%')])
    expect(parseGameText('<size=\\"60%\\">작게</size>')).toEqual([el('size', [text('작게')], '60%')])
    expect(parseGameText('<size=20>작게</size>크게')).toEqual([el('size', [text('작게')], '20'), text('크게')])
    expect(parseGameText('<size=110%><b>가</size>나</b>')).toEqual([
      el('size', [el('b', [text('가')])], '110%'),
      el('b', [text('나')]),
    ])
  })

  it('REQ-SHARED-018 hides the content of <size=0%> by keeping the element with no children (KR_ActionEvents_Refraction6)', () => {
    expect(parseGameText('가<size=0%>숨김 [Sinking] {0}</size>나')).toEqual([text('가'), el('size', [], '0%'), text('나')])
    expect(parseGameText('<size=0>숨김')).toEqual([el('size', [], '0')])
  })

  it('REQ-SHARED-018 strips <font=...> and <ruby=...> but keeps the inner text (JP ruby, EN font)', () => {
    expect(parseGameText('<ruby=ぎょく>玉</ruby>と<ruby=>字</ruby>')).toEqual([text('玉と字')])
    expect(parseGameText('<font=\\"BebasKai SDF\\">Title</font> [Sinking]')).toEqual([text('Title '), ref('Sinking')])
    expect(parseGameText('<b><font=\\"ExcelsiorSans SDF\\">굵게</b>')).toEqual([el('b', [text('굵게')])])
  })

  it('REQ-SHARED-018 accepts only TMP named colours (case-insensitive, lowercased) and leaves other words as text', () => {
    for (const name of ['black', 'blue', 'green', 'orange', 'purple', 'red', 'white', 'yellow']) {
      expect(parseGameText(`<color=${name}>가</color>`)).toEqual([el('color', [text('가')], name)])
    }
    expect(parseGameText('<color=Red>가</color>')).toEqual([el('color', [text('가')], 'red')])
    expect(parseGameText('<color=pink>가</color>')).toEqual([text('<color=pink>가')])
  })

  it('REQ-SHARED-018 leaves unknown tags and malformed known tags as literal text (<E.G.O>, <color=>, <size=>)', () => {
    expect(parseGameText('<E.G.O> [Sinking]')).toEqual([text('<E.G.O> '), ref('Sinking')])
    expect(parseGameText('<color=>가')).toEqual([text('<color=>가')])
    expect(parseGameText('<size=>가<size=big>나')).toEqual([text('<size=>가<size=big>나')])
    expect(parseGameText('<b')).toEqual([text('<b')])
    expect(parseGameText('a < b > c')).toEqual([text('a < b > c')])
  })

  it('REQ-SHARED-018 merges adjacent text, including literal tags and brackets, into one node', () => {
    expect(parseGameText('가<E.G.O>나[사용시]다{x y}')).toEqual([text('가<E.G.O>나[사용시]다{x y}')])
  })
})

describe('isRawGameText (REQ-SHARED-018)', () => {
  const refIds = new Set(['Sinking', 'Burst'])

  it('REQ-SHARED-018 is true when a recognised Unity tag is present', () => {
    expect(isRawGameText('<style="highlight">강조</style>', refIds)).toBe(true)
    expect(isRawGameText('<color=#ff6000>주황</color>', new Set())).toBe(true)
    expect(isRawGameText('<sprite name="Burst">', new Set())).toBe(true)
    expect(isRawGameText('특수 <noparse>침잠</noparse> 포함', new Set())).toBe(true)
    expect(isRawGameText('<b>굵게', new Set())).toBe(true)
    expect(isRawGameText('サ<size=50%>ル</size>', new Set())).toBe(true)
    expect(isRawGameText('가</color=#ebcaa2>나', new Set())).toBe(true)
  })

  it('REQ-SHARED-018 is true when an [Id] is a known reference id', () => {
    expect(isRawGameText('[Sinking] 3 부여', refIds)).toBe(true)
  })

  it('REQ-SHARED-018 is false for old stored text, unknown ids, placeholders and unknown tags', () => {
    expect(isRawGameText('[코인 1] 침잠 3 부여', refIds)).toBe(false)
    expect(isRawGameText('[Conbustion] 3 부여', refIds)).toBe(false)
    expect(isRawGameText('[사용시] {{live}} 만큼 {0}', refIds)).toBe(false)
    expect(isRawGameText('<E.G.O> 작게', refIds)).toBe(false)
    expect(isRawGameText('', refIds)).toBe(false)
  })

  it('REQ-SHARED-018 counts a lone <noparse> pair as raw text and an [Id] without a ref table as not raw', () => {
    expect(isRawGameText('<noparse>[Sinking]</noparse>', new Set())).toBe(true)
    expect(isRawGameText('[Sinking]', new Set())).toBe(false)
  })
})

describe('mayBeRawGameText (REQ-SHARED-019)', () => {
  it('REQ-SHARED-019 is true for a < or an ASCII [Id]-shaped bracket, so only those texts need the reference table', () => {
    expect(mayBeRawGameText('<b>굵게</b>')).toBe(true)
    expect(mayBeRawGameText('1 < 2')).toBe(true)
    expect(mayBeRawGameText('[Combustion] 3 부여')).toBe(true)
    expect(mayBeRawGameText('[StartBattle_Force]')).toBe(true)
  })

  it('REQ-SHARED-019 is false for older stored text: Korean/Japanese labels, spaced labels, tokens, plain words', () => {
    expect(mayBeRawGameText('[사용시] 화상 3 부여')).toBe(false)
    expect(mayBeRawGameText('[On Hit] Inflict 3 Burn')).toBe(false)
    expect(mayBeRawGameText('【使用時】火傷')).toBe(false)
    expect(mayBeRawGameText('{{live}} {0} 피해량 +5%')).toBe(false)
    expect(mayBeRawGameText('')).toBe(false)
  })
})

describe('collectRefIds (REQ-SHARED-018)', () => {
  it('REQ-SHARED-018 returns each ref id once, in order, including refs nested in elements', () => {
    const nodes = parseGameText('[Sinking] <b>[Burst] [Sinking]</b> <style="highlight">[Laceration]</style> <noparse>[Hidden]</noparse>')
    expect(collectRefIds(nodes)).toEqual(['Sinking', 'Burst', 'Laceration'])
  })

  it('REQ-SHARED-018 returns an empty list when there are no refs', () => {
    expect(collectRefIds(parseGameText('피해량 +5% {0}'))).toEqual([])
  })
})

describe('<coin=N> coin descriptions (REQ-SHARED-018)', () => {
  const raw = '[WhenUse] 공격 시 [Sinking] 부여\n<coin=1>[OnSucceedAttackHead] 침잠 1 부여</coin>\n<coin=2><b>강조</b> 끝</coin>'

  it('REQ-SHARED-018 reads <coin=N>…</coin> as a coin element with the number as its value and the main text around it', () => {
    expect(parseGameText(raw)).toEqual([
      ref('WhenUse'),
      text(' 공격 시 '),
      ref('Sinking'),
      text(' 부여\n'),
      el('coin', [ref('OnSucceedAttackHead'), text(' 침잠 1 부여')], '1'),
      text('\n'),
      el('coin', [el('b', [text('강조')]), text(' 끝')], '2'),
    ])
  })

  it('REQ-SHARED-018 closes an unclosed <coin=N> at the end and drops a stray </coin>', () => {
    expect(parseGameText('<coin=3>끝')).toEqual([el('coin', [text('끝')], '3')])
    expect(parseGameText('가</coin>나')).toEqual([text('가나')])
  })

  it('REQ-SHARED-018 treats <coin= as raw game text even without refs, and a bare <coin> without a number as text', () => {
    expect(isRawGameText('<coin=1>침잠 1 부여</coin>', new Set())).toBe(true)
    expect(isRawGameText('<coin>침잠', new Set())).toBe(false)
    expect(parseGameText('<coin>가')).toEqual([text('<coin>가')])
  })
})

describe('gameTextToPlain (REQ-SHARED-018)', () => {
  it('REQ-SHARED-018 drops tags and keeps their inner text, drops size 0 content and keeps noparse inner text', () => {
    expect(gameTextToPlain('<style="highlight">강조</style> <color=#ff6000>색</color><u>밑줄</u> <link="Burst">폭발 링크</link>')).toBe('강조 색밑줄 폭발 링크')
    expect(gameTextToPlain('가<size=0%>숨김</size>나<size=50%>작게</size>')).toBe('가나작게')
    expect(gameTextToPlain('<noparse><b>[Sinking]</b></noparse>')).toBe('<b>[Sinking]</b>')
    expect(gameTextToPlain('<sprite name="Burst">폭발')).toBe('폭발')
  })

  it('REQ-SHARED-018 turns [Id] into the given name, or leaves [Id] when unknown', () => {
    expect(gameTextToPlain('[Sinking] 3 부여 [Unknown]', { names: { Sinking: '침잠' } })).toBe('침잠 3 부여 [Unknown]')
    expect(gameTextToPlain('[Sinking] 3 부여')).toBe('[Sinking] 3 부여')
  })

  it('REQ-SHARED-018 turns {{token}} into its plain label with the locale and keeps numbered slots as written', () => {
    expect(gameTextToPlain('{{potency}} 증가 {0}')).toBe('(수치) 증가 {0}')
    expect(gameTextToPlain('{{potency}} up', { locale: 'en' })).toBe('(Potency) up')
    expect(gameTextToPlain('{{live}}', { locale: 'ja' })).toBe('(ゲーム中に表示)')
  })

  it('REQ-SHARED-018 puts each coin on its own line, labelled only when coinLabel is given', () => {
    const raw = '[WhenUse] 본문\n<coin=1>[OnSucceedAttackHead] 침잠 1 부여</coin>\n<coin=2>끝</coin>'
    const names = { WhenUse: '[사용시]', OnSucceedAttackHead: '[적중시]', Sinking: '침잠' }
    expect(gameTextToPlain(raw, { names })).toBe('[사용시] 본문\n[적중시] 침잠 1 부여\n끝')
    expect(gameTextToPlain(raw, { names, coinLabel: (n) => `[코인 ${n}]` })).toBe(
      '[사용시] 본문\n[코인 1] [적중시] 침잠 1 부여\n[코인 2] 끝',
    )
  })

  it('REQ-SHARED-018 starts a coin on a new line even when the main text does not end with a line break', () => {
    expect(gameTextToPlain('본문<coin=1>가</coin><coin=2>나</coin>다')).toBe('본문\n가\n나\n다')
  })

  it('REQ-SHARED-018 returns an empty string for empty text', () => {
    expect(gameTextToPlain('')).toBe('')
  })
})

describe('REQ-SHARED-020 helpers for the code that reads stored game text', () => {
  it('REQ-SHARED-020 splits the main text from the <coin=N> blocks, and leaves old text whole', () => {
    expect(splitCoinBlocks('[WhenUse] 본문\n<coin=1>가\n나</coin>\n<coin=3>다</coin>')).toEqual({
      main: '[WhenUse] 본문',
      coins: [{ coinNum: 1, text: '가\n나' }, { coinNum: 3, text: '다' }],
    })
    expect(splitCoinBlocks('[코인 1] 효과')).toEqual({ main: '[코인 1] 효과', coins: [] })
    expect(splitCoinBlocks('<coin=2>닫히지 않음')).toEqual({ main: '', coins: [{ coinNum: 2, text: '닫히지 않음' }] })
    expect(splitCoinBlocks('')).toEqual({ main: '', coins: [] })
  })

  it('REQ-SHARED-020 splits into lines that are each balanced: open tags reopen on the next line', () => {
    expect(splitGameTextLines('a\nb')).toEqual(['a', 'b'])
    expect(splitGameTextLines('<b>x</b>\ny')).toEqual(['<b>x</b>', 'y'])
    expect(splitGameTextLines('<style="highlight">- 가\n\n- 나</style>\n끝')).toEqual([
      '<style="highlight">- 가', '', '<style="highlight">- 나</style>', '끝',
    ])
    // Unity closes by name, not by nesting: only the colour is closed, the underline carries on.
    expect(splitGameTextLines('<color=#ff0000><u>가</color>\n나</u>')).toEqual(['<color=#ff0000><u>가</color>', '<u>나</u>'])
  })

  it('REQ-SHARED-020 turns a line that only holds tags into an empty line', () => {
    expect(splitGameTextLines('<style="highlight">가\n</style>\n나')).toEqual(['<style="highlight">가', '', '나'])
  })

  it('REQ-SHARED-020 keeps a noparse block literal on every line it spans', () => {
    expect(splitGameTextLines('<noparse>가\n나</noparse>')).toEqual(['<noparse>가</noparse>', '<noparse>나</noparse>'])
  })

  it('REQ-SHARED-020 closes the tags a text leaves open, innermost first, so another text can follow it', () => {
    expect(closeGameText('<style="highlight">가 <color=#ff0000><u>나')).toBe('<style="highlight">가 <color=#ff0000><u>나</u></color></style>')
    expect(closeGameText('<b>가</b>')).toBe('<b>가</b>')
    expect(closeGameText('<noparse>가')).toBe('<noparse>가</noparse>')
    expect(closeGameText('화상 3 부여')).toBe('화상 3 부여')
    expect(closeGameText('')).toBe('')
  })

  it('REQ-SHARED-020 maps reference names to plain labels', () => {
    expect(refNameLabels({ Combustion: { k: 'keyword', n: '화상', kw: '화상' }, OnHit: { k: 'skilltag', n: '[적중시]' } }))
      .toEqual({ Combustion: '화상', OnHit: '[적중시]' })
  })

  it('REQ-SHARED-020 keeps {{token}} and {0} as written when asked, for comparing with the screen', () => {
    expect(gameTextToPlain('{{potency}} up {0}', { keepPlaceholders: true })).toBe('{{potency}} up {0}')
    expect(gameTextToPlain('{{potency}} up {0}')).toBe('(수치) up {0}')
  })

  it('REQ-SHARED-020 shows raw game text as the screen does (names for [Id], tokens kept) and leaves old text alone', () => {
    const labels = { Combustion: '화상' }
    expect(gameTextForScreen('<style="highlight">[Combustion]</style> {{potency}} 부여', labels)).toBe('화상 {{potency}} 부여')
    expect(gameTextForScreen('화상 {{potency}} 부여 [사용시]', labels)).toBe('화상 {{potency}} 부여 [사용시]')
    expect(gameTextForScreen('[Combustion] 부여', undefined)).toBe('[Combustion] 부여')
  })

  it('REQ-SHARED-020 plain text of a formation label has no digits from colour tags', () => {
    expect(gameTextToPlain('[편성 <color=#f8c200>6번</color> 인격 전용 효과]')).toBe('[편성 6번 인격 전용 효과]')
  })
})
