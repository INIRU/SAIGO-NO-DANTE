// 기프트 탭과 그 안의 패널(격자·선택 창·최종 기프트 영역)이 함께 쓰는 전역 스타일. 상태가 없고, 기프트 탭이 그려질 때 같이 들어간다.
export default function GiftPlanTabStyles() {
  return (
    <style jsx global>{`
      /* Ten keywords: one row when the picker is wide enough for ten columns, else five by two (never a short last row). */
      @container (min-width: 56rem) { .planner-gift-start-grid { grid-template-columns: repeat(10, minmax(0, 1fr)) !important; } }
      @container (max-width: 26rem) { .planner-gift-start-grid { gap: 0.25rem !important; } .planner-gift-start-group { padding: 0.375rem 0.125rem 0.5rem !important; } }
      @media (max-width: 767px) {
        .planner-gift-tab {
          gap: 0.875rem !important;
        }

        .planner-gift-subtabs {
          overflow-x: auto;
          scrollbar-width: none;
        }

        .planner-gift-subtabs::-webkit-scrollbar,
        .planner-keyword-sidebar::-webkit-scrollbar,
        .planner-gift-final-keywords::-webkit-scrollbar {
          display: none;
        }

        .planner-gift-subtab {
          min-height: 2.75rem !important;
          padding: 0.625rem 0.875rem !important;
          font-size: 0.9375rem !important;
          white-space: nowrap;
          flex: 0 0 auto;
        }

        .planner-gift-subtab span {
          font-size: 0.75rem !important;
          min-width: 1.5rem;
          text-align: center;
        }

        .planner-gift-info-bar {
          padding: 0.625rem 0.75rem !important;
          gap: 0.5rem !important;
        }

        .planner-gift-info-bar > span {
          font-size: 0.875rem !important;
        }

        .planner-gift-observe-layout,
        .planner-gift-start-layout {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.875rem !important;
        }

        .planner-gift-observe-layout > .planner-selected-panel,
        .planner-gift-start-layout > .planner-selected-panel {
          order: -1 !important;
        }

        .planner-gift-grid-panel {
          flex-direction: column !important;
          width: 100%;
          gap: 0.75rem !important;
        }

        .planner-keyword-sidebar {
          width: 100%;
          max-width: none !important;
          min-width: 0 !important;
          flex-direction: row !important;
          overflow-x: auto;
          gap: 0.375rem !important;
          padding: 0.125rem 0 0.25rem;
          scroll-snap-type: x proximity;
        }

        .planner-keyword-filter {
          min-height: 2.75rem !important;
          min-width: 8.25rem;
          flex: 0 0 auto;
          border: 1px solid #2a2520 !important;
          border-left: 1px solid #2a2520 !important;
          border-bottom: 2px solid transparent !important;
          border-radius: 0.375rem !important;
          padding: 0.5rem 0.625rem !important;
          font-size: 0.9375rem !important;
          scroll-snap-align: start;
        }

        .planner-keyword-filter.is-active {
          border-bottom-color: #c8900a !important;
        }

        .planner-keyword-filter > span:last-child {
          font-size: 0.75rem !important;
          line-height: 1.8 !important;
        }

        .planner-gift-grid-scroll {
          width: 100%;
          max-height: none !important;
          overflow-y: visible !important;
          padding-right: 0 !important;
          gap: 0.875rem !important;
        }

        .planner-gift-card-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          gap: 0.375rem !important;
        }

        .planner-gift-empty {
          padding: 2rem 1rem !important;
          font-size: 0.9375rem !important;
        }

        .planner-selected-panel {
          width: 100%;
          min-width: 0 !important;
          max-width: none !important;
          padding: 0.75rem !important;
        }

        .planner-selected-panel-title {
          font-size: 0.9375rem !important;
        }

        .planner-selected-panel-empty {
          font-size: 0.875rem !important;
        }

        .planner-gift-start-main {
          width: 100%;
        }

        .planner-gift-final-build {
          padding: 0.75rem !important;
        }

        .planner-gift-final-build-header,
        .planner-gift-final-filters,
        .planner-gift-final-condition-legend {
          align-items: stretch !important;
          flex-wrap: wrap !important;
        }

        .planner-gift-final-build-header > div {
          flex-wrap: wrap;
        }

        .planner-gift-final-build-header button,
        .planner-gift-grade-select {
          min-height: 2.75rem !important;
          font-size: 0.9375rem !important;
        }

        .planner-gift-final-help,
        .planner-gift-final-drop-empty,
        .planner-gift-final-list > span {
          font-size: 0.875rem !important;
        }

        .planner-gift-final-drop-empty {
          min-height: 5rem !important;
          padding: 0.5rem;
          text-align: center;
        }

        .planner-gift-final-condition-legend {
          gap: 0.375rem !important;
          font-size: 0.75rem !important;
        }

        .planner-gift-final-search input {
          min-height: 2.75rem !important;
          font-size: 1rem !important;
        }

        .planner-gift-final-keywords {
          order: 2;
          flex: 1 0 100% !important;
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          overflow-x: visible !important;
          gap: 0.375rem !important;
          padding-bottom: 0 !important;
        }

        .planner-gift-final-keywords button {
          min-height: 2.75rem !important;
          justify-content: center;
          font-size: 0.875rem !important;
          white-space: normal !important;
        }

        .planner-gift-grade-select {
          width: 100%;
          padding: 0.5rem 0.625rem !important;
        }

        .planner-gift-final-selected-grid,
        .planner-gift-final-source-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          gap: 0.375rem !important;
        }

        .planner-gift-final-grid-scroll {
          max-height: none !important;
          overflow-y: visible !important;
        }

        .planner-gift-quick-adds {
          gap: 0.5rem !important;
        }

        .planner-quick-add-label {
          font-size: 0.875rem !important;
        }

        .planner-quick-add-list {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.375rem !important;
        }

        .planner-quick-add-chip {
          min-width: 0;
          min-height: 2.75rem !important;
          justify-content: flex-start;
          font-size: 0.875rem !important;
        }

        .planner-quick-add-chip > span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      /* Tablet width in the stacked layout: more columns instead of five cards stretched to ~8rem each. */
      @media (min-width: 480px) and (max-width: 767px) {
        .planner-gift-card-grid {
          grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr)) !important;
        }
      }

      @media (max-width: 359px) {
        .planner-gift-card-grid,
        .planner-gift-final-selected-grid,
        .planner-gift-final-source-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }
      }
    `}</style>
  )
}
