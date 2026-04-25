'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import GiftCard from '@/components/ui/GiftCard'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import type {
  MdEvent,
  MdEventChoice,
  ChoiceEffect,
  EgoGift,
  EgoGiftTheme,
} from '@/components/mirror-dungeon/types'
import {
  colorizeEventText,
  replaceEventPlaceholders,
  parseUnityColorTags,
} from '@/lib/utils/event-text'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import { useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { translations } from '@/lib/i18n/translations'
import { getLocalizedName } from '@/lib/i18n/localize'

// ── Types ────────────────────────────────────────────────────────────────────

interface EventModalProps {
  lang: SupportedLang
  event: MdEvent
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  themes: EgoGiftTheme[]
  onClose: () => void
  onSelectGift: (gift: EgoGift) => void
}

// ── Sin color helper ─────────────────────────────────────────────────────────

function getSinColor(sinKr: string): string {
  const en = SIN_KR_TO_EN[sinKr]
  return en ? SIN_COLORS[en] : '#aaa'
}

// English color names used in message_desc → sin names per language
const SIN_LABELS: Record<string, { ko: string; en: string; ja: string }> = {
  CRIMSON:  { ko: '분노', en: 'Wrath',    ja: '憤怒' },
  SCARLET:  { ko: '색욕', en: 'Lust',     ja: '色欲' },
  ORANGE:   { ko: '색욕', en: 'Lust',     ja: '色欲' },
  VIOLET:   { ko: '질투', en: 'Envy',     ja: '嫉妬' },
  INDIGO:   { ko: '오만', en: 'Pride',    ja: '傲慢' },
  AZURE:    { ko: '우울', en: 'Gloom',    ja: '憂鬱' },
  GREEN:    { ko: '탐식', en: 'Gluttony', ja: '暴食' },
  SHAMROCK: { ko: '탐식', en: 'Gluttony', ja: '暴食' },
  YELLOW:   { ko: '나태', en: 'Sloth',    ja: '怠惰' },
  AMBER:    { ko: '나태', en: 'Sloth',    ja: '怠惰' },
}

// Derive a flat KR-keyed map for getSinColor (color→KR still needed for sinInfo)
const COLOR_TO_KR: Record<string, string> = Object.fromEntries(
  Object.entries(SIN_LABELS).map(([k, v]) => [k, v.ko])
)

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripSizeTags(text: string): string {
  return text.replace(/<size=[^>]*>/g, '').replace(/<\/size>/g, '')
}

/**
 * Extract condition from message_desc and return a human-readable string.
 * Returns null if the condition is absent or unrecognizable (hide gracefully).
 */
const EFFECT_TEXT: Record<SupportedLang, {
  allAllies: string
  chosenPersonality: string
  randomPersonality: string
  onePersonality: string
  unaffectedAlly: string
  randomAlly: (count: string) => string
  lowestHpAlly: (count: string) => string
  lowestMpAlly: (count: string) => string
  includeSkillAttribute: (sins: string) => string
  notIncludeSkillAttribute: (sins: string) => string
  attributePersonality: (sin: string) => string
  giftCondition: (names: string) => string
  costCondition: (amount: string) => string
  costGain: (amount: number | undefined) => string
  costLoss: (amount: number | undefined) => string
  hpLoss: (subject: string, amount: number | undefined) => string
  hpLossAll: (subject: string) => string
  mpLoss: (subject: string, amount: number | undefined) => string
  mpLossAll: (subject: string) => string
  hpMpLoss: (subject: string, hp: number | undefined, mp: number | undefined, amount: number | undefined) => string
  hpRatioLoss: (subject: string, amount: number | undefined) => string
  hpRecover: (subject: string, amount: number | undefined) => string
  hpRecoverAll: (subject: string) => string
  mpRecover: (subject: string, amount: number | undefined) => string
  mpRecoverAll: (subject: string) => string
  hpMpRecover: (subject: string, hp: number | undefined, mp: number | undefined, amount: number | undefined) => string
  hpRatioRecover: (subject: string, amount: number | undefined) => string
  battle: string
  nothing: string
  levelUp: string
  getCharacter: string
  destroyGift: string
  battleGift: string
}> = {
  ko: {
    allAllies: '아군 전원',
    chosenPersonality: '선택한 인격',
    randomPersonality: '랜덤 인격',
    onePersonality: '인격 1명',
    unaffectedAlly: '이상 없는 아군',
    randomAlly: count => `랜덤 아군 ${count}명`,
    lowestHpAlly: count => `체력이 가장 낮은 아군 ${count}명`,
    lowestMpAlly: count => `정신력이 가장 낮은 아군 ${count}명`,
    includeSkillAttribute: sins => `${sins} 속성 공격 스킬 보유 인격`,
    notIncludeSkillAttribute: sins => `${sins} 속성 공격 스킬 미보유 인격`,
    attributePersonality: sin => `${sin} 속성 인격`,
    giftCondition: names => `E.G.O 기프트 「${names}」 보유 시 선택 가능`,
    costCondition: amount => `코스트 ${amount} 이상 시 선택 가능`,
    costGain: amount => `코스트 ${amount} 획득`,
    costLoss: amount => `코스트 ${amount} 소모`,
    hpLoss: (subject, amount) => `${subject} 체력 ${amount} 피해`,
    hpLossAll: subject => `${subject} 체력 전소모`,
    mpLoss: (subject, amount) => `${subject} 정신력 ${amount} 피해`,
    mpLossAll: subject => `${subject} 정신력 전소모`,
    hpMpLoss: (subject, hp, mp, amount) => hp != null && mp != null
      ? `${subject} 체력 ${hp}, 정신력 ${mp} 피해`
      : `${subject} 체력·정신력 ${amount} 피해`,
    hpRatioLoss: (subject, amount) => `${subject} ${amount}%만큼 체력 피해`,
    hpRecover: (subject, amount) => `${subject} 체력 ${amount} 회복`,
    hpRecoverAll: subject => `${subject} 체력 전회복`,
    mpRecover: (subject, amount) => `${subject} 정신력 ${amount} 회복`,
    mpRecoverAll: subject => `${subject} 정신력 전회복`,
    hpMpRecover: (subject, hp, mp, amount) => hp != null && mp != null
      ? `${subject} 체력 ${hp}, 정신력 ${mp} 회복`
      : `${subject} 체력·정신력 ${amount} 회복`,
    hpRatioRecover: (subject, amount) => `${subject} ${amount}%만큼 체력 회복`,
    battle: '전투 발생!',
    nothing: '아무 일도 일어나지 않았다.',
    levelUp: '인격 레벨 업!',
    getCharacter: '수감자 영입!',
    destroyGift: 'E.G.O 기프트 파괴',
    battleGift: '다음 전투 승리 시 획득',
  },
  en: {
    allAllies: 'All allies',
    chosenPersonality: 'Selected Identity',
    randomPersonality: 'Random Identity',
    onePersonality: '1 Identity',
    unaffectedAlly: 'Unaffected ally',
    randomAlly: count => `${count} random allies`,
    lowestHpAlly: count => `${count} allies with the lowest HP`,
    lowestMpAlly: count => `${count} allies with the lowest SP`,
    includeSkillAttribute: sins => `Identities with ${sins} attack skills`,
    notIncludeSkillAttribute: sins => `Identities without ${sins} attack skills`,
    attributePersonality: sin => `${sin} Identity`,
    giftCondition: names => `Selectable if you own E.G.O Gift "${names}"`,
    costCondition: amount => `Selectable with ${amount}+ Cost`,
    costGain: amount => `Gain ${amount} Cost`,
    costLoss: amount => `Spend ${amount} Cost`,
    hpLoss: (subject, amount) => `${subject}: take ${amount} HP damage`,
    hpLossAll: subject => `${subject}: lose all HP`,
    mpLoss: (subject, amount) => `${subject}: take ${amount} SP damage`,
    mpLossAll: subject => `${subject}: lose all SP`,
    hpMpLoss: (subject, hp, mp, amount) => hp != null && mp != null
      ? `${subject}: take ${hp} HP and ${mp} SP damage`
      : `${subject}: take ${amount} HP/SP damage`,
    hpRatioLoss: (subject, amount) => `${subject}: take HP damage equal to ${amount}%`,
    hpRecover: (subject, amount) => `${subject}: recover ${amount} HP`,
    hpRecoverAll: subject => `${subject}: fully recover HP`,
    mpRecover: (subject, amount) => `${subject}: recover ${amount} SP`,
    mpRecoverAll: subject => `${subject}: fully recover SP`,
    hpMpRecover: (subject, hp, mp, amount) => hp != null && mp != null
      ? `${subject}: recover ${hp} HP and ${mp} SP`
      : `${subject}: recover ${amount} HP/SP`,
    hpRatioRecover: (subject, amount) => `${subject}: recover HP by ${amount}%`,
    battle: 'Battle starts!',
    nothing: 'Nothing happens.',
    levelUp: 'Identity level up!',
    getCharacter: 'Recruit Sinner!',
    destroyGift: 'Destroy E.G.O Gift',
    battleGift: 'Obtained after winning the next battle',
  },
  ja: {
    allAllies: '味方全員',
    chosenPersonality: '選択した人格',
    randomPersonality: 'ランダムな人格',
    onePersonality: '人格1名',
    unaffectedAlly: '異常のない味方',
    randomAlly: count => `ランダムな味方${count}名`,
    lowestHpAlly: count => `体力が最も低い味方${count}名`,
    lowestMpAlly: count => `精神力が最も低い味方${count}名`,
    includeSkillAttribute: sins => `${sins}属性攻撃スキルを持つ人格`,
    notIncludeSkillAttribute: sins => `${sins}属性攻撃スキルを持たない人格`,
    attributePersonality: sin => `${sin}属性人格`,
    giftCondition: names => `E.G.Oギフト「${names}」所持時に選択可能`,
    costCondition: amount => `コスト${amount}以上で選択可能`,
    costGain: amount => `コスト${amount}獲得`,
    costLoss: amount => `コスト${amount}消費`,
    hpLoss: (subject, amount) => `${subject} 体力${amount}ダメージ`,
    hpLossAll: subject => `${subject} 体力を全消耗`,
    mpLoss: (subject, amount) => `${subject} 精神力${amount}ダメージ`,
    mpLossAll: subject => `${subject} 精神力を全消耗`,
    hpMpLoss: (subject, hp, mp, amount) => hp != null && mp != null
      ? `${subject} 体力${hp}、精神力${mp}ダメージ`
      : `${subject} 体力・精神力${amount}ダメージ`,
    hpRatioLoss: (subject, amount) => `${subject} 体力に${amount}%分のダメージ`,
    hpRecover: (subject, amount) => `${subject} 体力${amount}回復`,
    hpRecoverAll: subject => `${subject} 体力を全回復`,
    mpRecover: (subject, amount) => `${subject} 精神力${amount}回復`,
    mpRecoverAll: subject => `${subject} 精神力を全回復`,
    hpMpRecover: (subject, hp, mp, amount) => hp != null && mp != null
      ? `${subject} 体力${hp}、精神力${mp}回復`
      : `${subject} 体力・精神力${amount}回復`,
    hpRatioRecover: (subject, amount) => `${subject} 体力を${amount}%回復`,
    battle: '戦闘発生！',
    nothing: '何も起こらなかった。',
    levelUp: '人格レベルアップ！',
    getCharacter: '囚人加入！',
    destroyGift: 'E.G.Oギフト破壊',
    battleGift: '次の戦闘勝利時に獲得',
  },
}

function effectText(lang: SupportedLang) {
  return EFFECT_TEXT[lang] ?? EFFECT_TEXT.ko
}

function formatGiftList(names: string[], lang: SupportedLang): string {
  if (lang === 'ko') return names.join('」 또는 「')
  if (lang === 'ja') return names.join('」または「')
  return names.join('" or "')
}

function formatCondition(raw: string, giftByGameId: Map<number, EgoGift>, lang: SupportedLang): string | null {
  const m = raw.match(/\[조건: ([^\]]+)\]/)
  if (!m) return null
  const cond = m[1].trim()
  const text = effectText(lang)

  // HasNotEgoGift_XXXX
  const singleGift = cond.match(/^HasNotEgoGift_(\d+)$/)
  if (singleGift) {
    const gift = giftByGameId.get(Number(singleGift[1]))
    if (!gift) return null
    return text.giftCondition(getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang))
  }

  // HasNotEgoGiftList_N_XXXX:YYYY:...
  const listGift = cond.match(/^HasNotEgoGiftList_\d+_(.+)$/)
  if (listGift) {
    const ids = listGift[1].split(':').map(Number)
    const names = ids
      .map(id => {
        const gift = giftByGameId.get(id)
        return gift ? getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang) : null
      })
      .filter((n): n is string => Boolean(n))
    if (names.length === 0) return null
    return text.giftCondition(formatGiftList(names, lang))
  }

  // HasNotEnoughCost_N
  const cost = cond.match(/^HasNotEnoughCost_(\d+)$/)
  if (cost) {
    return text.costCondition(cost[1])
  }

  return null
}

