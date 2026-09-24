"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import Image from "next/image";
import { X, Plus, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import BaseModal from "@/components/ui/BaseModal";
import { getResourceIconUrl } from "@/lib/utils/images";
import {
  calculatePlan,
  createPlan,
  planSchema,
  PRODUCTS,
  monthDays,
  weekday,
  type Plan,
  type CalendarEvent,
  type Entry,
} from "@/lib/tools/lunacy/calculator";
import { copy } from "@/lib/tools/lunacy/copy";
import { readPlans, savePlan } from "@/lib/tools/lunacy/storage";
import LunacySettings from "./LunacySettings";
import LunacyProductPicker from "./LunacyProductPicker";
import {
  LunacyIcon as LunacyMark,
  NumberControl,
  Toggle,
} from "./LunacyControls";
import css from "./LunacyCalendar.module.css";
import PageHeader from "@/components/ui/PageHeader";
const storageKey = (month: string) => `limbus-lunacy-plan-v1:${month}`;
export default function LunacyCalendar() {
  const locale = useLocale();
  const lang = locale === "en" || locale === "ja" ? locale : "ko";
  const t = copy[lang];
  const [plan, setPlan] = useState<Plan | null>(null),
    [monthIndex, setMonthIndex] = useState(0),
    [date, setDate] = useState<string | null>(null),
    [error, setError] = useState(false);
  const [kind, setKind] = useState<"mirror" | "purchase" | "bonus">("mirror"),
    [productId, setProductId] = useState("21"),
    [quantity, setQuantity] = useState(1),
    [difficulty, setDifficulty] = useState<"normal" | "hard">("hard"),
    [runs, setRuns] = useState(1),
    [bonuses, setBonuses] = useState(3),
    [label, setLabel] = useState(""),
    [bonusFree, setBonusFree] = useState(0),
    [bonusPaid, setBonusPaid] = useState(0);
  const load = (month: string) => {
    try {
      const saved = readPlans()[month];
      const legacy = saved ? null : localStorage.getItem(storageKey(month));
      const parsed = legacy ? planSchema.safeParse(JSON.parse(legacy)) : null;
      const restored =
        saved ||
        (parsed?.success && parsed.data.month === month
          ? parsed.data
          : createPlan(month));
      setPlan(restored);
      savePlan(restored);
      setError(!!legacy && !parsed?.success);
    } catch {
      setPlan((previous) =>
        previous?.month === month ? previous : createPlan(month),
      );
      setError(true);
    }
    setMonthIndex(0);
    setDate(null);
  };
  useEffect(() => {
    const now = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    const parts = now.match(/\d+/g)!;
    const month =
      parts[0].length === 4
        ? `${parts[0]}-${parts[1]}`
        : `${parts[1]}-${parts[0]}`;
    load(month);
  }, []);
  const computed = useMemo(() => (plan ? calculatePlan(plan) : null), [plan]);
  const change = (next: Plan) => {
    const parsed = planSchema.safeParse(next);
    if (!parsed.success) {
      setError(true);
      return;
    }
    setPlan(parsed.data);
    try {
      savePlan(parsed.data);
      setError(false);
    } catch {
      setError(true);
    }
  };
  const n = (value: number) => value.toLocaleString(lang);
  const num = (
    name: string,
    value: number,
    onChange: (v: number) => void,
    max = 10000000,
    min = 0,
  ) => (
    <NumberControl
      label={name}
      value={value}
      onChange={onChange}
      max={max}
      min={min}
      increase={t.increase}
      decrease={t.decrease}
    />
  );
  if (!plan || !computed)
    return (
      <div className={css.page} aria-busy="true">
        {t.title}
      </div>
    );
  const month = computed.months[monthIndex],
    dates = monthDays(month.month),
    day = date ? computed.days[date] : null;
  const title = (entry: Entry) =>
    entry.kind === "maintenance"
      ? t.maintenance
      : entry.kind === "mirror"
        ? `${t.mirror} · ${entry.event?.kind === "mirror" ? (entry.event.difficulty === "hard" ? t.hardName : t.normalName) + " ×" + entry.event.runs : ""}`
        : entry.kind === "bonus" && entry.event?.kind === "bonus"
          ? entry.event.label
          : `${PRODUCTS.find((p) => p.id === entry.productId)?.name[lang] || ""}${entry.kind === "daily" ? " · " + t.daily : entry.first ? " · " + t.first : ""}${entry.event?.kind === "purchase" && (entry.event.quantity ?? 1) > 1 ? ` ×${entry.event.quantity}` : ""}`;
  const add = () => {
    if (!date) return;
    const base = { id: crypto.randomUUID(), date };
    const event: CalendarEvent =
      kind === "mirror"
        ? { ...base, kind, difficulty, runs, bonuses }
        : kind === "purchase"
          ? { ...base, kind, productId, first: !plan.firstUsed.includes(productId), quantity: PRODUCTS.find(p => p.id === productId)?.limit === "none" ? quantity : 1 }
          : {
              ...base,
              kind,
              label: label.trim() || t.bonus,
              free: bonusFree,
              paid: bonusPaid,
            };
    change({ ...plan, events: [...plan.events, event] });
  };
  return (
    <div className={css.page}>
      <PageHeader title={t.title} description={t.intro} actions={
        <Image src={getResourceIconUrl("lunacy")} alt="" width={112} height={112} priority className="hidden h-12 w-12 opacity-70 sm:block" />
      } />
      <LunacySettings
        plan={plan}
        lang={lang}
        onChange={change}
        onPeriod={load}
      />
      <div className={css.monthBar}>
        <button
          aria-label={t.period + " -1"}
          disabled={monthIndex === 0}
          onClick={() => setMonthIndex(0)}
        >
          <ChevronLeft />
        </button>
        <h2>
          <CalendarDays size={21} />
          {month.month}
        </h2>
        <button
          aria-label={t.period + " +1"}
          disabled={monthIndex === 1}
          onClick={() => setMonthIndex(1)}
        >
          <ChevronRight />
        </button>
      </div>
      <div className={css.totals}>
        {(["free", "paid", "cash"] as const).map((key) => (
          <div
            key={key}
            className={
              key === "free" || key === "paid"
                ? css.currencyCard
                : css.otherCard
            }
          >
            <span>{t[key]}</span>
            <div className={css.amountLine}>
              {(key === "free" || key === "paid") && <LunacyMark size={48} />}
              <strong data-testid={`monthly-${key}`}>
                {key === "cash" ? "₩" : ""}
                {n(month[key])}
              </strong>
            </div>
            {key === "free" || key === "paid" ? (
              <small>
                {t.balance}{" "}
                <b data-testid={`balance-${key}`}>
                  {n(key === "free" ? month.balanceFree : month.balancePaid)}
                </b>
              </small>
            ) : (
              <small>PC · Steam · KRW</small>
            )}
          </div>
        ))}
      </div>
      <div className={css.calendar}>
        <div className={css.weekdays}>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i}>
              {new Intl.DateTimeFormat(lang, {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(2026, 8, 6 + i)))}
            </span>
          ))}
        </div>
        <div className={css.grid}>
          {Array.from({ length: weekday(dates[0]) }, (_, i) => (
            <div key={`empty${i}`} className={css.blank} />
          ))}
          {dates.map((d) => {
            const reward = computed.days[d];
            return (
              <button
                key={d}
                className={css.day}
                data-testid={`day-${d}`}
                aria-label={`${d} · ${t.free} ${reward.free} · ${t.paid} ${reward.paid}`}
                onClick={() => setDate(d)}
              >
                <span className={css.dayNumber}>
                  {Number(d.slice(-2))}
                  {reward.entries.some((e) => e.event) && <i />}
                </span>
                {reward.free > 0 && (
                  <span className={css.free}>
                    <small>{t.free}</small>
                    <span className={css.calendarAmount}>
                      <LunacyMark size={26} />+{n(reward.free)}
                    </span>
                  </span>
                )}
                {reward.paid > 0 && (
                  <span className={css.paid}>
                    <small>{t.paid}</small>
                    <span className={css.calendarAmount}>
                      <LunacyMark size={26} />+{n(reward.paid)}
                    </span>
                  </span>
                )}
                {reward.cash > 0 && (
                  <span className={css.spend}>₩{n(reward.cash)}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p role="status" className={error ? css.error : css.caption}>
        {error ? t.error : t.saved}
      </p>
      <p className={css.caption}>{t.assumption}</p>
      <p className={css.caption}>{t.notice}</p>
      <BaseModal
        open={!!date}
        onClose={() => setDate(null)}
        title={date || t.title}
        maxWidth="44rem"
      >
        <div className={css.modal}>
          <header>
            <div>
              <p className={css.eyebrow}>{t.title}</p>
              <h2>{date}</h2>
            </div>
            <button onClick={() => setDate(null)} aria-label={t.close}>
              <X />
            </button>
          </header>
          <div className={css.modalBody}>
            {day && (
              <div className={css.dayTotal}>
                <span>
                  <small>{t.free}</small>
                  <span className={css.amountLine}>
                    <LunacyMark size={30} />
                    <b data-testid="day-free">+{n(day.free)}</b>
                  </span>
                </span>
                <span>
                  <small>{t.paid}</small>
                  <span className={css.amountLine}>
                    <LunacyMark size={30} />
                    <b data-testid="day-paid">+{n(day.paid)}</b>
                  </span>
                </span>
                <span>
                  <small>{t.cash}</small>
                  <b>₩{n(day.cash)}</b>
                </span>
              </div>
            )}
            <div className={css.tabs}>
              {(["mirror", "purchase", "bonus"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                >
                  {t[value]}
                </button>
              ))}
            </div>
            <div
              className={
                css.editor + (kind === "purchase" ? " " + css.shopEditor : "")
              }
            >
              {kind === "mirror" ? (
                <>
                  <div className={css.row}>
                    <Dropdown
                      ariaLabel={t.mirror}
                      value={difficulty}
                      onChange={setDifficulty}
                      options={[
                        { value: "hard", label: t.hardName },
                        { value: "normal", label: t.normalName },
                      ]}
                    />
                    <Dropdown
                      ariaLabel={t.runs}
                      value={String(runs)}
                      onChange={(v) => setRuns(Number(v))}
                      prefix={t.runs}
                      options={[1, 2, 3].map((v) => ({
                        value: String(v),
                        label: String(v),
                      }))}
                    />
                    <Dropdown
                      ariaLabel={t.bonuses}
                      value={String(bonuses)}
                      onChange={(v) => setBonuses(Number(v))}
                      prefix={t.bonuses}
                      options={[0, 1, 2, 3].map((v) => ({
                        value: String(v),
                        label: String(v),
                      }))}
                    />
                  </div>
                  <p>{t.rule}</p>
                </>
              ) : kind === "purchase" ? (
                <>
                  <LunacyProductPicker
                    plan={plan}
                    quantity={quantity}
                    date={date!}
                    lang={lang}
                    value={productId}
                    onChange={(id) => { if (id !== productId) { setProductId(id); setQuantity(1) } }}
                    onPlanChange={change}
                  />
                  {PRODUCTS.find(p => p.id === productId)?.limit === "none" && <>
                    {num(t.quantity, quantity, setQuantity, 100, 1)}
                    <p>{t.quantityHint}</p>
                  </>}
                </>
              ) : (
                <>
                  <label className={css.field}>
                    <span>{t.label}</span>
                    <input
                      maxLength={60}
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </label>
                  <div className={css.fields}>
                    {num(t.free, bonusFree, setBonusFree)}
                    {num(t.paid, bonusPaid, setBonusPaid)}
                  </div>
                </>
              )}
              <button className={css.primary} onClick={add}>
                <Plus size={16} />
                {t.add}
              </button>
            </div>
            {date && weekday(date) === 4 && plan.maintenance && (
              <Toggle
                label={t.exclude}
                checked={plan.maintenanceExcluded.includes(date)}
                onChange={(v) =>
                  change({
                    ...plan,
                    maintenanceExcluded: v
                      ? [...plan.maintenanceExcluded, date]
                      : plan.maintenanceExcluded.filter((d) => d !== date),
                  })
                }
              />
            )}
            <div className={css.entries}>
              {!day?.entries.length && <p>{t.empty}</p>}
              {day?.entries.map((entry) => (
                <article key={entry.id}>
                  <div>
                    <strong>{title(entry)}</strong>
                    {entry.warning ? (
                      <p className={css.error}>{t[entry.warning]}</p>
                    ) : (
                      <p>
                        {t.free} +{n(entry.free)} · {t.paid} +{n(entry.paid)}
                        {entry.cash > 0 ? ` · ₩${n(entry.cash)}` : ""}
                      </p>
                    )}
                  </div>
                  {entry.event && (
                    <button
                      aria-label={`${t.remove} ${title(entry)}`}
                      onClick={() =>
                        change({
                          ...plan,
                          events: plan.events.filter((e) => e.id !== entry.id),
                        })
                      }
                    >
                      {t.remove}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
