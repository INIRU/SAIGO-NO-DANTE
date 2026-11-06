import { useState } from "react";
import { Play } from "lucide-react";
import { API_BASE, NEWS_EXAMPLES, SCOPES, type Scope } from "@/features/account/lib/api-reference";
import { RequestCode, goldButton, heading, lineButton, panel, useCodeKind, useText, type Open, type Partner } from "./DeveloperUi";

/** What a partner account can do, and how to post news to the calendar, with one example per kind of news. */
export default function PartnerTab({ partner, admin, news, open }: { partner: Partner | null; admin: boolean; news: boolean; open: Open }) {
  const { t, label } = useText();
  const [kind, setKind] = useCodeKind();
  const [picked, setPicked] = useState(NEWS_EXAMPLES[0].id);
  const example = NEWS_EXAMPLES.find((item) => item.id === picked) ?? NEWS_EXAMPLES[0];
  // An administrator sees every scope, to check the tools.
  const scopes = (admin ? Object.keys(SCOPES) : partner?.scopes ?? []) as Scope[];
  const rules: [string, string][] = [
    [label("덮어쓰기", "上書き", "Replace"), label("같은 id 재전송", "同じ id を再送", "Post the same id again")],
    [label("언어", "言語", "Languages"), label("ko, en, ja를 한 요청에", "ko・en・ja を1リクエストに", "ko, en and ja in one request")],
    [label("시험 전송", "テスト送信", "Dry run"), "?dry_run=1"],
    [label("보낼 것", "送るもの", "What to send"), label("Discord에 내보낸 소식만", "Discord に流したニュースのみ", "Only what was relayed to Discord")],
    ["aiohttp", "session.post(url, headers=…, json=payload)"],
  ];
  return (
    <div className="space-y-5">
      <section className={panel} aria-labelledby="partner-heading">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="partner-heading" className={heading}>{partner ? partner.name : label("관리자 보기", "管理者ビュー", "Administrator view")}</h2>
          {partner && <code className="text-xs text-[var(--text-secondary)]">{partner.code}</code>}
        </div>
        {!partner && <p className="mt-2 text-sm text-[var(--text-secondary)]">{label("관리자 키는 조회와 시험 전송만", "管理者キーは取得とテスト送信のみ", "An administrator key can read and dry-run only")}</p>}
        <ul className="mt-4 space-y-2">
          {scopes.map((scope) => (
            <li key={scope} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-md bg-white/[0.025] px-4 py-3">
              <code className="text-xs text-[var(--gold-light)]">{scope}</code>
              <span className="text-sm text-[var(--text-secondary)]">{t(SCOPES[scope])}</span>
            </li>
          ))}
        </ul>
      </section>

      {news && (
        <section className={panel} aria-labelledby="partner-news-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="partner-news-heading" className={heading}>{label("캘린더에 소식 보내기", "カレンダーにニュースを送る", "Posting news to the calendar")}</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={lineButton} onClick={() => open("docs", "news")}>{label("칸 설명 보기", "項目の説明", "Field reference")}</button>
              <button type="button" className={goldButton} onClick={() => open("test", "news")}><Play size={15} aria-hidden />{label("시험 전송 해 보기", "テスト送信する", "Try a dry run")}</button>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {rules.map(([name, value]) => (
              <div key={name} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                <dt className="text-xs leading-6 text-[var(--text-muted)]">{name}</dt>
                <dd className="leading-6 text-[var(--text-secondary)]">{value}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mb-2 mt-6 text-sm font-semibold text-[var(--text-primary)]">{label("소식 종류별 예시", "ニュースの種類別の例", "An example for each kind of news")}</h3>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="group" aria-label={label("소식 종류", "ニュースの種類", "Kind of news")}>
            {NEWS_EXAMPLES.map((item) => (
              <button key={item.id} type="button" aria-pressed={item.id === example.id} onClick={() => setPicked(item.id)}
                className={`min-h-10 shrink-0 rounded-md px-3 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${item.id === example.id ? "bg-[var(--gold)]/10 text-[var(--gold-light)]" : "text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"}`}>{t(item.name)}</button>
            ))}
          </div>
          <p className="mb-3 mt-3 text-sm text-[var(--text-secondary)]">{t(example.note)}</p>
          <RequestCode request={{ method: "POST", url: `${API_BASE}/api/v1/news`, body: example.body }} kind={kind} onKind={setKind} maxHeight="30rem" />
        </section>
      )}
    </div>
  );
}
