"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { signOut } from "next-auth/react";
import { showSuccess, showError } from "@/lib/toast";
import AvatarPicker from "@/components/mypage/AvatarPicker";
import { DEFAULT_AVATAR_URL } from "@/lib/constants/game";
import { getCommunityCopy } from "@/lib/community/copy";
import { Pencil } from "lucide-react";

type Profile = {
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};
export default function ProfileTab({
  profile,
  email,
  onProfileUpdate,
}: {
  profile: Profile;
  email: string;
  onProfileUpdate: () => Promise<void>;
}) {
  const locale = useLocale(),
    t = getCommunityCopy(locale);
  const [name, setName] = useState(profile.username || ""),
    [bio, setBio] = useState(profile.bio || "");
  const [busy, setBusy] = useState(false),
    [avatarOpen, setAvatarOpen] = useState(false),
    [withdraw, setWithdraw] = useState(false);
  async function patch(url: string, data: unknown) {
    const r = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw Error();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await patch("/api/profile", { username: name, bio });
      await onProfileUpdate();
      showSuccess(t.saved);
    } catch {
      showError(t.saveError);
    } finally {
      setBusy(false);
    }
  }
  async function avatar(url: string) {
    setBusy(true);
    try {
      await patch("/api/profile", { avatar_url: url });
      await onProfileUpdate();
      setAvatarOpen(false);
      window.dispatchEvent(new CustomEvent("avatar-changed", { detail: url }));
      showSuccess(t.saved);
    } catch {
      showError(t.saveError);
    } finally {
      setBusy(false);
    }
  }
  async function removeAccount() {
    setBusy(true);
    try {
      if (!(await fetch("/api/profile", { method: "DELETE" })).ok)
        throw Error();
      await signOut({ callbackUrl: `/${locale}` });
    } catch {
      showError(t.saveError);
      setBusy(false);
    }
  }
  return (
    <section className="community-settings">
      <h2>{t.profile}</h2>
      <button
        type="button"
        className="community-link mb-4"
        onClick={() => setAvatarOpen(true)}
        disabled={busy}
      >
        <Pencil size={15} />
        {t.editAvatar}
      </button>
      <form onSubmit={save}>
        <label>
          {t.name}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={1}
            maxLength={20}
            required
            autoComplete="nickname"
          />
        </label>
        <label>
          {t.bio}
          <textarea
            aria-label={t.bio}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={4}
          />
          <span className="community-muted text-right">{bio.length} / 300</span>
        </label>
        <button
          className="community-button primary justify-self-end"
          disabled={busy}
        >
          {busy ? t.saving : t.save}
        </button>
      </form>
      <details className="community-account">
        <summary>{t.account}</summary>
        <p className="community-muted">{email}</p>
        {withdraw ? (
          <>
            <p>{t.withdrawWarning}</p>
            <div className="community-account-actions">
              <button
                className="community-button"
                disabled={busy}
                onClick={() => setWithdraw(false)}
              >
                {t.cancel}
              </button>
              <button
                className="community-button"
                disabled={busy}
                onClick={removeAccount}
              >
                {t.confirm}
              </button>
            </div>
          </>
        ) : (
          <div className="community-account-actions">
            <button
              className="community-button"
              onClick={() => signOut({ callbackUrl: `/${locale}` })}
            >
              {t.logout}
            </button>
            <button
              className="community-button"
              onClick={() => setWithdraw(true)}
            >
              {t.withdraw}
            </button>
          </div>
        )}
      </details>
      <AvatarPicker
        open={avatarOpen}
        currentUrl={profile.avatar_url}
        onSelect={avatar}
        onReset={() => avatar(DEFAULT_AVATAR_URL)}
        onClose={() => setAvatarOpen(false)}
      />
    </section>
  );
}
