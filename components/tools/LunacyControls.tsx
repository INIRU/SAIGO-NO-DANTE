"use client";
import Image from "next/image";
import { Plus, Minus } from "lucide-react";
import { useId } from "react";
import Switch from "@/components/ui/Switch";
import { getResourceIconUrl } from "@/lib/utils/images";
import css from "./LunacyCalendar.module.css";
export function LunacyIcon({ size = 24 }: { size?: number }) {
  return (
    <Image
      className={css.currencyIcon}
      src={getResourceIconUrl("lunacy")}
      alt=""
      width={size}
      height={size}
    />
  );
}
export function NumberControl({
  label,
  value,
  onChange,
  max = 10000000,
  min = 0,
  increase,
  decrease,
  icon = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  min?: number;
  increase: string;
  decrease: string;
  icon?: boolean;
}) {
  const id = useId();
  const set = (v: number) =>
    onChange(Math.max(min, Math.min(max, Math.trunc(v) || 0)));
  return (
    <div className={css.numberField}>
      <label htmlFor={id}>{label}</label>
      <div className={css.stepper}>
        {icon && <LunacyIcon size={34} />}
        <button
          type="button"
          aria-label={`${label} ${decrease}`}
          disabled={value === min}
          onClick={() => set(value - 1)}
        >
          <Minus size={16} />
        </button>
        <input
          id={id}
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => {
            if (/^\d*$/.test(e.target.value)) set(Number(e.target.value));
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              set(value + (e.key === "ArrowUp" ? 1 : -1));
            }
          }}
        />
        <button
          type="button"
          aria-label={`${label} ${increase}`}
          disabled={value === max}
          onClick={() => set(value + 1)}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  showState = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  showState?: boolean;
}) {
  return (
    <label className={css.toggleRow} data-on={checked || undefined}>
      <span>{label}</span>
      {showState && <b className={css.toggleState}>{checked ? "ON" : "OFF"}</b>}
      <Switch size="sm" checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}
