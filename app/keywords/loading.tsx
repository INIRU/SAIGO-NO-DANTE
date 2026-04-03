export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto animate-pulse">
      {/* ── 헤더 ── */}
      <div className="text-center mb-10">
        {/* KEYWORD ARCHIVE 레이블 */}
        <div className="mx-auto mb-2 rounded" style={{ width: '8rem', height: '0.75rem', background: 'rgba(200,144,10,0.2)' }} />
        {/* 제목 */}
        <div className="mx-auto mb-2 rounded" style={{ width: '12rem', height: '2.25rem', background: '#2a2318' }} />
        {/* 부제 */}
        <div className="mx-auto rounded" style={{ width: '18rem', height: '1rem', background: '#1e1a12' }} />
      </div>

      {/* 장식선 */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div style={{ width: '4rem', height: '0.0625rem', background: 'rgba(200,144,10,0.15)' }} />
        <div style={{ width: '0.25rem', height: '0.25rem', background: 'rgba(200,144,10,0.2)', transform: 'rotate(45deg)' }} />
        <div style={{ width: '4rem', height: '0.0625rem', background: 'rgba(200,144,10,0.15)' }} />
      </div>

      {/* ── 사이드바 + 콘텐츠 ── */}
      <div className="flex gap-6">
        {/* ── 사이드바 스켈레톤 (데스크탑만) ── */}
        <aside
          className="hidden lg:flex shrink-0 flex-col gap-4"
          style={{ width: '16rem' }}
        >
          {/* CATEGORY 레이블 */}
          <div className="rounded" style={{ width: '4rem', height: '0.625rem', background: 'rgba(200,144,10,0.18)' }} />

          {/* 카테고리 칩 그리드 (2열 × 5행 = 10개) */}
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="rounded"
                style={{ height: '2.25rem', background: '#1a1510', border: '1px solid rgba(255,255,255,0.06)' }}
              />
            ))}
          </div>

          {/* 구분선 */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

          {/* SEARCH 레이블 */}
          <div className="rounded" style={{ width: '3rem', height: '0.625rem', background: 'rgba(200,144,10,0.18)' }} />

          {/* 검색바 */}
          <div
            className="rounded-lg"
            style={{
              height: '2.25rem',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          />
        </aside>

        {/* ── 메인 콘텐츠 ── */}
        <div className="flex-1 min-w-0">
          {/* 카운트 + 뷰모드 + 정렬 바 */}
          <div className="flex items-center justify-between mb-5">
            {/* 카운트 텍스트 */}
            <div className="rounded" style={{ width: '6rem', height: '1rem', background: '#1a1510' }} />

            {/* 뷰모드 토글 + 정렬 드롭다운 */}
            <div className="flex items-center gap-2">
              {/* 뷰 토글 */}
              <div
                className="rounded"
                style={{
                  width: '4rem',
                  height: '2rem',
                  background: '#1a1510',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
              {/* 정렬 드롭다운 */}
              <div
                className="rounded"
                style={{
                  width: '7rem',
                  height: '2rem',
                  background: '#1a1510',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
            </div>
          </div>

          {/* 키워드 카드 그리드 — detail 뷰 기준 (minmax 18rem) */}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl"
                style={{
                  height: '7rem',
                  background: '#1a1510',
                  border: '1px solid rgba(200,144,10,0.06)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
