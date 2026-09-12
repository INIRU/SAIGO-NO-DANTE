'use client'

import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { useEffect, useCallback, type ReactNode } from 'react'
import Image from 'next/image'
import KeywordIcon from '@/components/ui/KeywordIcon'
import { Link } from '@/lib/i18n/navigation'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { STORAGE_BASE } from '@/lib/data/sinners'
import { SIN_COLORS } from '@/lib/constants/sin'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName, getLocalizedKeywordName, getLocalizedKeywordDesc } from '@/lib/i18n/localize'
import { resolveKeywordIconUrl } from '@/components/providers/KeywordProvider'

const RARITY_ICONS: Record<number, string> = { 1: '1star', 2: '2star', 3: '3star' }
const GRADE_LABELS: Record<string, string> = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', 'EX': 'EX' }

interface Keyword {
  name: string
  description: string | null
  max_stack: number | null
  icon_slug: string | null
  sin_affinity: string | null
  category: string | null
  name_en?: string | null
  name_jp?: string | null
  description_en?: string | null
  description_jp?: string | null
}
interface Identity {
  id: string; name: string; name_kr: string; sinner_id: string
  name_en?: string | null; name_jp?: string | null
  keywords: string[] | null; rarity: number; game_id: string | null; folder_name: string | null
}
interface EGO {
  id: string; name: string; name_kr: string | null; sinner_id: string
  name_en?: string | null; name_jp?: string | null
  grade: string; sin_affinity: string | null; keywords: string[] | null
  folder_name: string | null; image_url: string | null
}
interface EgoGift {
  name: string; keyword: string; grade: string; image_url: string | null
}

interface KeywordModalProps {
  keyword: Keyword
  relatedIdentities: Identity[]
  relatedEgos: EGO[]
  relatedGifts: EgoGift[]
  sinnerNameMap: Record<string, string>
  formatSkillDesc: (text: string, color: string) => ReactNode
  onClose: () => void
  lang: SupportedLang
}

