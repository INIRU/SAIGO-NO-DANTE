"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import DeckCard, { type DeckSummary } from "@/components/decks/DeckCard";
import PlanCard, { type PlanSummary } from "@/components/planner/PlanCard";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { useOwnedIdentities } from "@/hooks/useOwnedIdentities";
import { forYouPhase } from "@/lib/discovery/for-you-phase";
import { getGameUiAsset } from "@/lib/utils/game-ui";
import { CardSkeleton } from "./BoardSkeleton";
import styles from "./ForYou.module.css";

type Post = DeckSummary & PlanSummary;
type Kind = "deck" | "planner";

/** The skeleton stays at least this long, so a fast answer does not flicker. */
const MIN_CHOOSING_MS = 400;
/** The fold transition of ForYou.module.css, and the settle from skeleton height to the picks' height. */
const FOLD_MS = 300;
/** The third card joins at the three-column width, like the other shelves. */
const slot = (index: number) => `min-w-0 ${index === 2 ? "hidden xl:block" : ""}`;

/** A link to what the saved collection can field, at the top of the deck and plan boards. */
export function OwnedLink({ kind, base }: { kind: Kind; base: string }) {
  const t = useTranslations("discoveryForYou");
  if (!useOwnedIdentities()) return null;
  return (
    <Link href={`${base}?browse=all&oi=true`} data-owned-link
      className="-mt-5 inline-flex w-fit items-center gap-1 text-sm font-semibold text-[var(--gold-light)] underline-offset-4 hover:underline">
      {t(kind === "deck" ? "ownedDecks" : "ownedPlans")}
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

/**
 * The logged-in user's personal shelf. It holds its place with the title and card skeletons while the picks are chosen,
 * then shows them in the same spot, so the shelves below never jump.
 */
export default function ForYou({ kind, personal }: { kind: Kind; personal: boolean }) {
  const t = useTranslations("discoveryForYou");
  const { status } = useSession();
  // Personal data: fetched per user with no-store, never through the shared discovery cache.
  const { data: mine, error } = useSWR<{ items: Post[] }>(
    personal && status === "authenticated" ? `/api/discovery/for-you?kind=${kind}` : null,
    async (u: string) => {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) throw Error();
      return r.json();
    },
  );
  const items = (mine?.items ?? []).slice(0, 3);
  // idle: no skeleton was shown (the picks were already here). holding: it is up for its minimum time. released: it may go.
  const [hold, setHold] = useState<"idle" | "holding" | "released">("idle");
  const phase = forYouPhase({ personal, status, loaded: mine !== undefined || !!error, held: hold === "holding", count: items.length });
  // Hidden when the board was drawn (the session resolved late): the shelf opens instead of popping in.
  const [late] = useState(phase === "hidden");
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    if (phase === "choosing") setHold((current) => (current === "idle" ? "holding" : current));
  }, [phase]);
  useEffect(() => {
    if (hold !== "holding") return;
    const timer = setTimeout(() => setHold("released"), MIN_CHOOSING_MS);
    return () => clearTimeout(timer);
  }, [hold]);
  useEffect(() => {
    if (phase !== "empty") return;
    const timer = setTimeout(() => setFolded(true), FOLD_MS);
    return () => clearTimeout(timer);
  }, [phase]);
  // The picks are rarely exactly as tall as their skeleton (descriptions vary, one column on phones): settle to the new
  // height instead of jumping, so the shelves below glide.
  const inner = useRef<HTMLDivElement>(null);
  const height = useRef(0);
  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    const next = element.offsetHeight;
    if (phase === "ready" && height.current && next !== height.current && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      element.animate([{ height: `${height.current}px` }, { height: `${next}px` }], { duration: FOLD_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    height.current = next;
  }, [phase]);
  // Nothing to fold when no skeleton was ever shown.
  if (phase === "hidden" || folded || (phase === "empty" && hold === "idle")) return null;

  const choosing = phase !== "ready";
  const reveal = hold === "idle" ? "" : styles.rise;
  return (
    <section data-for-you data-phase={phase} aria-busy={phase === "choosing"}
      className={`${styles.shelf} ${late ? styles.late : ""} ${phase === "empty" ? styles.folded : ""}`}>
      <div ref={inner} className={styles.inner}>
        <h2 className="flex items-center gap-1.5 font-[family-name:var(--font-paperlogy)] text-lg font-bold leading-snug tracking-[-0.02em] text-[var(--gold)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getGameUiAsset("start-buffs/starlight")} alt="" className={`${styles.spark} ${choosing ? styles.sparkActive : ""}`} />
          <span className={choosing ? styles.glint : undefined}>{t(kind === "deck" ? "decksTitle" : "plansTitle")}</span>
        </h2>
        {/* The hint keeps its own box in both states (it wraps on phones), with a bone over it while choosing.
            A div, not a p: the bone is a div, and a browser closes a <p> that contains one. */}
        <div className="relative mb-4 mt-1 text-sm text-[var(--text-muted)]">
          <span data-hint className={choosing ? "invisible" : reveal} aria-hidden={choosing}>{t("hint")}</span>
          {choosing && <SkeletonLine w="17rem" h="0.75rem" className="absolute left-0 top-1/2 -translate-y-1/2" />}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-reveal={hold === "idle" ? "instant" : "rise"}>
          {choosing
            ? Array.from({ length: 3 }, (_, index) => (
              <div key={index} data-card-skeleton className={slot(index)}><CardSkeleton kind={kind} /></div>
            ))
            : items.map((post, index) => (
              <div key={post.id} className={`${slot(index)} ${reveal}`} style={{ "--i": index } as CSSProperties}>
                {kind === "deck" ? <DeckCard deck={post} /> : <PlanCard plan={post} />}
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