/** Strip [조건: ...] tag from message_desc for clean display */
function stripConditionTag(text: string): string {
  return text.replace(/\[조건: [^\]]+\]/g, '').trim()
}

function tEvent(key: string, lang: SupportedLang): string {
  const entry = translations[key as keyof typeof translations]
  if (!entry) return key
  return entry[lang] ?? entry.ko ?? key
}

function getEventName(event: MdEvent, lang: SupportedLang): string | null {
  if (!event.name) return null
  return getLocalizedName({ name_kr: event.name, name_en: event.name_en, name_jp: event.name_jp }, lang)
}

function getEventDesc(event: MdEvent, lang: SupportedLang): string | null {
  if (lang === 'en') return event.desc_text_en ?? event.desc_text
  if (lang === 'ja') return event.desc_text_jp ?? event.desc_text
  return event.desc_text
}

function getEventTitle(event: MdEvent, lang: SupportedLang): string {
  const name = getEventName(event, lang)
  if (name) return name
  const desc = getEventDesc(event, lang)
  return desc
    ? desc.split('\n')[0].slice(0, 40)
    : `${tEvent('mirrorDungeon.event.fallbackTitle', lang)} #${event.id}`
}

function getGiftCardData(gift: EgoGift, lang: SupportedLang) {
  return {
    ...gift,
    name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang),
  }
}

