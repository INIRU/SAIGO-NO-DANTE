'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { type PlannerState, type PlannerAction } from '@/lib/planner/types'
import { STORAGE_BASE } from '@/lib/constants/game'

const S = STORAGE_BASE

// 가호 데이터 (게임 추출 기반)
interface Blessing {
  baseId: number
  name: string
  costs: [number, number, number]  // [기본, +, ++]
  effectsByLevel: [string[], string[], string[]]  // [기본, +, ++]
}

const BLESSINGS: Blessing[] = [
  { baseId: 100, name: '시작의 별', costs: [10, 20, 30], effectsByLevel: [
    ['시작 코스트 +150', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 1회 무료'],
    ['시작 코스트 +250', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 1회 무료'],
    ['시작 코스트 +250', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 2회 무료'],
  ]},
  { baseId: 101, name: '쌓여가는 별무리', costs: [10, 20, 30], effectsByLevel: [
    ['층 이동 시, 보유 코스트 10% 증가 (최대 100)', '기프트 판매 비용 50% 증가 (상점별 1회)'],
    ['층 이동 시, 보유 코스트 20% 증가 (최대 125)', '기프트 판매 비용 75% 증가 (상점별 1회)'],
    ['층 이동 시, 보유 코스트 30% 증가 (최대 150)', '기프트 판매 비용 100% 증가 (상점별 1회)'],
  ]},
  { baseId: 102, name: '성간여행', costs: [20, 40, 60], effectsByLevel: [
    ['테마팩 목록 +1', '테마팩 새로고침 횟수 +2', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3 (최대 9)'],
    ['테마팩 목록 +1', '테마팩 새로고침 횟수 +3', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3 (최대 9)', '테마팩 해금 수에 따라 라운드 시작 시 버프'],
    ['테마팩 목록 +1', '테마팩 새로고침 횟수 +4', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3 (최대 9)', '테마팩 해금 수에 따라 라운드 시작 시 버프'],
  ]},
  { baseId: 103, name: '쏟아지는 유성우', costs: [20, 40, 60], effectsByLevel: [
    ['시작 코스트 +400', '시작 기프트 수 +1'],
    ['시작 코스트 +500', '시작 기프트 수 +1', '별빛 전투 보상 선택 시 코스트 +75'],
    ['시작 코스트 +700', '시작 기프트 수 +1', '별빛 전투 보상 선택 시 코스트 +150'],
  ]},
  { baseId: 104, name: '쌍성계 상점', costs: [30, 60, 90], effectsByLevel: [
    ['상점 기프트 목록 +1', '전투 보급 코스트 +20', '상점에서 높은 등급 기프트 등장 확률 상승'],
    ['상점 기프트 목록 +1', '전투 보급 코스트 +30', '상점에서 높은 등급 기프트 등장 확률 상승', '상점 입장 시 기프트 등급 합 기반 코스트 획득'],
    ['상점 기프트 목록 +1', '전투 보급 코스트 +40', '상점에서 높은 등급 기프트 등장 확률 상승', '상점 입장 시 기프트 등급 합 기반 코스트 획득'],
  ]},
  { baseId: 105, name: '위성계 상점', costs: [30, 60, 90], effectsByLevel: [
    ['상점 키워드 새로고침 1회 무료', '1층 입장 시, 무작위 1등급 기프트 1개 획득'],
    ['상점 키워드 새로고침 1회 무료', '1층 입장 시, 무작위 1등급 기프트 2개 획득', '강화 상점 출현 확률 증가'],
    ['상점 키워드 새로고침 2회 무료', '1층 입장 시, 무작위 1등급 기프트 3개 획득', '강화 상점 출현 확률 증가'],
  ]},
  { baseId: 106, name: '성운의 총애', costs: [40, 80, 120], effectsByLevel: [
    ['1층 입장 시, 인격 레벨 +3', '층 클리어 시, 인격 레벨 +1 (최대 5)'],
    ['1층 입장 시, 인격 레벨 +3', '층 클리어 시, 인격 레벨 +1 (최대 9)'],
    ['1층 입장 시, 인격 레벨 +3', '6층 입장 시, 인격 레벨 +3', '층 클리어 시, 인격 레벨 +1 (최대 9)'],
  ]},
  { baseId: 107, name: '별빛의 인도', costs: [40, 80, 120], effectsByLevel: [
    ['속도 최댓값 +2', '합 위력 증가 1', '피해량 증가 1', '보호 1'],
    ['속도 최댓값 +3', '합 위력 증가 1', '피해량 증가 1', '보호 1'],
    ['속도 최댓값 +3', '합 위력 증가 1', '피해량 증가 1', '보호 1'],
  ]},
  { baseId: 108, name: '우연한 혜성', costs: [50, 100, 150], effectsByLevel: [
    ['상점 입장 시 합성 판매용 기프트 1개 획득', '3층 입장 시, 무작위 3등급 기프트 1개 획득', '합성 시, 2단계 낮은 무작위 기프트 획득 (상점별 1회)'],
    ['상점 입장 시 합성 판매용 기프트 2개 획득', '3/5층 입장 시, 무작위 3등급 기프트 1개 획득', '합성 시, 2단계 낮은 무작위 기프트 획득 (상점별 1회)'],
    ['상점 입장 시 합성 판매용 기프트 3개 획득', '3/5/7층 입장 시, 무작위 4등급 기프트 1개 획득', '합성 시, 1단계 낮은 무작위 기프트 획득 (상점별 1회)'],
  ]},
  { baseId: 109, name: '완전한 가능성', costs: [60, 120, 180], effectsByLevel: [
    ['테마팩 목록 +1', '시작 기프트 수 +1', '입장 시, 키워드 3등급 기프트 1개 선택 획득', '입장 시, 어두운 잔영 1개 획득'],
    ['테마팩 목록 +1', '시작 기프트 수 +1', '입장 시, 키워드 3등급 기프트 2개 선택 획득', '입장 시, 1~2등급 합성 재료 기프트 획득'],
    ['테마팩 목록 +1', '시작 기프트 수 +1', '입장 시, 키워드 3등급 기프트 3개 선택 획득', '입장 시, 1~3등급 합성 재료 기프트 획득'],
  ]},
]

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
}

export default function BlessingTab({ state, dispatch }: Props) {
  // 가호 선택 상태: giftInventory에 'blessing_{baseId}_{level}' 형태로 저장
  const selectedBlessings = useMemo(() => {
    const map = new Map<number, number>() // baseId → level (0=미선택, 1=기본, 2=+, 3=++)
    for (const id of state.giftInventory) {
      if (id.startsWith('blessing_')) {
        const parts = id.split('_')
        const baseId = parseInt(parts[1])
        const level = parseInt(parts[2])
        map.set(baseId, level)
      }
    }
    return map
  }, [state.giftInventory])

  const totalCost = useMemo(() => {
    let cost = 0
    for (const [baseId, level] of selectedBlessings) {
      const blessing = BLESSINGS.find(b => b.baseId === baseId)
      if (blessing && level > 0) cost += blessing.costs[level - 1]
    }
    return cost
  }, [selectedBlessings])

  const toggleBlessing = (baseId: number, targetLevel: number) => {
    // 기존 선택 제거
    const existingKey = state.giftInventory.find(id => id.startsWith(`blessing_${baseId}_`))
    if (existingKey) {
      dispatch({ type: 'REMOVE_GIFT', giftId: existingKey })
    }

    const currentLevel = selectedBlessings.get(baseId) ?? 0
    // 같은 레벨 클릭 → 해제, 다른 레벨 → 변경
    if (currentLevel !== targetLevel) {
      dispatch({ type: 'ADD_GIFT', giftId: `blessing_${baseId}_${targetLevel}` })
    }
  }

  const allSelectedAtLevel = (level: number) =>
    BLESSINGS.every(b => selectedBlessings.get(b.baseId) === level)

  const isAnySelected = selectedBlessings.size > 0

  const selectAll = (level: number) => {
    // 이미 전부 해당 레벨이면 → 전체 해제
    const shouldClear = allSelectedAtLevel(level)
    // 기존 가호 전부 제거
    for (const id of state.giftInventory) {
      if (id.startsWith('blessing_')) dispatch({ type: 'REMOVE_GIFT', giftId: id })
    }
    if (!shouldClear) {
      for (const b of BLESSINGS) {
        dispatch({ type: 'ADD_GIFT', giftId: `blessing_${b.baseId}_${level}` })
      }
    }
  }

  const clearAll = () => {
    for (const id of state.giftInventory) {
      if (id.startsWith('blessing_')) dispatch({ type: 'REMOVE_GIFT', giftId: id })
    }
  }

  return (
    <div>
      {/* 상단: 별빛 코스트 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Image src={`${S}/icons/start-buffs/starlight.webp`} alt="별빛" width={24} height={24} style={{ width: '1.5rem', height: '1.5rem' }} />
          <div>
            <span style={{ color: '#e8dcc8', fontSize: '0.875rem', fontWeight: 600 }}>사용 별빛</span>
            <span style={{ color: '#c8900a', fontSize: '1.125rem', fontWeight: 700, marginLeft: '0.5rem' }}>{totalCost}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => selectAll(1)} className="px-3 py-1.5 rounded text-xs font-semibold transition-all hover:brightness-110" style={{ background: allSelectedAtLevel(1) ? '#c8900a30' : '#c8900a20', color: '#c8900a', border: '1px solid #c8900a40' }}>
            {allSelectedAtLevel(1) ? '전체 해제' : '전체 선택'}
          </button>
          <button onClick={() => selectAll(2)} className="px-3 py-1.5 rounded text-xs font-semibold transition-all hover:brightness-110" style={{ background: allSelectedAtLevel(2) ? '#4898b030' : '#4898b020', color: '#4898b0', border: '1px solid #4898b040' }}>
            {allSelectedAtLevel(2) ? '+ 해제' : '전체 +'}
          </button>
          <button onClick={() => selectAll(3)} className="px-3 py-1.5 rounded text-xs font-semibold transition-all hover:brightness-110" style={{ background: allSelectedAtLevel(3) ? '#c8303030' : '#c8303020', color: '#c83030', border: '1px solid #c8303040' }}>
            {allSelectedAtLevel(3) ? '++ 해제' : '전체 ++'}
          </button>
        </div>
      </div>

      {/* 가호 카드 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {BLESSINGS.map(blessing => {
          const level = selectedBlessings.get(blessing.baseId) ?? 0
          const isSelected = level > 0
          const currentCost = level > 0 ? blessing.costs[level - 1] : blessing.costs[0]

          return (
            <div
              key={blessing.baseId}
              className="rounded-lg overflow-hidden transition-all flex flex-col"
              style={{
                background: '#1a1510',
                border: `1px solid ${isSelected ? '#c8900a50' : '#222'}`,
                boxShadow: isSelected ? '0 0 12px #c8900a15' : 'none',
              }}
            >
              {/* 헤더: 아이콘 + 이름 + 코스트 */}
              <div className="flex items-center gap-2 p-3 pb-2">
                <Image
                  src={`${S}/icons/start-buffs/${blessing.baseId}.webp`}
                  alt={blessing.name}
                  width={32} height={32}
                  style={{ width: '2rem', height: '2rem', objectFit: 'contain' }}
                />
                <div className="flex-1 min-w-0">
                  <div style={{ color: isSelected ? '#e8dcc8' : '#888', fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.2 }}>
                    {blessing.name}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Image src={`${S}/icons/start-buffs/starlight.webp`} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span style={{ color: '#c8900a', fontSize: '0.75rem', fontWeight: 700 }}>{currentCost}</span>
                </div>
              </div>

              {/* 효과 목록 */}
              <div className="px-3 pb-2 flex-1">
                {(blessing.effectsByLevel[Math.max(0, level - 1)] ?? blessing.effectsByLevel[0]).map((eff: string, i: number) => (
                  <div key={i} style={{ color: '#777', fontSize: '0.625rem', lineHeight: 1.5 }}>
                    • {eff}
                  </div>
                ))}
              </div>

              {/* +/++ 버튼 */}
              <div className="flex border-t" style={{ borderColor: '#222' }}>
                {[1, 2, 3].map(lvl => {
                  const labels = ['', '+', '++']
                  const isActive = level === lvl
                  return (
                    <button
                      key={lvl}
                      onClick={() => toggleBlessing(blessing.baseId, lvl)}
                      className="flex-1 py-2 text-center font-semibold transition-all"
                      style={{
                        background: isActive ? '#c8900a30' : 'transparent',
                        color: isActive ? '#e8b030' : '#555',
                        fontSize: '0.75rem',
                        borderRight: lvl < 3 ? '1px solid #222' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {lvl === 1 ? '기본' : labels[lvl - 1]}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
