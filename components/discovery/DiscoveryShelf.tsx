"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { ArrowUpRight, ChevronDown, ChevronUp, History, Layers3 } from "lucide-react";
import BoardSkeleton from "./BoardSkeleton";
import DeckCard, { type DeckSummary } from "@/components/decks/DeckCard";
import PlanCard, { type PlanSummary } from "@/components/planner/PlanCard";
import IdentityCard from "@/components/sinners/IdentityCard";
import {
  readHistory,
  type HistoryItem,
} from "@/lib/discovery/history";
import type { Identity } from "@/lib/types";
type Post = DeckSummary & PlanSummary & { updated_at: string };
type Data = {
  recent: Post[];
  updated: Post[];
  popular: Post[];
  identities: Identity[];
  counts: { kind: string; entity_id: string; visitors: number }[];
};
export default function DiscoveryShelf({
  kind,
  onBrowse,
}: {
  kind: "deck" | "planner";
  onBrowse: () => void;
}) {
  const lang = useLocale(),
    label = (k: string, j: string, e: string) =>
      lang === "ko" ? k : lang === "ja" ? j : e;
  const [days, setDays] = useState(7),
    [expanded, setExpanded] = useState<Set<string>>(() => new Set()),
    [history, setHistory] = useState<{
      items: HistoryItem[];
      queries: string[];
      enabled: boolean;
    }>({ items: [], queries: [], enabled: true });
  useEffect(() => {
    const load = () => setHistory(readHistory());
    load();
    window.addEventListener("limbus-history-changed", load);
    return () => window.removeEventListener("limbus-history-changed", load);
  }, []);
  const { data, error, mutate } = useSWR<Data>(
    `/api/discovery?kind=${kind}&days=${days}`,
    async (u: string) => {
      const r = await fetch(u);
      if (!r.ok) throw Error();
      return r.json();
    },
  );
  const counts = new Map(
    data?.counts
      .filter((r) => r.kind === kind)
      .map((r) => [r.entity_id, r.visitors]),
  );
  const noun =
    kind === "deck"
      ? label("덱", "デッキ", "decks")
      : label("플랜", "プラン", "plans");
  const hasPosts =
    !!data &&
    [data.recent, data.updated, data.popular].some((posts) => posts.length > 0);
  const recentItems = history.items
    .filter((i) => i.kind === kind || i.kind === "identity")
    .slice(0, 8);
  const hasHistory = recentItems.length > 0 || history.queries.length > 0;
  const base = kind === "deck" ? "/decks" : "/planner/community";
  return (
    <div
      className="px-4 pb-16 font-[family-name:var(--font-paperlogy)] md:px-6"
      data-discovery-shelf
    >
      <div className="mx-auto max-w-7xl space-y-9">
        <div className="flex flex-wrap items-center justify-between gap-3 py-1">
          <div className="flex gap-1">
            {hasPosts && (
              <>
                {[7, 30, 0].map((d) => (
                  <button
                    key={d}
                    aria-pressed={d === days}
                    onClick={() => setDays(d)}
                    className={`min-h-10 rounded-full px-4 text-sm transition-colors ${d === days ? "bg-[var(--gold)]/10 text-[var(--gold)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                  >
                    {d === 7
                      ? label("주간", "週間", "Weekly")
                      : d === 30
                        ? label("월간", "月間", "Monthly")
                        : label("전체 기간", "全期間", "All time")}
                  </button>
                ))}
              </>
            )}
          </div>
          <button
            onClick={onBrowse}
            className="ml-auto flex min-h-12 items-center gap-1.5 px-1 text-[1rem] font-semibold text-[var(--gold-light)] transition-colors hover:text-[var(--text-primary)]"
          >
            {label(
              "전체보기 · 필터",
              "すべて・絞り込み",
              "Browse all · Filters",
            )}
            <ArrowUpRight size={14} />
          </button>
        </div>
        {error && (
          <button
            onClick={() => mutate()}
            role="alert"
            className="text-[var(--gold)]"
          >
            {label(
              "목록을 불러오지 못했습니다. 다시 시도",
              "再試行",
              "Could not load. Retry",
            )}
          </button>
        )}
        {!data && !error && (
          <div className="space-y-9">
            {Array.from({ length: 3 }, (_, index) => (
              <BoardSkeleton key={index} kind={kind} shelf count={3} />
            ))}
          </div>
        )}
        {data &&
          (
            [
              [
                "recent",
                label(`새로 올라온 ${noun}`, `新着${noun}`, `New ${noun}`),
                data.recent,
              ],
              [
                "updated",
                label(
                  `최근 수정된 ${noun}`,
                  `最近更新された${noun}`,
                  `Recently updated ${noun}`,
                ),
                data.updated,
              ],
              [
                "popular",
                label(
                  `관리자분들이 자주 찾는 ${noun}`,
                  `よく読まれている${noun}`,
                  `Frequently visited ${noun}`,
                ),
                [...data.popular].sort(
                  (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
                ),
              ],
            ] as const
          )
            .filter(([, , posts]) => posts.length > 0)
            .map(([key, title, posts]) => {
              const isExpanded = expanded.has(key);
              return <section key={key}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-[family-name:var(--font-paperlogy)] text-lg font-bold tracking-[-0.02em] leading-snug text-[var(--gold)]">
                    {title}
                  </h2>
                  <button
                    onClick={() => {
                      if (posts.length <= 3) return onBrowse();
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      });
                    }}
                    aria-expanded={posts.length > 3 ? isExpanded : undefined}
                    className="flex min-h-12 shrink-0 items-center gap-1 px-1 text-[1rem] font-semibold text-[var(--gold-light)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    {posts.length > 3
                      ? isExpanded
                        ? label("접기", "閉じる", "Show less")
                        : label("더보기", "もっと見る", "Show more")
                      : label("전체보기", "すべて", "View all")}
                    {posts.length > 3
                      ? isExpanded
                        ? <ChevronUp size={14} />
                        : <ChevronDown size={14} />
                      : <ArrowUpRight size={14} />}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {posts.slice(0, isExpanded ? 6 : 3).map((post) => (
                    <div key={post.id} className="min-w-0">
                      {kind === "deck" ? (
                        <DeckCard deck={post} />
                      ) : (
                        <PlanCard plan={post} />
                      )}
                    </div>
                  ))}
                </div>
              </section>;
            })}
        {data &&
          !data.recent.length &&
          !data.updated.length &&
          !data.popular.length && (
            <section
              data-discovery-empty
              className="relative flex min-h-[38dvh] flex-col items-center justify-center gap-4 px-5 py-12 text-center"
            >
              <Layers3
                size={44}
                strokeWidth={1}
                className="mb-2 text-[var(--gold-dim)] opacity-60"
              />
              <h2 className="font-[family-name:var(--font-body)] text-xl font-semibold text-[var(--text-primary)]">
                {label(
                  `첫 ${noun}을 남겨주세요`,
                  `最初の${noun}を投稿しましょう`,
                  `Share the first ${kind === "deck" ? "deck" : "plan"}`,
                )}
              </h2>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                {label(
                  "나만의 편성과 공략을 다른 관리자들과 나눠보세요.",
                  "編成と攻略を他の管理人と共有しましょう。",
                  "Share your lineup and strategy with other managers.",
                )}
              </p>
              <Link
                href={kind === "deck" ? "/decks/new" : "/planner"}
                className="mt-2 inline-flex min-h-11 items-center gap-3 rounded-md bg-[var(--gold)]/10 px-5 text-sm font-medium text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20"
              >
                {label(
                  `${noun} 만들기`,
                  `${noun}を作成`,
                  `Create ${kind === "deck" ? "deck" : "plan"}`,
                )}
                <ArrowUpRight size={15} />
              </Link>
            </section>
          )}
        {!!data?.identities.length && (
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-paperlogy)] text-lg font-bold tracking-[-0.02em] leading-snug text-[var(--gold)]">
              {label(
                "관리자분들이 자주 찾는 인격",
                "管理人たちがよく探す人格",
                "Identities managers frequently view",
              )}
            </h2>
            <div className="grid grid-cols-3 items-start gap-4 py-2 max-[22rem]:grid-cols-2 sm:grid-cols-4 sm:gap-6 sm:px-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9">
              {data.identities.map((i, index) => (
                <Link
                  key={i.id}
                  href={`${base}?browse=all&ids=${i.id}`}
                  className={`w-full min-w-0 max-w-24 justify-self-center sm:max-w-28 ${index >= 9 ? "hidden" : index >= 7 ? "hidden xl:block" : index >= 5 ? "hidden lg:block" : index >= 4 ? "hidden md:block" : index >= 3 ? "hidden sm:block" : index === 2 ? "max-[22rem]:hidden" : ""}`}
                >
                  <IdentityCard identity={i} compact />
                </Link>
              ))}
            </div>
          </section>
        )}
        <section className="pt-3">
          {hasHistory && (
            <>
              <h2 className="mb-3 flex items-center gap-2 text-sm text-[var(--gold)]">
                <History size={17} />
                {label("최근 찾아본 기록", "最近の閲覧", "Recently viewed")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {recentItems.map((i) => (
                  <Link
                    key={i.href}
                    href={
                      i.kind === "identity"
                        ? `${base}?browse=all&ids=${i.id}`
                        : i.href
                    }
                    className="rounded-md bg-white/[0.035] px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--gold)]"
                  >
                    {i.title}
                  </Link>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {history.queries.slice(0, 6).map((q) => (
                  <Link
                    key={q}
                    href={`${base}?browse=all&q=${encodeURIComponent(q)}`}
                    className="text-xs text-[var(--gold-dim)]"
                  >
                    #{q}
                  </Link>
                ))}
              </div>
            </>
          )}

        </section>
      </div>
    </div>
  );
}
