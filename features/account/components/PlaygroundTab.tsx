import { useState } from "react";
import { Copy, LoaderCircle, Send } from "lucide-react";
import { API_BASE, codeSample, type Endpoint } from "@/features/account/lib/api-reference";
import { CodeBlock, Method, copyText, field, goldButton, heading, lineButton, panel, railItem, useText, type Open } from "./DeveloperUi";

type Result = { status: number; ms: number; remaining: string | null; retry: string | null; body: string };

// The example query as starting values. Shortened ids (…) are left for the developer to fill in.
const startValues = (endpoint: Endpoint) =>
  Object.fromEntries([...new URLSearchParams(endpoint.query)].filter(([name, value]) => name !== "dry_run" && !value.includes("…")));

/** Sends a real request with the developer's key and shows what came back. The key stays in this component's memory. */
export default function PlaygroundTab({ endpoints, endpoint, open }: { endpoints: Endpoint[]; endpoint: Endpoint; open: Open }) {
  const { t, label } = useText();
  const [key, setKey] = useState("");
  return (
    <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 nav-slide lg:sticky lg:top-[var(--nav-height)] lg:mx-0 lg:block lg:h-fit lg:space-y-0 lg:overflow-visible lg:px-0 lg:pt-1" role="group" aria-label={label("보낼 요청", "送るリクエスト", "Request to send")}>
        {endpoints.map((item) => (
          <button key={item.id} type="button" aria-pressed={item.id === endpoint.id} onClick={() => open("test", item.id)} className={`${railItem(item.id === endpoint.id)} lg:w-full`}>
            <Method method={item.method} small /><span>{t(item.name)}</span>
          </button>
        ))}
      </div>
      {/* Keyed by endpoint so its form starts from that endpoint's example. */}
      <RequestForm key={endpoint.id} endpoint={endpoint} apiKey={key} onApiKey={setKey} open={open} />
    </div>
  );
}

