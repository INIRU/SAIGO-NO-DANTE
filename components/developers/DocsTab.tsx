import { Play } from "lucide-react";
import { API_BASE, ERRORS, GROUPS, type Endpoint } from "@/app/[lang]/developers/api-reference";
import { CodeBlock, FieldTable, Method, RequestCode, heading, lineButton, panel, railItem, useCodeKind, useText, type Open } from "./developer-ui";

/** The example request of an endpoint: its example query and, when it has one, its example body. */
export const exampleRequest = (endpoint: Endpoint) => ({
  method: endpoint.method,
  url: `${API_BASE}${endpoint.path}${endpoint.query}`,
  ...(endpoint.bodySample ? { body: JSON.parse(endpoint.bodySample) } : {}),
});

/** API reference: endpoints on the left, the chosen one explained in the middle, its code on the right. */
export default function DocsTab({ endpoints, endpoint, open }: { endpoints: Endpoint[]; endpoint: Endpoint; open: Open }) {
  const { t, label } = useText();
  const [kind, setKind] = useCodeKind();
  const groups = (Object.keys(GROUPS) as Endpoint["group"][]).map((group) => [group, endpoints.filter((item) => item.group === group)] as const).filter(([, items]) => items.length);
  const pick = (item: Endpoint, wide: boolean) => (
    <button key={item.id} type="button" aria-pressed={item.id === endpoint.id} onClick={() => open("docs", item.id)} className={`${railItem(item.id === endpoint.id)} ${wide ? "w-full" : ""}`}>
      <Method method={item.method} small /><span>{t(item.name)}</span>
    </button>
  );
  return (
    <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
      <nav className="sticky-under-nav hidden h-fit space-y-5 pt-1 lg:block" aria-label={label("API 문서 목차", "API ドキュメントの目次", "API reference contents")}>
        {groups.map(([group, items]) => (
          <div key={group}>
            <p className="mb-1.5 px-3 text-xs text-[var(--text-muted)]">{t(GROUPS[group])}</p>
            {items.map((item) => pick(item, true))}
          </div>
        ))}
      </nav>
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:hidden" role="group" aria-label={label("API 문서 목차", "API ドキュメントの目次", "API reference contents")}>
        {endpoints.map((item) => pick(item, false))}
      </div>

      <article className={`${panel} min-w-0`} aria-labelledby="api-doc-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="api-doc-heading" className={heading}>{t(endpoint.name)}</h2>
            <p className="mt-2 flex items-center gap-2"><Method method={endpoint.method} /><code className="break-all text-sm text-[var(--text-primary)]">{endpoint.path}</code></p>
          </div>
          <button type="button" className={lineButton} onClick={() => open("test", endpoint.id)}><Play size={15} aria-hidden />{label("테스트에서 열기", "テストで開く", "Open in test")}</button>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">{t(endpoint.summary)}</p>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
          <div className="min-w-0 space-y-6">
            {!!endpoint.params.length && <FieldTable title={label("쿼리 옵션", "クエリオプション", "Query options")} fields={endpoint.params} />}
            {endpoint.body && <FieldTable title={label("본문 (JSON)", "本文 (JSON)", "Body (JSON)")} fields={endpoint.body} />}
            <section>
              <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">{label("오류", "エラー", "Errors")}</h3>
              <table className="w-full text-left text-xs">
                <tbody>
                  {endpoint.errors.map((status) => (
                    <tr key={status} className="border-t border-[#2e2417] align-top">
                      <th scope="row" className="w-14 py-2.5 pr-3 font-normal tabular-nums text-[#cf8076]">{status}</th>
                      <td className="py-2.5 leading-relaxed text-[var(--text-secondary)]">{t(ERRORS[status])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <div className="min-w-0 space-y-3 xl:sticky xl:top-[var(--nav-offset)] xl:h-fit xl:transition-[top] xl:duration-300 motion-reduce:transition-none">
            <RequestCode request={exampleRequest(endpoint)} kind={kind} onKind={setKind} maxHeight="22rem" />
            <CodeBlock title={label("응답", "レスポンス", "Response")} code={endpoint.sample} maxHeight="22rem" />
          </div>
        </div>
      </article>
    </div>
  );
}
