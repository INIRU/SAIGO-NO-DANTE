"use client";
import useSWR from "swr";
import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { AlertTriangle, Hammer, MapPin } from "lucide-react";
import { craftableAtFloor } from "@/lib/planner/floor-guidance";
import type { FloorEntry, GiftData, RecipeData } from "@/lib/planner/types";
type Event = {
  id: number;
  name: string;
  name_en: string | null;
  name_jp: string | null;
  desc_text: string | null;
  desc_text_en: string | null;
  desc_text_jp: string | null;
  gift_ids: number[];
  theme_ids: number[];
};
type Context = {
  events: Event[];
  themes: {
    id: number;
    name: string;
    boss_image_url: string | null;
    specific_ego_gift_ids: number[] | null;
  }[];
};
export default function FloorGuidance({
  entry,
  entries,
  inventory,
  recipes,
  gifts,
}: {
  entry: Pick<FloorEntry, "floor" | "theme_id" | "gift_ids">;
  entries: Pick<FloorEntry, "floor" | "gift_ids">[];
  inventory: string[];
  recipes: RecipeData[];
  gifts: Map<number, GiftData>;
}) {
  const lang = useLocale();
  const label = (ko: string, ja: string, en: string) =>
    lang === "ko" ? ko : lang === "ja" ? ja : en;
  const { data, error, mutate } = useSWR<Context>(
    "/api/planner/context",
    async (u) => {
      const r = await fetch(u);
      if (!r.ok) throw Error();
      return r.json();
    },
    { revalidateOnFocus: false },
  );
  const theme = data?.themes.find((t) => String(t.id) === entry.theme_id);
  const craftable = craftableAtFloor(
    entry.floor,
    entries,
    inventory,
    recipes,
    gifts,
  );
  const name = (g: GiftData) =>
    lang === "en"
      ? g.name_en || g.name
      : lang === "ja"
        ? g.name_jp || g.name
        : g.name;
  return (
    <div
      className="mt-3 space-y-3 text-xs leading-5"
      data-floor-guidance={entry.floor}
    >
      {error && (
        <button onClick={() => mutate()} className="text-[var(--gold)]">
          {label(
            "획득 정보 다시 불러오기",
            "入手情報を再取得",
            "Retry acquisition details",
          )}
        </button>
      )}
      {theme?.boss_image_url && (
        <div className="flex items-center gap-3 border-t border-[var(--border)] pt-2">
          <Image
            src={theme.boss_image_url}
            alt={label("테마팩 보스", "テーマパックのボス", "Theme pack boss")}
            width={80}
            height={64}
            className="h-16 w-20 object-contain"
          />
          <span className="text-[var(--text-muted)]">
            {label("테마팩 보스", "テーマパックのボス", "Theme pack boss")}
          </span>
        </div>
      )}
      {entry.gift_ids.map((id) => {
        const gift = gifts.get(Number.parseInt(id, 10));
        if (!gift) return null;
        const events =
          data?.events.filter(
            (e) =>
              e.gift_ids?.includes(gift.game_id) &&
              (!entry.theme_id ||
                e.theme_ids?.includes(Number(entry.theme_id))),
          ) ?? [];
        const exclusive = theme?.specific_ego_gift_ids?.includes(gift.game_id);
        if (!events.length && !exclusive) return null;
        return (
          <div key={id} className="border-l border-[var(--gold-dim)] pl-3">
            <p className="text-[var(--text-primary)]">{name(gift)}</p>
            {exclusive && (
              <p className="flex items-start gap-1 text-[#e8a14c]">
                <AlertTriangle size={13} className="mt-1 shrink-0" />
                {label(
                  "테마팩 전용 · 떠나기 전에 획득을 확인하세요.",
                  "テーマパック専用。移動前に入手を確認。",
                  "Theme pack gift. Check acquisition before leaving.",
                )}
              </p>
            )}
            {events.map((e) => {
              const title =
                (lang === "en"
                  ? e.name_en
                  : lang === "ja"
                    ? e.name_jp
                    : e.name) ||
                (lang === "en"
                  ? e.desc_text_en
                  : lang === "ja"
                    ? e.desc_text_jp
                    : e.desc_text) ||
                `#${e.id}`;
              return (
                <Link
                  key={e.id}
                  href={`/mirror-dungeon?tab=events&event=${e.id}`}
                  className="mt-1 flex items-start gap-1 text-[var(--gold)] hover:underline"
                >
                  <MapPin size={13} className="mt-1 shrink-0" />
                  {title
                    .replace(/<[^>]*>/g, "")
                    .split("\n")[0]
                    .slice(0, 90)}
                </Link>
              );
            })}
          </div>
        );
      })}
      {craftable.map((r) => (
        <p
          key={r.recipe.id}
          className="flex items-center gap-2 border border-[#88a83055] bg-[#88a8300a] p-2 text-[#aec65b]"
        >
          <Hammer size={15} />
          {label("조합 가능", "合成可能", "Can fuse")}: {name(r.result!)}
          <span className="text-[var(--text-muted)]">
            {label("계획한 재료 기준", "予定素材基準", "Planned materials")}
          </span>
        </p>
      ))}
    </div>
  );
}
