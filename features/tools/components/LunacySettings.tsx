"use client";
import { useState } from "react";
import { X, SlidersHorizontal, ChevronRight } from "lucide-react";
import BaseModal from "@/components/ui/BaseModal";
import Dropdown from "@/components/ui/Dropdown";
import { NumberControl, Toggle, LunacyIcon } from "./LunacyControls";
import { copy } from "@/features/tools/lib/lunacy/copy";
import {
  PRODUCTS,
  weeklyMirrorEvents,
  type Plan,
} from "@/features/tools/lib/lunacy/calculator";
import css from "./LunacyCalendar.module.css";
export default function LunacySettings({
  plan,
  lang,
  onChange,
  onPeriod,
}: {
  plan: Plan;
  lang: "ko" | "en" | "ja";
  onChange: (p: Plan) => void;
  onPeriod: (month: string) => void;
}) {
  const t = copy[lang];
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<"holdings" | "membership" | "weekly">("holdings"),
    [mode, setMode] = useState<"hard1" | "hard3" | "normal3">("hard1");
  const year = Number(plan.month.slice(0, 4));
  const number = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    max = 10000000,
    icon = false,
  ) => (
    <NumberControl
      label={label}
      value={value}
      onChange={onChange}
      max={max}
      increase={t.increase}
      decrease={t.decrease}
      icon={icon}
    />
  );
  return (
    <>
      <button className={css.settingsTrigger} onClick={() => setOpen(true)}>
        <span>
          <SlidersHorizontal size={19} />
          {t.settings}
        </span>
        <span>
          {plan.month}
          <ChevronRight size={17} />
        </span>
      </button>
      <BaseModal
        open={open}
        onClose={() => setOpen(false)}
        title={t.settings}
        maxWidth="42rem"
      >
        <div className={css.modal}>
          <header>
            <div>
              <p className={css.eyebrow}>{t.title}</p>
              <h2>{t.settings}</h2>
            </div>
            <button aria-label={t.close} onClick={() => setOpen(false)}>
              <X />
            </button>
          </header>
          <div className={css.modalBody}>
            <div className={css.periodPicker}>
              <span>{t.period}</span>
              <div>
                <Dropdown
                  ariaLabel={t.year}
                  value={String(year)}
                  onChange={(v) => onPeriod(`${v}-${plan.month.slice(5)}`)}
                  options={Array.from({ length: 5 }, (_, i) => year + i - 2)
                    .filter((v) => v >= 2000 && v <= 2099)
                    .map((v) => ({ value: String(v), label: String(v) }))}
                />
                <Dropdown
                  ariaLabel={t.month}
                  value={plan.month.slice(5)}
                  onChange={(v) => onPeriod(`${year}-${v}`)}
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: String(i + 1).padStart(2, "0"),
                    label: new Intl.DateTimeFormat(lang, {
                      month: "long",
                      timeZone: "UTC",
                    }).format(new Date(Date.UTC(2026, i, 1))),
                  }))}
                />
              </div>
            </div>
            <div className={css.tabs}>
              {(["holdings", "membership", "weekly"] as const).map((key) => (
                <button
                  key={key}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                >
                  {t[key]}
                </button>
              ))}
            </div>
            <div className={css.settingsPanel}>
              {tab === "holdings" && (
                <>
                  <div className={css.balanceInputs}>
                    {number(
                      `${t.opening} · ${t.free}`,
                      plan.openingFree,
                      (n) => onChange({ ...plan, openingFree: n }),
                      10000000,
                      true,
                    )}
                    {number(
                      `${t.opening} · ${t.paid}`,
                      plan.openingPaid,
                      (n) => onChange({ ...plan, openingPaid: n }),
                      10000000,
                      true,
                    )}
                  </div>
                  <p>{t.periodNote}</p>
                </>
              )}
              {tab === "membership" && (
                <>
                  {(["21", "22"] as const).map((id) => (
                    <div className={css.membershipSetting} key={id}>
                      <div>
                        <LunacyIcon size={42} />
                        <span>
                          <strong>{id === "21" ? t.large : t.small}</strong>
                          <small>
                            {t.daily} · {t.free} +
                            {PRODUCTS.find((p) => p.id === id)!.dailyFree}
                          </small>
                        </span>
                      </div>
                      {number(
                        t.remaining + " · " + (id === "21" ? t.large : t.small),
                        plan.existingDays[id],
                        (n) =>
                          onChange({
                            ...plan,
                            existingDays: { ...plan.existingDays, [id]: n },
                          }),
                        60,
                      )}
                    </div>
                  ))}
                  <p>{t.extension}</p>
                </>
              )}
              {tab === "weekly" && (
                <>
                  <Toggle
                    label={t.maintenance}
                    checked={plan.maintenance}
                    onChange={(v) => onChange({ ...plan, maintenance: v })}
                  />
                  {number(
                    t.prior,
                    plan.priorBonuses,
                    (n) => onChange({ ...plan, priorBonuses: n }),
                    3,
                  )}
                  <div className={css.weeklySchedule}>
                    <span>{t.schedule}</span>
                    <div className={css.scheduleChoices}>
                      {(["hard1", "normal3", "hard3"] as const).map((v) => (
                        <button
                          aria-pressed={mode === v}
                          key={v}
                          onClick={() => setMode(v)}
                        >
                          {v === "hard1"
                            ? t.hard
                            : v === "hard3"
                              ? t.hard3
                              : t.normal}
                        </button>
                      ))}
                    </div>
                    <button
                      className={css.primary}
                      onClick={() =>
                        onChange({
                          ...plan,
                          events: [
                            ...plan.events,
                            ...weeklyMirrorEvents(plan, mode),
                          ],
                        })
                      }
                    >
                      {t.fill}
                    </button>
                  </div>
                  <p>{t.rule}</p>
                </>
              )}
            </div>
            <button
              className={css.primary + " " + css.doneButton}
              onClick={() => setOpen(false)}
            >
              {t.done}
            </button>
          </div>
        </div>
      </BaseModal>
    </>
  );
}
