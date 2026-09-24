"use client";
import useSWR from "swr";
import { useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Heart } from "lucide-react";
import ProfileSummary from "./ProfileSummary";
import { getCommunityCopy } from "@/lib/community/copy";
import { useHtmlFlag } from "@/hooks/useHtmlFlag";
import type { CommunityProfile } from "@/lib/community/rules";
async function fetcher(url: string): Promise<CommunityProfile> {
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error(), { status: r.status });
  return r.json();
}
export default function PublicProfile({ id }: { id: string }) {
  const locale = useLocale(),
    t = getCommunityCopy(locale);
  useHtmlFlag("with-compact-footer");
  const { data, error, mutate } = useSWR(
    `/api/community/profiles/${id}`,
    fetcher,
    { shouldRetryOnError: false },
  );
  return (
    <div className="community-shell">
      <div className="community-profile-panel">
      <div className="community-page-heading">
        <span>{t.publicProfile}</span>
        <Link href="/decks" className="community-link">
          {t.back}
        </Link>
      </div>
      {error ? (
        <div className="community-state" role="alert">
          <p>{error.status === 404 ? t.unavailable : t.error}</p>
          {error.status !== 404 && (
            <button className="community-button" onClick={() => void mutate()}>
              {t.retry}
            </button>
          )}
        </div>
      ) : !data ? (
        <div className="community-state" role="status">
          {t.loading}
        </div>
      ) : (
        <ProfileSummary data={data} />
      )}
      </div>
      {data && !error && (
          <section className="community-recent">
            <h2>{t.recentDecks}</h2>
            {data.decks.length ? (
              <div className="community-deck-grid">
                {data.decks.map((deck) => (
                  <Link
                    key={deck.id}
                    href={`/decks/${deck.id}`}
                    className="community-deck-entry"
                  >
                    <h3>{deck.title}</h3>
                    <small>
                      <time>
                        {new Date(deck.created_at).toLocaleDateString(locale)}
                      </time>
                      <span>
                        <Heart size={14} />
                        {deck.vote_count}
                      </span>
                    </small>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="community-muted">{t.noDecks}</p>
            )}
          </section>
      )}
    </div>
  );
}