function isCoinEvent(event: MdEvent): boolean {
  return event.event_type === 'COIN_EVENT' || event.event_type === 'ab'
}

function isActionEvent(event: MdEvent): boolean {
  return event.event_type === 'ACTION' || event.event_type === 'action' || event.event_type === 'personality'
}

// ── Effect renderer (sentence style) ─────────────────────────────────────────

function sinLabel(key: string, lang: SupportedLang): string {
  return SIN_LABELS[key]?.[lang] ?? SIN_LABELS[key]?.ko ?? key
}

function sinList(raw: string, lang: SupportedLang): string {
  return raw.split(',').map(s => sinLabel(s.trim(), lang)).join('·')
}

function formatTarget(raw: string, lang: SupportedLang = 'ko'): string | null {
  if (!raw) return null
  const text = effectText(lang)
  // strip condition suffix (|SUCCESS, |FAILURE, |IncludeSkillAttribute_*)
  const parts = raw.split('|')
  const target = parts[0]

  if (target === 'ChosenPersonality') return text.chosenPersonality
  if (target === 'RandomPersonality') return text.randomPersonality
  if (target === 'OnePersonality') return text.onePersonality
  if (target === 'NotAffectedAlly') return text.unaffectedAlly

  // RandomAlly_N
  const randomAlly = target.match(/^RandomAlly_(\d+)$/)
  if (randomAlly) return text.randomAlly(randomAlly[1])

  // LowestHpAlly_N
  const lowestHp = target.match(/^LowestHpAlly_(\d+)$/)
  if (lowestHp) return text.lowestHpAlly(lowestHp[1])

  // LowestMpAlly_N
  const lowestMp = target.match(/^LowestMpAlly_(\d+)$/)
  if (lowestMp) return text.lowestMpAlly(lowestMp[1])

  // IncludeSkillAttribute_SIN[,SIN]
  const includeAttr = target.match(/^IncludeSkillAttribute_(.+)$/)
  if (includeAttr) return text.includeSkillAttribute(sinList(includeAttr[1], lang))

  // NotIncludeSkillAttribute_SIN[,SIN]
  const excludeAttr = target.match(/^NotIncludeSkillAttribute_(.+)$/)
  if (excludeAttr) return text.notIncludeSkillAttribute(sinList(excludeAttr[1], lang))

  // AttributePersonality_SIN (legacy pattern)
  const attrPersonality = target.match(/^AttributePersonality_(\w+)$/)
  if (attrPersonality) return text.attributePersonality(sinLabel(attrPersonality[1], lang))

  // Named character targets (Ryosyu, Donquixote etc.) — show as-is
  if (/^[A-Z]/.test(target)) return target

  return null
}

