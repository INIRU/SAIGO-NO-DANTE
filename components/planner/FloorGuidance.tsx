"use client";
import useSWR from "swr";
import { useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { MapPin } from "lucide-react";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import GiftCard from "@/components/ui/GiftCard";
import GiftArtwork from "@/components/ui/GiftArtwork";
import { craftableAtFloor } from "@/lib/planner/floor-guidance";
import type { FloorEntry, GiftData, RecipeData } from "@/lib/planner/types";
type Event = {
  id: number;
  image_url: string | null;
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
};
export default function FloorGuidance({
  entry,
  entries,
  inventory,
  recipes,
  gifts,
  onGiftClick,
}: {
  entry: Pick<FloorEntry, "floor" | "theme_id" | "gift_ids">;
  entries: Pick<FloorEntry, "floor" | "gift_ids">[];
  inventory: string[];
  recipes: RecipeData[];
  gifts: Map<number, GiftData>;
  onGiftClick?: (gift: GiftData) => void;
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
  const events = data?.events.filter((event) =>
    entry.gift_ids.some(id => event.gift_ids?.includes(Number(id))) &&
    (!entry.theme_id || event.theme_ids?.includes(Number(entry.theme_id)))
  ) ?? [];
  if (!error && !events.length && !craftable.length) return null;
  return (
    <aside className="floor-guidance space-y-4 text-xs leading-5" data-floor-guidance={entry.floor}>
      {error && (
        <button onClick={() => mutate()} className="min-h-11 text-[var(--gold)]">
          {label("획득 정보 다시 불러오기", "入手情報を再取得", "Retry acquisition details")}
        </button>
      )}
      {events.length > 0 && <div>
        <h4 className="mb-2 font-medium text-[var(--text-muted)]">{label("획득 이벤트", "入手イベント", "Gift events")}</h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2">
          {events.map((event) => {
            const title = ((lang === "en" ? event.name_en : lang === "ja" ? event.name_jp : event.name)
              || (lang === "en" ? event.desc_text_en : lang === "ja" ? event.desc_text_jp : event.desc_text)
              || `#${event.id}`).replace(/<[^>]*>/g, "").split("\n")[0];
            const rewards = entry.gift_ids.map(id => gifts.get(Number(id))).filter((gift): gift is GiftData => !!gift && event.gift_ids?.includes(gift.game_id));
            return (
              <Link key={event.id} href={`/mirror-dungeon?tab=events&event=${event.id}`}
                title={`${title} · ${rewards.map(name).join(", ")}`} aria-label={`${title} · ${rewards.map(name).join(", ")}`}
                className="group min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
                <span className="relative block aspect-square overflow-hidden rounded-md bg-[#0d0b08] transition-opacity group-hover:opacity-80">
                  {event.image_url ? <ImageWithFallback src={event.image_url} alt="" fill sizes="64px" className="object-cover" /> : <MapPin className="absolute inset-0 m-auto text-[var(--gold-dim)]" size={20} />}
                </span>
                <span className="mt-1 block truncate text-[0.625rem] text-[var(--text-secondary)]">{title}</span>
              </Link>
            );
          })}
        </div>
      </div>}
      {craftable.length > 0 && <div data-floor-craftable={entry.floor}>
        <h4 className="mb-2 font-medium text-[#aec65b]">{label("조합 가능", "合成可能", "Can fuse")}</h4>
        <div className="flex flex-wrap gap-2">
          {craftable.map(({ result }) => result && <div key={result.game_id} className="w-12" title={name(result)}>
            {onGiftClick ? <GiftCard gift={result} onClick={() => onGiftClick(result)} size="3rem" showName={false} /> : <GiftArtwork gift={result} displayName={name(result)} sizes="48px" />}
          </div>)}
        </div>
      </div>}
    </aside>
  );
}
