'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { StoryNode, StorySubchapter, StoryUnit, Texts } from '@/lib/story-map'
import { SIN_ICON_MAP } from '@/lib/constants/sin'
import AttackTypeIcon from '@/components/ui/AttackTypeIcon'
import { MAP_COPY as L, effectiveWeaknesses as effective, mapText as text, type Lang } from '@/features/story'

/** The picked stage, built from the game's own stage info pieces: its see-through plate (info-plate, fading into the
 * map on the left), the inner bronze frame for the stage facts (info-frame) and the portrait frame of every enemy
 * (enemy-frame). The title band keeps the stage's card picture behind its number. */
export default function StagePanel({ node, sub, base, lang, spoiler, onClose, note, action, story }: {
  node: StoryNode; sub: StorySubchapter; base: string; lang: Lang; spoiler: boolean; onClose: () => void
  /** Shown instead of the story-stage line when there is no battle (dungeon rooms) */
  note?: string
  /** Under the title: the button into a dungeon */
  action?: React.ReactNode
  /** A dungeon room's story (the game's room panel 스토리 text) */
  story?: Texts
}) {
  const s = L[lang]
  // Past the reader's progress: no picture, no title, no enemies.
  const b = spoiler ? undefined : node.battle
  const eff = effective(node, sub)
  const [wave, setWave] = useState(0)
  // No per-enemy cover (USER 2026-11-09): the chapter and stage spoiler guards hide what is not reached yet
  const units = b?.waves[wave] ?? []
  return (
    // As in the game: see-through black over a blurred map, a plain edge on the map side. (A mask on top of
    // backdrop-filter makes Chrome drop the whole panel.)
    <aside className="story-panel-in absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto overscroll-contain border-t border-[var(--border)] bg-[#050403]/[.93] px-4 pb-6 pt-4 backdrop-blur-md @3xl:inset-x-auto @3xl:bottom-0 @3xl:right-0 @3xl:top-0 @3xl:max-h-none @3xl:w-[min(32rem,46cqw)] @3xl:border-l @3xl:border-t-0 @3xl:px-8 @3xl:py-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/s/${node.tag}.webp`} alt="" aria-hidden className="pointer-events-none absolute bottom-10 right-10 w-44 opacity-[0.08]" />
      <button type="button" onClick={onClose} aria-label={s.close}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] @3xl:right-6 @3xl:top-5"><X size={20} /></button>

      <header className="relative -mx-2 overflow-hidden px-2 pb-3 pt-2">
        {node.cg && !spoiler && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${base}/cg/${node.id}.webp`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 [mask-image:linear-gradient(90deg,transparent,#000_30%,#000_70%,transparent)]" />
        )}
        <div className="relative flex items-end gap-3 border-b border-[#5a4526] pb-2 pr-10">
          <span className="shrink-0 whitespace-nowrap font-[family-name:var(--font-title)] text-[3.25rem] leading-[0.85] text-[#f3e4cb] @3xl:text-[3.75rem]">{node.label}</span>
          <h2 className="min-w-0 break-keep pb-0.5 font-[family-name:var(--font-heading)] text-[1.5rem] leading-tight text-[#f3e4cb] @3xl:text-[1.75rem]">{spoiler ? '???' : text(node.title, lang)}</h2>
        </div>
      </header>

      {!spoiler && action}
      {!spoiler && story && text(story, lang) && (
        <p className="relative mt-3 break-keep text-[0.9375rem] leading-relaxed text-[#cfc3ad]">{text(story, lang)}</p>
      )}
      {!spoiler && node.endings ? (
        <Endings endings={node.endings} sub={sub} base={base} lang={lang} />
      ) : !b ? (
        !(action && !spoiler) && <p className="relative mt-5 text-[0.9375rem] text-[var(--text-secondary)]">{spoiler ? s.spoiler : note ?? s.storyOnly}</p>
      ) : (
        <div className="relative">
          {/* The info line of the site's game info windows (DESIGN.md 5): items side by side, split by a --border
              line, no box or chip. */}
          <ul className="mt-3 flex flex-wrap items-center gap-y-2 text-[0.875rem] leading-none [&>li]:flex [&>li]:items-center [&>li]:gap-1.5 [&>li]:border-[var(--border)] [&>li:not(:first-child)]:border-l [&>li:not(:first-child)]:pl-3 [&>li:not(:last-child)]:pr-3">
            <li>
              <span className="text-[#9c8b73]">{s.recommended}</span>
              {/* 0 in the data: the game prints LV.?? */}
              <span className="font-[family-name:var(--font-title)] text-[1.375rem] text-[var(--gold-light)]">LV.{b.recommended || '??'}</span>
            </li>
            {eff.atk.length + eff.sin.length > 0 && (
              <li>
                <span className="text-[#9c8b73]">{s.effective}</span>
                {eff.atk.map(e => (
                  <span key={e.key} className="flex items-center gap-1 text-[var(--text-primary)]"><AttackTypeIcon type={e.icon} className="h-5 w-5" />{s.atk[e.icon]}</span>
                ))}
                {eff.sin.map(e => (
                  <span key={e.key} className="flex items-center gap-1 text-[var(--text-primary)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SIN_ICON_MAP[e.sin]} alt="" className="h-5 w-5 object-contain" />{s.sin[e.sin]}
                  </span>
                ))}
              </li>
            )}
            {b.ex?.map((q, i) => (
              <li key={i}>
                <span className="text-[#9c8b73]">EX</span>
                <span className="break-keep text-[var(--text-primary)]">{text(q, lang)}</span>
              </li>
            ))}
            {b.boss && <li className="text-[#ec6a5e]">{s.boss}</li>}
            {/* 99 turns = no limit in the data */}
            {b.turnLimit != null && b.turnLimit < 99 && <li className="text-[var(--text-secondary)]">{s.turnLimit(b.turnLimit)}</li>}
          </ul>

          {/* Section title of the site's info windows: the title, a --border line to the right edge, controls at the end. */}
          <div className="mt-6 flex items-center gap-3">
            <h3 className="shrink-0 font-[family-name:var(--font-heading)] text-[1.125rem] leading-none text-[var(--text-primary)]">{s.enemies}</h3>
            <span aria-hidden className="h-px flex-1 bg-[var(--border)]" />
            {b.waves.length > 1 && (
              // Waves: bare Bebas numbers at the end of the title line, the shown one in gold.
              <div role="tablist" aria-label={s.enemies} className="-my-2 flex shrink-0">
                {b.waves.map((_, w) => (
                  <button key={w} type="button" role="tab" aria-selected={w === wave} aria-label={s.wave(w + 1)} onClick={() => setWave(w)}
                    className={`flex h-9 min-w-9 items-center justify-center font-[family-name:var(--font-title)] text-[1.375rem] leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${w === wave ? 'text-[var(--gold-light)]' : 'text-[#94887a] hover:text-[var(--text-primary)]'}`}>
                    {w + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ul key={wave} className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4 @min-[40rem]:grid-cols-4 @3xl:grid-cols-3">
            {units.map((u, j) => {
              return <EnemyCard key={j} u={u} j={j} sub={sub} base={base} lang={lang} />
            })}
          </ul>
        </div>
      )}

    </aside>
  )
}

/** One enemy: the game's enemy info card, a head crop of the unit portrait inside its bronze portrait frame. */
function EnemyCard({ u, j, sub, base, lang }: {
  u: StoryUnit; j: number; sub: StorySubchapter; base: string; lang: Lang
}) {
  const s = L[lang]
  const e = sub.enemies[String(u.id)]
  const name = text(e?.name, lang) || '???'
  return (
    <li className="story-rise group min-w-0" style={{ '--i': j } as React.CSSProperties}>
      <div className={`relative aspect-[279/361] ${u.hidden ? 'opacity-60' : ''}`}>
        <div className="absolute inset-[5%] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#2e261d,#0f0c08)]">
          {e?.portrait
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`${base}/portrait/${e.portrait}.webp`} alt="" loading="lazy" className="absolute left-1/2 top-[-4%] h-[170%] w-auto max-w-none -translate-x-1/2 transition-transform duration-300 group-hover:scale-[1.04]" />
            : e?.sd
            // no portrait in the game: its battle figure, whole, fitted into the card
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`${base}/sd/${e.sd}.webp`} alt="" loading="lazy" className="absolute inset-[6%] h-[88%] w-[88%] object-contain object-bottom transition-transform duration-300 group-hover:scale-[1.04]" />
            : <span className="flex h-full items-center justify-center font-[family-name:var(--font-title)] text-[2rem] text-[#5a4526]">?</span>}
          <span className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(transparent,#0b0906)]" aria-hidden />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}/ui/enemy-frame.webp`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
        {u.count > 1 && (
          <span className="absolute -right-1 -top-1 bg-[#8a0b0b] px-1.5 py-0.5 font-[family-name:var(--font-title)] text-[1.0625rem] leading-none text-[#f3e4cb] shadow-[0_1px_3px_#000]">×{u.count}</span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 break-keep text-center font-[family-name:var(--font-heading)] text-[0.8125rem] leading-[1.4] text-[var(--text-primary)]" title={u.hidden ? `${name} (${s.hidden})` : name}>{name}</p>
      {e?.desc && <p className="truncate text-center text-[0.6875rem] leading-[1.4] text-[#94887a]">{text(e.desc, lang)}</p>}
    </li>
  )
}

/** A floor's battles; the same enemies on one floor shown once (VIEWER). */
function battlesOf(battles: NonNullable<StoryNode['endings']>[number]['floors'][number]['battles']) {
  const seen = new Set<string>()
  return battles.filter(bt => {
    const k = bt.waves.map(w => w.map(u => `${u.id}x${u.count}`).join('+')).join('|')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** 10장 시지프 백화점: the store is walked in RPG mode (not drawn here); its battles, by ending and floor. */
function Endings({ endings, sub, base, lang }: {
  endings: NonNullable<StoryNode['endings']>; sub: StorySubchapter; base: string; lang: Lang
}) {
  const s = L[lang]
  const [pick, setPick] = useState(0)
  const ending = endings[pick] ?? endings[0]
  return (
    <div className="relative">
      <p className="mt-3 break-keep text-[0.9375rem] leading-relaxed text-[#cfc3ad]">{s.endingNote}</p>
      <div className="mt-6 flex items-center gap-3">
        <h3 className="shrink-0 font-[family-name:var(--font-heading)] text-[1.125rem] leading-none text-[var(--text-primary)]">{s.ending}</h3>
        <span aria-hidden className="h-px flex-1 bg-[var(--border)]" />
        <div role="tablist" aria-label={s.ending} className="-my-2 flex shrink-0">
          {endings.map((e, i) => (
            <button key={e.key} type="button" role="tab" aria-selected={i === pick} aria-label={`${s.ending} ${e.key}`} onClick={() => setPick(i)}
              className={`flex h-9 min-w-9 items-center justify-center font-[family-name:var(--font-title)] text-[1.375rem] leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${i === pick ? 'text-[var(--gold-light)]' : 'text-[#94887a] hover:text-[var(--text-primary)]'}`}>
              {e.key}
            </button>
          ))}
        </div>
      </div>
      <div key={ending.key} role="tabpanel" className="story-panel-in">
        {ending.floors.map((f, fi) => (
          <section key={fi} className="mt-5">
            {f.floor ? <h4 className="font-[family-name:var(--font-title)] text-[1.75rem] leading-none text-[var(--gold-light)]">{f.floor}</h4>
              : <h4 className="font-[family-name:var(--font-heading)] text-[1.125rem] leading-none text-[var(--gold-light)]">{s.otherFloor}</h4>}
            <ol className="mt-2 space-y-4">
              {battlesOf(f.battles).map(bt => (
                <li key={bt.id} className="flex gap-3">
                  <span className="w-12 shrink-0 pt-1 font-[family-name:var(--font-title)] text-[1.125rem] leading-none text-[#9c8b73]">LV.{bt.recommended || bt.level || '??'}</span>
                  <ul className="grid flex-1 grid-cols-4 gap-x-2.5 gap-y-3 @min-[40rem]:grid-cols-5 @3xl:grid-cols-4">
                    {bt.waves.flat().map((u, j) => (
                      <EnemyCard key={j} u={u} j={j} sub={sub} base={base} lang={lang} />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}
