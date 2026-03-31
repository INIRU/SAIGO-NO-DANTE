'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ExternalLink, ChevronDown, Bell, HelpCircle } from 'lucide-react'

import { STORAGE_BASE } from '@/lib/constants/game'

const BOT_AVATAR = '/icons/icon-192x192.png'
const S = STORAGE_BASE

function I({ src, s = 16 }: { src: string; s?: number }) {
  return <Image src={src} alt="" width={s} height={s} style={{ width: `${s / 16}rem`, height: `${s / 16}rem`, display: 'inline', verticalAlign: 'middle', objectFit: 'contain' }} />
}
function Code({ children }: { children: React.ReactNode }) {
  return <code style={{ background: '#0d0b08', padding: '0.0625rem 0.25rem', borderRadius: '0.1875rem', color: '#e8dcc8', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{children}</code>
}
function V2({ accent, children }: { accent: string; children: React.ReactNode }) {
  return <div className="rounded-lg overflow-hidden" style={{ background: '#111110', borderLeft: `0.1875rem solid ${accent}`, maxWidth: '28rem', width: '100%' }}>{children}</div>
}
function V2Head({ children, thumb }: { children: React.ReactNode; thumb?: string }) {
  return <div className="flex items-start justify-between" style={{ padding: '0.75rem 0.875rem 0.375rem' }}><div>{children}</div>{thumb && <Image src={thumb} alt="" width={64} height={64} className="rounded-md ml-3 flex-shrink-0" style={{ width: '4rem', height: '4rem', objectFit: 'cover' }} />}</div>
}
function V2Body({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '0.25rem 0.875rem', color: '#b0a898', fontSize: '0.8125rem', lineHeight: 1.7 }}>{children}</div>
}
function V2Line() { return <div style={{ margin: '0.375rem 0.875rem', borderTop: '1px solid #222' }} /> }
function V2Btn({ items }: { items: { label: string; primary?: boolean }[] }) {
  return <div className="flex flex-wrap gap-1.5" style={{ padding: '0.5rem 0.875rem' }}>{items.map((b, i) => <span key={i} className="rounded-md" style={{ background: b.primary ? '#5865f2' : '#1a1a1a', color: b.primary ? '#fff' : '#aaa', fontSize: '0.75rem', padding: '0.3125rem 0.75rem', fontWeight: 500 }}>{b.label}</span>)}</div>
}
function V2Foot({ text }: { text: string }) { return <div style={{ padding: '0.25rem 0.875rem 0.625rem', color: '#5865f2', fontSize: '0.625rem' }}>{text}</div> }
function V2Drop({ text }: { text: string }) {
  return <div style={{ padding: '0.25rem 0.875rem 0.625rem' }}><div className="rounded-md flex items-center justify-between" style={{ background: '#0d0b08', border: '1px solid #222', padding: '0.5rem 0.75rem', color: '#b0a898', fontSize: '0.8125rem' }}>{text} <ChevronDown style={{ width: '0.875rem', height: '0.875rem', color: '#666' }} /></div></div>
}
function BotTag() {
  return <div className="flex items-center gap-2 mb-2"><Image src={BOT_AVATAR} alt="" width={24} height={24} className="rounded-full" style={{ width: '1.5rem', height: '1.5rem' }} /><span style={{ color: '#c8900a', fontWeight: 600, fontSize: '0.75rem' }}>최애의 관리자</span><span style={{ color: '#c8900a', fontSize: '0.4375rem', fontWeight: 700, background: '#c8900a20', padding: '0.0625rem 0.1875rem', borderRadius: '0.125rem' }}>BOT</span></div>
}

// ── 슬라이드 ──
interface Slide { node: React.ReactNode }
const SLIDES: Slide[] = [
  // 0: Hero
  { node: (
    <div className="text-center">
      <Image src={BOT_AVATAR} alt="" width={80} height={80} className="rounded-2xl mx-auto mb-6" style={{ width: '5rem', height: '5rem', boxShadow: '0 0 60px #c8900a10' }} />
      <h1 className="font-serif" style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)', color: '#e8dcc8', letterSpacing: '-0.02em' }}>최애의 관리자</h1>
      <p style={{ color: '#8a6010', fontSize: '0.875rem', marginTop: '0.375rem', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em' }}>SAIGO NO DANTE — DISCORD BOT</p>
      <p style={{ color: '#666', fontSize: '0.875rem', maxWidth: '26rem', margin: '1.25rem auto 0', lineHeight: 1.8 }}>림버스 컴퍼니 인격 · E.G.O · 키워드 · 기프트 정보를 디스코드에서 바로 확인하세요</p>
      <div className="flex flex-wrap justify-center gap-3 mt-8">
        <a href="https://discord.com/oauth2/authorize?client_id=1482245554598576221&permissions=0&integration_type=0&scope=bot+applications.commands" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all hover:brightness-110 hover:scale-105" style={{ background: '#5865f2', color: '#fff' }}>봇 초대하기 <ExternalLink style={{ width: '0.75rem', height: '0.75rem' }} /></a>
        <a href="https://discord.gg/efaGjQwsVB" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all hover:brightness-110 hover:scale-105" style={{ border: '1px solid #5865f250', color: '#7289da' }}>서버 참여 <ExternalLink style={{ width: '0.75rem', height: '0.75rem' }} /></a>
        <Link href="/" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all hover:brightness-110" style={{ border: '1px solid #c8900a30', color: '#c8900a' }}><ArrowLeft style={{ width: '0.75rem', height: '0.75rem' }} /> 사이트</Link>
      </div>
    </div>
  )},
  // 1: 인격
  { node: (
    <div className="max-w-5xl mx-auto w-full"><div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
      <div className="flex-shrink-0"><BotTag /><V2 accent="#c8900a"><V2Head thumb={`${S}/sinners/yi-sang/identities/The%20House%20of%20Spiders%20The%20Index%20Nursefather/10115_normal_info.webp`}><div style={{ color: '#e8dcc8', fontWeight: 700, fontSize: '0.9375rem' }}><I src={`${S}/icons/Rarity/3star.webp`} s={18} /> 거미집 검지 아비</div><div style={{ color: '#8a8a7a', fontSize: '0.75rem', marginTop: '0.1875rem' }}><I src={`${S}/icons/Sinners/yi-sang.webp`} s={16} /> 이상 · 검지</div></V2Head><V2Line /><V2Body><div><I src={`${S}/icons/stats/blunt.webp`} s={15} /> <Code>248</Code>{'  '}<I src={`${S}/icons/Sins/transparent/Sloth.webp`} s={15} /> <Code>3-8</Code>{'  '}<I src={`${S}/icons/stats/pierce.webp`} s={15} /> <Code>62</Code></div><div style={{ marginTop: '0.125rem' }}><I src={`${S}/icons/stats/slash.webp`} s={14} /> 내성{'  '}<I src={`${S}/icons/stats/pierce.webp`} s={14} /> 취약{'  '}<I src={`${S}/icons/stats/blunt.webp`} s={14} /> 보통</div></V2Body><V2Line /><V2Body><div><span style={{ fontWeight: 700, color: '#e8dcc8' }}>S1 얼어붙은 피를 삼백삼십 휘감아</span></div><div><I src={`${S}/icons/Sins/transparent/Lust.webp`} s={14} /> <I src={`${S}/icons/stats/blunt.webp`} s={14} /> 기본 3 / 코인 +4 / ×2 / 공레 62</div><div style={{ marginTop: '0.375rem' }}><span style={{ fontWeight: 700, color: '#e8dcc8' }}>S2 소리 없이 손뼉 쳐 즐기고</span></div><div><I src={`${S}/icons/Sins/transparent/Gluttony.webp`} s={14} /> <I src={`${S}/icons/stats/pierce.webp`} s={14} /> 기본 4 / 코인 +4 / ×3 / 공레 63</div><div style={{ marginTop: '0.375rem' }}><span style={{ fontWeight: 700, color: '#e8dcc8' }}>S3 날 세워 칼을 웃거라</span></div><div><I src={`${S}/icons/Sins/transparent/Envy.webp`} s={14} /> <I src={`${S}/icons/stats/slash.webp`} s={14} /> 기본 4 / 코인 +3 / ×4 / 공레 64</div></V2Body><V2Btn items={[{ label: '스킬 상세', primary: true }, { label: '패시브' }, { label: '3동기화 보기' }, { label: '수비 (회피)' }]} /><V2Foot text="saigo-no-dante.com | 최애의 관리자" /><V2Drop text="거미집 검지 아비" /></V2></div>
      <div className="flex-1 min-w-0"><span style={{ color: '#c8900a', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', fontFamily: 'var(--font-heading)' }}>인격 정보</span><h2 className="font-serif mt-2 mb-4" style={{ fontSize: '1.75rem', color: '#e8dcc8', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{'스킬, 스탯, 내성을\n한눈에 확인'}</h2><p style={{ color: '#777', fontSize: '0.875rem', lineHeight: 1.8 }}>인격의 스킬 구성, 코인 위력, 공격 레벨, 내성까지 한 번에 조회합니다.</p><div className="mt-4" style={{ fontFamily: 'var(--font-mono)', color: '#5865f2', fontSize: '0.8125rem', background: '#5865f208', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', display: 'inline-block' }}>/인격 거미집 검지 아비 이상</div></div>
    </div></div>
  )},
  // 2: 키워드
  { node: (
    <div className="max-w-5xl mx-auto w-full"><div className="flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16">
      <div className="flex-shrink-0"><BotTag /><V2 accent="#c83030"><V2Head thumb={`${S}/icons/keywords/bleed.webp`}><div style={{ color: '#e8dcc8', fontWeight: 700, fontSize: '0.9375rem' }}><I src={`${S}/icons/keywords/bleed.webp`} s={18} /> 출혈</div><div style={{ color: '#b0a898', fontSize: '0.75rem', marginTop: '0.25rem', lineHeight: 1.5 }}>턴 종료 시 (출혈 위력 × 출혈 횟수) 피해<br />피격 시 출혈 횟수 1 차감</div><div style={{ color: '#666', fontSize: '0.6875rem', marginTop: '0.1875rem' }}>최대 스택: 99</div></V2Head><V2Line /><V2Body><div style={{ color: '#666', fontSize: '0.6875rem', fontWeight: 600, marginBottom: '0.25rem' }}>보유 인격 (28개)</div><div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> <I src={`${S}/icons/Sinners/yi-sang.webp`} s={14} /> R사 4과 이상</div><div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> <I src={`${S}/icons/Sinners/faust.webp`} s={14} /> W사 3과 파우스트</div><div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> <I src={`${S}/icons/Sinners/heathcliff.webp`} s={14} /> 쐐기 사무소 히스클리프</div><div style={{ color: '#444', fontSize: '0.6875rem' }}>...외 25명</div></V2Body><V2Btn items={[{ label: '◀ 이전' }, { label: '1 / 3' }, { label: '다음 ▶' }]} /></V2></div>
      <div className="flex-1 min-w-0"><span style={{ color: '#c8900a', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', fontFamily: 'var(--font-heading)' }}>키워드 검색</span><h2 className="font-serif mt-2 mb-4" style={{ fontSize: '1.75rem', color: '#e8dcc8', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{'키워드 설명과\n보유 인격을 한번에'}</h2><p style={{ color: '#777', fontSize: '0.875rem', lineHeight: 1.8 }}>키워드의 효과와 최대 스택을 확인하고, 보유 인격 목록을 탐색합니다.</p><div className="mt-4" style={{ fontFamily: 'var(--font-mono)', color: '#5865f2', fontSize: '0.8125rem', background: '#5865f208', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', display: 'inline-block' }}>/키워드 출혈</div></div>
    </div></div>
  )},
  // 3: 기프트
  { node: (
    <div className="max-w-5xl mx-auto w-full"><div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
      <div className="flex-shrink-0"><BotTag /><V2 accent="#c8900a"><V2Head thumb={`${S}/ego-gifts/ego-gift-aebc9e2c.webp`}><div style={{ color: '#e8dcc8', fontWeight: 700, fontSize: '0.9375rem' }}>달의 기억</div><div style={{ color: '#8a8a7a', fontSize: '0.75rem', marginTop: '0.125rem' }}>Ⅴ · 공통 · 비용 999</div></V2Head><V2Line /><V2Body><div style={{ color: '#666', fontSize: '0.6875rem', fontWeight: 600 }}>기본 효과</div><div>모든 적(환상체일 경우, 모든 부위)의 물리 내성과 속성 내성이 취약으로 변경됨.</div></V2Body><V2Btn items={[{ label: '기본', primary: true }]} /></V2></div>
      <div className="flex-1 min-w-0"><span style={{ color: '#c8900a', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', fontFamily: 'var(--font-heading)' }}>EGO 기프트</span><h2 className="font-serif mt-2 mb-4" style={{ fontSize: '1.75rem', color: '#e8dcc8', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{'기프트 효과를\n바로 확인'}</h2><p style={{ color: '#777', fontSize: '0.875rem', lineHeight: 1.8 }}>거울 던전 EGO 기프트의 등급, 키워드, 효과를 한눈에 조회합니다.</p><div className="mt-4" style={{ fontFamily: 'var(--font-mono)', color: '#5865f2', fontSize: '0.8125rem', background: '#5865f208', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', display: 'inline-block' }}>/기프트 달의 기억</div></div>
    </div></div>
  )},
  // 4: 수감자
  { node: (
    <div className="max-w-5xl mx-auto w-full"><div className="flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16">
      <div className="flex-shrink-0"><BotTag /><V2 accent="#c8900a"><V2Head thumb={`${S}/icons/Sinners/faust.webp`}><div style={{ color: '#e8dcc8', fontWeight: 700, fontSize: '0.9375rem' }}><I src={`${S}/icons/Sinners/faust.webp`} s={18} /> 파우스트 <span style={{ color: '#666', fontSize: '0.75rem', fontWeight: 400 }}>(Faust)</span></div><div style={{ color: '#8a8a7a', fontSize: '0.6875rem', marginTop: '0.125rem' }}>📖 파우스트 — 요한 볼프강 폰 괴테</div></V2Head><V2Line /><V2Body><div style={{ color: '#666', fontSize: '0.6875rem', fontWeight: 600, marginBottom: '0.25rem' }}>인격 (14개)</div><div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> 로보토미 E.G.O::후회</div><div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> W사 3과</div><div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> 7 K사</div><div style={{ color: '#444', fontSize: '0.6875rem' }}>...외 11명</div></V2Body><V2Drop text="📋 인격 상세 보기" /><V2Line /><V2Drop text="🔮 E.G.O 상세 보기 (9개)" /><V2Foot text="saigo-no-dante.com | 최애의 관리자" /></V2></div>
      <div className="flex-1 min-w-0"><span style={{ color: '#c8900a', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', fontFamily: 'var(--font-heading)' }}>수감자 목록</span><h2 className="font-serif mt-2 mb-4" style={{ fontSize: '1.75rem', color: '#e8dcc8', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{'인격과 E.G.O를\n드롭다운으로 탐색'}</h2><p style={{ color: '#777', fontSize: '0.875rem', lineHeight: 1.8 }}>수감자의 보유 인격과 E.G.O 목록을 한눈에 보고 상세 정보에 접근합니다.</p><div className="mt-4" style={{ fontFamily: 'var(--font-mono)', color: '#5865f2', fontSize: '0.8125rem', background: '#5865f208', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', display: 'inline-block' }}>/수감자 파우스트</div></div>
    </div></div>
  )},
  // 5: 명령어 + CTA
  { node: (
    <div className="max-w-3xl mx-auto w-full">
      <h2 className="font-serif text-center mb-1.5" style={{ color: '#e8dcc8', fontSize: '1.5rem' }}>전체 명령어</h2>
      <p className="text-center mb-6" style={{ color: '#555', fontSize: '0.75rem' }}>모든 명령어는 자동완성을 지원합니다</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-8">
        {[
          { img: `${S}/icons/Sinners/yi-sang.webp`, title: '/인격', desc: '스킬 · 패시브 · 스탯', color: '#c8900a' },
          { img: `${S}/icons/Sins/transparent/Wrath.webp`, title: '/에고', desc: '코스트 · 내성 · 각성/침식', color: '#c83030' },
          { img: `${S}/icons/keywords/bleed.webp`, title: '/키워드', desc: '설명 + 보유 인격', color: '#c83030' },
          { img: `${S}/icons/keywords/sinking.webp`, title: '/기프트', desc: '효과 기본/+/++', color: '#4898b0' },
          { img: `${S}/icons/Sinners/faust.webp`, title: '/수감자', desc: '인격 & E.G.O 목록', color: '#c8900a' },
          { img: null as string | null, lucide: 'bell', title: '/알림설정', desc: 'Steam · X 소식', color: '#5865f2' },
          { img: null as string | null, lucide: 'help', title: '/도움말', desc: '명령어 안내', color: '#c8900a' },
          { img: null as string | null, lucide: 'ticket', title: '/티켓', desc: '문의 + 트랜스크립트', color: '#5865f2' },
        ].map((f, i) => (
          <div key={i} className="rounded-lg p-3 transition-all hover:scale-[1.02]" style={{ background: '#1a1510', border: '1px solid #222' }}>
            <div className="flex items-center gap-2 mb-1">
              {f.img ? <Image src={f.img} alt="" width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain' }} /> : f.lucide === 'bell' ? <Bell style={{ width: '1rem', height: '1rem', color: f.color }} /> : f.lucide === 'help' ? <HelpCircle style={{ width: '1rem', height: '1rem', color: f.color }} /> : <span style={{ fontSize: '1rem' }}>🎫</span>}
              <span style={{ color: f.color, fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{f.title}</span>
            </div>
            <p style={{ color: '#666', fontSize: '0.625rem', lineHeight: 1.4 }}>{f.desc}</p>
          </div>
        ))}
      </div>
      <div className="text-center">
        <a href="https://discord.gg/efaGjQwsVB" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all hover:brightness-110 hover:scale-105" style={{ background: '#5865f2', color: '#fff', fontSize: '0.875rem' }}>디스코드 서버 참여 <ExternalLink style={{ width: '0.875rem', height: '0.875rem' }} /></a>
        <p className="mt-4" style={{ color: '#333', fontSize: '0.625rem' }}>saigo-no-dante.com | 최애의 관리자</p>
      </div>
    </div>
  )},
]

// ── 메인 ──
export default function BotClient() {
  const [current, setCurrent] = useState(0)
  const [fade, setFade] = useState(true)
  const transitioning = useRef(false)
  const total = SLIDES.length

  const goTo = useCallback((next: number) => {
    if (transitioning.current || next < 0 || next >= total || next === current) return
    transitioning.current = true
    setFade(false) // fadeOut
    setTimeout(() => {
      setCurrent(next)
      setFade(true) // fadeIn
      setTimeout(() => { transitioning.current = false }, 500)
    }, 300)
  }, [current, total])

  // body overflow hidden
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // wheel
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (Math.abs(e.deltaY) < 20) return
      goTo(e.deltaY > 0 ? current + 1 : current - 1)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [current, goTo])

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); goTo(current + 1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); goTo(current - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, goTo])

  // touch
  useEffect(() => {
    let startY = 0
    const onStart = (e: TouchEvent) => { startY = e.touches[0].clientY }
    const onEnd = (e: TouchEvent) => {
      const diff = startY - e.changedTouches[0].clientY
      if (Math.abs(diff) > 50) goTo(diff > 0 ? current + 1 : current - 1)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd) }
  }, [current, goTo])

  return (
    <div style={{ background: '#0d0b08', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1.5rem', overflow: 'hidden' }}>
      {/* 슬라이드 */}
      <div style={{ opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease', width: '100%' }}>
        {SLIDES[current].node}
      </div>

      {/* SCROLL 유도 (Hero만) */}
      {current === 0 && (
        <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', color: '#c8900a30', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.625rem', letterSpacing: '0.15em' }}>SCROLL</span>
          <ChevronDown style={{ width: '1rem', height: '1rem' }} />
        </div>
      )}

      {/* 도트 네비게이션 */}
      <div style={{ position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} style={{ width: i === current ? '0.5rem' : '0.375rem', height: i === current ? '1.25rem' : '0.375rem', background: i === current ? '#c8900a' : '#333', border: 'none', borderRadius: '9999px', cursor: 'pointer', transition: 'all 0.3s' }} />
        ))}
      </div>
    </div>
  )
}
