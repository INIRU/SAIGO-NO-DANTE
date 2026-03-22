'use client'

import { useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ExternalLink, ChevronDown, Bell, HelpCircle } from 'lucide-react'

const BOT_AVATAR = '/icons/icon-192x192.png'
const S = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

function I({ src, s = 16 }: { src: string; s?: number }) {
  return <Image src={src} alt="" width={s} height={s} style={{ width: `${s / 16}rem`, height: `${s / 16}rem`, display: 'inline', verticalAlign: 'middle', objectFit: 'contain' }} />
}
function Code({ children }: { children: React.ReactNode }) {
  return <code style={{ background: '#0d0b08', padding: '0.0625rem 0.25rem', borderRadius: '0.1875rem', color: '#e8dcc8', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{children}</code>
}

// ── V2 Components ──
function V2({ accent, children }: { accent: string; children: React.ReactNode }) {
  return <div className="rounded-lg overflow-hidden" style={{ background: '#111110', borderLeft: `0.1875rem solid ${accent}`, maxWidth: '28rem', width: '100%' }}>{children}</div>
}
function V2Head({ children, thumb }: { children: React.ReactNode; thumb?: string }) {
  return (
    <div className="flex items-start justify-between" style={{ padding: '0.75rem 0.875rem 0.375rem' }}>
      <div>{children}</div>
      {thumb && <Image src={thumb} alt="" width={64} height={64} className="rounded-md ml-3 flex-shrink-0" style={{ width: '4rem', height: '4rem', objectFit: 'cover' }} />}
    </div>
  )
}
function V2Body({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '0.25rem 0.875rem', color: '#b0a898', fontSize: '0.8125rem', lineHeight: 1.7 }}>{children}</div>
}
function V2Line() { return <div style={{ margin: '0.375rem 0.875rem', borderTop: '1px solid #222' }} /> }
function V2Btn({ items }: { items: { label: string; primary?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" style={{ padding: '0.5rem 0.875rem' }}>
      {items.map((b, i) => <span key={i} className="rounded-md" style={{ background: b.primary ? '#5865f2' : '#1a1a1a', color: b.primary ? '#fff' : '#aaa', fontSize: '0.75rem', padding: '0.3125rem 0.75rem', fontWeight: 500 }}>{b.label}</span>)}
    </div>
  )
}
function V2Foot({ text }: { text: string }) { return <div style={{ padding: '0.25rem 0.875rem 0.625rem', color: '#5865f2', fontSize: '0.625rem' }}>{text}</div> }
function V2Drop({ text }: { text: string }) {
  return (
    <div style={{ padding: '0.25rem 0.875rem 0.625rem' }}>
      <div className="rounded-md flex items-center justify-between" style={{ background: '#0d0b08', border: '1px solid #222', padding: '0.5rem 0.75rem', color: '#b0a898', fontSize: '0.8125rem' }}>
        {text} <ChevronDown style={{ width: '0.875rem', height: '0.875rem', color: '#666' }} />
      </div>
    </div>
  )
}

function BotHeader() {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Image src={BOT_AVATAR} alt="" width={24} height={24} className="rounded-full" style={{ width: '1.5rem', height: '1.5rem' }} />
      <span style={{ color: '#c8900a', fontWeight: 600, fontSize: '0.75rem' }}>최애의 관리자</span>
      <span style={{ color: '#c8900a', fontSize: '0.4375rem', fontWeight: 700, background: '#c8900a20', padding: '0.0625rem 0.1875rem', borderRadius: '0.125rem' }}>BOT</span>
    </div>
  )
}

// ── 섹션 데이터 ──
interface Feature { tag: string; title: string; desc: string; command: string; embed: React.ReactNode; reverse?: boolean }

const FEATURES: Feature[] = [
  {
    tag: '인격 정보', title: '스킬, 스탯, 내성을\n한눈에 확인',
    desc: '인격의 스킬 구성, 코인 위력, 공격 레벨, 내성까지 한 번에 조회합니다. 버튼으로 스킬 상세와 패시브를 전환하고, 드롭다운으로 같은 수감자의 다른 인격을 탐색합니다.',
    command: '/인격 거미집 검지 아비 이상',
    embed: (
      <V2 accent="#c8900a">
        <V2Head thumb={`${S}/sinners/yi-sang/identities/The%20House%20of%20Spiders%20The%20Index%20Nursefather/10115_normal_info.webp`}>
          <div style={{ color: '#e8dcc8', fontWeight: 700, fontSize: '0.9375rem' }}><I src={`${S}/icons/Rarity/3star.webp`} s={18} /> 거미집 검지 아비</div>
          <div style={{ color: '#8a8a7a', fontSize: '0.75rem', marginTop: '0.1875rem' }}><I src={`${S}/icons/Sinners/yi-sang.webp`} s={16} /> 이상 · 검지</div>
        </V2Head>
        <V2Line />
        <V2Body>
          <div><I src={`${S}/icons/stats/blunt.webp`} s={15} /> <Code>248</Code>{'  '}<I src={`${S}/icons/Sins/transparent/Sloth.webp`} s={15} /> <Code>3-8</Code>{'  '}<I src={`${S}/icons/stats/pierce.webp`} s={15} /> <Code>62</Code></div>
          <div style={{ marginTop: '0.125rem' }}><I src={`${S}/icons/stats/slash.webp`} s={14} /> 내성{'  '}<I src={`${S}/icons/stats/pierce.webp`} s={14} /> 취약{'  '}<I src={`${S}/icons/stats/blunt.webp`} s={14} /> 보통</div>
        </V2Body>
        <V2Line />
        <V2Body>
          <div><span style={{ fontWeight: 700, color: '#e8dcc8' }}>S1 얼어붙은 피를 삼백삼십 휘감아</span></div>
          <div><I src={`${S}/icons/Sins/transparent/Lust.webp`} s={14} /> <I src={`${S}/icons/stats/blunt.webp`} s={14} /> 기본 3 / 코인 +4 / ×2 / 공레 62</div>
          <div style={{ marginTop: '0.375rem' }}><span style={{ fontWeight: 700, color: '#e8dcc8' }}>S2 소리 없이 손뼉 쳐 즐기고</span></div>
          <div><I src={`${S}/icons/Sins/transparent/Gluttony.webp`} s={14} /> <I src={`${S}/icons/stats/pierce.webp`} s={14} /> 기본 4 / 코인 +4 / ×3 / 공레 63</div>
          <div style={{ marginTop: '0.375rem' }}><span style={{ fontWeight: 700, color: '#e8dcc8' }}>S3 날 세워 칼을 웃거라</span></div>
          <div><I src={`${S}/icons/Sins/transparent/Envy.webp`} s={14} /> <I src={`${S}/icons/stats/slash.webp`} s={14} /> 기본 4 / 코인 +3 / ×4 / 공레 64</div>
        </V2Body>
        <V2Btn items={[{ label: '스킬 상세', primary: true }, { label: '패시브' }, { label: '3동기화 보기' }, { label: '수비 (회피)' }]} />
        <V2Foot text="saigo-no-dante.com | 최애의 관리자" />
        <V2Drop text="거미집 검지 아비" />
      </V2>
    ),
  },
  {
    tag: '키워드 검색', title: '키워드 설명과\n보유 인격을 한번에',
    desc: '키워드의 효과와 최대 스택을 확인하고, 해당 키워드를 보유한 인격 목록을 페이지네이션으로 탐색합니다.',
    command: '/키워드 출혈', reverse: true,
    embed: (
      <V2 accent="#c83030">
        <V2Head thumb={`${S}/icons/keywords/bleed.webp`}>
          <div style={{ color: '#e8dcc8', fontWeight: 700, fontSize: '0.9375rem' }}><I src={`${S}/icons/keywords/bleed.webp`} s={18} /> 출혈</div>
          <div style={{ color: '#b0a898', fontSize: '0.75rem', marginTop: '0.25rem', lineHeight: 1.5 }}>턴 종료 시 (출혈 위력 × 출혈 횟수) 피해<br />피격 시 출혈 횟수 1 차감</div>
          <div style={{ color: '#666', fontSize: '0.6875rem', marginTop: '0.1875rem' }}>최대 스택: 99</div>
        </V2Head>
        <V2Line />
        <V2Body>
          <div style={{ color: '#666', fontSize: '0.6875rem', fontWeight: 600, marginBottom: '0.25rem' }}>보유 인격 (28개)</div>
          <div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> <I src={`${S}/icons/Sinners/yi-sang.webp`} s={14} /> R사 4과 이상</div>
          <div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> <I src={`${S}/icons/Sinners/faust.webp`} s={14} /> W사 3과 파우스트</div>
          <div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> <I src={`${S}/icons/Sinners/heathcliff.webp`} s={14} /> 쐐기 사무소 히스클리프</div>
          <div style={{ color: '#444', fontSize: '0.6875rem' }}>...외 25명</div>
        </V2Body>
        <V2Btn items={[{ label: '◀ 이전' }, { label: '1 / 3' }, { label: '다음 ▶' }]} />
      </V2>
    ),
  },
  {
    tag: 'EGO 기프트', title: '기프트 효과를\n바로 확인',
    desc: '거울 던전 EGO 기프트의 등급, 키워드, 효과를 한눈에 조회합니다.',
    command: '/기프트 달의 기억',
    embed: (
      <V2 accent="#c8900a">
        <V2Head thumb={`${S}/ego-gifts/ego-gift-aebc9e2c.webp`}>
          <div style={{ color: '#e8dcc8', fontWeight: 700, fontSize: '0.9375rem' }}>달의 기억</div>
          <div style={{ color: '#8a8a7a', fontSize: '0.75rem', marginTop: '0.125rem' }}>Ⅴ · 공통 · 비용 999</div>
        </V2Head>
        <V2Line />
        <V2Body>
          <div style={{ color: '#666', fontSize: '0.6875rem', fontWeight: 600 }}>기본 효과</div>
          <div>모든 적(환상체일 경우, 모든 부위)의 물리 내성과 속성 내성이 취약으로 변경됨.</div>
        </V2Body>
        <V2Btn items={[{ label: '기본', primary: true }]} />
      </V2>
    ),
  },
  {
    tag: '수감자 목록', title: '인격과 E.G.O를\n드롭다운으로 탐색',
    desc: '수감자의 보유 인격과 E.G.O 목록을 한눈에 보고, 드롭다운으로 상세 정보에 접근합니다.',
    command: '/수감자 파우스트', reverse: true,
    embed: (
      <V2 accent="#c8900a">
        <V2Head thumb={`${S}/icons/Sinners/faust.webp`}>
          <div style={{ color: '#e8dcc8', fontWeight: 700, fontSize: '0.9375rem' }}><I src={`${S}/icons/Sinners/faust.webp`} s={18} /> 파우스트 <span style={{ color: '#666', fontSize: '0.75rem', fontWeight: 400 }}>(Faust)</span></div>
          <div style={{ color: '#8a8a7a', fontSize: '0.6875rem', marginTop: '0.125rem' }}>📖 파우스트 — 요한 볼프강 폰 괴테</div>
        </V2Head>
        <V2Line />
        <V2Body>
          <div style={{ color: '#666', fontSize: '0.6875rem', fontWeight: 600, marginBottom: '0.25rem' }}>인격 (14개)</div>
          <div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> 로보토미 E.G.O::후회</div>
          <div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> W사 3과</div>
          <div><I src={`${S}/icons/Rarity/3star.webp`} s={14} /> 7 K사</div>
          <div style={{ color: '#444', fontSize: '0.6875rem' }}>...외 11명</div>
        </V2Body>
        <V2Drop text="📋 인격 상세 보기" />
        <V2Line />
        <V2Drop text="🔮 E.G.O 상세 보기 (9개)" />
        <V2Foot text="saigo-no-dante.com | 최애의 관리자" />
      </V2>
    ),
  },
]

const COMMANDS = [
  { img: `${S}/icons/Sinners/yi-sang.webp`, title: '/인격', desc: '스킬 · 패시브 · 스탯', color: '#c8900a' },
  { img: `${S}/icons/Sins/transparent/Wrath.webp`, title: '/에고', desc: '코스트 · 내성 · 각성/침식', color: '#c83030' },
  { img: `${S}/icons/keywords/bleed.webp`, title: '/키워드', desc: '설명 + 보유 인격', color: '#c83030' },
  { img: `${S}/icons/keywords/sinking.webp`, title: '/기프트', desc: '효과 기본/+/++', color: '#4898b0' },
  { img: `${S}/icons/Sinners/faust.webp`, title: '/수감자', desc: '인격 & E.G.O 목록', color: '#c8900a' },
]

// ── 메인 ──
export default function BotClient() {
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const isSnapping = useRef(false)

  // wheel snap: 스크롤 멈추면 가장 가까운 섹션으로 부드럽게 이동
  const handleSnap = useCallback(() => {
    if (isSnapping.current) return
    const sections = sectionRefs.current.filter(Boolean) as HTMLDivElement[]
    const mid = window.innerHeight / 2
    let closest: HTMLDivElement | null = null
    let closestDist = Infinity
    for (const sec of sections) {
      const rect = sec.getBoundingClientRect()
      const dist = Math.abs(rect.top + rect.height / 2 - mid)
      if (dist < closestDist) { closestDist = dist; closest = sec }
    }
    if (closest && closestDist > 80) {
      isSnapping.current = true
      closest.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setTimeout(() => { isSnapping.current = false }, 900)
    }
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(handleSnap, 150) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer) }
  }, [handleSnap])

  // GSAP fade-in
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) (e.target as HTMLElement).style.opacity = '1'
      })
    }, { threshold: 0.15 })
    sectionRefs.current.forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen pt-0" style={{ background: '#0d0b08' }}>
      {/* ── 히어로 ── */}
      <div
        ref={el => { sectionRefs.current[0] = el }}
        className="min-h-screen flex flex-col items-center justify-center px-6 relative"
        style={{ opacity: 1, transition: 'opacity 0.6s ease' }}
      >
        <div className="text-center">
          <Image src={BOT_AVATAR} alt="" width={80} height={80} className="rounded-2xl mx-auto mb-6" style={{ width: '5rem', height: '5rem', boxShadow: '0 0 60px #c8900a10' }} />
          <h1 className="font-serif" style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)', color: '#e8dcc8', letterSpacing: '-0.02em' }}>최애의 관리자</h1>
          <p style={{ color: '#8a6010', fontSize: '0.875rem', marginTop: '0.375rem', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em' }}>SAIGO NO DANTE — DISCORD BOT</p>
          <p style={{ color: '#666', fontSize: '0.875rem', maxWidth: '26rem', margin: '1.25rem auto 0', lineHeight: 1.8 }}>
            림버스 컴퍼니 인격 · E.G.O · 키워드 · 기프트 정보를 디스코드에서 바로 확인하세요
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <a href="https://discord.com/oauth2/authorize?client_id=1482245554598576221&permissions=0&integration_type=0&scope=bot+applications.commands" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all hover:brightness-110 hover:scale-105" style={{ background: '#5865f2', color: '#fff' }}>
              봇 초대하기 <ExternalLink style={{ width: '0.75rem', height: '0.75rem' }} />
            </a>
            <a href="https://discord.gg/efaGjQwsVB" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all hover:brightness-110 hover:scale-105" style={{ border: '1px solid #5865f250', color: '#7289da' }}>
              서버 참여 <ExternalLink style={{ width: '0.75rem', height: '0.75rem' }} />
            </a>
            <Link href="/" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all hover:brightness-110" style={{ border: '1px solid #c8900a30', color: '#c8900a' }}>
              <ArrowLeft style={{ width: '0.75rem', height: '0.75rem' }} /> 사이트
            </Link>
          </div>
        </div>
        <div className="absolute bottom-10 flex flex-col items-center gap-1" style={{ color: '#c8900a30' }}>
          <span style={{ fontSize: '0.625rem', letterSpacing: '0.15em' }}>SCROLL</span>
          <ChevronDown style={{ width: '1rem', height: '1rem' }} />
        </div>
      </div>

      {/* ── 기능 소개 ── */}
      {FEATURES.map((f, i) => (
        <div
          key={i}
          ref={el => { sectionRefs.current[i + 1] = el }}
          className="min-h-screen flex items-center px-6 py-20"
          style={{ opacity: 0, transition: 'opacity 0.7s ease' }}
        >
          <div className="max-w-5xl mx-auto w-full">
            <div className={`flex flex-col ${f.reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10 md:gap-16`}>
              <div className="flex-shrink-0">
                <BotHeader />
                {f.embed}
              </div>
              <div className="flex-1 min-w-0">
                <span style={{ color: '#c8900a', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', fontFamily: 'var(--font-heading)' }}>{f.tag}</span>
                <h2 className="font-serif mt-2 mb-4" style={{ fontSize: '1.75rem', color: '#e8dcc8', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{f.title}</h2>
                <p style={{ color: '#777', fontSize: '0.875rem', lineHeight: 1.8 }}>{f.desc}</p>
                <div className="mt-4" style={{ fontFamily: 'var(--font-mono)', color: '#5865f2', fontSize: '0.8125rem', background: '#5865f208', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', display: 'inline-block' }}>{f.command}</div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* ── 전체 명령어 ── */}
      <div
        ref={el => { sectionRefs.current[FEATURES.length + 1] = el }}
        className="min-h-screen flex items-center px-6 py-20"
        style={{ opacity: 0, transition: 'opacity 0.7s ease' }}
      >
        <div className="max-w-3xl mx-auto w-full">
          <h2 className="font-serif text-center mb-1.5" style={{ color: '#e8dcc8', fontSize: '1.5rem' }}>전체 명령어</h2>
          <p className="text-center mb-6" style={{ color: '#555', fontSize: '0.75rem' }}>모든 명령어는 자동완성을 지원합니다</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-12">
            {COMMANDS.map((f, i) => (
              <div key={i} className="rounded-lg p-3 transition-all hover:scale-[1.02]" style={{ background: '#1a1510', border: '1px solid #222' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Image src={f.img} alt="" width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain' }} />
                  <span style={{ color: f.color, fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{f.title}</span>
                </div>
                <p style={{ color: '#666', fontSize: '0.625rem', lineHeight: 1.4 }}>{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-12">
            {[
              { icon: <Bell style={{ width: '1rem', height: '1rem', color: '#5865f2' }} />, title: '/알림설정', desc: 'Steam · X 소식', color: '#5865f2' },
              { icon: <HelpCircle style={{ width: '1rem', height: '1rem', color: '#c8900a' }} />, title: '/도움말', desc: '명령어 안내', color: '#c8900a' },
              { icon: <span style={{ fontSize: '1rem' }}>🎫</span>, title: '/티켓', desc: '문의 + 트랜스크립트', color: '#5865f2' },
            ].map((f, i) => (
              <div key={i} className="rounded-lg p-3 transition-all hover:scale-[1.02]" style={{ background: '#1a1510', border: '1px solid #222' }}>
                <div className="flex items-center gap-2 mb-1">
                  {f.icon}
                  <span style={{ color: f.color, fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{f.title}</span>
                </div>
                <p style={{ color: '#666', fontSize: '0.625rem', lineHeight: 1.4 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <div className="inline-block rounded-xl p-6" style={{ background: '#1a1510', border: '1px solid #222' }}>
              <Image src={BOT_AVATAR} alt="" width={40} height={40} className="rounded-lg mx-auto mb-3" style={{ width: '2.5rem', height: '2.5rem' }} />
              <h3 className="font-serif mb-1.5" style={{ color: '#e8dcc8', fontSize: '1.125rem' }}>서버에서 직접 써보세요</h3>
              <p className="mb-4" style={{ color: '#555', fontSize: '0.75rem' }}>모든 기능 무료</p>
              <a href="https://discord.gg/efaGjQwsVB" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all hover:brightness-110 hover:scale-105" style={{ background: '#5865f2', color: '#fff', fontSize: '0.875rem' }}>
                디스코드 서버 참여 <ExternalLink style={{ width: '0.875rem', height: '0.875rem' }} />
              </a>
            </div>
            <p className="mt-6" style={{ color: '#333', fontSize: '0.625rem' }}>saigo-no-dante.com | 최애의 관리자</p>
          </div>
        </div>
      </div>
    </div>
  )
}
