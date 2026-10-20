'use client'
import { createContext, useContext, useMemo, useState, useId, type ReactNode } from 'react'
import useSWR from 'swr'
import { ChevronDown } from 'lucide-react'
import { useLocale } from 'next-intl'
import type { JSONContent } from '@tiptap/core'
import { assetRefs, visibleNode, type AssetKind } from '@/lib/notes/blocks'
import { assetName, type NoteAssetData } from '@/lib/notes/assets'
import GiftArtwork from '@/components/ui/GiftArtwork'
import IdentityCard from '@/components/sinners/IdentityCard'
import IdentitySkillFrameCard from '@/components/identity/IdentitySkillFrameCard'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import { KeywordWithTooltip, useKeywords } from '@/components/providers/KeywordProvider'
import { resolveKeywordTextColor } from '@/lib/keywords/text-color'
import { getLocalizedKeywordName, type SupportedLang } from '@/lib/i18n'
import { isNoteImageUrl } from '@/lib/notes/images'
import { mentionHref, type MentionKind } from '@/lib/notes/mention'
import QuietImage from '@/components/ui/QuietImage'
import { Link } from '@/lib/i18n/navigation'
import NoteTocLayout, { NoteHeadingLink } from './NoteToc'
import { NOTE_TOC_MIN, collectHeadings } from '@/lib/notes/toc'
import { isNoteColorSin } from '@/lib/notes/text-style'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import { NoteCardView } from './NoteCardBlock'

export async function fetchNoteAssets(url: string): Promise<NoteAssetData[]> {
  const r = await fetch(url)
  if (!r.ok) throw Error('Assets unavailable')
  return r.json()
}
const AssetContext = createContext<{data: Map<string, NoteAssetData>; loading: boolean; error: boolean; retry: () => void}>({data:new Map(),loading:false,error:false,retry:()=>{}})
/** Pages that own a gift modal provide this; the key is a gift id (blocks) or name (legacy tokens). */
export const NoteGiftClickContext = createContext<((key: string) => void) | null>(null)
export function NoteAssetsProvider({doc, children}:{doc:JSONContent; children:ReactNode}) {
  const refs = assetRefs(doc)
  const {data, error, isLoading, mutate} = useSWR(refs === '[]' ? null : ['note-assets',refs], async ([, value]) => {
    const entries = JSON.parse(value)
    const batches = []
    for (let i=0;i<entries.length;i+=50) batches.push(fetchNoteAssets(`/api/notes/assets?refs=${encodeURIComponent(JSON.stringify(entries.slice(i,i+50)))}`))
    return (await Promise.all(batches)).flat()
  }, {revalidateOnFocus:false, keepPreviousData:true})
  const map=useMemo(()=>new Map((data ?? []).map(a=>[`${a.kind}:${a.id}`,a])),[data])
  return <AssetContext.Provider value={{data:map,loading:isLoading,error:Boolean(error),retry:()=>{void mutate()}}}>{children}</AssetContext.Provider>
}
/** A keyword written in a memo: icon and name in the keyword's colour with its tooltip, inline like game text (no chip box). */
export function NoteKeywordLabel({id}:{id:string}) {
  const keywords=useKeywords(), lang=useLocale()
  const info=keywords[id]
  const name=info ? getLocalizedKeywordName(id,info,lang as SupportedLang) : id
  const color=resolveKeywordTextColor(name,info,id)
  return <KeywordWithTooltip keyword={name} krKey={info ? id : undefined} inline displayColor={color}><span style={{color,fontWeight:600}}>{name}</span></KeywordWithTooltip>
}
/** A gift written inside a sentence: its art at text height and its name in the keyword's colour; opens the gift. */
export function NoteGiftLabel({id,name}:{id:string;name?:string}) {
  const lang=useLocale(), {data}=useContext(AssetContext), onGiftClick=useContext(NoteGiftClickContext)
  const asset=data.get('gift:'+id)
  const label=asset ? assetName(asset,lang) : name || id
  const style={'--gift-color':GIFT_KEYWORD_COLORS[asset?.keyword ?? ''] ?? '#c8b898'} as React.CSSProperties
  const body=<>{asset?.image_url && <img src={asset.image_url} alt="" loading="lazy" decoding="async"/>}<strong>{label}</strong></>
  return onGiftClick && asset
    ? <button type="button" className="note-gift-label" style={style} onClick={()=>onGiftClick(id)}>{body}</button>
    : <span className="note-gift-label" style={style}>{body}</span>
}
/**
 * An identity or E.G.O named inside a sentence: its portrait and name as a chip. In the viewer it links to the page
 * (`linked`); the editor draws it as plain text so a click selects it. Without the asset only the saved name shows.
 */
