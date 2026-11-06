"use client";
import { useMemo } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { getLunacyProductIconUrl } from "@/lib/utils/images";
import {
  calculatePlan,
  PRODUCTS,
  type Plan,
} from "@/features/tools/lib/lunacy/calculator";
import { copy } from "@/features/tools/lib/lunacy/copy";
import { LunacyIcon, Toggle } from "./LunacyControls";
import css from "./LunacyCalendar.module.css";
export default function LunacyProductPicker({
  plan,
  date,
  lang,
  value,
  onChange,
  onPlanChange,
  quantity,
}: {
  plan: Plan;
  quantity: number;
  date: string;
  lang: "ko" | "en" | "ja";
  value: string;
  onChange: (id: string) => void;
  onPlanChange: (plan: Plan) => void;
}) {
  const t = copy[lang];
  const previews = useMemo(
    () =>
      new Map(
        PRODUCTS.filter((p) =>
          ["21", "22", "1", "2", "3", "4", "5", "6"].includes(p.id),
        ).map((p) => {
          const id = `preview-${p.id}`;
          return [
            p.id,
            calculatePlan({
              ...plan,
              events: [
                ...plan.events,
                { id, date, kind: "purchase", productId: p.id, first: !plan.firstUsed.includes(p.id), quantity: p.limit === "none" && p.id === value ? quantity : 1 },
              ],
            }).entries.find((e) => e.id === id)!,
          ];
        }),
      ),
    [plan, date, quantity, value],
  );
  const products = PRODUCTS.filter((p) =>
    ["21", "22", "1", "2", "3", "4", "5", "6"].includes(p.id),
  ).sort((a, b) => Number(!!b.dailyFree) - Number(!!a.dailyFree));
  const selected = PRODUCTS.find((p) => p.id === value)!;
  return (
    <div className={css.productPicker}>
      <div className={css.productGrid}>
        {products.map((p) => {
          const preview = previews.get(p.id)!;
          return (
            <div
              className={css.productCard}
              key={p.id}
              data-testid={`product-${p.id}`}
              data-selected={value === p.id}
            >
              <button
                type="button"
                className={css.productSelect}
                aria-pressed={value === p.id}
                onClick={() => onChange(p.id)}
              >
                <span className={css.productArt}>
                  <Image
                    src={getLunacyProductIconUrl(p.id)}
                    alt=""
                    width={112}
                    height={112}
                  />
                  {value === p.id && (
                    <span className={css.selectedMark}>
                      <Check size={15} />
                    </span>
                  )}
                </span>
                <span className={css.productHeading}>
                  <strong>{p.name[lang]}</strong>
                  <b>₩{(p.price * (p.limit === "none" && p.id === value ? quantity : 1)).toLocaleString(lang)}</b>
                </span>
                {preview.warning && (
                  <span className={css.productWarning}>
                    {t[preview.warning]}
                  </span>
                )}
              </button>
              <div className={css.productRewards}>
                <span className={css.productContents}>
                  {(p.paid > 0 || p.firstPaid) && (
                    <span className={css.productCurrency}>
                      <LunacyIcon size={25} />
                      <span>
                        {t.paid}{" "}
                        <b>+{preview.warning ? p.paid : preview.paid}</b>
                        {preview.first && <em>{t.first}</em>}
                      </span>
                    </span>
                  )}
                  {(p.free > 0 || p.dailyFree) && (
                    <span className={css.productCurrency}>
                      <LunacyIcon size={25} />
                      <span>
                        {p.dailyFree ? `${t.daily} · ` : ""}
                        {t.free}{" "}
                        <b>
                          +
                          {p.dailyFree ||
                            (preview.warning ? p.free : preview.free)}
                        </b>
                        {p.dailyFree && <small> ×30 {t.days}</small>}
                      </span>
                    </span>
                  )}
                </span>
                {p.firstPaid !== undefined && (
                  <div className={css.firstPurchase}>
                    <Toggle
                      label={t.first}
                      checked={!!preview.first}
                      showState
                      onChange={(first) => {
                        onChange(p.id);
                        const recordedFirst = new Map(calculatePlan(plan).entries.map(entry => [entry.id, !!entry.first]));
                        onPlanChange({
                          ...plan,
                          events: plan.events.map(event => event.kind === "purchase" && event.first === undefined ? { ...event, first: recordedFirst.get(event.id) ?? false } : event),
                          firstUsed: first
                            ? plan.firstUsed.filter((id) => id !== p.id)
                            : [...new Set([...plan.firstUsed, p.id])],
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className={css.selectedProduct}>
        {t.selected} · {selected.name[lang]} · ₩
        {(selected.price * (selected.limit === "none" ? quantity : 1)).toLocaleString(lang)}
      </p>
      {selected.dailyFree && <p>{t.extension}</p>}
    </div>
  );
}