interface EffectLineProps {
  effect: ChoiceEffect
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
}

function EffectLine({ effect, giftByGameId, onSelectGift }: EffectLineProps) {
  const locale = useLocale()
  const lang = (locale as SupportedLang) ?? 'ko'
  const text = effectText(lang)
  const red = '#e05050'
  const green = '#00c87a'
  const gold = '#c8900a'
  const muted = '#605850'

  const lineStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    lineHeight: 1.55,
    color: '#bbb0a0',
  }

  if (effect.type === 'gift' || effect.type === 'gift_battle') {
    const gift = effect.gift_id ? giftByGameId.get(effect.gift_id) : null
    if (!gift) return null
    return (
      <div style={{ position: 'relative', zIndex: 0, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', maxWidth: '5rem' }}>
        <GiftCard
          gift={getGiftCardData(gift, lang)}
          onClick={() => onSelectGift(gift)}
          size="3rem"
          showName={true}
        />
      </div>
    )
  }

  if (effect.type === 'cost') {
    return (
      <p style={{ ...lineStyle, color: gold, fontWeight: 700 }}>
        {text.costGain(effect.amount)}
      </p>
    )
  }

  if (effect.type === 'cost_loss') {
    return (
      <p style={{ ...lineStyle, color: red }}>
        {text.costLoss(effect.amount)}
      </p>
    )
  }

  const targetText = effect.effect ? formatTarget(effect.effect, lang) : null
  const subject = targetText ?? text.allAllies

  if (effect.type === 'hp_loss') {
    const val = effect.hp ?? effect.amount
    return (
      <p style={{ ...lineStyle, color: red }}>
        {val === -1 ? text.hpLossAll(subject) : text.hpLoss(subject, val)}
      </p>
    )
  }

  if (effect.type === 'mp_loss') {
    const val = effect.mp ?? effect.amount
    return (
      <p style={{ ...lineStyle, color: red }}>
        {val === -1 ? text.mpLossAll(subject) : text.mpLoss(subject, val)}
      </p>
    )
  }

  if (effect.type === 'hp_mp_loss') {
    return (
      <p style={{ ...lineStyle, color: red }}>
        {text.hpMpLoss(subject, effect.hp, effect.mp, effect.amount)}
      </p>
    )
  }

  if (effect.type === 'hp_loss_ratio') {
    return (
      <p style={{ ...lineStyle, color: red }}>
        {text.hpRatioLoss(subject, effect.amount)}
      </p>
    )
  }

  if (effect.type === 'hp_recover') {
    const val = effect.hp ?? effect.amount
    return (
      <p style={{ ...lineStyle, color: green }}>
        {val === -1 ? text.hpRecoverAll(subject) : text.hpRecover(subject, val)}
      </p>
    )
  }

  if (effect.type === 'mp_recover') {
    const val = effect.mp ?? effect.amount
    return (
      <p style={{ ...lineStyle, color: green }}>
        {val === -1 ? text.mpRecoverAll(subject) : text.mpRecover(subject, val)}
      </p>
    )
  }

  if (effect.type === 'hp_mp_recover') {
    return (
      <p style={{ ...lineStyle, color: green }}>
        {text.hpMpRecover(subject, effect.hp, effect.mp, effect.amount)}
      </p>
    )
  }

  if (effect.type === 'hp_recover_ratio') {
    return (
      <p style={{ ...lineStyle, color: green }}>
        {text.hpRatioRecover(subject, effect.amount)}
      </p>
    )
  }

  if (effect.type === 'battle' || effect.type === 'battle_abnormality') {
    return (
      <p style={{ ...lineStyle, color: red, fontWeight: 700 }}>{text.battle}</p>
    )
  }

  if (effect.type === 'nothing') {
    return (
      <p style={{ ...lineStyle, color: muted }}>{text.nothing}</p>
    )
  }

  if (effect.type === 'level_up') {
    return (
      <p style={{ ...lineStyle, color: gold }}>{text.levelUp}</p>
    )
  }

  if (effect.type === 'get_character') {
    return (
      <p style={{ ...lineStyle, color: gold }}>{text.getCharacter}</p>
    )
  }

  // destroy_gift
  if (effect.type === 'destroy_gift') {
    return (
      <p style={{ ...lineStyle, color: red }}>{text.destroyGift}</p>
    )
  }

  return null
}

// ── Effects list renderer ─────────────────────────────────────────────────────

function EffectsList({
  effects,
  giftByGameId,
  onSelectGift,
}: {
  effects: ChoiceEffect[]
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
}) {
  const locale = useLocale()
  const lang = (locale as SupportedLang) ?? 'ko'
  if (!effects || effects.length === 0) return null
  const normalGifts = effects.filter(e => e.type === 'gift')
  const battleGifts = effects.filter(e => e.type === 'gift_battle')
  const otherEffects = effects.filter(e => e.type !== 'gift' && e.type !== 'gift_battle')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3125rem', marginTop: '0.5rem' }}>
      {otherEffects.map((eff, i) => (
        <EffectLine key={`o-${i}`} effect={eff} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
      ))}
      {battleGifts.length > 0 && (
        <div style={{ marginTop: '0.25rem' }}>
          <p style={{ fontSize: '0.6875rem', color: '#00c87a', marginBottom: '0.375rem' }}>
            {effectText(lang).battleGift}
          </p>
          <div style={{ position: 'relative', zIndex: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {battleGifts.map((eff, i) => (
              <EffectLine key={`bg-${i}`} effect={eff} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
            ))}
          </div>
        </div>
      )}
      {normalGifts.length > 0 && (
        <div style={{ position: 'relative', zIndex: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
          {normalGifts.map((eff, i) => (
            <EffectLine key={`g-${i}`} effect={eff} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Narration block ───────────────────────────────────────────────────────────

function NarrationText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div
      style={{
        paddingLeft: '0.875rem',
        borderLeft: '2px solid rgba(255,255,255,0.07)',
        marginTop: '0.5rem',
      }}
    >
      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            color: '#807060',
            fontSize: '0.8125rem',
            lineHeight: 1.75,
            minHeight: line.length === 0 ? '0.5rem' : undefined,
          }}
        >
          {line.length > 0 ? colorizeEventText(replaceEventPlaceholders(line)) : '\u00A0'}
        </p>
      ))}
    </div>
  )
}

// ── Coin event block (success/failure branches) ───────────────────────────────

interface CoinEventProps {
  coinEvent: MdEvent
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
  depth: number
  successLabel?: string
  failureLabel?: string
}

function CoinEventBlock({
  coinEvent,
  eventById,
  choicesByEventId,
  giftByGameId,
  onSelectGift,
  depth,
  successLabel,
  failureLabel,
}: CoinEventProps) {
  const locale = useLocale()
  const lang = locale as SupportedLang
  if (depth > 5) return null
  const branches = choicesByEventId.get(coinEvent.id) ?? []
  const successBranch = branches.find(c => c.sort_order === 0)
  const failureBranch = branches.find(c => c.sort_order === 1)
  const successText = successLabel ?? tEvent('mirrorDungeon.event.success', lang)
  const failureText = failureLabel ?? tEvent('mirrorDungeon.event.failure', lang)

  // Parse sin/threshold from behaveDesc stored in coinEvent.desc_text
  // Format: "분노/색욕 판정 XX+" or similar
  const judgeSource = getEventDesc(coinEvent, lang)
  const judgeText = judgeSource
    ? replaceEventPlaceholders(stripSizeTags(judgeSource))
    : null

  // Extract sin types from message_desc of branches: [SINCOLOR/sinKR 판정 min~max]
  // sm[1] may be an English color name (e.g. AMBER), sm[2] may also be English or Korean
  const sinInfo: { name: string; color: string }[] = []
  for (const branch of branches) {
    if (!branch.message_desc) continue
    const sinMatches = branch.message_desc.matchAll(/\[([^/\]]+)\/([^\s\]]+)\s/g)
    for (const sm of sinMatches) {
      const raw1 = sm[1]
      const raw2 = sm[2]
      const sinKr1 = COLOR_TO_KR[raw1] ?? raw1
      const sinKr2 = COLOR_TO_KR[raw2] ?? raw2
      for (const sinKr of [sinKr1, sinKr2]) {
        const color = getSinColor(sinKr)
        if (!sinInfo.find(s => s.name === sinKr)) {
          sinInfo.push({ name: sinKr, color })
        }
      }
    }
  }

  // Extract threshold value (e.g., "20+" or "30~50")
  let threshold = ''
  for (const branch of branches) {
    if (!branch.message_desc) continue
    const tMatch = branch.message_desc.match(/\s(\d+[+~\d]*)[\]$]/)
    if (tMatch) { threshold = tMatch[1]; break }
    // simpler: last number-like token in bracket
    const bracketContent = branch.message_desc.match(/\[([^\]]+)\]/)
    if (bracketContent) {
      const numMatch = bracketContent[1].match(/(\d+\+?)$/)
      if (numMatch) { threshold = numMatch[1]; break }
    }
  }

  return (
    <div
      style={{
        marginTop: '0.625rem',
        borderRadius: '0.5rem',
        border: '1px solid rgba(200,144,10,0.18)',
        overflow: 'hidden',
      }}
    >
      {/* Coin event header */}
      <div
        style={{
          padding: '0.625rem 0.875rem',
          background: 'rgba(200,144,10,0.07)',
          borderBottom: '1px solid rgba(200,144,10,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        {judgeText && (
          <span style={{ color: '#d4a020', fontSize: '0.8125rem', fontWeight: 600, flex: 1, minWidth: 0 }}>
            {colorizeEventText(judgeText)}
          </span>
        )}
        {sinInfo.length > 0 && (
          <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexShrink: 0 }}>
            {sinInfo.map((s, i) => (
              <span key={s.name}>
                {i > 0 && <span style={{ color: '#666', margin: '0 0.125rem' }}>/</span>}
                <span style={{ color: s.color, fontWeight: 700, fontSize: '0.75rem' }}>{s.name}</span>
              </span>
            ))}
          </span>
        )}
        {threshold && (
          <span
            style={{
              color: '#c8900a',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              fontSize: '0.875rem',
              flexShrink: 0,
            }}
          >
            {threshold}
          </span>
        )}
      </div>

      {/* Branches */}
      <div style={{ padding: '0.625rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {successBranch && (
          <BranchBlock
            choice={successBranch}
            isSuccess={true}
            eventById={eventById}
            choicesByEventId={choicesByEventId}
            giftByGameId={giftByGameId}
            onSelectGift={onSelectGift}
            depth={depth}
            label={successText}
          />
        )}
        {failureBranch && (
          <BranchBlock
            choice={failureBranch}
            isSuccess={false}
            eventById={eventById}
            choicesByEventId={choicesByEventId}
            giftByGameId={giftByGameId}
            onSelectGift={onSelectGift}
            depth={depth}
            label={failureText}
          />
        )}
      </div>
    </div>
  )
}

