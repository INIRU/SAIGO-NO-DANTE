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
import { getLocalizedKeywordName, type SupportedLang } from '@/lib/i18n'
import { isNoteImageUrl } from '@/lib/notes/images'

export async function fetchNoteAssets(url: string): Promise<NoteAssetData[]> {
  const r = await fetch(url)
  if (!r.ok) throw Error('Assets unavailable')
  return r.json()
}
const AssetContext = createContext<{data: Map<string, NoteAssetData>; loading: boolean; error: boolean; retry: () => void}>({data:new Map(),loading:false,error:false,retry:()=>{}})
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
export function NoteKeywordLabel({id}:{id:string}) {
  const keywords=useKeywords(), lang=useLocale()
  const name=keywords[id] ? getLocalizedKeywordName(id,keywords[id],lang as SupportedLang) : id
  return <span className="note-keyword-label"><KeywordWithTooltip keyword={name} krKey={id} inline><strong>{name}</strong></KeywordWithTooltip></span>
}
export function NoteAssetArtwork({asset, compact=false}:{asset:NoteAssetData; compact?:boolean}) {
  const lang=useLocale(), name=assetName(asset,lang)
  if (asset.kind === 'gift') return <GiftArtwork gift={{...asset,keyword:asset.keyword ?? undefined}} displayName={name} sizes="96px" />
  if (asset.kind === 'identity' && asset.identity) return <IdentityCard identity={{...asset.identity,name_kr:name}} board compact disableHoverEffects />
  if (asset.kind === 'ego' && asset.ego && asset.sinnerId) return <EgoDisplayCard ego={asset.ego} sinnerId={asset.sinnerId} name={name} lang={lang === 'en' || lang === 'ja' ? lang : 'ko'} displayOnly/>
  if (asset.kind === 'skill' && asset.skill) return <IdentitySkillFrameCard skill={compact ? {...asset.skill,description:null,description_en:null,description_jp:null} : asset.skill} skills={asset.skills ?? [asset.skill]} identity={asset.identity} lang={lang} size={compact?'2.5rem':'3.5rem'} />
  return <span className={`note-asset-art note-asset-art--${asset.kind}`}>
    {/* Game URLs come only from the public, allowlisted asset endpoint. */}
    {asset.image_url && <img src={asset.image_url} alt={name} loading="lazy" decoding="async" />}
    {(asset.kind === 'sin' || asset.kind === 'keyword') && <span>{name}</span>}
  </span>
}
export function NoteAssetView({kind,id}:{kind:AssetKind;id:string}) {
  const lang=useLocale(), {data,loading,error,retry}=useContext(AssetContext)
  const asset=data.get(`${kind}:${id}`)
  if (!id) return null
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
export default function NoteBlockViewer({doc,renderText}:{doc:JSONContent;renderText:(text:string)=>ReactNode}) {
  function render(n:JSONContent,key:string):ReactNode {
    if (!visibleNode(n) && !['horizontalRule','hardBreak'].includes(n.type ?? '')) return null
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
      return <span key={key}>{result}</span>
    }
    switch(n.type) {
      case 'noteAccordion': return <NoteAccordionView key={key} title={n.content?.[0]?.content?.map((c,i)=>render(c,`${key}-title-${i}`)) || '…'}>{n.content?.[1]?.content?.map((c,i)=>render(c,`${key}-body-${i}`))}</NoteAccordionView>
      case 'noteKeyword': return <NoteKeywordLabel key={key} id={n.attrs!.id}/>
      case 'noteAsset': return <NoteAssetView key={key} kind={n.attrs!.kind} id={n.attrs!.id}/>
      case 'noteVideo': return <NoteVideo key={key} id={n.attrs!.videoId}/>
      case 'image': return isNoteImageUrl(n.attrs?.src) ? <img key={key} className="note-document-image" src={n.attrs!.src} alt={n.attrs?.alt ?? ''} loading="lazy"/> : null
      case 'heading': return n.attrs?.level===1?<h2 key={key}>{children}</h2>:<h3 key={key}>{children}</h3>
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
  return <NoteAssetsProvider doc={doc}><div className="note-block-document">{doc.content?.map((n,i)=>render(n,String(i)))}</div></NoteAssetsProvider>
}
