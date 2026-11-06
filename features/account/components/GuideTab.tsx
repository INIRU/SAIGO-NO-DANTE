import { ArrowRight } from "lucide-react";
import { ERRORS, type Endpoint } from "@/features/account/lib/api-reference";
import { exampleRequest } from "./DocsTab";
import { CodeBlock, RequestCode, digits, goldButton, heading, lineButton, panel, useCodeKind, useText, type Open } from "./DeveloperUi";

/** Getting started: the three steps to a first response, then the rules every request shares. */
export default function GuideTab({ first, limits, open }: { first: Endpoint; limits: { minute: number; day: number | null }; open: Open }) {
  const { lang, t, label } = useText();
  const [kind, setKind] = useCodeKind();
  const count = (value: number) => value.toLocaleString(lang);
  const step = (number: number, title: string) => (
    <h3 className="flex items-center gap-3 text-sm font-semibold text-[var(--text-primary)]">
      <span className={`${digits} grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--gold)]/15 text-base text-[var(--gold-light)]`}>{number}</span>{title}
    </h3>
  );
  return (
    <div className="space-y-5">
      <section className={panel} aria-labelledby="guide-steps-heading">
        <h2 id="guide-steps-heading" className={heading}>{label("시작하기", "はじめに", "Getting started")}</h2>
        <ol className="mt-5 space-y-7">
          <li>
            {step(1, label("API 키 발급", "APIキーの発行", "Create an API key"))}
            <div className="mt-3 sm:pl-10"><button type="button" className={goldButton} onClick={() => open("keys")}>{label("키 발급하러 가기", "キーを発行する", "Go to API keys")}<ArrowRight size={16} aria-hidden /></button></div>
          </li>
          <li>
            {step(2, label("첫 요청 보내기", "最初のリクエスト", "Send a first request"))}
            <div className="mt-3 sm:pl-10"><RequestCode request={exampleRequest(first)} kind={kind} onKind={setKind} /></div>
          </li>
          <li>
            {step(3, label("응답 읽기", "レスポンスを読む", "Read the response"))}
            <div className="mt-3 sm:pl-10"><CodeBlock title={label("응답", "レスポンス", "Response")} code={first.sample} maxHeight="16rem" /></div>
            <div className="mt-3 flex flex-wrap gap-2 sm:pl-10">
              <button type="button" className={lineButton} onClick={() => open("docs")}>{label("API 문서 보기", "API ドキュメント", "Read the API reference")}</button>
              <button type="button" className={lineButton} onClick={() => open("test")}>{label("직접 보내 보기", "実際に送ってみる", "Try a request")}</button>
            </div>
          </li>
        </ol>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={panel} aria-labelledby="guide-rules-heading">
          <h2 id="guide-rules-heading" className={heading}>{label("공통 규칙", "共通ルール", "Rules for every request")}</h2>
          <dl className="mt-4 space-y-4 text-sm">
            {[
              [label("목록", "一覧", "Lists"), "offset, limit, nextOffset"],
              [label("인증", "認証", "Authentication"), <>Authorization: Bearer <code className="text-[var(--gold-light)]">lmb_…</code></>],
              [label("분당 요청", "1分あたり", "Per minute"), `${count(limits.minute)}${label("회", "回", "")}`],
              [label("하루 요청", "1日あたり", "Per day"), limits.day === null ? label("제한 없음", "制限なし", "No limit") : `${count(limits.day)}${label("회", "回", "")} (UTC)`],
              [label("응답 헤더", "レスポンスヘッダー", "Response headers"), "X-RateLimit-Remaining, Retry-After"],
              [label("시각", "時刻", "Times"), label("ISO 8601, UTC", "ISO 8601、UTC", "ISO 8601, UTC")],
              [label("제공하지 않는 것", "提供しないもの", "Never included"), label("이메일, 비공개 프로필, 개인 검색 기록", "メール、非公開プロフィール、個人の検索履歴", "Emails, private profiles and search history")],
            ].map(([name, value], index) => (
              <div key={index} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
                <dt className="text-xs leading-6 text-[var(--text-muted)]">{name}</dt>
                <dd className="leading-6 text-[var(--text-secondary)]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={panel} aria-labelledby="guide-errors-heading">
          <h2 id="guide-errors-heading" className={heading}>{label("오류", "エラー", "Errors")}</h2>
          <table className="mt-3 w-full text-left text-xs">
            <tbody>
              {Object.entries(ERRORS).map(([status, text]) => (
                <tr key={status} className="border-t border-[#2e2417] align-top first:border-t-0">
                  <th scope="row" className="w-14 py-2.5 pr-3 font-normal tabular-nums text-[#cf8076]">{status}</th>
                  <td className="py-2.5 leading-relaxed text-[var(--text-secondary)]">{t(text)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