export default function KeywordModal({
  keyword: kw, relatedIdentities, relatedEgos, relatedGifts,
  sinnerNameMap, formatSkillDesc, onClose, lang,
}: KeywordModalProps) {
  const sinColor = kw.sin_affinity
    ? ((SIN_COLORS as Record<string, string>)[kw.sin_affinity] || '#c8900a')
    : null

  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }

  const sinLabel = (sin: string) =>
    translations[(`sin.${sin}`) as keyof typeof translations]?.[lang] ?? sin

  const kwName = getLocalizedKeywordName(kw.name, { nameEn: kw.name_en, nameJp: kw.name_jp, descEn: null, descJp: null }, lang)
  const kwDesc = kw.description
    ? getLocalizedKeywordDesc(kw.description, { nameEn: null, nameJp: null, descEn: kw.description_en, descJp: kw.description_jp }, lang)
    : null
  const iconUrl = resolveKeywordIconUrl(kw.name, kw.icon_slug)

  // body 스크롤 잠금
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [])

  // ESC 키
  const handleClose = useCallback(() => onClose(), [onClose])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleClose])

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 pb-8">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(0.25rem)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-2xl rounded-lg overflow-hidden"
          style={{
            background: '#1a1510',
            border: `0.0625rem solid ${sinColor ? `${sinColor}20` : 'rgba(200,144,10,0.15)'}`,
            maxHeight: 'calc(100vh - 7rem)',
          }}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
        >
          {/* 상단 죄악 색상 라인 */}
          {sinColor && (
            <div className="absolute top-0 left-0 right-0" style={{ height: '0.125rem', background: `${sinColor}40` }} />
          )}

          {/* 헤더 */}
          <div className="p-5 pb-4" style={{ borderBottom: '0.0625rem solid rgba(200,144,10,0.08)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {iconUrl && (
                  <div className="flex items-center justify-center rounded"
                    style={{
                      width: '2.75rem', height: '2.75rem',
                      background: sinColor ? `${sinColor}10` : 'rgba(200,144,10,0.06)',
                      border: `0.0625rem solid ${sinColor ? `${sinColor}25` : 'rgba(200,144,10,0.12)'}`,
                    }}
                  >
                    <KeywordIcon
                      src={iconUrl}
                      alt={kwName} width={28} height={28}
                      style={{ width: '1.75rem', height: 'auto' }}
                    />
                  </div>
                )}
                <div>
                  <h2 className="font-serif text-lg font-bold" style={{ color: '#e8dcc8' }}>
                    {kwName}
                  </h2>
                  <div className="flex gap-2 mt-0.5">
                    {kw.max_stack && (
                      <span className="text-[0.625rem]" style={{ color: '#7a6845' }}>{t('keyword.maxStack')} {kw.max_stack}</span>
                    )}
                    {kw.sin_affinity && (
                      <span className="text-[0.625rem]" style={{ color: sinColor || '#7a6845' }}>
                        {sinLabel(kw.sin_affinity)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 rounded hover:bg-white/5 transition-colors" style={{ color: '#555' }}>
                <X size={18} />
              </button>
            </div>

            {/* 설명 */}
            {kwDesc && (
              <div className="mt-3 text-[0.8125rem] leading-[1.7]" style={{ color: '#a89070' }}>
                {kwDesc.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i}>{formatSkillDesc(line, '#a89070')}</p>
                ))}
              </div>
            )}
          </div>

          {/* 바디 — 스크롤 */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 18rem)' }}>
            {/* 관련 인격 */}
            {relatedIdentities.length > 0 && (
              <div className="p-5 pb-4" style={{ borderBottom: '0.0625rem solid rgba(200,144,10,0.06)' }}>
                <h3 className="text-[0.75rem] font-bold mb-3" style={{ color: '#c8900a', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
                  {t('keyword.related.identities')} ({relatedIdentities.length})
                </h3>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))' }}>
                  {relatedIdentities.map(id => {
                    const idName = getLocalizedName({ name_kr: id.name_kr, name_en: id.name_en, name_jp: id.name_jp }, lang)
                    return (
                      <Link
                        key={id.id}
                        href={`/sinners/${id.sinner_id}/identities/${id.id}`}
                        className="flex items-center gap-2.5 p-2 rounded transition-colors hover:bg-white/[0.03] overflow-hidden"
                        style={{ border: '0.0625rem solid rgba(200,144,10,0.06)' }}
                        onClick={handleClose}
                      >
                        {id.game_id && id.folder_name && (
                          <Image
                            src={getIdentityPortraitUrl(id.sinner_id, id.folder_name, id.game_id, false)}
                            alt={idName} width={36} height={48}
                            className="rounded shrink-0"
                            style={{ width: '2.25rem', height: '3rem', objectFit: 'cover' }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.75rem] truncate" style={{ color: '#e8dcc8' }}>{idName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {RARITY_ICONS[id.rarity] && (
                              <Image
                                src={`${STORAGE_BASE}/icons/Rarity/${RARITY_ICONS[id.rarity]}.webp`}
                                alt="" width={id.rarity === 1 ? 12 : id.rarity === 2 ? 20 : 28} height={12}
                                style={{ width: id.rarity === 1 ? '0.75rem' : id.rarity === 2 ? '1.25rem' : '1.75rem', height: 'auto' }}
                              />
                            )}
                            <span className="text-[0.5625rem]" style={{ color: '#555' }}>
                              {sinnerNameMap[id.sinner_id] || id.sinner_id}
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 관련 EGO */}
            {relatedEgos.length > 0 && (
              <div className="p-5 pb-4" style={{ borderBottom: '0.0625rem solid rgba(200,144,10,0.06)' }}>
                <h3 className="text-[0.75rem] font-bold mb-3" style={{ color: '#b06060', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
                  {t('keyword.related.ego')} ({relatedEgos.length})
                </h3>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))' }}>
                  {relatedEgos.map(ego => {
                    const egoName = getLocalizedName({ name_kr: ego.name_kr ?? ego.name, name_en: ego.name_en, name_jp: ego.name_jp }, lang)
                    return (
                      <Link
                        key={ego.id}
                        href={`/sinners/${ego.sinner_id}/ego/${ego.id}`}
                        className="flex items-center gap-2.5 p-2 rounded transition-colors hover:bg-white/[0.03] overflow-hidden"
                        style={{ border: '0.0625rem solid rgba(180,100,100,0.06)' }}
                        onClick={handleClose}
                      >
                        {ego.image_url && (
                          <Image
                            src={ego.image_url}
                            alt={egoName} width={36} height={48}
                            className="rounded shrink-0"
                            style={{ width: '2.25rem', height: '3rem', objectFit: 'cover' }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.75rem] truncate" style={{ color: '#e8dcc8' }}>{egoName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Image
                              src={`${STORAGE_BASE}/icons/grade/${ego.grade}.webp`}
                              alt={ego.grade} width={28} height={12}
                              style={{ width: '1.75rem', height: 'auto' }}
                            />
                            <span className="text-[0.5625rem] truncate" style={{ color: '#555' }}>
                              {sinnerNameMap[ego.sinner_id] || ego.sinner_id}
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 관련 기프트 */}
            {relatedGifts.length > 0 && (
              <div className="p-5 pb-4">
                <h3 className="text-[0.75rem] font-bold mb-3" style={{ color: '#6a9a6a', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
                  {t('keyword.related.gifts')} ({relatedGifts.length})
                </h3>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))' }}>
                  {relatedGifts.map(g => (
                    <Link
                      key={g.name}
                      href="/mirror-dungeon"
                      className="flex items-center gap-2.5 p-2 rounded transition-colors hover:bg-white/[0.03]"
                      style={{ border: '0.0625rem solid rgba(100,180,100,0.06)' }}
                      onClick={handleClose}
                    >
                      {g.image_url && (
                        <Image
                          src={g.image_url} alt={g.name} width={36} height={36}
                          className="rounded"
                          style={{ width: '2.25rem', height: '2.25rem', objectFit: 'contain', background: 'rgba(0,0,0,0.3)' }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-[0.75rem] truncate" style={{ color: '#e8dcc8' }}>{g.name}</p>
                        <p className="text-[0.5625rem]" style={{ color: '#555' }}>
                          {GRADE_LABELS[g.grade] ?? g.grade}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 관련 데이터 없음 */}
            {relatedIdentities.length === 0 && relatedEgos.length === 0 && relatedGifts.length === 0 && (
              <div className="p-8 text-center" style={{ color: '#555', fontSize: '0.8125rem' }}>
                {t('keyword.related.empty')}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
