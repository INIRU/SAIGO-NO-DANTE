'use client'

import { useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react'
import useSWR from 'swr'
import { useLocale, useTranslations } from 'next-intl'
import { Minus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { GiftEnhanceMark, GiftEnhancePicker } from '@/components/ui/GiftCard'
import { EffectText } from '@/components/ui/GiftDetailModal'
import KeywordChip from '@/components/ui/KeywordChip'
import KeywordIcon from '@/components/ui/KeywordIcon'
import { useKeywords } from '@/components/providers/KeywordProvider'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { localizeGiftKeyword } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { showWarning } from '@/lib/toast'
import { clampModifierValue, MAX_MODIFIER_NAME, MAX_MODIFIER_OPTIONS, MAX_MODIFIERS, MAX_MODIFIER_VALUE, MODIFIER_TARGETS, type ModifierTarget, type SavedModifier } from '@/lib/tools/damage'
import { stackEffect, suggestDamageSources, type DamageSources, type DamageSuggestion, type SourceGroup } from '@/lib/tools/damage-sources'
import NumberInput from './NumberInput'
import styles from './DamageCalculator.module.css'

// Who carries the effect, as the game shows status effects on a unit: the attacker, the run's gifts, the target.
const GROUPS: SourceGroup[] = ['self', 'gift', 'target']
const groupOf = (modifier: SavedModifier): SourceGroup | 'manual' => modifier.gift ? 'gift' : modifier.keyword ? modifier.side ?? 'self' : 'manual'
const dropdownStyle = {width:'100%',justifyContent:'space-between',minHeight:'2.75rem',padding:'.7rem',background:'var(--bg-deep)',borderColor:'var(--border)',fontSize:'.875rem',color:'var(--text-primary)'}
// A percent steps by 1 and shares its unit with the other percent; a multiplier and a resistance value step by 0.05.
const isPercent = (target: ModifierTarget) => target === 'damage' || target === 'resist'
// 35 → "+35%", -15 → "−15%"; a resistance value has no unit: 0.2 → "+0.2"
const signed = (value: number, target: ModifierTarget) => `${value < 0 ? '−' : '+'}${Math.abs(value)}${isPercent(target) ? '%' : ''}`

const fetchSources = async (url: string): Promise<DamageSources> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  const sources = await response.json()
  // A copy of another shape (an older one still held by the CDN) is a failed load, not a list.
  if (!Array.isArray(sources?.keywords) || !Array.isArray(sources?.gifts)) throw new Error('Unexpected response')
  return sources
}

/**
 * The modifiers of the damage calculator. Keywords and gifts sit as icon tiles in the group that carries them; a
 * group's "+" opens its own candidates to search, and a pressed tile opens its text and its value below. Only one of
 * those two panels is open at a time, and an ✕ only ever closes a panel: removing is a button that says so.
 */
export default function DamageModifiers({ modifiers, setModifiers }: { modifiers: SavedModifier[]; setModifiers: Dispatch<SetStateAction<SavedModifier[]>> }) {
  const t = useTranslations('damage')
  const locale = useLocale() as SupportedLang
  const keywords = useKeywords()
  const [adding, setAdding] = useState<SourceGroup | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  // The list is asked for once it is needed (a "+" or a tile is pressed), then kept: it only changes with a game data sync.
  const [wanted, setWanted] = useState(false)
  // Where the focus goes back to when a panel closes: the "+" of its group, or the tile that was edited.
  const slots = useRef<Partial<Record<SourceGroup, HTMLButtonElement | null>>>({})
  const tiles = useRef(new Map<number, HTMLButtonElement | null>())
  const { data, error, isLoading, mutate } = useSWR(wanted ? `/api/damage-sources/${locale}` : null, fetchSources, { revalidateOnFocus: false })

  const candidates = data && adding ? suggestDamageSources(data, query, { group: adding }) : []
  const full = modifiers.length >= MAX_MODIFIERS
  const keywordLabel = (name: string) => (locale === 'en' ? keywords[name]?.nameEn : locale === 'ja' ? keywords[name]?.nameJp : null) || name
  // A gift's enhancement level is drawn on its artwork with the game's mark, so the "+" its name was saved with is not repeated.
  // Once the list is loaded a gift is named in the page's language, whatever language it was picked in.
  const labelOf = (modifier: Pick<SavedModifier, 'name'> & Partial<Pick<SavedModifier, 'keyword' | 'gift'>>) => modifier.keyword ? keywordLabel(modifier.keyword)
    : modifier.gift ? data?.gifts.find(gift => gift.id === modifier.gift?.id)?.label ?? modifier.name.replace(/\++$/, '') : modifier.name || t('unnamed')

  const update = (id: number, patch: Partial<SavedModifier>) => setModifiers(list => list.map(modifier => modifier.id === id ? { ...modifier, ...patch } : modifier))
  const setStacks = (modifier: SavedModifier, stacks: number) => {
    const stack = stackEffect(modifier.keyword ?? '')
    if (!stack) return
    const count = Math.max(1, Math.min(stack.max, stacks))
    // 0.1 × 3 is 0.30000000000000004 in binary: kept to two places.
    // The target goes with the value: a stack keyword's effect is its own, whatever was saved beside it.
    update(modifier.id, { stacks: count, target: stack.target, value: Math.round(stack.perStack * count * 100) / 100 })
  }
  const add = (modifier: Omit<SavedModifier, 'id'>) => {
    // A stack keyword already applied gains a stack instead of a second tile.
    const applied = modifier.stacks ? modifiers.find(other => other.keyword === modifier.keyword && other.stacks) : undefined
    if (applied) {
      const max = stackEffect(applied.keyword ?? '')?.max ?? applied.stacks!
      if (applied.stacks! >= max) showWarning(t('picker.maxStack', { max }))
      else setStacks(applied, applied.stacks! + 1)
      return
    }
    if (full) { showWarning(t('full', { max: MAX_MODIFIERS })); return }
    setModifiers(list => list.length >= MAX_MODIFIERS ? list : [...list, { ...modifier, name: modifier.name.slice(0, MAX_MODIFIER_NAME), id: Math.max(0, ...list.map(other => other.id)) + 1 }])
  }
  const groupOfId = (id: number) => { const modifier = modifiers.find(other => other.id === id); return modifier ? groupOf(modifier) : 'manual' }
  const closeAdder = (group: SourceGroup) => { setAdding(null); slots.current[group]?.focus() }
  const closeEditor = (id: number) => { setSelected(null); tiles.current.get(id)?.focus() }
  // The tile is gone with its effect: the focus goes to its group's "+".
  const remove = (id: number) => {
    const group = groupOfId(id)
    setModifiers(list => list.filter(other => other.id !== id))
    if (group !== 'manual') slots.current[group]?.focus()
  }
  const open = (group: SourceGroup) => { setAdding(current => current === group ? null : group); setSelected(null); setQuery(''); setWanted(true) }
  const edit = (id: number) => { setSelected(current => current === id ? null : id); setAdding(null); setWanted(true) }
  // Enter adds the first match of what was typed; with nothing typed it adds nothing.
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && query.trim() && candidates.length) { event.preventDefault(); add(candidates[0].modifier) }
  }
  // Escape closes a panel from anywhere inside it.
  const onEscape = (close: () => void) => (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }
  const giftSource = (modifier: SavedModifier) => data?.gifts.find(gift => gift.id === modifier.gift?.id)
  // The text as the game wrote it; EffectText draws its keywords with their icons, colours and tooltips.
  const sourceText = (modifier: SavedModifier) => modifier.keyword
    ? data?.keywords.find(keyword => keyword.name === modifier.keyword)?.text
    : giftSource(modifier)?.stages.find(stage => stage.level === modifier.gift?.level)?.text
  // Another enhancement level is another text: its values replace the choices, and its first value is applied.
  const setLevel = (modifier: SavedModifier, level: number) => {
    const source = giftSource(modifier)
    const stage = source?.stages.find(candidate => candidate.level === level)
    if (!source || !stage || !modifier.gift) return
    const options = stage.values.slice(0, MAX_MODIFIER_OPTIONS)
    update(modifier.id, { name: (source.label + '+'.repeat(level)).slice(0, MAX_MODIFIER_NAME), gift: { ...modifier.gift, level }, options, value: options[0] ?? 0 })
  }
  const art = (modifier: Pick<SavedModifier, 'name'> & Partial<Pick<SavedModifier, 'keyword' | 'gift'>>, sizes = '48px') => {
    // The name stands next to the artwork wherever it is drawn, so the artwork itself is not named again.
    if (modifier.gift) return <GiftArtwork gift={{ ...modifier.gift, name: modifier.name }} displayName="" enhance={modifier.gift.level} sizes={sizes}>{modifier.gift.level > 0 && <GiftEnhanceMark level={modifier.gift.level} />}</GiftArtwork>
    const url = modifier.keyword ? getKeywordIconUrl(modifier.keyword, keywords[modifier.keyword]?.iconSlug) : null
    return url ? <KeywordIcon src={url} alt="" width={64} height={64} /> : <Pencil size={16} aria-hidden="true" />
  }
  const candidateValue = ({ perStack, modifier }: DamageSuggestion) => perStack !== undefined ? t('picker.perStack', { value: signed(perStack, modifier.target) }) : modifier.options?.length ? signed(modifier.value, modifier.target) : null
  const numberInput = (modifier: SavedModifier, name: string) => (
    <span className={styles.modifierNumber}>
      <NumberInput label={`${name} ${t('customValue')}`} value={modifier.value} decimal step={isPercent(modifier.target) ? 1 : 0.05}
        min={clampModifierValue(-MAX_MODIFIER_VALUE, modifier.target)} max={MAX_MODIFIER_VALUE} onChange={value => update(modifier.id, { value })} />
      {isPercent(modifier.target) && <span aria-hidden="true">%</span>}
    </span>
  )
  const manual = modifiers.filter(modifier => groupOf(modifier) === 'manual')

  return <div className={styles.sides}>
    {GROUPS.map(group => {
      const groupName = t(`picker.group.${group}`)
      const applied = modifiers.filter(modifier => groupOf(modifier) === group)
      const chosen = applied.find(modifier => modifier.id === selected)
      const stack = chosen?.stacks ? stackEffect(chosen.keyword ?? '') : null
      return <section key={group} className={styles.side} aria-label={groupName}>
        <h4>{groupName}</h4>
        <div className={styles.tiles}>
          {applied.map(modifier => (
            <button key={modifier.id} type="button" ref={node => { tiles.current.set(modifier.id, node) }} className={styles.tile} aria-pressed={modifier.id === selected}
              onClick={() => edit(modifier.id)}>
              <span className={styles.tileArt}>{art(modifier)}{modifier.stacks && <span key={modifier.stacks} className={styles.badge}>{modifier.stacks}</span>}</span>
              <span className={styles.tileName}>{labelOf(modifier)}</span>
              <b key={modifier.value}>{signed(modifier.value, modifier.target)}</b>
            </button>
          ))}
          <button type="button" ref={node => { slots.current[group] = node }} className={styles.slot} aria-expanded={adding === group} aria-label={t('picker.addTo', { group: groupName })} onClick={() => open(group)}><Plus size={20} aria-hidden="true" /></button>
        </div>
        {adding === group && <div className={styles.adder} onKeyDown={onEscape(() => closeAdder(group))}>
          <div className={styles.adderHead}>
            <label className={styles.search}>
              <Search size={16} aria-hidden="true" />
              {/* The "+" was just pressed to look for something: the search takes the focus. */}
              <input type="text" autoFocus aria-label={t('picker.search')} placeholder={t('picker.search')} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={onSearchKey} />
            </label>
            <button type="button" className={styles.remove} aria-label={t('picker.close')} onClick={() => closeAdder(group)}><X size={16} aria-hidden="true" /></button>
          </div>
          {isLoading && <p className={styles.hint} role="status">{t('picker.loading')}</p>}
          {error && <p className={styles.hint} role="alert">{t('picker.loadError')} <button type="button" className={styles.retry} onClick={() => mutate()}>{t('picker.retry')}</button></p>}
          {data && !candidates.length && <p className={styles.hint}>{t('picker.noResults')}</p>}
          {candidates.length > 0 && <div className={styles.candidates}>
            {candidates.map(candidate => (
              <button key={candidate.key} type="button" className={styles.tile} onClick={() => add(candidate.modifier)}>
                <span className={styles.tileArt}>{art(candidate.modifier)}</span>
                <span className={styles.tileName}>{labelOf(candidate.modifier)}</span>
                <small>{candidateValue(candidate)}</small>
              </button>
            ))}
          </div>}
        </div>}
        {chosen && (() => {
          const name = labelOf(chosen)
          const text = sourceText(chosen)
          const levels = giftSource(chosen)?.stages.map(candidate => candidate.level) ?? []
          const level = chosen.gift?.level ?? 0
          return <div className={styles.editor} onKeyDown={onEscape(() => closeEditor(chosen.id))}>
            <button type="button" className={`${styles.remove} ${styles.editorClose}`} aria-label={t('picker.close')} onClick={() => closeEditor(chosen.id)}><X size={18} aria-hidden="true" /></button>
            <div className={styles.editorHead}>
              <span className={styles.editorArt}>{art(chosen, '72px')}</span>
              <div className={styles.editorTitle}>
                <h5>{name}</h5>
                {chosen.gift?.keyword && <KeywordChip keyword={chosen.gift.keyword} label={localizeGiftKeyword(chosen.gift.keyword, locale)} size="md" />}
              </div>
            </div>
            <div className={styles.editorPart}>
              <div className={styles.editorPartHead}>
                <span>{t('picker.effect')}</span>
                {levels.length > 1 && <div className={styles.enhance}><GiftEnhancePicker level={level} max={Math.max(...levels) >= 2 ? 2 : 1} giftName={name} onChange={next => setLevel(chosen, next)} /></div>}
              </div>
              {text
                ? <EffectText key={level} text={text} color={level === 2 ? '#e8b030' : level === 1 ? '#d8b878' : '#c8b898'} />
                : <p className={styles.hint} role={error ? 'alert' : 'status'}>{error ? t('picker.loadError') : t('picker.loading')}</p>}
            </div>
            <div className={`${styles.editorPart} ${styles.editorControls}`}>
              <span>{t('picker.value')}</span>
              {stack ? <>
                <div className={styles.stepper}>
                  <button type="button" aria-label={t('picker.decrease', { name })} disabled={chosen.stacks! <= 1} onClick={() => setStacks(chosen, chosen.stacks! - 1)}><Minus size={14} aria-hidden="true" /></button>
                  <b key={chosen.stacks} aria-live="polite">{chosen.stacks}</b>
                  <button type="button" aria-label={t('picker.increase', { name })} disabled={chosen.stacks! >= stack.max} onClick={() => setStacks(chosen, chosen.stacks! + 1)}><Plus size={14} aria-hidden="true" /></button>
                </div>
                <strong className={styles.modifierValue}>{signed(chosen.value, chosen.target)}</strong>
              </> : <>
                {(chosen.options?.length ?? 0) > 1 && <div className={styles.options} role="group" aria-label={t('picker.choices', { name })}>
                  {chosen.options!.map(option => <button key={option} type="button" className={styles.chip} aria-pressed={option === chosen.value} onClick={() => update(chosen.id, { value: clampModifierValue(option, chosen.target) })}>{signed(option, chosen.target)}</button>)}
                </div>}
                {numberInput(chosen, name)}
              </>}
              <button type="button" className={styles.delete} onClick={() => remove(chosen.id)}><Trash2 size={15} aria-hidden="true" />{t('picker.delete')}</button>
            </div>
          </div>
        })()}
      </section>
    })}
    <section className={styles.side} aria-label={t('picker.group.manual')}>
      <h4>{t('picker.group.manual')}</h4>
      {manual.length > 0 && <ul className={styles.modifierList}>
        {manual.map(modifier => <li key={modifier.id} className={styles.modifier}>
          <input type="text" aria-label={t('customName')} placeholder={t('customName')} maxLength={MAX_MODIFIER_NAME} value={modifier.name} onChange={event => update(modifier.id, { name: event.target.value })} />
          <Dropdown ariaLabel={t('customTarget')} buttonStyle={dropdownStyle} value={modifier.target}
            options={MODIFIER_TARGETS.map(target => ({ value: target, label: t(`targetOption.${target}`) }))}
            // A percent, a multiplier and a resistance value are different units: switching starts from the neutral value.
            onChange={target => update(modifier.id, { target, value: target === 'final' ? 1 : isPercent(target) === isPercent(modifier.target) && modifier.target !== 'final' ? modifier.value : 0 })} />
          {numberInput(modifier, modifier.name || t('unnamed'))}
          <button type="button" className={`${styles.remove} ${styles.trash}`} aria-label={t('remove', { name: modifier.name || t('unnamed') })} onClick={() => remove(modifier.id)}><Trash2 size={16} aria-hidden="true" /></button>
        </li>)}
      </ul>}
      <button type="button" className={styles.add} disabled={full} onClick={() => add({ name: '', value: 10, target: 'damage' })}><Plus size={16} aria-hidden="true" />{t('add')}</button>
    </section>
    {full && <p className={styles.hint}>{t('full', { max: MAX_MODIFIERS })}</p>}
    <p className={styles.hint}>{t('customHelp')}</p>
  </div>
}
