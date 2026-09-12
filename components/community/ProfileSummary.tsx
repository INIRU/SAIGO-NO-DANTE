"use client";
import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { ArrowUpRight, Copy, Heart, Layers, BookOpenCheck } from "lucide-react";
import { DEFAULT_AVATAR_URL } from "@/lib/constants/game";
import { getCommunityCopy } from "@/lib/community/copy";
import type { CommunityProfile } from "@/lib/community/rules";
import { showError, showSuccess } from "@/lib/toast";
import "./community.css";
import { FollowSummary } from "./Follows";

export default function ProfileSummary({
  data,
  owner = false,
  onOpenFollows,
}: {
  data: CommunityProfile;
  owner?: boolean;
  onOpenFollows?: (kind: "following" | "followers") => void;
}) {
  const locale = useLocale(),
    t = getCommunityCopy(locale);
  const { profile, stats } = data;
  async function share() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${locale}/users/${profile.id}`,
      );
      showSuccess(t.copied);
    } catch {
      showError(t.saveError);
    }
  }
  return (
    <section className="community-profile" data-testid="community-profile">
      <div className="community-identity">
        <p className="community-eyebrow">{t.manager}</p>
        <div className="community-person">
          <Image
            src={profile.avatar_url || DEFAULT_AVATAR_URL}
            alt=""
            width={88}
            height={88}
            className="community-avatar"
          />
          <div className="community-name">
            <h1>{profile.username || t.anonymous}</h1>
            <p className="community-joined">
              {t.joined}{" "}
              {new Date(profile.created_at).toLocaleDateString(locale, {
                year: "numeric",
                month: "short",
              })}
            </p>
          </div>
        </div>
        <p className="community-bio">{profile.bio || t.noBio}</p>
        <FollowSummary id={profile.id} onOpen={onOpenFollows} />
        {owner && (
          <div className="community-actions">
            {profile.public_profile ? (
              <>
                <Link href={`/users/${profile.id}`} className="community-link">
                  {t.view}
                  <ArrowUpRight size={16} />
                </Link>
                <button
                  onClick={share}
                  className="community-icon-button"
                  aria-label={t.share}
                >
                  <Copy size={16} />
                </button>
              </>
            ) : (
              <span className="community-muted">{t.private}</span>
            )}
          </div>
        )}
      </div>
      <div className="community-score">
        <span className="community-eyebrow">{t.points}</span>
        <strong data-testid="activity-points">
          {stats.points.toLocaleString(locale)}
        </strong>
        <dl className="community-stat-list">
          {(
            [
              { key: "deck", icon: Layers },
              { key: "like", icon: Heart },
              { key: "contribution", icon: BookOpenCheck },
            ] as const
          ).map(({ key, icon: Icon }) => (
            <div key={key}>
              <dt>
                <Icon size={16} />
                {t[key]}
              </dt>
              <dd>{stats[key].toLocaleString(locale)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function ActivityRules() {
  const t = getCommunityCopy(useLocale());
  return (
    <section className="community-rules">
      <h2>{t.rules}</h2>
      <p>{t.rulesIntro}</p>
      <ul>
        <li>{t.deckRule}</li>
        <li>{t.likeRule}</li>
        <li>{t.contributionRule}</li>
      </ul>
      <p className="community-rule-note">{t.ruleNote}</p>
      <Link href="/support" className="community-link">
        {t.support}
        <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}
