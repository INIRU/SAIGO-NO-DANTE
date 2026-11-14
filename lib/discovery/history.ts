import { readJson, writeJson } from "@/lib/utils/local-storage";

export type HistoryItem = {
  href: string;
  title: string;
  kind: "identity" | "deck" | "planner";
  id: string;
};
const key = "limbus_browsing_v1";
export function readHistory(): {
  items: HistoryItem[];
  queries: string[];
  enabled: boolean;
} {
  const v = (readJson(key) ?? {}) as { items?: unknown; queries?: unknown; enabled?: unknown };
  try {
    return {
      items: Array.isArray(v.items)
        ? v.items
            .filter(
              (i: HistoryItem) =>
                typeof i.href === "string" &&
                i.href.startsWith("/") &&
                !i.href.startsWith("//") &&
                typeof i.title === "string",
            )
            .slice(0, 20)
        : [],
      queries: Array.isArray(v.queries)
        ? v.queries.filter((q: unknown) => typeof q === "string").slice(0, 20)
        : [],
      enabled: v.enabled !== false,
    };
  } catch {
    return { items: [], queries: [], enabled: true };
  }
}
export function remember(item: HistoryItem | string) {
  const history = readHistory();
  if (!history.enabled) return;
  if (typeof item === "string") {
    const q = item.trim();
    if (!q || q.length > 80) return;
    history.queries = [q, ...history.queries.filter((x) => x !== q)].slice(
      0,
      20,
    );
  } else
    history.items = [
      item,
      ...history.items.filter((x) => x.href !== item.href),
    ].slice(0, 20);
  writeJson(key, history); // Browsing works when storage is unavailable.
}
