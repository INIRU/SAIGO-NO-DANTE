"use client";
import { useMemo } from "react";
import useSWR from "swr";
import { useLocale } from "next-intl";
import { Layers } from "lucide-react";
import ProfileRail from "./ProfileRail";
import AchievementGrid from "./AchievementGrid";
import DeckCard from "@/components/decks/DeckCard";
import Skeleton from "@/components/ui/Skeleton";
import { getCommunityCopy } from "@/lib/community/copy";
import { achievementProgress } from "@/lib/community/achievements";
import { useHtmlFlag } from "@/hooks/useHtmlFlag";
import type { CommunityProfile } from "@/lib/community/rules";
import "./community.css";
import styles from "./profile.module.css";

async function fetcher(url: string): Promise<CommunityProfile> {
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error(), { status: r.status });
  return r.json();
}

/** Someone's profile: the same rail as my page, then the badges they earned and their latest decks. */
export default function PublicProfile({ id }: { id: string }) {
  const locale = useLocale(),
    t = getCommunityCopy(locale);
  useHtmlFlag("with-compact-footer");
  const { data, error, mutate } = useSWR(`/api/community/profiles/${id}`, fetcher, { shouldRetryOnError: false });
  // Easter eggs live in the owner's browser, so a public profile shows only badges earned by activity.
  const earned = useMemo(() => (data ? achievementProgress(data.stats).filter((badge) => badge.earned && !badge.hidden) : []), [data]);

  if (error)
    return (
      <div className={`${styles.page} ${styles.withNav}`}>
        <div className={`${styles.empty} lg:col-span-2`} role="alert">
          <p>{error.status === 404 ? t.unavailable : t.error}</p>
          {error.status !== 404 && <button type="button" className={styles.ghost} onClick={() => void mutate()}>{t.retry}</button>}
        </div>
      </div>
    );
  if (!data)
    return (
      <div className={`${styles.page} ${styles.withNav}`} role="status" aria-busy="true">
        <div className={`${styles.rail} sticky-under-nav`}><Skeleton line className="h-[24rem] rounded-xl" /></div>
        <div className={styles.main}>
          <div className={styles.head}><Skeleton className="h-6 w-28" /></div>
          <Skeleton line className="h-40 rounded-xl" />
        </div>
      </div>
    );
  return (
    <div className={`${styles.page} ${styles.withNav}`}>
      <div className={`${styles.rail} sticky-under-nav`}>
        <ProfileRail data={data} />
      </div>
      <div className={styles.main}>
        {earned.length > 0 && (
          <section className={styles.section}>
            <div className={styles.head}>
              <h2 className={styles.title}>{t.badges}<span className={styles.titleCount}>{earned.length}</span></h2>
            </div>
            <AchievementGrid items={earned} />
          </section>
        )}
        <section className={styles.section}>
          <div className={styles.head}>
            <h2 className={styles.title}>{t.recentDecks}<span className={styles.titleCount}>{data.decks.length}</span></h2>
          </div>
          {data.decks.length ? (
            <ul className={styles.list}>{data.decks.map((deck) => <li key={deck.id} className={styles.item}><DeckCard deck={deck} /></li>)}</ul>
          ) : (
            <div className={styles.empty}><Layers aria-hidden="true" /><p>{t.noDecks}</p></div>
          )}
        </section>
      </div>
    </div>
  );
}
