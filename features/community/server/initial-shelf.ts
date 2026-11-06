import { cacheLife } from "next/cache";
import { loadDiscovery } from "@/features/community/server/feed";
import { popularSince } from "@/lib/discovery/update-window";

// The board pages' first paint: the default (this week) shelves, so crawlers and first visits get real cards in the HTML.
// Same entry as /api/discovery?period=week (loadDiscovery carries the decks-list / plans-list tags); `counts` stays out of the page payload.
async function loadWeekShelf(kind: "deck" | "planner") {
  "use cache";
  cacheLife("minutes");
  const { counts: _counts, ...shelf } = await loadDiscovery(kind, popularSince("week"));
  return shelf;
}

/** undefined when the feed fails: the shelf then loads it on the client as before. */
export async function loadInitialShelf(kind: "deck" | "planner") {
  try {
    return await loadWeekShelf(kind);
  } catch {
    return undefined;
  }
}
