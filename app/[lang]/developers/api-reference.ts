/** What the developer tools page tells a key holder about /api/v1. The API itself is described in docs/partner-api.md. */
export type Text = { ko: string; en: string; ja: string };
type Param = [name: string, text: Text];
export type ApiResource = { id: string; name: Text; summary: Text; params: Param[]; query: string; sample: string };

export const LIMITS = { standard: { minute: 60, day: 10000 as number | null }, partner: { minute: 600, day: null as number | null } };

const LANG: Param = ["lang", { ko: "ko, en, ja. 기본 ko", en: "ko, en or ja. Default ko", ja: "ko・en・ja。既定は ko" }];
const ONE: Param = ["id", { ko: "하나만 조회", en: "Read one item", ja: "1件だけ取得" }];
const PAGING: Param[] = [
  ["limit", { ko: "1–50. 기본 20", en: "1–50. Default 20", ja: "1〜50。既定は 20" }],
  ["offset", { ko: "0–100000", en: "0–100000", ja: "0〜100000" }],
  ["q", { ko: "제목 검색", en: "Search titles", ja: "タイトル検索" }],
  ["sort", { ko: "recent(기본), popular", en: "recent (default) or popular", ja: "recent(既定)・popular" }],
];
const json = (value: unknown) => JSON.stringify(value, null, 2);

type Source = Omit<ApiResource, "summary" | "params" | "sample"> & {
  partnerOnly: boolean;
  summary: Text;
  params: Param[];
  sample: string;
  /** What a partner key gets instead, for resources every key can read. */
  forPartner?: { summary: Text; params: Param[]; sample: string };
};

