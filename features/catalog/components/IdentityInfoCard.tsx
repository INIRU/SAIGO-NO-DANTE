'use client'


import Image from 'next/image'
import SinnerShardIcon from '@/components/ui/SinnerShardIcon'
import {
  Identity,
  RARITY_ICON_MAP,
} from '@/lib/data/sinners'
import { KeywordWithTooltip, useKeywords } from '@/components/providers/KeywordProvider'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n'
import { getLocalizedAffiliation, getLocalizedKeywordName } from '@/lib/i18n'

interface IdentityInfoCardProps {
  identity: Identity
  sinColor: string
  currentSeason?: number
}

export function getAssociationChips(identity: Pick<Identity, 'unit_keyword_list' | 'association_list' | 'affiliation'>, locale: SupportedLang) {
  const associations = [...new Set([...(identity.unit_keyword_list ?? []), ...(identity.association_list ?? [])])]
    .map(association => association.trim())
    // SMALL is an internal unit-size tag, not an identity trait or affiliation.
    .filter(association => Boolean(association) && !['소형', 'SMALL'].includes(association))

  if (associations && associations.length > 0) {
    return associations.map(association => getLocalizedAffiliation(association, locale))
  }
  return identity.affiliation ? [getLocalizedAffiliation(identity.affiliation, locale)] : []
}

function getLocalizedGachaName(
  info: NonNullable<Identity['acquisition_info']>,
  locale: SupportedLang,
) {
  if (locale === 'en') return info.gacha_name_en ?? info.gacha_name ?? null
  if (locale === 'ja') return info.gacha_name_jp ?? info.gacha_name ?? null
  return info.gacha_name ?? null
}

