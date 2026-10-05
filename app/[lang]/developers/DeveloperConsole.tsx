"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { useSession } from "next-auth/react";
import { goToLogin } from "@/lib/auth-return";
import useSWR from "swr";
import { useHtmlFlag } from "@/hooks/useHtmlFlag";
import PageHeader from "@/components/ui/PageHeader";
import DanteLogo from "@/components/brand/DanteLogo";
import { Copy, Trash2, Plus, EyeOff, LoaderCircle, ArrowUpRight } from "lucide-react";
import { LIMITS, resourcesFor, usageByDay, type Text } from "./api-reference";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  revoked_at: string | null;
  developer_usage: { day: string; requests: number }[];
};

const panel = "rounded-lg bg-[var(--bg-panel)] p-5 sm:p-6";
const heading = "font-[family-name:var(--font-heading)] text-[1.0625rem] text-[var(--text-primary)]";
const digits = "font-[family-name:var(--font-title)] tabular-nums leading-none tracking-wide";
const button = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-[filter,background-color,color] duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-40";
const goldButton = `${button} bg-[var(--gold)] text-[var(--bg-deep)] hover:brightness-110`;
const quietButton = "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs text-[var(--text-secondary)] transition-colors duration-200 hover:bg-white/[0.06] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] disabled:opacity-40";
const railItem = (active: boolean) =>
  `flex min-h-10 w-full shrink-0 items-center rounded-md px-3 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${active ? "bg-[var(--gold)]/10 text-[var(--gold-light)]" : "text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"}`;

