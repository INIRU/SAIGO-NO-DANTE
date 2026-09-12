'use client'


import { getDetailStatIconUrl } from '@/lib/utils/images'
import Image from 'next/image'
import SinnerShardIcon from '@/components/ui/SinnerShardIcon'
import {
  Identity,
  SIN_COLORS,
  RARITY_ICON_MAP,
} from '@/lib/data/sinners'
import { KeywordWithTooltip } from '@/components/sinners/KeywordTooltip'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { SPECIAL_CHARGE_KEYWORDS } from '@/lib/constants/keywords'
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

export default function IdentityInfoCard({ identity, sinColor, currentSeason = 7 }: IdentityInfoCardProps) {
  const { sinMap: kwSinMap } = useKeywordData()
  const kwAll = useKeywords()
  const t = useTranslations()
  const locale = useLocale()
  const associationChips = getAssociationChips(identity, locale as SupportedLang)
  const representativeKeywords = identity.skill_keyword_list && identity.skill_keyword_list.length > 0
    ? identity.skill_keyword_list
    : (identity.keywords ?? [])
  const specialChargeKeywords = representativeKeywords.filter(kw => SPECIAL_CHARGE_KEYWORDS.has(kw))
  const sinKeywords = [...new Set(representativeKeywords)].filter(kw => !SPECIAL_CHARGE_KEYWORDS.has(kw))
  return (
    <div className="card p-6">
      <h2
        className="font-serif font-light mb-4"
        style={{ color: 'var(--gold)', fontSize: '1rem' }}
      >
        {t('identity.info.title')}
      </h2>

      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded"
        style={{
          background: 'linear-gradient(135deg, rgba(200,144,10,0.06) 0%, rgba(200,144,10,0.02) 100%)',
          border: '1px solid var(--border)',
        }}
      >
        {/* 등급 */}
        <div className="flex items-center gap-2">
          {RARITY_ICON_MAP[identity.rarity] && (
            <Image
              src={RARITY_ICON_MAP[identity.rarity]}
              alt=""
              width={identity.rarity === 1 ? 16 : identity.rarity === 2 ? 28 : 40}
              height={16}
              style={{ width: identity.rarity === 1 ? '1rem' : identity.rarity === 2 ? '1.75rem' : '2.5rem', height: 'auto', filter: 'drop-shadow(0 0 3px rgba(200,144,10,0.4))' }}
            />
          )}
        </div>

        {/* 키워드 (메인 상태이상 + 특수 충전) */}
        {(sinKeywords.length > 0 || specialChargeKeywords.length > 0) && (
          <>
            <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
            <div className="flex items-center gap-2 flex-wrap">
              {specialChargeKeywords.map(kw => (
                <KeywordWithTooltip key={kw} keyword={kw}>
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold"
                    style={{ color: SIN_COLORS[kwSinMap['충전']] || '#7b68ee' }}
                  >
                    {getLocalizedKeywordName(kw, kwAll[kw], locale as SupportedLang)}
                  </span>
                </KeywordWithTooltip>
              ))}
              {sinKeywords.map(kw => {
                const kwColor = SIN_COLORS[kwSinMap[kw]] || sinColor
                return (
                  <KeywordWithTooltip key={kw} keyword={kw}>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: kwColor }}
                    >
                      {getLocalizedKeywordName(kw, kwAll[kw], locale as SupportedLang)}
                    </span>
                  </KeywordWithTooltip>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 내성 */}
      {(identity.slash_res || identity.pierce_res || identity.blunt_res) && (() => {
        const localRes = (res: string | undefined | null) => {
          if (res === '취약') return t('identity.resistance.weak')
          if (res === '내성') return t('identity.resistance.resistant')
          return t('identity.resistance.normal')
        }
        return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          {([
            { label: t('identity.info.slash'), res: identity.slash_res, icon: 'slash' },
            { label: t('identity.info.pierce'), res: identity.pierce_res, icon: 'pierce' },
            { label: t('identity.info.blunt'), res: identity.blunt_res, icon: 'blunt' },
          ] as const).map(({ label, res, icon }) => {
            const resColor = res === '취약' ? '#ff6b6b' : res === '내성' ? '#6bbbff' : '#888'
            return (
              <div
                key={label}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}
              >
                <Image
                  src={getDetailStatIconUrl(icon)}
                  alt=""
                  width={14}
                  height={14}
                  style={{ width: '0.875rem', height: '0.875rem' }}
                />
                <span style={{ color: resColor, fontSize: '0.6875rem', fontWeight: 600 }}>
                  {localRes(res)}
                </span>
              </div>
            )
          })}
        </div>
        )
      })()}

      {/* 소속 */}
      {associationChips.length > 0 && (
        <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ color: '#999', fontSize: '0.75rem', marginBottom: '6px' }}>{t('identity.info.traits')}</div>
          <div className="flex flex-wrap gap-1.5">
            {associationChips.map(association => (
              <span
                key={association}
                className="px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1"
                style={{
                  background: `${sinColor}18`,
                  color: sinColor,
                  border: `1px solid ${sinColor}40`,
                }}
              >
                {association}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 출시시기 & 획득 방법 */}
      {(identity.release_date || identity.acquisition_info) && (
        <div className="mt-5 space-y-2">
          {identity.release_date && (
            <div className="flex items-center gap-2">
              <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>{t('identity.info.releaseDate')}</span>
              <span style={{ color: '#bbb', fontSize: '0.75rem' }}>{identity.release_date}</span>
            </div>
          )}
          {(() => {
            const info = identity.acquisition_info
            if (!info) return null

            const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
              default:    { label: t('identity.info.type.default'),    color: '#8a8a8a', bg: 'rgba(138,138,138,0.12)' },
              standard:   { label: t('identity.info.type.standard'),   color: '#6bbbff', bg: 'rgba(107,187,255,0.12)' },
              limited:    { label: t('identity.info.type.limited'),    color: '#ffa502', bg: 'rgba(255,165,2,0.12)' },
              event:      { label: t('identity.info.type.event'),      color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' },
              walpurgis:  { label: t('identity.info.type.walpurgis'),  color: '#7bed9f', bg: 'rgba(123,237,159,0.12)' },
              attendance: { label: t('identity.info.type.attendance'), color: '#a29bfe', bg: 'rgba(162,155,254,0.12)' },
            }
            const GACHA_LABELS: Record<string, { label: string; color: string }> = {
              always:   { label: t('identity.info.gacha.always'),    color: '#6bbbff' },
              seasonal: { label: t('identity.info.gacha.seasonal'),  color: '#ffa502' },
              pickup:   { label: t('identity.info.gacha.pickup'),    color: '#ffa502' },
              walpurgis:{ label: t('identity.info.gacha.walpurgis'), color: '#7bed9f' },
              none:     { label: t('identity.info.gacha.none'),      color: '#999' },
            }

            const typeInfo = TYPE_LABELS[info.type] ?? TYPE_LABELS.standard
            const gachaInfo = GACHA_LABELS[info.gacha] ?? GACHA_LABELS.none
            const gachaName = getLocalizedGachaName(info, locale as SupportedLang)

            return (
              <div className="space-y-2">
                {/* 타입 + 시즌 배지 */}
                <div className="flex items-center gap-2">
                  <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>{t('identity.info.acquisition')}</span>
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
                          color: '#c8900a',
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
                          color: '#7bed9f',
                          background: 'rgba(123,237,159,0.08)',
                          border: '1px solid rgba(123,237,159,0.2)',
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
                          color: '#ff9f43',
                          background: 'rgba(255,159,67,0.08)',
                          border: '1px solid rgba(255,159,67,0.2)',
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
                    <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>{t('identity.info.extraction')}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span style={{ fontSize: '0.75rem', color: gachaInfo.color }}>
                        {gachaInfo.label}
                        {info.gacha === 'seasonal' && info.gacha_from_season && ` (S${info.gacha_from_season}~)`}
                        {info.gacha === 'pickup' && info.gacha_from_season && ` (S${info.gacha_from_season}~)`}
                      </span>
                      {info.target_sinner && (
                        <span style={{ fontSize: '0.75rem', color: '#ffa502' }}>
                          · {info.target_sinner} {t('identity.info.targetExtraction')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {gachaName && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>{t('identity.info.gachaBanner')}</span>
                    <span style={{ fontSize: '0.75rem', color: '#bbb' }}>{gachaName}</span>
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

                  const detailColor = isNew7dLock || isNextSeasonLock ? '#ff6b6b' : '#bbb'

                  return (
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>{t('identity.info.fragmentExchange')}</span>
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
