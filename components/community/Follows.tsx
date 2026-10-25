'use client'
import { useState } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import { goToLogin } from '@/lib/auth-return'
import useSWR, { useSWRConfig } from 'swr'
import { LockKeyhole, Users, X } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import BaseModal from '@/components/ui/BaseModal'
import { showError, showSuccess } from '@/lib/toast'

type FollowKind = 'following' | 'followers'
type FollowState = { owner:boolean; public_following:boolean; public_followers:boolean; following_count:number|null; follower_count:number|null; is_following:boolean; can_view:boolean; items:{id:string;username:string|null;avatar_url:string|null;bio:string|null;is_following:boolean;is_self:boolean}[] }
const endpoint = (id:string) => `/api/community/profiles/${id}/follows`
async function fetcher(url:string):Promise<FollowState> { const r=await fetch(url);if(!r.ok)throw Error();return r.json() }
function useCopy() {const lang=useLocale();return (ko:string,ja:string,en:string)=>lang==='ko'?ko:lang==='ja'?ja:en}
function useFollowMutation() {
  const {mutate}=useSWRConfig(), label=useCopy(), {status}=useSession(), lang=useLocale()
  const [busy,setBusy]=useState(false)
  async function change(id:string,following:boolean) {
    if(status!=='authenticated'){goToLogin(lang);return}
    if(busy)return
    setBusy(true)
    try { const r=await fetch(endpoint(id),{method:following?'DELETE':'POST'});if(!r.ok)throw Error();await mutate(k=>typeof k==='string'&&k.includes('/follows'));showSuccess(label(following?'팔로우를 취소했습니다.':'팔로우했습니다.',following?'フォローを解除しました。':'フォローしました。',following?'Unfollowed.':'Following.')) }
    catch {showError(label('변경하지 못했습니다. 다시 시도해주세요.','変更できません。再試行してください。','Could not update. Please retry.'))}
    finally {setBusy(false)}
  }
  return {busy,change}
}
export function FollowSummary({id,onOpen}:{id:string;onOpen?:(kind:FollowKind)=>void}) {
  const label=useCopy(), {data,error,mutate}=useSWR(endpoint(id),fetcher), {busy,change}=useFollowMutation()
  const [kind,setKind]=useState<FollowKind|null>(null)
  if(error)return <button className="community-link" onClick={()=>mutate()}>{label('팔로우 정보 다시 불러오기','再読み込み','Retry follow information')}</button>
  if(!data)return <p className="community-muted py-2" role="status">{label('팔로우 정보 불러오는 중','読み込み中','Loading follows')}</p>
  return <>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {(['following','followers'] as const).map(k=>{const count=k==='following'?data.following_count:data.follower_count;return <button key={k} disabled={count===null} className="inline-flex min-h-11 items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--gold)] disabled:cursor-default" onClick={()=>onOpen ? onOpen(k) : setKind(k)}>{k==='following'?label('팔로잉','フォロー中','Following'):label('팔로워','フォロワー','Followers')}{count===null?<LockKeyhole size={13} aria-label={label('비공개','非公開','Private')}/>:<strong className="font-medium tabular-nums text-[var(--gold)]">{count}</strong>}</button>})}
      {!data.owner && <button className={`community-button ${data.is_following?'':'primary'}`} disabled={busy} aria-pressed={data.is_following} onClick={()=>change(id,data.is_following)}>{data.is_following?label('팔로잉','フォロー中','Following'):label('팔로우','フォロー','Follow')}</button>}
    </div>
    <BaseModal open={kind!==null} onClose={()=>setKind(null)} title={label('팔로우','フォロー','Follows')}>
      <div className="rounded-lg bg-[var(--bg-panel)] p-5 text-[var(--text-primary)]">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{label('팔로우','フォロー','Follows')}</h2><button className="community-icon-button" onClick={()=>setKind(null)} aria-label={label('닫기','閉じる','Close')}><X size={18}/></button></div>
        {kind && <FollowList id={id} initialKind={kind}/>}
      </div>
    </BaseModal>
  </>
}
export function FollowList({id,initialKind='following'}:{id:string;initialKind?:FollowKind}) {
  const label=useCopy(), [kind,setKind]=useState<FollowKind>(initialKind), [offset,setOffset]=useState(0)
  const {data,error,mutate}=useSWR(`${endpoint(id)}?kind=${kind}&offset=${offset}`,fetcher)
  const {busy,change}=useFollowMutation()
  return <section className="min-w-0" aria-label={label('팔로우 목록','フォローリスト','Follow list')}>
    <div className="mb-4 flex gap-3" role="group" aria-label={label('목록 종류','リストの種類','List type')}>
      {(['following','followers'] as const).map(k=><button key={k} className={`community-button ${kind===k?'text-[var(--gold)] bg-[var(--gold)]/10':''}`} aria-pressed={kind===k} onClick={()=>{setKind(k);setOffset(0)}}><Users size={16}/>{k==='following'?label('팔로잉','フォロー中','Following'):label('팔로워','フォロワー','Followers')}</button>)}
    </div>
    {error?<button className="community-button" onClick={()=>mutate()}>{label('다시 불러오기','再読み込み','Retry')}</button>:!data?<p role="status" className="community-muted py-8">{label('불러오는 중…','読み込み中…','Loading…')}</p>:!data.can_view?<p className="flex items-center gap-2 py-8 text-sm text-[var(--text-muted)]"><LockKeyhole size={18}/>{label('비공개 목록입니다.','非公開のリストです。','This list is private.')}</p>:<>
      {!data.items.length?<p className="community-muted py-8">{label('아직 목록에 관리자가 없습니다.','まだユーザーがいません。','No managers in this list yet.')}</p>:<ul className="max-h-[55dvh] space-y-2 overflow-y-auto">
        {data.items.map(person=><li key={person.id} className="flex items-center gap-3 rounded-md bg-white/[0.025] p-3">
          <Link href={`/users/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3"><Image src={person.avatar_url||DEFAULT_AVATAR_URL} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover"/><span className="min-w-0"><strong className="block truncate text-sm font-medium">{person.username||label('관리자','管理人','Manager')}</strong><span className="block truncate text-xs text-[var(--text-muted)]">{person.bio}</span></span></Link>
          {!person.is_self && <button className="community-button" disabled={busy} aria-label={`${person.username||label('관리자','管理人','Manager')} ${person.is_following?label('팔로우 취소','解除','Unfollow'):label('팔로우','フォロー','Follow')}`} aria-pressed={person.is_following} onClick={()=>change(person.id,person.is_following)}>{person.is_following?label('팔로잉','フォロー中','Following'):label('팔로우','フォロー','Follow')}</button>}
        </li>)}
      </ul>}
      {(offset>0 || data.items.length===25)&&<div className="mt-4 flex justify-end gap-2"><button className="community-button" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-25))}>{label('이전','前へ','Previous')}</button><button className="community-button" disabled={data.items.length<25} onClick={()=>setOffset(n=>n+25)}>{label('다음','次へ','Next')}</button></div>}
    </>}
  </section>
}
