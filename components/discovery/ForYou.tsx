"use client";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import DeckCard, { type DeckSummary } from "@/components/decks/DeckCard";
import PlanCard, { type PlanSummary } from "@/components/planner/PlanCard";
import { KEYWORD_FILTERS } from "@/lib/constants/gift";
import { keywordTrend } from "@/lib/discovery/recommend";
import type { Identity } from "@/lib/types";

type Post = DeckSummary & PlanSummary;
type Shared = {
  popular: Post[];
  identities: Identity[];
  counts: { kind: string; entity_id: string; visitors: number }[];
};

/** Community trend lines plus the logged-in user's personal shelf, shown on the deck and plan boards. */
export default function ForYou({
  kind,
  data,
  base,
  personal,
}: {
  kind: "deck" | "planner";
  data?: Shared;
  base: string;
  personal: boolean;
}) {
  const t = useTranslations("discoveryForYou"),
    sinner = useTranslations("sinner"),
    lang = useLocale();
  const { status } = useSession();
  // Personal data: fetched per user with no-store, never through the shared discovery cache.
  const { data: mine } = useSWR<{ items: Post[] }>(
    personal && status === "authenticated" ? `/api/discovery/for-you?kind=${kind}` : null,
    async (u: string) => {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) throw Error();
      return r.json();
    },
  );
  const items = mine?.items ?? [];
  const top = data?.identities[0];
  const visitors = new Map(
    data?.counts.filter((c) => c.kind === kind).map((c) => [c.entity_id, c.visitors]),
  );
  const keyword = data ? keywordTrend(data.popular, visitors) : null;
  const slug = KEYWORD_FILTERS.find((k) => k.label === keyword)?.slug;
  const link = (href: string) => (chunks: React.ReactNode) => (
    <Link href={href} className="font-semibold text-[var(--gold-light)] underline-offset-4 hover:underline">
      {chunks}
    </Link>
  );
  const identityName = top
    ? `${(lang === "en" ? top.name_en : lang === "ja" ? top.name_jp : null) || top.name_kr} ${sinner(top.sinner_id)}`
    : "";
  return (
    <>
      {(top || slug) && (
        <div className="-mt-5 space-y-1.5 border-l border-[#2e2417] pl-3 text-sm leading-6 text-[var(--text-secondary)]" data-discovery-trends>
          {top && (
            <p>{t.rich("identityTrend", { name: identityName, link: link(`${base}?browse=all&ids=${top.id}`) })}</p>
          )}
          {keyword && slug && (
            <p>
              {t.rich(kind === "deck" ? "deckKeywordTrend" : "planKeywordTrend", {
                keyword: t(`keywords.${slug}`),
                link: link(`${base}?browse=all&${kind === "deck" ? "kw" : "kt"}=${encodeURIComponent(keyword)}`),
              })}
            </p>
          )}
        </div>
      )}
      {items.length > 0 && (
        <section data-for-you>
          <h2 className="font-[family-name:var(--font-paperlogy)] text-lg font-bold leading-snug tracking-[-0.02em] text-[var(--gold)]">
            {t(kind === "deck" ? "decksTitle" : "plansTitle")}
          </h2>
          <p className="mb-4 mt-1 text-sm text-[var(--text-muted)]">{t("hint")}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.slice(0, 3).map((post, index) => (
              <div key={post.id} className={`min-w-0 ${index === 2 ? "hidden xl:block" : ""}`}>
                {kind === "deck" ? <DeckCard deck={post} /> : <PlanCard plan={post} />}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
