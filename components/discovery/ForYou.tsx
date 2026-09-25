"use client";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import DeckCard, { type DeckSummary } from "@/components/decks/DeckCard";
import PlanCard, { type PlanSummary } from "@/components/planner/PlanCard";
import { useOwnedIdentities } from "@/hooks/useOwnedIdentities";

type Post = DeckSummary & PlanSummary;

/** A link to what the saved collection can field, then the logged-in user's personal shelf, on the deck and plan boards. */
export default function ForYou({
  kind,
  base,
  personal,
}: {
  kind: "deck" | "planner";
  base: string;
  personal: boolean;
}) {
  const t = useTranslations("discoveryForYou");
  const { status } = useSession();
  const owned = useOwnedIdentities();
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
  return (
    <>
      {owned && (
        <Link href={`${base}?browse=all&oi=true`} data-owned-link
          className="-mt-5 inline-flex w-fit items-center gap-1 text-sm font-semibold text-[var(--gold-light)] underline-offset-4 hover:underline">
          {t(kind === "deck" ? "ownedDecks" : "ownedPlans")}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
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
