'use client'
import { useLocale } from 'next-intl'
import { assetName, type NoteAssetData } from '@/features/notes/lib/assets'
import GiftArtwork from '@/components/ui/GiftArtwork'
import IdentityCard from '@/features/catalog/components/IdentityCard'
import IdentitySkillFrameCard from '@/features/catalog/components/IdentitySkillFrameCard'
import EgoDisplayCard from '@/components/cards/EgoDisplayCard'
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
