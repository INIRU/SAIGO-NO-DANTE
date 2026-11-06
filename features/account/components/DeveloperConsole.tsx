"use client";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useRouter } from "@/lib/i18n/navigation";
import { useHtmlFlag } from "@/hooks/useHtmlFlag";
import PageHeader from "@/components/ui/PageHeader";
import UnderlineTabBar from "@/components/ui/UnderlineTabBar";
import DanteLogo from "@/components/brand/DanteLogo";
import DocsTab from "./DocsTab";
import GuideTab from "./GuideTab";
import KeysTab from "./KeysTab";
import PartnerTab from "./PartnerTab";
import PlaygroundTab from "./PlaygroundTab";
import { useText, type Account, type Open, type TabKey } from "./DeveloperUi";
import { LIMITS, endpointsFor } from "../lib/api-reference";

/** Developer tools: a guide, the API reference, a request tester, the account's keys and, for partners, the partner tab. The tab and item live in the address. */
export default function DeveloperConsole() {
  const { label } = useText();
  const { status } = useSession();
  useHtmlFlag("with-compact-footer");
  const search = useSearchParams();
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR<Account>(
    status === "authenticated" ? "/api/developer/keys" : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw Error();
      return response.json();
    },
  );
  const partner = data?.partner ?? null;
  const admin = !!data?.admin;
  // An administrator sees and may try everything, to check the tools without being a partner.
  const can = { catalog: admin || !!partner?.scopes.includes("catalog:read"), news: admin || !!partner?.scopes.includes("news:write") };
  const endpoints = endpointsFor(can);
  const limits = partner ? LIMITS.partner : LIMITS.standard;

  const requested = search.get("tab"), requestedItem = search.get("item");
  // Until the account has loaded, a link to something only a partner sees waits instead of falling back.
  const pending = status === "loading" || isLoading;
  const tabs: { key: TabKey; label: string }[] = [
    { key: "guide", label: label("시작하기", "はじめに", "Getting started") },
    { key: "docs", label: label("API 문서", "API ドキュメント", "API reference") },
    { key: "test", label: label("테스트", "テスト", "Test") },
    { key: "keys", label: label("키와 사용량", "キーと使用量", "Keys and usage") },
    ...(admin || partner || (pending && requested === "partner") ? [{ key: "partner" as const, label: label("파트너", "パートナー", "Partner") }] : []),
  ];
  const tab = tabs.find((item) => item.key === requested)?.key ?? "guide";
  const endpoint = endpoints.find((item) => item.id === requestedItem);
  const waiting = pending && (tab === "partner" || (!!requestedItem && !endpoint));
  const open: Open = (next, item) => {
    const id = item ?? endpoint?.id;
    router.replace(`/developers?tab=${next}${(next === "docs" || next === "test") && id ? `&item=${id}` : ""}`, { scroll: false });
  };

  const plate = partner && (
    <div className="flex items-center gap-3 rounded-md border border-[#5a4526] bg-[var(--bg-elevated)] px-4 py-2.5">
      <DanteLogo size={26} className="shrink-0 text-[var(--gold-light)]" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-[var(--text-secondary)]">{label("협업 파트너", "協業パートナー", "Collaboration partner")}</p>
        <p className="mt-0.5 font-[family-name:var(--font-heading)] text-sm leading-tight text-[var(--gold-light)]">{partner.name}<code className="ml-2 font-[family-name:var(--font-body)] text-xs text-[var(--text-secondary)]">{partner.code}</code></p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[82rem] px-4 pb-20 pt-[5.5rem] text-[var(--text-primary)] sm:px-6" data-developer-console>
      <PageHeader
        title={label("개발자 도구", "開発者ツール", "Developer tools")}
        description={can.catalog
          ? label("게임 데이터와 공개 덱·플랜을 내 서비스에 연결하세요.", "ゲームデータと公開デッキ・プランを自分のサービスに接続できます。", "Connect game data and public decks and plans to your service.")
          : label("공개 덱과 플랜을 내 서비스에 연결하세요.", "公開デッキとプランを自分のサービスに接続できます。", "Connect public decks and plans to your service.")}
        actions={plate}
      />
      <UnderlineTabBar tabs={tabs} activeKey={tab} onTabChange={(key) => open(key as TabKey)} className="mb-5" />

      {waiting ? (
        <p role="status" className="py-10 text-sm text-[var(--text-muted)]">{label("불러오는 중", "読み込み中", "Loading")}</p>
      ) : tab === "docs" ? (
        <DocsTab endpoints={endpoints} endpoint={endpoint ?? endpoints[0]} open={open} />
      ) : tab === "test" ? (
        <PlaygroundTab endpoints={endpoints} endpoint={endpoint ?? endpoints[0]} open={open} />
      ) : tab === "keys" ? (
        <KeysTab status={status} keys={data?.keys ?? []} loading={isLoading} failed={!!error} reload={() => mutate()} limits={limits} raise={!partner} />
      ) : tab === "partner" ? (
        <PartnerTab partner={partner} admin={admin} news={can.news} open={open} />
      ) : (
        <GuideTab first={endpoints[0]} limits={limits} open={open} />
      )}
    </div>
  );
}