export default function DeveloperConsole() {
  const lang = useLocale() as keyof Text;
  const label = (ko: string, ja: string, en: string) => (lang === "ko" ? ko : lang === "ja" ? ja : en);
  const count = (value: number) => value.toLocaleString(lang);
  const { status } = useSession();
  useHtmlFlag("with-compact-footer");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("decks");
  const { data, error, mutate, isLoading } = useSWR<{ keys: KeyRow[]; partner: string | null }>(
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

  const partner = !!data?.partner;
  const limits = partner ? LIMITS.partner : LIMITS.standard;
  const resources = resourcesFor(partner);
  const resource = resources.find((item) => item.id === selected) ?? resources[0];
  const request = `GET /api/v1/${resource.id}${resource.query}\nAuthorization: Bearer YOUR_API_KEY`;
  const today = new Date().toISOString().slice(0, 10);
  const usage = usageByDay(data?.keys ?? [], today);
  const peak = Math.max(1, ...usage.map((day) => day.requests));
  const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`;
  const times = label("회", "回", "");

  const plate = partner && (
    <div className="flex items-center gap-3 rounded-md border border-[#5a4526] bg-[var(--bg-elevated)] px-4 py-2.5">
      <DanteLogo size={26} className="shrink-0 text-[var(--gold-light)]" aria-hidden />
      <div className="min-w-0">
        <p className="font-[family-name:var(--font-heading)] text-sm leading-tight text-[var(--gold-light)]">{label("협업 서포터", "協業サポーター", "Collaboration partner")}</p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{label("Discord 봇", "Discordボット", "Discord bot")}</p>
      </div>
    </div>
  );
  const resourceButtons = resources.map((item) => (
    <button key={item.id} type="button" aria-pressed={item.id === resource.id} onClick={() => setSelected(item.id)} className={railItem(item.id === resource.id)}>{item.name[lang]}</button>
  ));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-[5.5rem] text-[var(--text-primary)] sm:px-6" data-developer-console>
      <PageHeader
        title={label("개발자 도구", "開発者ツール", "Developer tools")}
        description={partner
          ? label("게임 데이터와 공개 덱·플랜을 내 서비스에 연결하세요.", "ゲームデータと公開デッキ・プランを自分のサービスに接続できます。", "Connect game data and public decks and plans to your service.")
          : label("공개 덱과 플랜을 내 서비스에 연결하세요.", "公開デッキとプランを自分のサービスに接続できます。", "Connect public decks and plans to your service.")}
      />

      <div className="grid gap-x-8 gap-y-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav className="sticky-under-nav hidden h-fit space-y-6 pt-1 lg:block" aria-label={label("개발자 도구", "開発者ツール", "Developer tools")}>
          {plate}
          <div>
            <p className="mb-2 px-3 text-xs text-[var(--text-muted)]">{label("내 계정", "アカウント", "Account")}</p>
            <a href="#keys" className={railItem(false)}>{label("API 키", "APIキー", "API keys")}</a>
            <a href="#usage" className={railItem(false)}>{label("사용량과 한도", "使用量と制限", "Usage and limits")}</a>
          </div>
          <div>
            <p className="mb-2 px-3 text-xs text-[var(--text-muted)]">{label("데이터", "データ", "Data")}</p>
            {resourceButtons}
          </div>
        </nav>

        <div className="min-w-0 space-y-5">
          {plate && <div className="lg:hidden">{plate}</div>}

          <section id="keys" className={`${panel} scroll-mt-24`} aria-labelledby="api-keys-heading">
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
                <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} aria-label={label("키 이름", "キー名", "Key name")} placeholder={label("서비스 이름", "サービス名", "Service name")}
                  className="min-h-11 min-w-0 flex-1 basis-48 rounded-md bg-[var(--bg-deep)] px-3 text-sm ring-1 ring-inset ring-white/10 placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--gold)]" />
                <button disabled={busy || !name.trim()} className={goldButton}>
                  {busy ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Plus size={16} aria-hidden />}{label("새 키 발급", "新規発行", "Create key")}
                </button>
              </form>
            )}
            {secret && <div className="mt-4 rounded-md bg-[var(--bg-deep)] p-4">
              <p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">{label("발급한 키는 한 번만 표시됩니다. 서버에 보관하고 공개 코드에 넣지 마세요.", "キーは一度だけ表示されます。公開せず、サーバーで保管してください。", "Shown once. Keep this key on your server, out of public code.")}</p>
              <code className="block break-all text-xs leading-6 text-[var(--gold-light)]">{secret}</code>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button className={quietButton} onClick={() => copy(secret)}><Copy size={14} aria-hidden />{label("복사", "コピー", "Copy")}</button>
                <button className={quietButton} onClick={() => setSecret("")}><EyeOff size={14} aria-hidden />{label("숨기기", "閉じる", "Hide")}</button>
              </div>
            </div>}
            {isLoading && <p role="status" className="mt-4 text-sm text-[var(--text-muted)]">{label("키 목록을 불러오는 중", "キーを読み込み中", "Loading keys")}</p>}
            {!!data?.keys.length && <ul className="mt-4 space-y-2">
              {data.keys.map((key) => (
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
            {error && <p role="alert" className="mt-4 text-sm text-[#cf8076]">{label("키 목록을 불러오지 못했습니다.", "取得に失敗しました。", "Could not load keys.")} <button className="underline underline-offset-4" onClick={() => mutate()}>{label("다시 시도", "再試行", "Retry")}</button></p>}
          </section>

          <section id="usage" className={`${panel} grid scroll-mt-24 gap-6 md:grid-cols-[minmax(0,1fr)_14rem]`}>
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
              {!partner && <Link href="/support?topic=api-limit" className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm text-[var(--gold)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]">
                {label("추가 한도 요청하기", "制限の引き上げを相談", "Request a higher limit")}<ArrowUpRight size={15} aria-hidden />
              </Link>}
            </div>
          </section>

          <section className={panel} aria-labelledby="api-data-heading">
            <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1 lg:hidden [&>button]:w-auto" role="group" aria-label={label("데이터", "データ", "Data")}>{resourceButtons}</div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id="api-data-heading" className={heading}>{resource.name[lang]}</h2>
              <code className="text-xs text-[var(--text-secondary)]">/api/v1/{resource.id}</code>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{resource.summary[lang]}</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
              <table className="h-fit w-full text-left text-xs">
                <tbody>
                  {resource.params.map(([param, text]) => (
                    <tr key={param} className="border-t border-[#2e2417] first:border-t-0"><th scope="row" className="w-16 py-2 pr-3 align-top font-normal text-[var(--gold-light)]"><code>{param}</code></th><td className="py-2 leading-relaxed text-[var(--text-secondary)]">{text[lang]}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="min-w-0 space-y-3">
                <div className="rounded-md bg-[var(--bg-deep)] p-4">
                  <div className="mb-1 flex items-center justify-between"><span className="text-xs text-[var(--text-muted)]">{label("요청", "リクエスト", "Request")}</span><button className={quietButton} onClick={() => copy(request)} aria-label={label("요청 예시 복사", "リクエスト例をコピー", "Copy request example")}><Copy size={14} aria-hidden />{label("복사", "コピー", "Copy")}</button></div>
                  <pre className="overflow-x-auto text-xs leading-6"><code>{request}</code></pre>
                </div>
                <div className="rounded-md bg-[var(--bg-deep)] p-4">
                  <span className="text-xs text-[var(--text-muted)]">{label("응답", "レスポンス", "Response")}</span>
                  <pre className="mt-1 max-h-[26rem] overflow-auto text-xs leading-6 text-[var(--text-secondary)]"><code>{resource.sample}</code></pre>
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">{label("401·403은 키를 쓸 수 없을 때, 429는 한도를 넘었을 때(Retry-After 헤더), 503은 일시 오류입니다. 이메일·비공개 프로필·개인 검색 기록은 제공하지 않습니다.", "401・403 はキーが使えない場合、429 は制限超過(Retry-After ヘッダー)、503 は一時的なエラーです。個人情報は含まれません。", "401 and 403 mean the key cannot be used, 429 that a limit was reached (see Retry-After), 503 a temporary failure. Emails, private profiles and search history are never included.")}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
