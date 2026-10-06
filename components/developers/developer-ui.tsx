/** Pieces the developer tools tabs share: class names, the language helper, method badge, code panel and field table. */
import { useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { Copy } from "lucide-react";
import { showError, showSuccess } from "@/lib/toast";
import { CODE_KINDS, codeSample, type CodeKind, type Endpoint, type Field, type Text } from "@/app/[lang]/developers/api-reference";

export type KeyRow = { id: string; name: string; prefix: string; revoked_at: string | null; developer_usage: { day: string; requests: number }[] };
export type Partner = { code: string; name: string; scopes: string[] };
export type Account = { keys: KeyRow[]; partner: Partner | null; admin: boolean };
export type TabKey = "guide" | "docs" | "test" | "keys" | "partner";
export type Open = (tab: TabKey, item?: string) => void;

export const panel = "rounded-lg bg-[var(--bg-panel)] p-5 sm:p-6";
export const heading = "font-[family-name:var(--font-heading)] text-[1.0625rem] text-[var(--text-primary)]";
export const digits = "font-[family-name:var(--font-title)] tabular-nums leading-none tracking-wide";
const button = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-[filter,background-color,color] duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-40";
export const goldButton = `${button} bg-[var(--gold)] text-[var(--bg-deep)] hover:brightness-110`;
export const lineButton = `${button} text-[var(--gold-light)] ring-1 ring-inset ring-[#5a4526] hover:bg-[var(--gold)]/10`;
export const quietButton = "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs text-[var(--text-secondary)] transition-colors duration-200 hover:bg-white/[0.06] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] disabled:opacity-40";
export const field = "min-h-11 min-w-0 rounded-md bg-[var(--bg-deep)] px-3 text-sm ring-1 ring-inset ring-white/10 placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--gold)]";
export const railItem = (active: boolean) =>
  `flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${active ? "bg-[var(--gold)]/10 text-[var(--gold-light)]" : "text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"}`;

/** The viewer's language, and a picker for text written inline in the three languages. */
export function useText() {
  const lang = useLocale() as keyof Text;
  return {
    lang,
    t: (text: Text) => text[lang] ?? text.ko,
    label: (ko: string, ja: string, en: string) => (lang === "ko" ? ko : lang === "ja" ? ja : en),
  };
}

export async function copyText(text: string, done: string, failed: string) {
  try {
    await navigator.clipboard.writeText(text);
    showSuccess(done);
  } catch {
    showError(failed);
  }
}

const METHOD_TONE = { GET: "bg-[#90b393]/12 text-[#90b393]", POST: "bg-[var(--gold)]/15 text-[var(--gold-light)]", DELETE: "bg-[#cf8076]/12 text-[#cf8076]" };
export function Method({ method, small = false }: { method: Endpoint["method"]; small?: boolean }) {
  return <span className={`shrink-0 rounded font-semibold tabular-nums ${small ? "w-11 py-0.5 text-center text-[0.625rem]" : "px-2 py-1 text-xs"} ${METHOD_TONE[method]}`}>{method}</span>;
}

/** A dark code panel with a copy button. `tabs` puts a switcher (curl, Python …) where the title would be. */
export function CodeBlock({ title, code, tabs, maxHeight = "26rem" }: { title?: string; code: string; tabs?: ReactNode; maxHeight?: string }) {
  const { label } = useText();
  return (
    <div className="min-w-0 overflow-hidden rounded-md bg-[var(--bg-deep)] ring-1 ring-inset ring-white/[0.06]">
      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-white/[0.06] pl-3 pr-1">
        {tabs ?? <span className="text-xs text-[var(--text-muted)]">{title}</span>}
        <button type="button" className={quietButton} onClick={() => copyText(code, label("복사했습니다.", "コピーしました。", "Copied."), label("텍스트를 직접 복사해주세요.", "手動でコピーしてください。", "Please copy the text manually."))}
          aria-label={`${title ?? label("코드", "コード", "Code")} ${label("복사", "コピー", "Copy")}`}>
          <Copy size={14} aria-hidden />{label("복사", "コピー", "Copy")}
        </button>
      </div>
      <pre className="overflow-auto p-4 text-xs leading-[1.7] text-[var(--text-secondary)]" style={{ maxHeight }}><code>{code}</code></pre>
    </div>
  );
}

/** The request as curl, Python or JavaScript, with a switcher. The choice is shared by passing `kind` down. */
export function RequestCode({ request, kind, onKind, maxHeight }: { request: { method: string; url: string; body?: unknown }; kind: CodeKind; onKind: (kind: CodeKind) => void; maxHeight?: string }) {
  const { label } = useText();
  return (
    <CodeBlock
      title={label("요청", "リクエスト", "Request")}
      code={codeSample(kind, request)}
      maxHeight={maxHeight}
      tabs={
        <div className="flex gap-0.5" role="group" aria-label={label("요청 예시 언어", "リクエスト例の言語", "Request example language")}>
          {CODE_KINDS.map(([id, name]) => (
            <button key={id} type="button" aria-pressed={id === kind} onClick={() => onKind(id)}
              className={`min-h-9 rounded px-2.5 text-xs transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${id === kind ? "bg-white/[0.07] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>{name}</button>
          ))}
        </div>
      }
    />
  );
}
export function useCodeKind() {
  return useState<CodeKind>("curl");
}

/** Name, type, whether it is required, and what it means. */
export function FieldTable({ title, fields }: { title: string; fields: Field[] }) {
  const { t, label } = useText();
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <table className="w-full text-left text-xs">
        <tbody>
          {fields.map((item) => (
            <tr key={item.name} className="border-t border-[#2e2417] align-top">
              <th scope="row" className="py-2.5 pr-4 font-normal">
                <code className="break-all text-[var(--gold-light)]">{item.name}</code>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-[var(--text-muted)]">
                  <span>{item.type}</span>
                  {item.required ? <span className="text-[#cf8076]">{label("필수", "必須", "required")}</span> : <span>{label("선택", "任意", "optional")}</span>}
                </span>
              </th>
              <td className="w-[62%] py-2.5 leading-relaxed text-[var(--text-secondary)]">{t(item.text)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