// ── Branch block (success / failure) ─────────────────────────────────────────

interface BranchBlockProps {
  choice: MdEventChoice
  isSuccess: boolean
  label: string
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
  depth: number
}

function BranchBlock({
  choice,
  isSuccess,
  label,
  eventById,
  choicesByEventId,
  giftByGameId,
  onSelectGift,
  depth,
}: BranchBlockProps) {
  if (depth > 5) return null
  const accentColor = isSuccess ? '#00c87a' : '#e05050'
  const accentBg = isSuccess ? 'rgba(0,200,122,0.06)' : 'rgba(224,80,80,0.06)'
  const accentBorder = isSuccess ? 'rgba(0,200,122,0.18)' : 'rgba(224,80,80,0.18)'

  const childEvent = choice.next_event_id ? eventById.get(choice.next_event_id) : null

  return (
    <div
      style={{
        borderRadius: '0.375rem',
        border: `1px solid ${accentBorder}`,
        borderLeft: `0.1875rem solid ${accentColor}`,
        background: accentBg,
        padding: '0.5rem 0.75rem',
      }}
    >
      <span
        className="font-serif"
        style={{ color: accentColor, fontSize: '0.875rem', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}
      >
        {label}
      </span>

      {choice.message && <NarrationText text={choice.message} />}
      {choice.result_text && <NarrationText text={choice.result_text} />}

      {choice.effects && choice.effects.length > 0 && (
        <EffectsList effects={choice.effects} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
      )}

      {/* Nested: if success branch itself leads to another coin event */}
      {childEvent && isCoinEvent(childEvent) && (
        <CoinEventBlock
          coinEvent={childEvent}
          eventById={eventById}
          choicesByEventId={choicesByEventId}
          giftByGameId={giftByGameId}
          onSelectGift={onSelectGift}
          depth={depth + 1}
        />
      )}
      {childEvent && isActionEvent(childEvent) && (
        <div style={{ marginTop: '0.5rem' }}>
          <ChoiceList
            event={childEvent}
            eventById={eventById}
            choicesByEventId={choicesByEventId}
            giftByGameId={giftByGameId}
            onSelectGift={onSelectGift}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  )
}

// ── Single choice row ─────────────────────────────────────────────────────────

interface ChoiceItemProps {
  choice: MdEventChoice
  index: number
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
  depth: number
}

function ChoiceItem({
  choice,
  index,
  eventById,
  choicesByEventId,
  giftByGameId,
  onSelectGift,
  depth,
}: ChoiceItemProps) {
  const locale = useLocale()
  const lang = (locale as SupportedLang) ?? 'ko'
  if (depth > 5) return null

  const messageDescClean = choice.message_desc
    ? stripSizeTags(replaceEventPlaceholders(choice.message_desc))
    : null
  const conditionText = messageDescClean
    ? formatCondition(messageDescClean, giftByGameId, lang)
    : null
  const descDisplay = messageDescClean ? stripConditionTag(messageDescClean) : null

  const childEvent = choice.next_event_id ? eventById.get(choice.next_event_id) : null
  const isCoinChild = childEvent ? isCoinEvent(childEvent) : false

  return (
    <div
      className="overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.055)',
        borderLeft: '0.1875rem solid rgba(200,144,10,0.55)',
        borderRadius: '0.5rem',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ padding: '0.875rem 1rem' }}>
        {/* Header row: index + message */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <span
            style={{
              flexShrink: 0,
              width: '1.5rem',
              height: '1.5rem',
              borderRadius: '50%',
              background: 'rgba(200,144,10,0.12)',
              border: '1px solid rgba(200,144,10,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c8900a',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              marginTop: '0.125rem',
            }}
          >
            {index + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              className="font-serif"
              style={{ color: '#e8dcc8', fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.5 }}
            >
              {parseUnityColorTags(stripSizeTags(choice.message ?? ''))}
            </p>

            {/* message_desc subtitle (sans condition tag) */}
            {descDisplay && descDisplay.length > 0 && (
              <p style={{ color: '#8a7a60', fontSize: '0.75rem', lineHeight: 1.5, marginTop: '0.25rem' }}>
                {parseUnityColorTags(descDisplay)}
              </p>
            )}

            {/* Condition line */}
            {conditionText && (
              <div
                style={{
                  marginTop: '0.4375rem',
                  padding: '0.25rem 0.625rem',
                  border: '1px solid rgba(200,144,10,0.25)',
                  borderLeft: '0.1875rem solid rgba(200,144,10,0.6)',
                  borderRadius: '0.3125rem',
                  background: 'rgba(200,144,10,0.05)',
                  fontSize: '0.6875rem',
                  color: '#c8a060',
                  display: 'inline-block',
                }}
              >
                {conditionText}
              </div>
            )}
          </div>
        </div>

        {/* Result narration */}
        {choice.result_text && (
          <div style={{ marginTop: '0.625rem', paddingLeft: '2.25rem' }}>
            <NarrationText text={choice.result_text} />
          </div>
        )}

        {/* Effects */}
        {choice.effects && choice.effects.length > 0 && (
          <div style={{ marginTop: '0.25rem', paddingLeft: '2.25rem' }}>
            <EffectsList effects={choice.effects} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
          </div>
        )}

        {/* Coin event child */}
        {isCoinChild && childEvent && (
          <div style={{ marginTop: '0.5rem', paddingLeft: '0.25rem' }}>
            <CoinEventBlock
              coinEvent={childEvent}
              eventById={eventById}
              choicesByEventId={choicesByEventId}
              giftByGameId={giftByGameId}
              onSelectGift={onSelectGift}
              depth={depth + 1}
            />
          </div>
        )}

        {/* Non-coin child event (nested choices) */}
        {childEvent && !isCoinEvent(childEvent) && (
          <div
            style={{
              marginTop: '0.75rem',
              paddingLeft: '0.75rem',
              borderLeft: '2px solid rgba(200,144,10,0.12)',
            }}
          >
            <ChoiceList
              event={childEvent}
              eventById={eventById}
              choicesByEventId={choicesByEventId}
              giftByGameId={giftByGameId}
              onSelectGift={onSelectGift}
              depth={depth + 1}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Choice list (recursive entry point) ──────────────────────────────────────

interface ChoiceListProps {
  event: MdEvent
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
  depth?: number
}

function ChoiceList({
  event,
  eventById,
  choicesByEventId,
  giftByGameId,
  onSelectGift,
  depth = 0,
}: ChoiceListProps) {
  if (depth > 5) return null
  const choices = choicesByEventId.get(event.id) ?? []
  if (choices.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {choices.map((choice, i) => (
        <ChoiceItem
          key={choice.id}
          choice={choice}
          index={i}
          eventById={eventById}
          choicesByEventId={choicesByEventId}
          giftByGameId={giftByGameId}
          onSelectGift={onSelectGift}
          depth={depth}
        />
      ))}
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
      <div
        style={{
          width: '0.1875rem',
          height: '0.875rem',
          background: 'linear-gradient(to bottom, var(--gold), rgba(200,144,10,0.4))',
          borderRadius: '0.125rem',
          flexShrink: 0,
        }}
      />
      <p
        style={{
          color: '#9a8a68',
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </p>
      <div
        style={{
          flex: 1,
          height: '1px',
          background: 'linear-gradient(90deg, rgba(200,144,10,0.15), transparent 60%)',
        }}
      />
    </div>
  )
}

// ── Main EventModal ───────────────────────────────────────────────────────────

export default function EventModal({
  lang,
  event,
  eventById,
  choicesByEventId,
  giftByGameId,
  themes,
  onClose,
  onSelectGift,
}: EventModalProps) {
  const eventTitle = getEventTitle(event, lang)
  const eventDesc = getEventDesc(event, lang)
  const evThemes = (event.theme_ids ?? [])
    .map(tid => themes.find(th => th.id === tid))
    .filter((t): t is EgoGiftTheme => Boolean(t))

  const evGifts = (event.gift_ids ?? [])
    .map(gid => giftByGameId.get(gid))
    .filter((g): g is EgoGift => Boolean(g))

  const handleSelectGift = (gift: EgoGift) => {
    onClose()
    onSelectGift(gift)
  }

  const choices = choicesByEventId.get(event.id) ?? []

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="58rem" padding="1rem" title={tEvent('mirrorDungeon.event.modalTitle', lang)}>
      {/* Responsive styles for sidebar layout */}
      <style>{`
        @media (min-width: 768px) {
          .event-modal-sidebar {
            width: 17rem !important;
            flex-shrink: 0 !important;
            border-bottom: none !important;
            border-right: 1px solid rgba(200,144,10,0.1) !important;
            padding: 1.5rem 1.25rem 1.5rem 1.5rem !important;
            gap: 1.25rem !important;
          }
          .event-modal-image-wrap {
            aspect-ratio: 4 / 3 !important;
          }
          .event-modal-content {
            padding: 1.5rem 1.5rem 1.5rem 1.25rem !important;
          }
        }
      `}</style>
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxHeight: '90vh',
          borderRadius: '0.875rem',
          background: 'linear-gradient(160deg, #161310 0%, #131110 50%, #100e0c 100%)',
          border: '1px solid rgba(200,144,10,0.14)',
          boxShadow:
            '0 0 0 1px rgba(200,144,10,0.04), 0 0 3.5rem rgba(200,144,10,0.08), 0 2rem 5rem rgba(0,0,0,0.7)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label={tEvent('mirrorDungeon.theme.close', lang)}
          className="absolute top-3 right-3 z-30 flex items-center justify-center"
          style={{
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)',
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            transition: 'color 0.2s, background 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#e8d8c0'
            e.currentTarget.style.background = 'rgba(200,144,10,0.18)'
            e.currentTarget.style.borderColor = 'rgba(200,144,10,0.35)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
            e.currentTarget.style.background = 'rgba(0,0,0,0.5)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
          }}
        >
          <X size={15} />
        </button>

        {/* Scroll container */}
        <div style={{ maxHeight: '90vh', overflowY: 'auto' }}>

          {/* ── Two-column layout (stacks on mobile) ──────── */}
          <div className="flex flex-col md:flex-row" style={{ gap: 0, minHeight: 0 }}>
            {/* ── LEFT SIDEBAR ─────────────────────────────── */}
            <div
              className="event-modal-sidebar"
              style={{
                width: '100%',
                borderBottom: '1px solid rgba(200,144,10,0.1)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                background: 'rgba(0,0,0,0.15)',
              }}
            >
              {/* Event image */}
              {event.image_url ? (
                <div
                  className="event-modal-image-wrap"
                  style={{
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    aspectRatio: '16 / 9',
                    position: 'relative',
                    background: '#0d0b08',
                    border: '1px solid rgba(200,144,10,0.12)',
                  }}
                >
                  <ImageWithFallback
                    src={event.image_url}
                    alt=""
                    fill
                    fallbackType="default"
                    sizes="(max-width: 767px) 100vw, 17rem"
                    className="object-cover"
                    style={{ opacity: 0.85 }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(to top, rgba(19,17,16,0.6) 0%, transparent 50%)',
                    }}
                  />
                </div>
              ) : (
                <div
                  className="event-modal-image-wrap"
                  style={{
                    borderRadius: '0.5rem',
                    aspectRatio: '16 / 9',
                    background: 'rgba(200,144,10,0.04)',
                    border: '1px solid rgba(200,144,10,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ color: 'rgba(200,144,10,0.3)', fontSize: '2rem' }}>✦</span>
                </div>
              )}

              {/* Event name */}
              <h2
                className="font-serif font-bold"
                style={{
                  fontSize: '1.0625rem',
                  color: '#f0e2c0',
                  lineHeight: 1.3,
                  letterSpacing: 0,
                  margin: 0,
                }}
              >
                {eventTitle}
              </h2>

              {/* Description text */}
              {eventDesc && (
                <div>
                  {replaceEventPlaceholders(eventDesc)
                    .split('\n\n')
                    .map((para, pi) => (
                      <p
                        key={pi}
                        className="whitespace-pre-line"
                        style={{
                          color: pi === 0 ? '#cebf9e' : '#a08870',
                          fontSize: '0.8125rem',
                          lineHeight: 1.85,
                          marginBottom: pi < replaceEventPlaceholders(eventDesc).split('\n\n').length - 1 ? '0.625rem' : 0,
                          ...(pi === 0 ? { fontWeight: 500 } : {}),
                        }}
                      >
                        {colorizeEventText(para)}
                      </p>
                    ))}
                </div>
              )}

              {/* Related E.G.O Gifts */}
              {evGifts.length > 0 && (
                <div>
                  <SectionLabel>{tEvent('mirrorDungeon.event.availableGifts', lang)}</SectionLabel>
                  {/* position: relative + zIndex: 0 isolates GiftCard hover z-index */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 0,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    {evGifts.map(g => (
                      <GiftCard
                        key={g.id}
                        gift={getGiftCardData(g, lang)}
                        onClick={() => handleSelectGift(g)}
                        size="2.5rem"
                        showName={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Related Theme Packs */}
              {evThemes.length > 0 && evThemes.length <= 8 && (
                <div>
                  <SectionLabel>{tEvent('mirrorDungeon.event.relatedThemes', lang)}</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {evThemes.map(t => {
                      const dColor =
                        t.difficulty === 'extreme'
                          ? '#c04040'
                          : t.difficulty === 'hard'
                            ? '#d08030'
                            : '#706050'
                      return (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.3125rem 0.5rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '0.375rem',
                          }}
                        >
                          {t.image_url && (
                            <ImageWithFallback
                              src={t.image_url}
                              alt=""
                              width={8}
                              height={14}
                              fallbackType="theme"
                              style={{
                                width: '0.5rem',
                                height: '0.875rem',
                                objectFit: 'cover',
                                borderRadius: '1px',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span style={{ color: '#b0a088', fontSize: '0.6875rem', flex: 1, minWidth: 0 }}>
                            {getLocalizedName({ name_kr: t.name, name_en: t.name_en, name_jp: t.name_jp }, lang)}
                          </span>
                          <span
                            style={{
                              color: dColor,
                              fontSize: '0.5rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {t.difficulty === 'extreme'
                              ? 'EX'
                              : t.difficulty === 'hard'
                                ? 'HARD'
                                : 'NML'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT CONTENT: Choices ──────────────────── */}
            <div
              className="event-modal-content"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '1rem',
              }}
            >
              {choices.length > 0 ? (
                <>
                  <SectionLabel>{tEvent('mirrorDungeon.event.choicesLabel', lang)}</SectionLabel>
                  <ChoiceList
                    event={event}
                    eventById={eventById}
                    choicesByEventId={choicesByEventId}
                    giftByGameId={giftByGameId}
                    onSelectGift={handleSelectGift}
                    depth={0}
                  />
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '8rem',
                    color: 'rgba(200,144,10,0.3)',
                    fontSize: '0.8125rem',
                  }}
                >
                  {tEvent('mirrorDungeon.event.noChoices', lang)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  )
}
