"use client";
import { useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { showSuccess, showError } from "@/lib/toast";
import AvatarPicker from "@/features/account/components/AvatarPicker";
import { DEFAULT_AVATAR_URL } from "@/lib/constants/game";
import { getCommunityCopy } from "@/lib/community/copy";
import { LogOut, Pencil } from "lucide-react";
import Button from "@/components/ui/Button";
import { forgetPushSubscription } from "@/hooks/usePushSubscription";

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
  // Arriving from the legal update modal ("decline and delete"): open straight at the withdrawal confirmation.
  const askWithdraw = useSearchParams().get("withdraw") === "1";
  const [name, setName] = useState(profile.username || ""),
    [bio, setBio] = useState(profile.bio || "");
  const [busy, setBusy] = useState(false),
    [avatarOpen, setAvatarOpen] = useState(false),
    [withdraw, setWithdraw] = useState(askWithdraw);
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
      window.dispatchEvent(new CustomEvent("username-changed", { detail: name.trim() }));
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
      <div className="mb-5 flex items-center gap-4">
        <Image
          src={profile.avatar_url || DEFAULT_AVATAR_URL}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 rounded-full object-cover shadow-[0_0_0_2px_#0d0b08,0_0_0_3px_#5a4526]"
        />
        <button
          type="button"
          className="community-link"
          onClick={() => setAvatarOpen(true)}
          disabled={busy}
        >
          <Pencil size={15} />
          {t.editAvatar}
        </button>
      </div>
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
        <Button type="submit" variant="primary" className="justify-self-end" loading={busy}>
          {busy ? t.saving : t.save}
        </Button>
      </form>
      <details className="community-account" open={askWithdraw || undefined}>
        <summary>{t.account}</summary>
        <p className="community-muted">{email}</p>
        {withdraw ? (
          <>
            <p>{t.withdrawWarning}</p>
            <div className="community-account-actions">
              <Button disabled={busy} onClick={() => setWithdraw(false)}>
                {t.cancel}
              </Button>
              <Button variant="danger" loading={busy} onClick={removeAccount}>
                {t.confirm}
              </Button>
            </div>
          </>
        ) : (
          <div className="community-account-actions">
            <Button icon={LogOut} onClick={() => void forgetPushSubscription().finally(() => signOut({ callbackUrl: `/${locale}` }))}>
              {t.logout}
            </Button>
            <Button variant="ghost" onClick={() => setWithdraw(true)}>
              {t.withdraw}
            </Button>
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