export default function IdentityInfoCard({ identity, currentSeason = 7 }: IdentityInfoCardProps) {
  const kwAll = useKeywords()
  const t = useTranslations()
  const locale = useLocale()
  const associationChips = getAssociationChips(identity, locale as SupportedLang)
  const representativeKeywords = identity.skill_keyword_list && identity.skill_keyword_list.length > 0
    ? identity.skill_keyword_list
    : (identity.keywords ?? [])
  return (
    <div className="border-b border-[var(--border)] pb-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="font-serif text-lg text-[var(--text-primary)]">{t('identity.info.title')}</h2>
        {RARITY_ICON_MAP[identity.rarity] && (
          <Image src={RARITY_ICON_MAP[identity.rarity]} alt={`${identity.rarity}`} width={40} height={24}
            className="h-6 w-auto object-contain" />
        )}
      </div>

      <dl className="divide-y divide-white/10">
        {representativeKeywords.length > 0 && (
          <div className="py-5">
            <dt className="mb-3 text-xs font-medium tracking-wide text-[var(--text-secondary)]">{t('identity.info.combatKeywords')}</dt>
            <dd className="flex flex-wrap gap-2">
              {[...new Set(representativeKeywords)].map(kw => (
                <div key={kw} className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-base transition-colors hover:border-[var(--gold)]/40 hover:bg-white/[0.06] [&_.keyword-token>img]:mr-2 [&_.keyword-token>img]:h-6 [&_.keyword-token>img]:w-6">
                  <KeywordWithTooltip keyword={kw}>
                    <span className="font-medium">{getLocalizedKeywordName(kw, kwAll[kw], locale as SupportedLang)}</span>
                  </KeywordWithTooltip>
                </div>
              ))}
            </dd>
          </div>
        )}
        {associationChips.length > 0 && (
          <div className="py-5">
            <dt className="mb-3 text-xs font-medium tracking-wide text-[var(--text-secondary)]">{t('identity.info.traits')}</dt>
            <dd className="flex flex-wrap gap-x-5 gap-y-3">
              {associationChips.map(association => (
                <span key={association} className="inline-flex items-center gap-2 text-sm font-medium text-[#d8cbb5]">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-[#967748]" />
                  {association}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {/* 출시시기 & 획득 방법 */}
      {(identity.release_date || identity.acquisition_info) && (
        <div className="border-t border-white/10 pt-5 space-y-3">
          {identity.release_date && (
            <div className="flex items-center gap-2">
              <span style={{ color: '#9c8b73', fontSize: '0.75rem', minWidth: '52px' }}>{t('identity.info.releaseDate')}</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.75rem' }}>{identity.release_date}</span>
            </div>
          )}
          {(() => {
            const info = identity.acquisition_info
            if (!info) return null

            const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
              default:    { label: t('identity.info.type.default'),    color: '#9c8b73', bg: 'rgba(156,139,115,0.12)' },
              standard:   { label: t('identity.info.type.standard'),   color: '#e8dcc8', bg: 'rgba(232,220,200,0.12)' },
              limited:    { label: t('identity.info.type.limited'),    color: '#e8b030', bg: 'rgba(232,176,48,0.12)' },
              event:      { label: t('identity.info.type.event'),      color: '#e8b030', bg: 'rgba(232,176,48,0.12)' },
              walpurgis:  { label: t('identity.info.type.walpurgis'),  color: '#d9826b', bg: 'rgba(217,130,107,0.12)' },
              attendance: { label: t('identity.info.type.attendance'), color: '#b8a684', bg: 'rgba(184,166,132,0.12)' },
            }
            const GACHA_LABELS: Record<string, { label: string; color: string }> = {
              always:   { label: t('identity.info.gacha.always'),    color: '#e8dcc8' },
              seasonal: { label: t('identity.info.gacha.seasonal'),  color: '#e8b030' },
              pickup:   { label: t('identity.info.gacha.pickup'),    color: '#e8b030' },
              walpurgis:{ label: t('identity.info.gacha.walpurgis'), color: '#d9826b' },
              none:     { label: t('identity.info.gacha.none'),      color: '#9c8b73' },
            }

            const typeInfo = TYPE_LABELS[info.type] ?? TYPE_LABELS.standard
            const gachaInfo = GACHA_LABELS[info.gacha] ?? GACHA_LABELS.none
            const gachaName = getLocalizedGachaName(info, locale as SupportedLang)

            return (
              <div className="space-y-2">
                {/* 타입 + 시즌 배지 */}
                <div className="flex items-center gap-2">
                  <span style={{ color: '#9c8b73', fontSize: '0.75rem', minWidth: '52px' }}>{t('identity.info.acquisition')}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* 타입 배지 */}
                    <span
                      style={{
                        fontSize: '0.75rem', fontWeight: 600,
                        padding: '2px 8px', borderRadius: '3px',
                        color: typeInfo.color,
                        background: typeInfo.bg,
                        border: `1px solid ${typeInfo.color}30`,
                      }}
                    >
                      {typeInfo.label}
                    </span>

                    {/* 시즌 */}
                    {info.release_season > 0 && (
                      <span
                        style={{
                          fontSize: '0.75rem', fontWeight: 500,
                          padding: '2px 8px', borderRadius: '3px',
                          color: 'var(--gold)',
                          background: 'rgba(200,144,10,0.1)',
                          border: '1px solid rgba(200,144,10,0.2)',
                        }}
                      >
                        S{info.release_season}
                      </span>
                    )}

                    {/* 발푸밤 회차 */}
                    {info.walpurgis_edition && (
                      <span
                        style={{
                          fontSize: '0.75rem', fontWeight: 500,
                          padding: '2px 8px', borderRadius: '3px',
                          color: '#d9826b',
                          background: 'rgba(217,130,107,0.08)',
                          border: '1px solid rgba(217,130,107,0.2)',
                        }}
                      >
                        {info.walpurgis_edition}{t('identity.info.walpurgisEdition')}
                      </span>
                    )}

                    {/* 이벤트명 */}
                    {info.event_name && (
                      <span
                        style={{
                          fontSize: '0.75rem', fontWeight: 500,
                          padding: '2px 8px', borderRadius: '3px',
                          color: 'var(--gold-light)',
                          background: 'rgba(232,176,48,0.08)',
                          border: '1px solid rgba(232,176,48,0.2)',
                        }}
                      >
                        {info.event_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* 추출 상태 */}
                {info.type !== 'default' && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#9c8b73', fontSize: '0.75rem', minWidth: '52px' }}>{t('identity.info.extraction')}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span style={{ fontSize: '0.75rem', color: gachaInfo.color }}>
                        {gachaInfo.label}
                        {info.gacha === 'seasonal' && info.gacha_from_season && ` (S${info.gacha_from_season}~)`}
                        {info.gacha === 'pickup' && info.gacha_from_season && ` (S${info.gacha_from_season}~)`}
                      </span>
                      {info.target_sinner && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--gold-light)' }}>
                          · {info.target_sinner} {t('identity.info.targetExtraction')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {gachaName && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#9c8b73', fontSize: '0.75rem', minWidth: '52px' }}>{t('identity.info.gachaBanner')}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{gachaName}</span>
                  </div>
                )}

                {/* 파편 교환 (자판기 + 파편 통합) */}
                {info.fragment_cost && (() => {
                  const releaseSeason = Number(info.release_season ?? 0)
                  const diff = currentSeason - releaseSeason
                  const isSeasonalOrEvent = info.gacha === 'seasonal'
                    || info.gacha === 'pickup'
                    || info.type === 'limited'
                    || (info.type === 'event' && info.gacha === 'none')
                  const permanentExchangeSeason = info.exchange_from_season ?? (
                    isSeasonalOrEvent && releaseSeason > 0 ? releaseSeason + 2 : undefined
                  )

                  // 같은 시즌 신규: 출시 7일 이내는 교환 불가
                  const isNew7dLock = isSeasonalOrEvent && diff === 0 && identity.release_date &&
                    Math.floor((Date.now() - new Date(identity.release_date).getTime()) / (1000 * 60 * 60 * 24)) < 7
                  // 다음 시즌 대기 (diff === 1)
                  const isNextSeasonLock = isSeasonalOrEvent && diff === 1

                  // 파편 교환 상세 텍스트
                  let detail: string
                  if (info.gacha === 'walpurgis') {
                    detail = `${t('identity.info.fragmentCost')} ${info.fragment_cost} (${t('identity.info.walpurgisLimited')})`
                  } else if (isNew7dLock) {
                    detail = `${t('identity.info.fragmentCost')} ${info.fragment_cost} (${t('identity.info.shardPostRelease7d')} ~ S${releaseSeason}, S${permanentExchangeSeason} ~ ${t('identity.info.permanent')})`
                  } else if (isNextSeasonLock) {
                    detail = permanentExchangeSeason
                      ? `${t('identity.info.fragmentCost')} ${info.fragment_cost} (S${permanentExchangeSeason} ~ ${t('identity.info.permanent')})`
                      : `${t('identity.info.fragmentCost')} ${info.fragment_cost} (${t('identity.info.permanent')})`
                  } else if (permanentExchangeSeason) {
                    detail = `${t('identity.info.fragmentCost')} ${info.fragment_cost} (${t('identity.info.shardPostRelease7d')} ~ S${releaseSeason}, S${permanentExchangeSeason} ~ ${t('identity.info.permanent')})`
                  } else {
                    detail = `${t('identity.info.fragmentCost')} ${info.fragment_cost} (${t('identity.info.permanent')})`
                  }

                  const detailColor = isNew7dLock || isNextSeasonLock ? '#ff6b6b' : '#e8dcc8'

                  return (
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#9c8b73', fontSize: '0.75rem', minWidth: '52px' }}>{t('identity.info.fragmentExchange')}</span>
                      <SinnerShardIcon sinnerId={identity.sinner_id} />
                      <span style={{ fontSize: '0.75rem', color: detailColor }}>
                        {detail}
                      </span>
                    </div>
                  )
                })()}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
