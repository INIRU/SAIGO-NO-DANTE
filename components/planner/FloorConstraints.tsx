"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import {
  constraintsForFloor,
  constraintSource,
} from "@/lib/planner/constraints";
import { getConstraintAssetUrl } from "@/lib/utils/images";
import { getGameUiAsset } from "@/lib/utils/game-ui";

export default function FloorConstraints({
  floor,
  entries,
  onChange,
}: {
  floor: number;
  entries: { floor: number; constraints?: number[] }[];
  onChange?: (ids: number[]) => void;
}) {
  const locale = useLocale();
  const lang = locale === "ja" || locale === "en" ? locale : "ko";
  const label = (ko: string, ja: string, en: string) => ({ ko, ja, en })[lang];
  if (floor < 11 || floor > 15) return null;
  const owned = entries
    .filter((e) => e.floor < floor)
    .flatMap((e) => e.constraints ?? []);
  const selected = entries.find((e) => e.floor === floor)?.constraints ?? [];
  // 읽기 전용(플랜 상세)에서도 그 층에서 고를 수 있는 제약을 전부 보여 주고, 선택한 것만 오버레이를 씌운다
  const rows = constraintsForFloor(floor, owned);
  const points = [...owned, ...selected].reduce(
    (n, id) =>
      n + (constraintSource.constraints.find((c) => c.id === id)?.score ?? 0),
    0,
  );

  return (
    <section className="my-4 min-w-0" data-floor-constraints={floor}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="font-[family-name:var(--font-paperlogy)] font-bold text-base text-[#beb3ef]">
          {floor}F · {label("제약 설정", "制約設定", "Constraints")}
        </h4>
        <div className="relative aspect-[323/197] w-24 shrink-0">
          <Image
            src={getConstraintAssetUrl("total")}
            alt=""
            fill
            sizes="96px"
            className="object-fill"
          />
          <span className="absolute inset-x-[10%] top-[16%] text-center font-[family-name:var(--font-body)] text-[0.5625rem] leading-none text-[#c6b9d7]">
            {label(
              "누적 제약 점수",
              "累積制約スコア",
              "Total constraint score",
            )}
          </span>
          <strong className="absolute inset-x-[10%] top-[45%] text-center font-[family-name:var(--font-bebas-kai)] font-normal text-[1.375rem] leading-none tabular-nums text-[#dfd5b4]">
            {points}
          </strong>
        </div>
      </div>
      {/* 모바일(읽기 전용): 카드 대신 점수·이름 칩으로 간결하게. 선택한 제약은 강조와 체크 표시 */}
      {!onChange && (
        <ul className="flex flex-wrap gap-1.5 pb-2 pt-1 sm:hidden">
          {rows.map((c) => {
            const active = selected.includes(c.id);
            return (
              <li
                key={c.id}
                title={c.descriptions[lang].replace(/\n{2,}/g, "\n")}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-[0.8125rem] ${active ? "border-[#8f7fd6] bg-[rgba(143,127,214,0.16)] text-[#e2dafb]" : "border-[#2e2417] text-[#8a7d69]"}`}
              >
                <span className="font-[family-name:var(--font-bebas-kai)] text-[1rem] leading-none tabular-nums">{c.score}</span>
                <span className={active ? "font-semibold" : ""}>{c.names[lang]}</span>
                {active && <span aria-label={label("선택됨", "選択済み", "Selected")} className="text-[#c3b3ff]">✓</span>}
              </li>
            );
          })}
        </ul>
      )}
      <div className={`${onChange ? "grid" : "hidden sm:grid"} grid-cols-[repeat(auto-fit,minmax(min(100%,10.75rem),1fr))] gap-x-1 gap-y-3 pb-2 pt-2`}>
        {rows.map((c) => {
          const active = selected.includes(c.id);
          const content = (
            <>
              <Image
                src={getConstraintAssetUrl("card")}
                alt=""
                fill
                sizes="200px"
                className="pointer-events-none object-fill"
              />
              <span
                className={`pointer-events-none absolute transition-opacity duration-300 motion-reduce:transition-none ${active ? "opacity-35" : "opacity-0 group-hover:opacity-15"}`}
                style={{ left: "1%", top: "0%", width: "98%", height: "100%" }}
              >
                <Image
                  src={getConstraintAssetUrl("selected")}
                  loading="eager"
                  alt=""
                  fill
                  sizes="200px"
                  className="object-fill"
                />
              </span>
              <Image
                src={getConstraintAssetUrl(`score-${c.score}`)}
                alt={label(`${c.score}점`, `${c.score}点`, `${c.score} points`)}
                width={50}
                height={60}
                className="absolute left-1/2 top-[1%] z-10 h-9 w-9 -translate-x-1/2 object-contain"
              />
              <strong className="absolute inset-x-[10%] top-[21%] -translate-y-1/2 text-center font-bold font-[family-name:var(--font-paperlogy)] text-[0.875rem] tracking-[-0.02em] leading-tight text-[#d8cdf3]">
                {c.names[lang]}
              </strong>
              <span
                style={{ wordBreak: lang === "ko" ? "keep-all" : "normal", fontSize: lang === "ko" ? "0.75rem" : "0.6875rem" }}
                className="absolute inset-x-[10%] top-[29%] whitespace-pre-line text-left font-[family-name:var(--font-body)] font-normal leading-[1.35] text-[#d4bfc4]"
              >
                {c.descriptions[lang].replace(/\n{2,}/g, "\n")}
              </span>
              <span className="absolute inset-x-[14%] top-[75%] text-center text-[0.5625rem] text-[#bd9a99]">
                {label("제약 보상", "制約報酬", "Constraint rewards")}
              </span>
              <div className="absolute inset-x-[14%] top-[81%] flex justify-around gap-2 text-[#dfd5b4]">
                <span className="flex items-center gap-1">
                  <Image src={getGameUiAsset("start-buffs/starlight")} alt={label("별빛", "星明かり", "Starlight")} width={32} height={32} className="h-6 w-6 object-contain" />
                  <strong className="font-[family-name:var(--font-bebas-kai)] font-normal text-[1.25rem] tabular-nums">
                    {c.score * constraintSource.rewardMultiplier.starlight}
                  </strong>
                </span>
                <span className="flex items-center gap-1">
                  <Image src={getGameUiAsset("resources/md-pass")} alt={label("거던 패스", "鏡パス", "MD pass")} width={32} height={32} className="h-6 w-6 object-contain" />
                  <strong className="font-[family-name:var(--font-bebas-kai)] font-normal text-[1.25rem] tabular-nums">
                    {c.score * constraintSource.rewardMultiplier.mdpass}
                  </strong>
                </span>
              </div>
            </>
          );
          const className =
            "group relative block aspect-[486/690] w-full max-w-[12.5rem] bg-transparent transition-transform duration-200 motion-reduce:transition-none";
          return onChange ? (
            <button
              key={c.id}
              type="button"
              aria-label={`${c.names[lang]}: ${c.descriptions[lang].replace(/\n{2,}/g, "\n")}`}
              aria-pressed={active}
              onClick={() =>
                onChange(
                  active
                    ? selected.filter((id) => id !== c.id)
                    : [...selected, c.id],
                )
              }
              className={`${className} hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#c3b3ff]`}
            >
              {content}
            </button>
          ) : (
            <div key={c.id} className={className}>
              {content}
            </div>
          );
        })}
        {!rows.length && (
          <p className="text-xs text-[var(--text-muted)]">
            {label("선택한 제약 없음", "選択なし", "No constraints selected")}
          </p>
        )}
      </div>
    </section>
  );
}
