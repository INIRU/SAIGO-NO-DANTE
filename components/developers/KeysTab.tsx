import { useState } from "react";
import { ArrowUpRight, Copy, EyeOff, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { goToLogin } from "@/lib/auth-return";
import { usageByDay } from "@/app/[lang]/developers/api-reference";
import { copyText, digits, field, goldButton, heading, panel, quietButton, useText, type KeyRow } from "./developer-ui";

/** API keys of the account (create, revoke) and how much each was used. */
export default function KeysTab({ status, keys, loading, failed, reload, limits, raise }: {
  status: string; keys: KeyRow[]; loading: boolean; failed: boolean; reload: () => Promise<unknown>;
  limits: { minute: number; day: number | null };
  /** Whether to offer the "request a higher limit" link (accounts on the standard limits). */
  raise: boolean;
}) {
  const { lang, label } = useText();
  const count = (value: number) => value.toLocaleString(lang);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function change(method: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/developer/keys", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw Error();
      if (result.key) {
        setSecret(result.key);
        setName("");
      }
      if (method === "DELETE") setSecret("");
      await reload();
      setMessage(label("반영했습니다.", "更新しました。", "Updated."));
    } catch {
      setMessage(label("처리하지 못했습니다. 다시 시도해주세요.", "再試行してください。", "Could not complete. Please retry."));
    } finally {
      setBusy(false);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const usage = usageByDay(keys, today);
  const peak = Math.max(1, ...usage.map((day) => day.requests));
  const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`;
  const times = label("회", "回", "");

  return (
    <div className="space-y-5">
      <section className={panel} aria-labelledby="api-keys-heading">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="api-keys-heading" className={heading}>{label("API 키", "APIキー", "API keys")}</h2>
          <p role="status" aria-live="polite" className="text-right text-sm text-[var(--gold-light)]">{message}</p>
        </div>
        {status === "loading" ? (
          <p role="status" className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" />{label("로그인 확인 중", "ログインを確認中", "Checking sign-in")}</p>
        ) : status !== "authenticated" ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{label("로그인하면 API 키를 발급하고 사용량을 확인할 수 있습니다.", "ログインするとキーの発行と使用量の確認ができます。", "Sign in to create API keys and track their usage.")}</p>
            <button className={goldButton} onClick={() => goToLogin(lang)}><Plus size={16} aria-hidden />{label("로그인 후 키 발급", "ログインして発行", "Sign in to create a key")}</button>
          </div>
        ) : (
          <form className="flex flex-wrap items-center gap-3" onSubmit={(event) => { event.preventDefault(); if (!busy && name.trim()) void change("POST", { name: name.trim() }); }}>
            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} aria-label={label("키 이름", "キー名", "Key name")} placeholder={label("서비스 이름", "サービス名", "Service name")} className={`${field} flex-1 basis-48`} />
            <button disabled={busy || !name.trim()} className={goldButton}>
              {busy ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Plus size={16} aria-hidden />}{label("새 키 발급", "新規発行", "Create key")}
            </button>
          </form>
        )}
        {secret && <div className="mt-4 rounded-md bg-[var(--bg-deep)] p-4">
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">{label("발급한 키는 한 번만 표시됩니다. 서버에 보관하고 공개 코드에 넣지 마세요.", "キーは一度だけ表示されます。公開せず、サーバーで保管してください。", "Shown once. Keep this key on your server, out of public code.")}</p>
          <code className="block break-all text-xs leading-6 text-[var(--gold-light)]">{secret}</code>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button className={quietButton} onClick={() => copyText(secret, label("복사했습니다.", "コピーしました。", "Copied."), label("텍스트를 직접 복사해주세요.", "手動でコピーしてください。", "Please copy the text manually."))}><Copy size={14} aria-hidden />{label("복사", "コピー", "Copy")}</button>
            <button className={quietButton} onClick={() => setSecret("")}><EyeOff size={14} aria-hidden />{label("숨기기", "閉じる", "Hide")}</button>
          </div>
        </div>}
        {loading && <p role="status" className="mt-4 text-sm text-[var(--text-muted)]">{label("키 목록을 불러오는 중", "キーを読み込み中", "Loading keys")}</p>}
        {!!keys.length && <ul className="mt-4 space-y-2">
          {keys.map((key) => (
            <li key={key.id} className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-white/[0.025] px-4 py-3.5 ${key.revoked_at ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1 basis-44">
                <p className="break-words text-sm font-medium">{key.name}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]"><code>{key.prefix}…</code><span className={`ml-3 ${key.revoked_at ? "text-[var(--text-muted)]" : "text-[#90b393]"}`}>{key.revoked_at ? label("폐기됨", "失効", "Revoked") : label("사용 중", "有効", "Active")}</span></p>
              </div>
              <dl className="grid grid-cols-[5rem_6.5rem] gap-4 text-right text-xs text-[var(--text-secondary)]">
                <div><dt>{label("오늘", "本日", "Today")}</dt><dd className={`${digits} mt-1 text-xl text-[var(--text-primary)]`}>{count(key.developer_usage.filter((day) => day.day === today).reduce((sum, day) => sum + day.requests, 0))}</dd></div>
                <div><dt>{label("전체", "合計", "Total")}</dt><dd className={`${digits} mt-1 text-xl text-[var(--text-primary)]`}>{count(key.developer_usage.reduce((sum, day) => sum + day.requests, 0))}</dd></div>
              </dl>
              <button className={`${quietButton} min-w-16 justify-center text-[#cf8076] hover:bg-[#cf8076]/10 hover:text-[#cf8076] ${key.revoked_at ? "invisible" : ""}`} disabled={busy || !!key.revoked_at} onClick={() => change("DELETE", { id: key.id })} aria-label={`${key.name} ${label("폐기", "失効", "Revoke")}`}><Trash2 size={14} aria-hidden />{label("폐기", "失効", "Revoke")}</button>
            </li>
          ))}
        </ul>}
        {failed && <p role="alert" className="mt-4 text-sm text-[#cf8076]">{label("키 목록을 불러오지 못했습니다.", "取得に失敗しました。", "Could not load keys.")} <button className="underline underline-offset-4" onClick={() => reload()}>{label("다시 시도", "再試行", "Retry")}</button></p>}
      </section>

      <section className={`${panel} grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem]`}>
        <div>
          <h2 className={`${heading} mb-4`}>{label("최근 14일 요청", "直近14日のリクエスト", "Requests, last 14 days")}</h2>
          <div className="flex h-28 items-end gap-1.5 border-b border-[#2e2417]" role="img" aria-label={label("날짜별 요청 수", "日別リクエスト数", "Requests per day")}>
            {usage.map((day, index) => (
              <div key={day.day} title={`${day.day} ${count(day.requests)}`} className={`h-full flex-1 origin-bottom transition-transform duration-500 ease-out motion-reduce:transition-none ${index === usage.length - 1 ? "bg-[var(--gold-light)]" : "bg-[var(--gold)]/45"}`} style={{ transform: `scaleY(${day.requests / peak})` }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[0.6875rem] tabular-nums text-[var(--text-muted)]"><span>{shortDay(usage[0].day)}</span><span>{shortDay(usage[7].day)}</span><span>{label("오늘", "本日", "Today")}</span></div>
        </div>
        <div className="md:border-l md:border-[#2e2417] md:pl-6">
          <h2 className={`${heading} mb-4`}>{label("요청 한도", "リクエスト制限", "Request limits")}</h2>
          <dl className="space-y-4">
            <div className="flex items-baseline justify-between gap-4"><dt className="text-xs text-[var(--text-secondary)]">{label("분당 요청", "1分あたり", "Per minute")}</dt><dd><span className={`${digits} text-2xl`}>{count(limits.minute)}</span><span className="ml-1 text-xs text-[var(--text-secondary)]">{times}</span></dd></div>
            <div className="flex items-baseline justify-between gap-4"><dt className="text-xs text-[var(--text-secondary)]">{label("하루 요청", "1日あたり", "Per day")}</dt><dd>{limits.day === null
              ? <span className="font-[family-name:var(--font-heading)] text-base text-[var(--gold-light)]">{label("제한 없음", "制限なし", "No limit")}</span>
              : <><span className={`${digits} text-2xl`}>{count(limits.day)}</span><span className="ml-1 text-xs text-[var(--text-secondary)]">{times}</span></>}</dd></div>
          </dl>
          <p className="mt-5 text-xs leading-relaxed text-[var(--text-muted)]">{label("하루 사용량은 UTC 기준으로 초기화됩니다. 폐기한 키는 즉시 차단됩니다.", "日次使用量はUTCでリセットされます。失効は即時適用されます。", "Daily usage resets at midnight UTC. Revocation takes effect immediately.")}</p>
          {raise && <Link href="/support?topic=api-limit" className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm text-[var(--gold)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]">
            {label("추가 한도 요청하기", "制限の引き上げを相談", "Request a higher limit")}<ArrowUpRight size={15} aria-hidden />
          </Link>}
        </div>
      </section>
    </div>
  );
}
