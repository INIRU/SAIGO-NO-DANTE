"use client";

import Image from "next/image";
import QuietImage from "@/components/ui/QuietImage";
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
        <h4 className="font-[family-name:var(--font-paperlogy)] font-bold text-base text-[#f2a7b8]">
          {floor}F · {label("제약 설정", "制約設定", "Constraints")}
        </h4>
        <div className="relative aspect-[407/214] w-32 shrink-0">
          <QuietImage
            src={getConstraintAssetUrl("total")}
            alt=""
            fill
            sizes="96px"
            className="object-fill"
          />
          <span className={`absolute inset-x-[6%] top-[14%] whitespace-nowrap text-center font-[family-name:var(--font-body)] leading-none text-[#e7b9c3] text-[0.5625rem]`}>
            {label(
              "누적 제약 점수",
              "累積制約スコア",
              "Total constraint score",
            )}
          </span>
          <strong className={`absolute inset-x-[16%] top-[34%] text-center font-[family-name:var(--font-title)] font-normal text-[1.875rem] leading-none tabular-nums ${points > 0 ? "text-[#ffd23f]" : "text-[#f2ece0]"}`}>
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
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-[0.8125rem] ${active ? "border-[#d0506a] bg-[rgba(208,80,106,0.16)] text-[#ffdbe2]" : "border-[#2e2417] text-[#8a7d69]"}`}
              >
                <span className="font-[family-name:var(--font-bebas-kai)] text-[1rem] leading-none tabular-nums">{c.score}</span>
                <span className={active ? "font-semibold" : ""}>{c.names[lang]}</span>
                {active && <span aria-label={label("선택됨", "選択済み", "Selected")} className="text-[#ff8aa0]">✓</span>}
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
              <QuietImage
                src={getConstraintAssetUrl("card")}
                alt=""
                fill
                sizes="200px"
                className="pointer-events-none object-fill"
              />
              <span
                className={`pointer-events-none absolute transition-opacity duration-300 motion-reduce:transition-none ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}
                style={{ left: "0%", top: "0%", width: "100%", height: "100.64%" }}
              >
                <QuietImage
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
                width={231}
                height={197}
                className="absolute left-1/2 top-[1%] z-10 h-auto w-[27%] -translate-x-1/2 object-contain"
              />
              {/* Sizes in cqw (share of the card's width) follow the game's earlier constraint card, never under 0.6875rem;
                  a description longer than its panel scrolls there, like the game's long card texts. */}
              <strong className={`absolute inset-x-[12%] top-[29%] -translate-y-1/2 text-center font-[family-name:var(--font-heading)] font-bold leading-tight text-[#ff9aae] [text-shadow:0_0.1em_0.2em_rgba(0,0,0,0.9)] ${lang === "ko" ? "text-[9.3cqw]" : "text-[7.5cqw]"}`}>
                {c.names[lang]}
              </strong>
              <span
                style={{ wordBreak: lang === "ko" ? "keep-all" : "normal" }}
                className={`absolute inset-x-[14%] top-[36%] bottom-[27%] overflow-y-auto overscroll-contain whitespace-pre-line text-left font-[family-name:var(--font-game-text)] font-normal leading-[1.3] text-[#efe6e8] [text-shadow:0_0.05em_0.2em_rgba(0,0,0,0.9)] ${{ ko: "text-[max(0.6875rem,6.6cqw)]", ja: "text-[max(0.6875rem,6cqw)]", en: "text-[max(0.6875rem,5.2cqw)]" }[lang]}`}
              >
                {c.descriptions[lang].replace(/\n{2,}/g, "\n")}
              </span>
              <span className="absolute inset-x-[14%] top-[75.5%] text-center font-[family-name:var(--font-game-text)] text-[5.2cqw] leading-none text-[#f0dfe2]">
                {label("제약 보상", "制約報酬", "Constraint rewards")}
              </span>
              <div className="absolute inset-x-[14%] top-[80%] flex justify-center text-[#f1e2c6]">
                <span className="flex items-center gap-[2cqw]">
                  <Image src={getGameUiAsset("start-buffs/starlight")} alt={label("별빛", "星明かり", "Starlight")} width={32} height={32} className="h-[13cqw] w-[13cqw] object-contain" />
                  <strong className="font-[family-name:var(--font-title)] font-normal text-[12.5cqw] leading-none tabular-nums">
                    {c.score * constraintSource.rewardMultiplier.starlight}
                  </strong>
                </span>
              </div>
            </>
          );
          const className =
            "group relative block aspect-[347/469] w-full max-w-[12.5rem] bg-transparent [container-type:inline-size] transition-transform duration-200 motion-reduce:transition-none";
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
              className={`${className} hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#ff8aa0]`}
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