const SOURCES: Source[] = [
  {
    id: "decks",
    partnerOnly: false,
    name: { ko: "덱", en: "Decks", ja: "デッキ" },
    query: "?limit=20&sort=popular",
    summary: { ko: "공개 덱 목록을 최신순이나 추천순으로 받습니다.", en: "Public decks, newest or most voted first.", ja: "公開デッキを新着順またはおすすめ順で取得します。" },
    params: [...PAGING, ONE],
    sample: json({ data: [{ id: "31f960cd-…", title: "거던 거검슈 1인 15층", lang: "ko", main_keywords: ["파열"], vote_count: 12, deck_identities: [{ identity_id: "29de8739-…", slot_order: 0 }], deck_egos: [{ ego_id: "4cf6d936-…", grade: "ZAYIN" }] }], offset: 0, limit: 20, nextOffset: 20 }),
    forPartner: {
      summary: { ko: "공개 덱 목록입니다. id를 주면 편성 순서, 스킬별 공격 유형, 집계까지 받습니다.", en: "Public decks. With an id you also get the formation order, attack type per skill and the analysis.", ja: "公開デッキの一覧です。id を指定すると編成順、スキルごとの攻撃タイプ、集計まで取得できます。" },
      params: [...PAGING, ONE, LANG],
      sample: json({ data: [{ id: "31f960cd-…", title: "거던 거검슈 1인 15층", url: "https://saigo-no-dante.com/ko/decks/31f960cd-…", card_url: "https://saigo-no-dante.com/ko/decks/31f960cd-…/opengraph-image", formation: [{ slot_order: 0, uptie: 4, skill_counts: [3, 2, 1], identity: { name: "거미집의 검", sinner_id: "ryoshu", rarity: 3 }, skills: [{ skill_order: 1, name: "삼연[三連]", atk_type: "slash", sin_affinity: "lust", coins: 3 }] }], egos: [{ grade: "ZAYIN", name: "오감도", sin_affinity: "sloth" }], analysis: { attack_types: { slash: 45, pierce: 6, blunt: 31 }, sin_production: { wrath: 6, lust: 17 } } }] }),
    },
  },
  {
    id: "planners",
    partnerOnly: false,
    name: { ko: "플랜", en: "Plans", ja: "プラン" },
    query: "?limit=20&sort=popular",
    summary: { ko: "공개 거울 던전 플랜 목록을 최신순이나 추천순으로 받습니다.", en: "Public Mirror Dungeon plans, newest or most voted first.", ja: "公開の鏡ダンジョンプランを新着順またはおすすめ順で取得します。" },
    params: [...PAGING, ONE],
    sample: json({ data: [{ id: "7f2c0a11-…", title: "르누아르 진충덱", lang: "ko", difficulty: "hard", deck: [{ identity_id: "e7d2e403-…", slot_order: 0 }], floor_plan: [{ floor: 2, theme_id: "1003", gift_ids: ["9079"] }], gift_inventory: ["start_9043"], vote_count: 8 }], offset: 0, limit: 20, nextOffset: null }),
    forPartner: {
      summary: { ko: "공개 플랜 목록입니다. id를 주면 편성과 층별 테마팩, 기프트를 이름까지 받습니다.", en: "Public plans. With an id you also get the formation and each floor's theme pack and gifts by name.", ja: "公開プランの一覧です。id を指定すると編成と階ごとのテーマパック、ギフトを名前付きで取得できます。" },
      params: [...PAGING, ONE, LANG],
      sample: json({ data: [{ id: "7f2c0a11-…", title: "르누아르 진충덱", difficulty: "hard", url: "https://saigo-no-dante.com/ko/planner/community/7f2c0a11-…", formation: [{ slot_order: 0, uptie: 4, identity: { name: "홍원 군주", sinner_id: "hong-lu" } }], floors: [{ floor: 2, theme: { id: 1003, name: "헬스치킨" }, gifts: [{ game_id: 9079, name: "…", keyword: "충전" }] }], gift_inventory: [{ source: "start", enhancement: 0, game_id: 9043, name: "사원증" }] }] }),
    },
  },
  {
    id: "identities",
    partnerOnly: true,
    name: { ko: "인격", en: "Identities", ja: "人格" },
    query: "?lang=ko",
    summary: { ko: "인격 전체입니다. id를 주면 스킬과 패시브를 포함합니다.", en: "Every identity. With an id the skills and passives are included.", ja: "すべての人格です。id を指定するとスキルとパッシブを含みます。" },
    params: [LANG, ONE],
    sample: json({ data: [{ id: "29de8739-…", name: "거미집의 검", sinner_id: "ryoshu", rarity: 3, slash_res: "내성", pierce_res: "취약", blunt_res: "보통", keywords: ["호흡"], image_url: "https://…/10415_normal_info.webp", url: "https://saigo-no-dante.com/ko/sinners/ryoshu/identities/29de8739-…", card_url: "https://saigo-no-dante.com/ko/sinners/ryoshu/identities/29de8739-…/opengraph-image" }] }),
  },
  {
    id: "egos",
    partnerOnly: true,
    name: { ko: "E.G.O", en: "E.G.O", ja: "E.G.O" },
    query: "?lang=ko",
    summary: { ko: "E.G.O 전체입니다. id를 주면 스킬과 패시브를 포함합니다.", en: "Every E.G.O. With an id the skills and passives are included.", ja: "すべての E.G.O です。id を指定するとスキルとパッシブを含みます。" },
    params: [LANG, ONE],
    sample: json({ data: [{ id: "4cf6d936-…", name: "오감도", sinner_id: "yi-sang", grade: "ZAYIN", sin_affinity: "sloth", cost: [0, 0, 2, 0, 0, 1, 0], image_url: "https://…/20101_awaken_profile.webp", url: "https://saigo-no-dante.com/ko/sinners/yi-sang/ego/4cf6d936-…" }] }),
  },
  {
    id: "ego-gifts",
    partnerOnly: true,
    name: { ko: "기프트", en: "E.G.O gifts", ja: "ギフト" },
    query: "?lang=ko",
    summary: { ko: "기프트 전체와 강화 단계별 효과입니다. id는 게임 ID도 됩니다.", en: "Every gift with its effect at each enhancement. The id may be the game id.", ja: "すべてのギフトと強化段階ごとの効果です。id にはゲーム ID も使えます。" },
    params: [LANG, ONE],
    sample: json({ data: [{ id: "0b7e…", game_id: 9043, name: "사원증", keyword: "충전", grade: "2", price: 190, effect_base: "…", effect_plus: "…", effect_plusplus: "…", image_url: "https://…/ego-gift-ec45cf61.webp" }] }),
  },
  {
    id: "theme-packs",
    partnerOnly: true,
    name: { ko: "테마팩", en: "Theme packs", ja: "テーマパック" },
    query: "?lang=ko",
    summary: { ko: "테마팩 전체입니다. 층 정보와 기프트 ID 목록을 포함합니다.", en: "Every theme pack with its floor data and gift ids.", ja: "すべてのテーマパックです。階の情報とギフト ID の一覧を含みます。" },
    params: [LANG, ONE],
    sample: json({ data: [{ id: 1003, name: "헬스치킨", difficulty: "normal", ego_gift_ids: [9079, 9078], attack_type: "slash", image_url: "https://…/theme-packs/1003.webp" }] }),
  },
  {
    id: "md-events",
    partnerOnly: true,
    name: { ko: "거던 이벤트", en: "Dungeon events", ja: "鏡ダンジョンイベント" },
    query: "?lang=ko",
    summary: { ko: "거울 던전 이벤트 전체와 선택지, 판정 결과입니다.", en: "Every Mirror Dungeon event with its choices and outcomes.", ja: "すべての鏡ダンジョンイベントと選択肢、判定結果です。" },
    params: [LANG, ONE],
    sample: json({ data: [{ id: 901001, name: "…", desc_text: "…", image_url: "https://…/events/901001.webp", theme_ids: [1003], choices: [{ sort_order: 0, message: "…", result_text: "…", outcome: "…", next_event_id: null }] }] }),
  },
  {
    id: "keywords",
    partnerOnly: true,
    name: { ko: "키워드", en: "Keywords", ja: "キーワード" },
    query: "?lang=ko",
    summary: { ko: "키워드 전체입니다. key가 다른 데이터의 keywords 값과 맞습니다.", en: "Every keyword. The key matches the keywords values of the other data.", ja: "すべてのキーワードです。key が他のデータの keywords の値と一致します。" },
    params: [LANG, ONE],
    sample: json({ data: [{ key: "화상", name: "화상", description: "…", max_stack: 99, sin_affinity: null, category: "…" }] }),
  },
];

/** The resources an account may read. Nothing about partner data is returned for a standard account. */
export function resourcesFor(partner: boolean): ApiResource[] {
  return SOURCES.filter((source) => partner || !source.partnerOnly).map(({ id, name, query, forPartner, ...own }) => {
    const { summary, params, sample } = partner && forPartner ? forPartner : own;
    return { id, name, summary, params, query, sample };
  });
}

/** Requests of all keys per UTC day for the `days` ending at `today` (YYYY-MM-DD), oldest first. */
export function usageByDay(keys: { developer_usage: { day: string; requests: number }[] }[], today: string, days = 14) {
  const totals = new Map<string, number>();
  for (const key of keys) for (const usage of key.developer_usage) totals.set(usage.day, (totals.get(usage.day) ?? 0) + usage.requests);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1 - index) * 86400000).toISOString().slice(0, 10);
    return { day, requests: totals.get(day) ?? 0 };
  });
}
