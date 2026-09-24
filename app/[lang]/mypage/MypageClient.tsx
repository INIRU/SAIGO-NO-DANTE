"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { showSuccess, showError } from "@/lib/toast";
import { useHtmlFlag } from "@/hooks/useHtmlFlag";
import MypageTabs, { type MypageTab } from "./components/MypageTabs";
import ProfileTab from "./components/ProfileTab";
import DecksTab from "./components/DecksTab";
import PlannerTab from "./components/PlannerTab";
import CollectionTab from "./components/CollectionTab";
import { type DeckSummary } from "@/components/decks/DeckCard";
import ProfileSummary from "@/components/community/ProfileSummary";
import { getCommunityCopy } from "@/lib/community/copy";
import type { CommunityProfile } from "@/lib/community/rules";
import { FollowList, ProfilePrivacy } from "@/components/community/Follows";
import { Plus } from "lucide-react";

type Profile = {
  username: string | null;
  collection_code: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string | null;
};
type ProfileData = {
  profile: Profile;
  decks: DeckSummary[];
  bookmarkedDecks: DeckSummary[];
  email: string;
  stats: {
    deckCount: number;
    planCount: number;
    bookmarkCount: number;
    totalVotesReceived: number;
  };
};
const tabs = ["profile", "decks", "planner", "collection", "follows"];
async function fetcher(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw Error();
  return r.json();
}

export default function MypageClient() {
  const { status } = useSession(),
    router = useRouter(),
    search = useSearchParams();
  const t = getCommunityCopy(useLocale());
  const [followKind, setFollowKind] = useState<"following" | "followers">("following");
  const [activeTab, setActiveTab] = useState<MypageTab>("profile");
  useHtmlFlag("with-compact-footer");
  useEffect(() => {
    const param = search.get("tab"),
      saved = localStorage.getItem("mypage-tab");
    const next = param || saved;
    setActiveTab(next && tabs.includes(next) ? (next as MypageTab) : "profile");
  }, [search]);
  const { data, error, isLoading, mutate } = useSWR<ProfileData>(
    status === "authenticated" ? "/api/profile" : null,
    fetcher,
  );
  const community = useSWR<CommunityProfile>(
    status === "authenticated" ? "/api/community/me" : null,
    fetcher,
  );
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);
  function changeTab(tab: MypageTab) {
    setActiveTab(tab);
    localStorage.setItem("mypage-tab", tab);
    router.replace(`/mypage?tab=${tab}`, { scroll: false });
  }
  async function deleteDeck(id: string) {
    try {
      if (!(await fetch(`/api/decks/${id}`, { method: "DELETE" })).ok)
        throw Error();
      await Promise.all([mutate(), community.mutate()]);
      showSuccess(t.deleteSuccess);
    } catch {
      showError(t.saveError);
    }
  }
  async function removeBookmark(id: string) {
    try {
      if (!(await fetch(`/api/decks/${id}/bookmark`, { method: "POST" })).ok)
        throw Error();
      await mutate();
      showSuccess(t.bookmarkSuccess);
    } catch {
      showError(t.saveError);
    }
  }
  if (error || community.error)
    return (
      <div className="community-shell">
        <div className="community-state" role="alert">
          <p>{t.error}</p>
          <button
            className="community-button"
            onClick={() => {
              void mutate();
              void community.mutate();
            }}
          >
            {t.retry}
          </button>
        </div>
      </div>
    );
  if (status !== "authenticated" || isLoading || !data || !community.data)
    return (
      <div className="community-shell">
        <div className="community-state" role="status">
          {t.loading}
        </div>
      </div>
    );
  return (
    <div className="community-shell">
      <div className="community-profile-panel">
      <div className="community-page-heading">
        <span>{t.mypage}</span>
        <Link href="/decks/new" className="community-button primary">
          <Plus size={16} />
          {t.newDeck}
        </Link>
      </div>
      <ProfileSummary data={community.data} owner onOpenFollows={(kind) => { setFollowKind(kind); changeTab("follows"); }} />
      </div>
      <MypageTabs
        activeTab={activeTab}
        onTabChange={changeTab}
        counts={{
          deckCount: data.stats.deckCount,
          planCount: data.stats.planCount,
        }}
      />
      <div
        className="mt-6"
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "profile" && (
          <div className="community-settings-layout">
            <ProfileTab
              profile={data.profile}
              email={data.email}
              onProfileUpdate={async () => {
                await Promise.all([mutate(), community.mutate()]);
              }}
            />
            <ProfilePrivacy id={community.data.profile.id} publicProfile={community.data.profile.public_profile} onSaved={async () => { await community.mutate(); }} />
          </div>
        )}
        {activeTab === "follows" && <FollowList key={followKind} id={community.data.profile.id} initialKind={followKind} />}
        {activeTab === "decks" && (
          <DecksTab
            decks={data.decks}
            bookmarkedDecks={data.bookmarkedDecks}
            onDeleteDeck={deleteDeck}
            onRemoveBookmark={removeBookmark}
          />
        )}
        {activeTab === "planner" && <PlannerTab />}
        {activeTab === "collection" && (
          <CollectionTab savedCode={data.profile.collection_code} />
        )}
      </div>
    </div>
  );
}
