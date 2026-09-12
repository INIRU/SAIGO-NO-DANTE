"use client";
import styles from "@/styles/components/MetaAnalysis.module.css";
import useSWR from "swr";
import { useLocale } from "next-intl";
export default function IdentityInterest({ id }: { id: string }) {
  const lang = useLocale(),
    label = (ko: string, ja: string, en: string) =>
      lang === "ko" ? ko : lang === "ja" ? ja : en;
  const { data, error } = useSWR<{ week: number; month: number; all: number }>(
    `/api/discovery/identity/${id}`,
    async (u: string) => {
      const r = await fetch(u);
      if (!r.ok) throw Error();
      return r.json();
    },
  );
  return (
    <div
      className={styles.interest}
      data-identity-interest
    >
      <h3 className="mb-3 font-[family-name:var(--font-heading)] text-sm text-[var(--gold)]">
        {label(
          "이 인격을 찾아본 관심도",
          "この人格への関心",
          "Interest in this identity",
        )}
      </h3>
      <dl className="grid grid-cols-3 gap-3">
        {(["week", "month", "all"] as const).map((key, i) => (
          <div key={key}>
            <dt className="text-xs text-[var(--text-muted)]">
              {
                [
                  label("최근 7일", "過去7日", "Last 7 days"),
                  label("최근 30일", "過去30日", "Last 30 days"),
                  label("전체 기간", "全期間", "All time"),
                ][i]
              }
            </dt>
            <dd className="mt-1 text-xl tabular-nums text-[var(--text-primary)]">
              {data ? data[key].toLocaleString() : error ? "—" : "…"}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        {error
          ? label(
              "방문 집계를 불러오지 못했습니다.",
              "集計を読み込めませんでした。",
              "Visit counts unavailable.",
            )
          : label(
              "기간 내 중복을 제외한 방문 브라우저 수입니다. 집계 시작 이후 기록을 사용합니다.",
              "期間内の重複を除いたブラウザ数。記録開始後のデータです。",
              "Unique browsers in each period, recorded since tracking began.",
            )}
      </p>
    </div>
  );
}