function RequestForm({ endpoint, apiKey, onApiKey, open }: { endpoint: Endpoint; apiKey: string; onApiKey: (key: string) => void; open: Open }) {
  const { t, label } = useText();
  const canDryRun = endpoint.params.some((param) => param.name === "dry_run");
  const [values, setValues] = useState<Record<string, string>>(() => startValues(endpoint));
  const [dryRun, setDryRun] = useState(true);
  const [body, setBody] = useState(endpoint.bodySample ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value !== ""));
  if (canDryRun && dryRun) query.set("dry_run", "1");
  const address = `${endpoint.path}${query.size ? `?${query}` : ""}`;
  const stores = endpoint.method !== "GET" && !(canDryRun && dryRun);

  function parsedBody(): { ok: true; value?: unknown } | { ok: false } {
    if (!endpoint.body) return { ok: true };
    try {
      return { ok: true, value: JSON.parse(body) };
    } catch {
      return { ok: false };
    }
  }
  async function send() {
    const json = parsedBody();
    if (!json.ok) return setProblem(label("본문이 올바른 JSON이 아닙니다.", "本文が正しい JSON ではありません。", "The body is not valid JSON."));
    setBusy(true);
    setProblem("");
    const started = performance.now();
    try {
      const response = await fetch(address, {
        method: endpoint.method,
        headers: { Authorization: `Bearer ${apiKey.trim()}`, ...(endpoint.body ? { "Content-Type": "application/json" } : {}) },
        ...(endpoint.body ? { body } : {}),
      });
      const text = await response.text();
      let shown = text;
      try {
        shown = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // Not JSON: show it as it came.
      }
      setResult({ status: response.status, ms: Math.round(performance.now() - started), remaining: response.headers.get("X-RateLimit-Remaining"), retry: response.headers.get("Retry-After"), body: shown });
    } catch {
      setResult(null);
      setProblem(label("요청을 보내지 못했습니다. 연결을 확인해주세요.", "リクエストを送信できませんでした。接続を確認してください。", "The request could not be sent. Check your connection."));
    } finally {
      setBusy(false);
    }
  }
  function copyCurl() {
    const json = parsedBody();
    // The copied command carries a placeholder, never the key typed here.
    void copyText(codeSample("curl", { method: endpoint.method, url: `${API_BASE}${address}`, ...(json.ok && json.value !== undefined ? { body: json.value } : {}) }),
      label("복사했습니다.", "コピーしました。", "Copied."), label("텍스트를 직접 복사해주세요.", "手動でコピーしてください。", "Please copy the text manually."));
  }

  const caption = "mb-1.5 block text-xs text-[var(--text-secondary)]";
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <form className={`${panel} min-w-0 space-y-5`} aria-labelledby="api-test-heading" onSubmit={(event) => { event.preventDefault(); if (!busy && apiKey.trim()) void send(); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="api-test-heading" className={heading}>{t(endpoint.name)}</h2>
            <p className="mt-2 flex items-center gap-2"><Method method={endpoint.method} /><code className="break-all text-sm text-[var(--text-primary)]">{address}</code></p>
          </div>
          <button type="button" className="text-xs text-[var(--gold)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--gold)]" onClick={() => open("docs", endpoint.id)}>{label("문서 보기", "ドキュメント", "Read the docs")}</button>
        </div>

        <label className="block">
          <span className={caption}>{label("API 키", "APIキー", "API key")}</span>
          <input type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => onApiKey(event.target.value)} placeholder="lmb_…" className={`${field} w-full`} />
          <span className="mt-1.5 block text-xs text-[var(--text-muted)]">{label("저장하지 않음", "保存しません", "Not saved")}</span>
        </label>

        {endpoint.params.filter((param) => param.name !== "dry_run").length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {endpoint.params.filter((param) => param.name !== "dry_run").map((param) => (
              <label key={param.name} className="block min-w-0">
                <span className={caption}><code className="text-[var(--gold-light)]">{param.name}</code>{param.required && <span className="ml-2 text-[#cf8076]">{label("필수", "必須", "required")}</span>}</span>
                <input value={values[param.name] ?? ""} onChange={(event) => setValues({ ...values, [param.name]: event.target.value })} placeholder={t(param.text)} spellCheck={false} className={`${field} w-full`} />
              </label>
            ))}
          </div>
        )}

        {endpoint.body && (
          <label className="block">
            <span className={caption}>{label("본문 (JSON)", "本文 (JSON)", "Body (JSON)")}</span>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={16} spellCheck={false}
              className="block w-full resize-y rounded-md bg-[var(--bg-deep)] p-3 font-[family-name:var(--font-mono)] text-xs leading-6 text-[var(--text-secondary)] ring-1 ring-inset ring-white/10 focus:outline-2 focus:outline-[var(--gold)]" />
          </label>
        )}

        {canDryRun && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--text-primary)]">
            <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
            {label("시험 전송", "テスト送信", "Dry run")}
          </label>
        )}
        {stores && <p className="text-xs leading-relaxed text-[#cf8076]">{endpoint.method === "DELETE"
          ? label("캘린더에서 실제로 삭제", "カレンダーから実際に削除", "Really deletes from the calendar")
          : label("캘린더에 실제로 게시", "カレンダーに実際に掲載", "Really publishes to the calendar")}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button className={goldButton} disabled={busy || !apiKey.trim()}>
            {busy ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Send size={16} aria-hidden />}{label("요청 보내기", "リクエスト送信", "Send request")}
          </button>
          <button type="button" className={lineButton} onClick={copyCurl}><Copy size={15} aria-hidden />{label("curl 복사", "curl をコピー", "Copy as curl")}</button>
        </div>
        {problem && <p role="alert" className="text-sm text-[#cf8076]">{problem}</p>}
      </form>

      <section className={`${panel} min-w-0`} aria-labelledby="api-test-result-heading" aria-live="polite">
        <h2 id="api-test-result-heading" className={heading}>{label("응답", "レスポンス", "Response")}</h2>
        {result ? (
          <>
            <dl className="mb-4 mt-4 flex flex-wrap gap-x-8 gap-y-3 text-xs text-[var(--text-secondary)]">
              <div><dt>{label("상태", "ステータス", "Status")}</dt><dd className={`mt-1 text-xl font-semibold tabular-nums ${result.status < 400 ? "text-[#90b393]" : "text-[#cf8076]"}`}>{result.status}</dd></div>
              <div><dt>{label("걸린 시간", "所要時間", "Time")}</dt><dd className="mt-1 text-xl tabular-nums text-[var(--text-primary)]">{result.ms}<span className="ml-1 text-xs text-[var(--text-secondary)]">ms</span></dd></div>
              {result.remaining && <div><dt>{label("오늘 남은 횟수", "本日の残り", "Left today")}</dt><dd className="mt-1 text-xl tabular-nums text-[var(--text-primary)]">{Number(result.remaining).toLocaleString()}</dd></div>}
              {result.retry && <div><dt>Retry-After</dt><dd className="mt-1 text-xl tabular-nums text-[var(--text-primary)]">{result.retry}<span className="ml-1 text-xs text-[var(--text-secondary)]">s</span></dd></div>}
            </dl>
            <CodeBlock title={label("본문", "本文", "Body")} code={result.body} maxHeight="34rem" />
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">{label("보낸 요청 없음", "送信したリクエストなし", "No request sent")}</p>
        )}
      </section>
    </div>
  );
}