export function NoteMentionLabel({kind,id,name,linked=true}:{kind:MentionKind;id:string;name?:string;linked?:boolean}) {
  const lang=useLocale(), {data}=useContext(AssetContext)
  const asset=data.get(`${kind}:${id}`)
  const sinnerId=asset?.identity?.sinner_id ?? asset?.sinnerId
  const body=<>{asset?.image_url && <QuietImage src={asset.image_url} alt="" width={20} height={20} sizes="1.25rem"/>}<span>{asset ? assetName(asset,lang) : name || id}</span></>
  return linked && asset && sinnerId
    ? <Link href={mentionHref(kind,id,sinnerId)} className="note-mention">{body}</Link>
    : <span className="note-mention">{body}</span>
}
export function NoteAssetArtwork({asset, compact=false}:{asset:NoteAssetData; compact?:boolean}) {
  const lang=useLocale(), name=assetName(asset,lang)
  if (asset.kind === 'gift') return <GiftArtwork gift={{...asset,keyword:asset.keyword ?? undefined}} displayName={name} sizes="96px" />
  if (asset.kind === 'identity' && asset.identity) return <IdentityCard identity={{...asset.identity,name_kr:name}} board compact disableHoverEffects />
  // The E.G.O card is laid out in fixed rem (9.5rem); on phones it shrinks to its quarter-row slot.
  if (asset.kind === 'ego' && asset.ego && asset.sinnerId) return <EgoDisplayCard ego={asset.ego} sinnerId={asset.sinnerId} name={name} lang={lang === 'en' || lang === 'ja' ? lang : 'ko'} displayOnly className="max-sm:[zoom:0.7]"/>
  if (asset.kind === 'skill' && asset.skill) return <IdentitySkillFrameCard skill={compact ? {...asset.skill,description:null,description_en:null,description_jp:null} : asset.skill} skills={asset.skills ?? [asset.skill]} identity={asset.identity} lang={lang} size={compact?'2.5rem':'3.5rem'} />
  return <span className={`note-asset-art note-asset-art--${asset.kind}`}>
    {/* Game URLs come only from the public, allowlisted asset endpoint. */}
    {asset.image_url && <img src={asset.image_url} alt={name} loading="lazy" decoding="async" />}
    {(asset.kind === 'sin' || asset.kind === 'keyword') && <span>{name}</span>}
  </span>
}
export function NoteAssetView({kind,id}:{kind:AssetKind;id:string}) {
  const lang=useLocale(), {data,loading,error,retry}=useContext(AssetContext), onGiftClick=useContext(NoteGiftClickContext)
  const asset=data.get(`${kind}:${id}`)
  if (!id) return null
  if (kind === 'gift' && asset && onGiftClick) return <button type="button" className="note-asset-view note-asset-view--gift cursor-pointer" onClick={()=>onGiftClick(id)}><NoteAssetArtwork asset={asset}/><span className="note-asset-caption">{assetName(asset,lang)}</span></button>
  return <div className={`note-asset-view note-asset-view--${kind}`}>
    {asset ? <><NoteAssetArtwork asset={asset}/>{!['identity','ego','skill','sin','keyword'].includes(kind) && <span className="note-asset-caption">{assetName(asset,lang)}</span>}</> : error ? <button type="button" onClick={retry}>{lang==='ko'?'다시 불러오기':lang==='ja'?'再読み込み':'Retry'}</button> : <span className="note-asset-unavailable" aria-busy={loading}>{loading ? '…' : lang==='ko'?'에셋을 찾을 수 없습니다':lang==='ja'?'データがありません':'Asset unavailable'}</span>}
  </div>
}
export function NoteVideo({id}:{id:string}) {
  const [playing,setPlaying]=useState(false), lang=useLocale()
  if (!/^[\w-]{11}$/.test(id)) return null
  const label=lang==='ko'?'유튜브 영상 재생':lang==='ja'?'YouTubeを再生':'Play YouTube video'
  return <div className="note-video">
    {playing ? <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`} title={label} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <button type="button" onClick={()=>setPlaying(true)} aria-label={label}><span className="note-video-play">▶</span><strong>YouTube</strong><span>{label}</span></button>}
    <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">{lang==='ko'?'YouTube에서 보기 ↗':lang==='ja'?'YouTubeで見る ↗':'Watch on YouTube ↗'}</a>
  </div>
}
function NoteAccordionView({title,children}:{title:ReactNode;children:ReactNode}) {
  const [open,setOpen]=useState(true), id=useId(), lang=useLocale()
  return <section className="note-accordion" data-open={open}>
    <div className="note-accordion-heading"><button type="button" aria-expanded={open} aria-controls={id} aria-label={lang==='ko'?'아코디언 접기 또는 펼치기':lang==='ja'?'アコーディオン開閉':'Toggle accordion'} onClick={()=>setOpen(!open)}><ChevronDown size={18}/></button><div>{title}</div></div>
    <div id={id} className="note-accordion-panel" inert={!open}><div><div className="note-accordion-body">{children}</div></div></div>
  </section>
}
export default function NoteBlockViewer({doc,renderText,anchors=false}:{doc:JSONContent;renderText:(text:string)=>ReactNode;/** Give the headings ids and a copy-link button, and a table of contents from three headings (detail pages, previews). */anchors?:boolean}) {
  const lang=useLocale(), tr=(ko:string,ja:string,en:string)=>lang==='ja'?ja:lang==='en'?en:ko
  const headings=useMemo(()=>anchors?collectHeadings(doc):[],[anchors,doc])
  const headingIds=useMemo(()=>headings.length>=NOTE_TOC_MIN?new Map(headings.map(h=>[h.node,h])):null,[headings])
  function render(n:JSONContent,key:string):ReactNode {
    // A text node of only spaces is the gap between two chips (or a chip and a word): it stays, the paragraph around it decides whether anything shows.
    if (!(n.type === 'text' && n.text) && !visibleNode(n) && !['horizontalRule','hardBreak','tableRow','tableCell','tableHeader'].includes(n.type ?? '')) return null
    const children=n.content?.map((c,i)=>render(c,`${key}-${i}`))
    if (n.type === 'text') {
      let result:ReactNode=renderText(n.text ?? '')
      for (const m of n.marks ?? []) {
        if(m.type==='bold') result=<strong>{result}</strong>
        if(m.type==='italic') result=<em>{result}</em>
        if(m.type==='strike') result=<s>{result}</s>
        if(m.type==='code') result=<code>{n.text}</code>
        if(m.type==='link') result=<a href={m.attrs?.href} target="_blank" rel="noopener noreferrer">{result}</a>
      }
      // The colour goes inside and the highlight outside whatever the saved order: the highlight lightens the colour it wraps (app/globals.css).
      const sin=(n.marks ?? []).find(m=>m.type==='noteColor')?.attrs?.sin
      if(isNoteColorSin(sin)) result=<span className="note-sin-color" data-note-color={sin} style={{'--note-sin':`var(--${sin})`} as React.CSSProperties}>{result}</span>
      if(n.marks?.some(m=>m.type==='highlight')) result=<mark className="note-highlight">{result}</mark>
      return <span key={key}>{result}</span>
    }
    switch(n.type) {
      case 'noteAccordion': return <NoteAccordionView key={key} title={n.content?.[0]?.content?.map((c,i)=>render(c,`${key}-title-${i}`)) || '…'}>{n.content?.[1]?.content?.map((c,i)=>render(c,`${key}-body-${i}`))}</NoteAccordionView>
      case 'noteCallout': { const variant = n.attrs?.variant === 'warning' ? 'warning' : 'tip'; return <aside key={key} className="note-callout" data-variant={variant}><div className="note-callout-head"><strong>{variant === 'warning' ? tr('주의', '注意', 'Warning') : tr('팁', 'ヒント', 'Tip')}</strong></div><div className="note-callout-body">{children}</div></aside> }
      case 'noteCard': return <NoteCardView key={key} kind={n.attrs!.kind} id={n.attrs!.id}/>
      case 'table': return <div key={key} className="note-block-table"><table><tbody>{children}</tbody></table></div>
      case 'tableRow': return <tr key={key}>{children}</tr>
      case 'tableCell': return <td key={key} colSpan={n.attrs?.colspan} rowSpan={n.attrs?.rowspan}>{children}</td>
      case 'tableHeader': return <th key={key} colSpan={n.attrs?.colspan} rowSpan={n.attrs?.rowspan}>{children}</th>
      case 'noteKeyword': return <NoteKeywordLabel key={key} id={n.attrs!.id}/>
      case 'noteGift': return <NoteGiftLabel key={key} id={n.attrs!.id} name={n.attrs?.name}/>
      case 'noteMention': return <NoteMentionLabel key={key} kind={n.attrs!.kind} id={n.attrs!.id} name={n.attrs?.name}/>
      case 'noteAsset': return <NoteAssetView key={key} kind={n.attrs!.kind} id={n.attrs!.id}/>
      case 'noteVideo': return <NoteVideo key={key} id={n.attrs!.videoId}/>
      case 'image': return isNoteImageUrl(n.attrs?.src) ? <img key={key} className="note-document-image" src={n.attrs!.src} alt={n.attrs?.alt ?? ''} loading="lazy"/> : null
      case 'heading': {
        const anchor=headingIds?.get(n), Tag=n.attrs?.level===1?'h2':'h3'
        return anchor ? <Tag key={key} id={anchor.id} className="note-heading">{children}<NoteHeadingLink id={anchor.id} text={anchor.text}/></Tag> : <Tag key={key}>{children}</Tag>
      }
      case 'paragraph': return <p key={key}>{children}</p>
      case 'bulletList': return <ul key={key}>{children}</ul>
      case 'orderedList': return <ol key={key} start={n.attrs?.start}>{children}</ol>
      case 'listItem': return <li key={key}>{children}</li>
      case 'blockquote': return <blockquote key={key}>{children}</blockquote>
      case 'codeBlock': return <pre key={key}><code>{n.content?.map(c=>c.text ?? '').join('')}</code></pre>
      case 'horizontalRule': return <hr key={key}/>
      case 'hardBreak': return <br key={key}/>
      default: return <div key={key}>{children}</div>
    }
  }
  return <NoteAssetsProvider doc={doc}><NoteTocLayout headings={headings}><div className="note-block-document">{doc.content?.map((n,i)=>render(n,String(i)))}</div></NoteTocLayout></NoteAssetsProvider>
}
