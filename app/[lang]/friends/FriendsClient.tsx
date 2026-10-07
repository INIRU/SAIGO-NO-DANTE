'use client'

import { useState } from 'react'
import SupportStrips, { type SupportSlot } from '@/components/friends/SupportStrips'
import SupportSlotPicker from '@/components/friends/SupportSlotPicker'

const VISIBILITY = [['public', '누구나'], ['members', '로그인한 사람'], ['exchange', '코드를 준 사람']] as const

/** Screen prototype: the line-up is edited in the browser only; saving and the list come with the API. */
export default function FriendsClient() {
  const [slots, setSlots] = useState<(SupportSlot | null)[]>(() => Array(12).fill(null))
  const [picking, setPicking] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [visibility, setVisibility] = useState<typeof VISIBILITY[number][0]>('public')
  const mono = { font: '400 1.5rem/1 var(--font-mikodacs), Impact, sans-serif', letterSpacing: '0.06em' } as const
  return <main style={{ maxWidth: '78rem', margin: '0 auto', padding: '1.75rem 1.25rem 4rem', color: 'var(--text-primary)' }}>
    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>친구 코드</h1>
    <section style={{ marginTop: '1.6rem', padding: '1.25rem 1.25rem 1.4rem', background: '#120e09', border: '1px solid #5a4526' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>내 친구 코드
          <input value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="A000000000" inputMode="text" autoComplete="off"
            style={{ ...mono, height: '2.75rem', width: '15rem', padding: '0 0.8rem', background: '#070604', border: '1px solid #5a4526', color: 'var(--gold-light)' }} />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>코드를 볼 수 있는 사람
          <div style={{ display: 'flex' }}>
            {VISIBILITY.map(([value, label]) => <button type="button" key={value} aria-pressed={visibility === value} onClick={() => setVisibility(value)}
              style={{ height: '2.75rem', padding: '0 0.9rem', marginLeft: '-1px', border: `1px solid ${visibility === value ? 'var(--gold)' : 'var(--border)'}`, position: 'relative', zIndex: visibility === value ? 1 : 0,
                background: 'none', fontSize: '0.85rem', fontWeight: 700, color: visibility === value ? 'var(--gold-light)' : 'var(--text-secondary)', cursor: 'pointer' }}>{label}</button>)}
          </div>
        </div>
      </div>
      <SupportStrips slots={slots} onPick={setPicking} />
      <p style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: '#e0857c' }}>다른 사람의 친구 코드나 가짜 코드를 올리면 이용이 정지됩니다.</p>
    </section>
    {picking !== null && <SupportSlotPicker index={picking} value={slots[picking]} onClose={() => setPicking(null)}
      onDone={slot => { setSlots(current => current.map((item, at) => at === picking ? slot : item)); setPicking(null) }} />}
  </main>
}
