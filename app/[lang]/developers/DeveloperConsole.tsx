"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { useSession } from "next-auth/react";
import { goToLogin } from "@/lib/auth-return";
import useSWR from "swr";
import { useHtmlFlag } from "@/hooks/useHtmlFlag";
import PageHeader from "@/components/ui/PageHeader";
import { KeyRound, Copy, Trash2, Code2, Plus, EyeOff, ChartNoAxesColumn, LoaderCircle, ArrowUpRight } from "lucide-react";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  revoked_at: string | null;
  developer_usage: { day: string; requests: number }[];
};

export default function DeveloperConsole() {
  const lang = useLocale();
  const label = (ko: string, ja: string, en: string) => lang === "ko" ? ko : lang === "ja" ? ja : en;
  const { status } = useSession();
  useHtmlFlag("with-compact-footer");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resource, setResource] = useState<"decks" | "planners">("decks");
  const { data, error, mutate, isLoading } = useSWR<{ keys: KeyRow[] }>(
    status === "authenticated" ? "/api/developer/keys" : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw Error();
      return response.json();
    },
  );
  async function change(method: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/developer/keys", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw Error();
      if (result.key) {
        setSecret(result.key);
        setName("");
      }
      if (method === "DELETE") setSecret("");
      await mutate();
      setMessage(label("반영했습니다.", "更新しました。", "Updated."));
    } catch {
      setMessage(label("처리하지 못했습니다. 다시 시도해주세요.", "再試行してください。", "Could not complete. Please retry."));
    } finally {
      setBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(label("복사했습니다.", "コピーしました。", "Copied."));
    } catch {
      setMessage(label("텍스트를 직접 복사해주세요.", "手動でコピーしてください。", "Please copy the text manually."));
    }
  }
  const button = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium leading-5 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-40";
  const quietButton = `${button} bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-[var(--text-primary)]`;
  const heading = "flex items-center gap-2.5 font-[family-name:var(--font-paperlogy)] text-lg font-bold tracking-[-0.02em]";
  const example = `GET /api/v1/${resource}?limit=20&offset=0\nAuthorization: Bearer YOUR_API_KEY`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-[5.5rem] text-[var(--text-primary)] sm:px-6" data-developer-console>
      <PageHeader title={label("개발자 도구", "開発者ツール", "Developer tools")} description={label("공개 덱과 플랜을 내 서비스에 연결하세요.", "公開デッキとプランを自分のサービスに接続できます。", "Connect public decks and plans to your service.")} />

      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <section className="min-w-0 rounded-lg bg-[var(--bg-panel)] p-5 sm:p-6" aria-labelledby="api-keys-heading">
          <h2 id="api-keys-heading" className={`${heading} mb-5`}><KeyRound size={20} aria-hidden />{label("API 키", "APIキー", "API keys")}</h2>
          {status === "loading" ? (
            <p role="status" className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" />{label("로그인 확인 중", "ログインを確認中", "Checking sign-in")}</p>
          ) : status !== "authenticated" ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{label("로그인하면 API 키를 발급하고 사용량을 확인할 수 있습니다.", "ログインするとキーの発行と使用量の確認ができます。", "Sign in to create API keys and track their usage.")}</p>
              <button className={`${button} bg-[var(--gold)] text-[var(--bg-deep)] hover:brightness-110`} onClick={() => goToLogin(lang)}>
                <Plus size={16} aria-hidden />{label("로그인 후 키 발급", "ログインして発行", "Sign in to create a key")}
              </button>
            </div>
          ) : (
            <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (!busy && name.trim()) void change("POST", { name: name.trim() }); }}>
              <label htmlFor="developer-key-name" className="text-xs text-[var(--text-secondary)]">{label("키 이름", "キー名", "Key name")}</label>
              <div className="flex flex-wrap items-start gap-3">
                <input id="developer-key-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} placeholder={label("서비스 이름", "サービス名", "Service name")}
                  className="min-h-11 min-w-0 basis-48 flex-1 rounded-md bg-[var(--bg-deep)] px-3 py-2 text-sm leading-5 ring-1 ring-inset ring-white/10 placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--gold)]" />
                <button disabled={busy || !name.trim()} className={`${button} bg-[var(--gold)] text-[var(--bg-deep)] hover:brightness-110`}>
                  {busy ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Plus size={16} aria-hidden />}{label("새 키 발급", "新規発行", "Create key")}
                </button>
              </div>
            </form>
          )}
          {isLoading && <p role="status" className="mt-5 text-sm text-[var(--text-muted)]">{label("키 목록을 불러오는 중", "キーを読み込み中", "Loading keys")}</p>}
          {!!data?.keys.length && <ul className="mt-5 space-y-3">
            {data.keys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center gap-3 rounded-md bg-white/[0.025] p-4">
                <KeyRound size={20} className="hidden shrink-0 text-[var(--text-muted)] sm:block" aria-hidden />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="break-words text-sm font-medium">{key.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <code className="text-xs text-[var(--text-secondary)]">{key.prefix}…</code>
                    <span className={`text-[0.625rem] ${key.revoked_at ? "text-[var(--text-muted)]" : "text-[#90b393]"}`}>{key.revoked_at ? label("폐기됨", "失効", "Revoked") : label("사용 중", "有効", "Active")}</span>
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-[var(--text-secondary)]">
                    <span>{label("오늘 요청", "本日", "Today")} <strong className="font-normal text-[var(--text-primary)]">{key.developer_usage.filter((u) => u.day === new Date().toISOString().slice(0, 10)).reduce((sum, u) => sum + u.requests, 0).toLocaleString(lang)}</strong></span>
                    <span>{label("전체 요청", "全リクエスト", "Total")} <strong className="font-normal text-[var(--text-primary)]">{key.developer_usage.reduce((sum, u) => sum + u.requests, 0).toLocaleString(lang)}</strong></span>
                  </p>
                </div>
                {!key.revoked_at && <button className={`${button} text-[#cf8076] hover:bg-[#cf8076]/10`} disabled={busy} onClick={() => change("DELETE", { id: key.id })} aria-label={`${key.name} ${label("폐기", "失効", "Revoke")}`}><Trash2 size={16} aria-hidden />{label("폐기", "失効", "Revoke")}</button>}
              </li>
            ))}
          </ul>}
          {secret && <div className="mt-4 rounded-md bg-[var(--bg-deep)] p-4">
            <p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">{label("발급한 키는 한 번만 표시됩니다. 서버에 보관하고 공개 코드에 넣지 마세요.", "キーは一度だけ表示されます。公開せず、サーバーで保管してください。", "Shown once. Keep this key on your server, out of public code.")}</p>
            <code className="block break-all text-xs leading-6 text-[var(--gold)]">{secret}</code>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button className={quietButton} onClick={() => copy(secret)}><Copy size={16} aria-hidden />{label("복사", "コピー", "Copy")}</button>
              <button className={quietButton} onClick={() => setSecret("")}><EyeOff size={16} aria-hidden />{label("숨기기", "閉じる", "Hide")}</button>
            </div>
          </div>}
          {error && <p role="alert" className="mt-4 text-sm text-[#cf8076]">{label("키 목록을 불러오지 못했습니다.", "取得に失敗しました。", "Could not load keys.")} <button className="underline underline-offset-4" onClick={() => mutate()}>{label("다시 시도", "再試行", "Retry")}</button></p>}
        </section>

        <aside className="rounded-lg bg-[var(--bg-panel)] p-5 sm:p-6" aria-labelledby="api-limits-heading">
          <h2 id="api-limits-heading" className={`${heading} mb-6`}><ChartNoAxesColumn size={20} aria-hidden />{label("요청 한도", "リクエスト制限", "Request limits")}</h2>
          <dl className="space-y-5 text-sm">
            <div className="flex items-baseline justify-between gap-4"><dt className="text-[var(--text-secondary)]">{label("분당 요청", "1分あたり", "Per minute")}</dt><dd className="font-[family-name:var(--font-paperlogy)] font-bold tabular-nums">60{label("회", "回", "")}</dd></div>
            <div className="flex items-baseline justify-between gap-4"><dt className="text-[var(--text-secondary)]">{label("하루 요청", "1日あたり", "Per day")}</dt><dd className="font-[family-name:var(--font-paperlogy)] font-bold tabular-nums">10,000{label("회", "回", "")}</dd></div>
          </dl>
          <p className="mt-6 text-xs leading-relaxed text-[var(--text-muted)]">{label("키별 한도입니다. 하루 사용량은 UTC 기준으로 초기화됩니다. 폐기한 키는 즉시 차단됩니다.", "キーごとの制限です。日次使用量はUTCでリセットされます。失効は即時適用されます。", "Limits apply per key. Daily usage resets at midnight UTC. Revocation takes effect immediately.")}</p>
          <Link href="/support?topic=api-limit" className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm text-[var(--gold)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]">
            {label("추가 한도 요청하기", "制限の引き上げを相談", "Request a higher limit")}<ArrowUpRight size={15} aria-hidden />
          </Link>
        </aside>
      </div>

      <section className="mt-5 rounded-lg bg-[var(--bg-panel)] p-5 sm:p-6" aria-labelledby="api-start-heading">
        <h2 id="api-start-heading" className={heading}><Code2 size={20} aria-hidden />{label("빠른 시작", "クイックスタート", "Quick start")}</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{label("조회할 데이터를 선택하고 요청 예시를 복사하세요.", "データを選択してリクエスト例をコピーしてください。", "Choose a resource and copy the request example.")}</p>
        <div className="mb-3 mt-5 flex gap-2" role="group" aria-label={label("조회할 데이터", "データの種類", "Resource")}>
          {(["decks", "planners"] as const).map((value) => <button key={value} type="button" aria-pressed={resource === value} onClick={() => setResource(value)} className={`${button} min-w-20 ${resource === value ? "bg-[var(--gold)]/10 text-[var(--gold)]" : "text-[var(--text-muted)] hover:bg-white/[0.04]"}`}>{value === "decks" ? label("덱", "デッキ", "Decks") : label("플랜", "プラン", "Plans")}</button>)}
        </div>
        <div className="min-w-0 rounded-md bg-[var(--bg-deep)] p-4">
          <div className="mb-2 flex items-center justify-between gap-3"><span className="text-[0.625rem] tracking-wider text-[var(--text-muted)]">HTTP</span><button className={quietButton} onClick={() => copy(example)} aria-label={label("요청 예시 복사", "リクエスト例をコピー", "Copy request example")}><Copy size={16} aria-hidden />{label("복사", "コピー", "Copy")}</button></div>
          <pre className="overflow-x-auto pb-2 text-xs leading-7"><code>{example}</code></pre>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">{label("공개된 덱과 플랜만 제공됩니다. 이메일·비공개 프로필·개인 검색 기록은 제공하지 않습니다.", "公開デッキとプランのみ提供します。個人情報は含まれません。", "Only public decks and plans are available. Private profiles, emails and search history are excluded.")}</p>
        <details className="mt-5 text-xs text-[var(--text-secondary)]">
          <summary className="cursor-pointer py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--gold)]">{label("응답과 조회 옵션", "レスポンスとオプション", "Responses and query options")}</summary>
          <p className="py-3 leading-relaxed">{label("limit: 1~50, offset: 0~100000. id로 특정 덱이나 플랜을 조회할 수 있습니다.", "limit: 1〜50、offset: 0〜100000。idで単一のデッキやプランを取得できます。", "limit: 1–50, offset: 0–100000. Use id to retrieve one deck or plan.")}</p>
          <pre className="overflow-x-auto rounded-md bg-[var(--bg-deep)] p-4 leading-7"><code>{"200 { data: [...], offset, limit, nextOffset }\n401 / 403: invalid or unavailable key\n429: quota reached — Retry-After header\n503: service unavailable"}</code></pre>
        </details>
      </section>
      <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm text-[var(--gold)]">{message}</p>
    </div>
  );
}
