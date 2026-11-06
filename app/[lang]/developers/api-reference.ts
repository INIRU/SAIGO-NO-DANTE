/** What the developer tools tell a key holder about /api/v1: endpoints, fields, examples and errors. The API itself is described in docs/partner-api.md. */
export type Text = { ko: string; en: string; ja: string };
export type Field = { name: string; type: string; required?: boolean; text: Text };
export type Scope = "catalog:read" | "news:write";
export type Endpoint = {
  id: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  group: "public" | "catalog" | "news";
  name: Text;
  summary: Text;
  /** Query string options. */
  params: Field[];
  /** JSON body fields, for requests that have a body. */
  body?: Field[];
  /** Example query string and body, as the docs and the test tab first show them. */
  query: string;
  bodySample?: string;
  /** Example response. */
  sample: string;
  /** Statuses this endpoint can answer besides 200, explained in ERRORS. */
  errors: number[];
};

export const API_BASE = "https://saigo-no-dante.com";
export const LIMITS = { standard: { minute: 60, day: 10000 as number | null }, partner: { minute: 600, day: null as number | null } };

export const GROUPS: Record<Endpoint["group"], Text> = {
  public: { ko: "공개 데이터", en: "Public data", ja: "公開データ" },
  catalog: { ko: "게임 데이터", en: "Game data", ja: "ゲームデータ" },
  news: { ko: "소식", en: "News", ja: "ニュース" },
};

export const SCOPES: Record<Scope, Text> = {
  "catalog:read": { ko: "게임 데이터와 덱·플랜 상세 읽기", en: "Read game data and deck and plan details", ja: "ゲームデータとデッキ・プラン詳細の取得" },
  "news:write": { ko: "캘린더에 소식 보내기와 지우기", en: "Post news to the calendar and delete it", ja: "カレンダーへのニュース送信と削除" },
};

export const ERRORS: Record<number, Text> = {
  400: { ko: "요청 값 오류. 이유는 error, 소식은 issues", en: "Invalid request value. See error, or issues for news", ja: "リクエスト値のエラー。理由は error、ニュースは issues" },
  401: { ko: "키 없음, 형식 오류, 폐기된 키", en: "Missing, malformed or revoked key", ja: "キーなし、形式エラー、失効したキー" },
  403: { ko: "권한 없는 기능, 이용 제한 계정", en: "No permission, or restricted account", ja: "権限のない機能、利用制限中のアカウント" },
  413: { ko: "본문 64KB 초과", en: "Body over 64KB", ja: "本文が 64KB 超過" },
  429: { ko: "한도 초과. Retry-After 초 뒤 재시도", en: "Limit reached. Retry after Retry-After seconds", ja: "制限超過。Retry-After 秒後に再送" },
  503: { ko: "일시 오류. 같은 요청 재시도", en: "Temporary failure. Retry the same request", ja: "一時的なエラー。同じリクエストを再送" },
};

const f = (name: string, type: string, text: Text, required = false): Field => ({ name, type, text, ...(required ? { required } : {}) });
const LANG = f("lang", "string", { ko: "ko, en, ja. 기본 ko", en: "ko, en or ja. Default ko", ja: "ko・en・ja。既定は ko" });
const ONE = f("id", "string", { ko: "하나만 조회", en: "Read one item", ja: "1件だけ取得" });
const PAGING = [
  f("limit", "integer", { ko: "1–50. 기본 20", en: "1–50. Default 20", ja: "1〜50。既定は 20" }),
  f("offset", "integer", { ko: "0–100000", en: "0–100000", ja: "0〜100000" }),
  f("q", "string", { ko: "제목 검색", en: "Search titles", ja: "タイトル検索" }),
  f("sort", "string", { ko: "recent(기본), popular", en: "recent (default) or popular", ja: "recent(既定)・popular" }),
];
const json = (value: unknown) => JSON.stringify(value, null, 2);
const READ_ERRORS = [400, 401, 403, 429, 503];

type Source = Pick<Endpoint, "id" | "name" | "query" | "summary" | "params" | "sample"> & {
  /** Needs the catalog scope. */
  catalogOnly: boolean;
  /** What a key with the catalog scope gets instead, for resources every key can read. */
  withCatalog?: Pick<Endpoint, "summary" | "params" | "sample">;
};

const SOURCES: Source[] = [
  {
    id: "decks",
    catalogOnly: false,
    name: { ko: "덱", en: "Decks", ja: "デッキ" },
    query: "?limit=20&sort=popular",
    summary: { ko: "공개 덱 목록을 최신순이나 추천순으로 받습니다.", en: "Public decks, newest or most voted first.", ja: "公開デッキを新着順またはおすすめ順で取得します。" },
    params: [...PAGING, ONE],
    sample: json({ data: [{ id: "31f960cd-…", title: "거던 거검슈 1인 15층", lang: "ko", main_keywords: ["파열"], vote_count: 12, deck_identities: [{ identity_id: "29de8739-…", slot_order: 0 }], deck_egos: [{ ego_id: "4cf6d936-…", grade: "ZAYIN" }] }], offset: 0, limit: 20, nextOffset: 20 }),
    withCatalog: {
      summary: { ko: "공개 덱 목록입니다. id를 주면 편성 전원의 순서, 스킬별 공격 유형, 집계까지 받습니다. 아래 예시는 한 명만 적었습니다.", en: "Public decks. With an id you also get every slot of the formation in order, the attack type per skill and the analysis. The example below lists one slot.", ja: "公開デッキの一覧です。id を指定すると編成全員の順番、スキルごとの攻撃タイプ、集計まで取得できます。下の例は1人分だけです。" },
      params: [...PAGING, ONE, LANG],
      sample: json({ data: [{ id: "31f960cd-…", title: "거던 거검슈 1인 15층", url: "https://saigo-no-dante.com/ko/decks/31f960cd-…", card_url: "https://saigo-no-dante.com/ko/decks/31f960cd-…/opengraph-image", formation: [{ slot_order: 0, uptie: 4, skill_counts: [3, 2, 1], identity: { name: "거미집의 검", sinner_id: "ryoshu", rarity: 3 }, skills: [{ skill_order: 1, name: "삼연[三連]", atk_type: "slash", sin_affinity: "lust", coins: 3 }] }], egos: [{ grade: "ZAYIN", name: "오감도", sin_affinity: "sloth" }], analysis: { attack_types: { slash: 45, pierce: 6, blunt: 31 }, sin_production: { wrath: 6, lust: 17 } } }] }),
    },
  },
  {
    id: "planners",
    catalogOnly: false,
    name: { ko: "플랜", en: "Plans", ja: "プラン" },
    query: "?limit=20&sort=popular",
    summary: { ko: "공개 거울 던전 플랜 목록을 최신순이나 추천순으로 받습니다.", en: "Public Mirror Dungeon plans, newest or most voted first.", ja: "公開の鏡ダンジョンプランを新着順またはおすすめ順で取得します。" },
    params: [...PAGING, ONE],
    sample: json({ data: [{ id: "7f2c0a11-…", title: "르누아르 진충덱", lang: "ko", difficulty: "hard", deck: [{ identity_id: "e7d2e403-…", slot_order: 0 }], floor_plan: [{ floor: 2, theme_id: "1003", gift_ids: ["9079"] }], gift_inventory: ["start_9043"], vote_count: 8 }], offset: 0, limit: 20, nextOffset: null }),
    withCatalog: {
      summary: { ko: "공개 플랜 목록입니다. id를 주면 편성 전원과 모든 층의 테마팩, 기프트를 이름까지 받습니다. 아래 예시는 일부만 적었습니다.", en: "Public plans. With an id you also get every slot of the formation and every floor's theme pack and gifts by name. The example below is shortened.", ja: "公開プランの一覧です。id を指定すると編成全員と全階のテーマパック、ギフトを名前付きで取得できます。下の例は一部だけです。" },
      params: [...PAGING, ONE, LANG],
      sample: json({ data: [{ id: "7f2c0a11-…", title: "르누아르 진충덱", difficulty: "hard", url: "https://saigo-no-dante.com/ko/planner/community/7f2c0a11-…", formation: [{ slot_order: 0, uptie: 4, identity: { name: "홍원 군주", sinner_id: "hong-lu" } }], floors: [{ floor: 2, theme: { id: 1003, name: "헬스치킨" }, gifts: [{ game_id: 9079, name: "…", keyword: "충전" }] }], gift_inventory: [{ source: "start", enhancement: 0, game_id: 9043, name: "사원증" }] }] }),
    },
  },
  {
    id: "identities",
    catalogOnly: true,
    name: { ko: "인격", en: "Identities", ja: "人格" },
    query: "?id=29de8739-…&lang=ko",
    summary: { ko: "id 없이 부르면 인격 전체 목록입니다. id를 주면 동기화 1~4 단계의 스킬과 패시브를 모두 포함하고, 줄마다 uptie_level로 단계를 알려 줍니다.", en: "Without an id, the list of every identity. With an id, the skills and passives of all four uptie levels are included; uptie_level on each row tells the level.", ja: "id なしではすべての人格の一覧です。id を指定すると同期化1〜4段階のスキルとパッシブをすべて含み、各行の uptie_level で段階が分かります。" },
    params: [LANG, ONE],
    sample: json({ data: [{ id: "29de8739-…", name: "거미집의 검", sinner_id: "ryoshu", rarity: 3, slash_res: "내성", pierce_res: "취약", blunt_res: "보통", keywords: ["호흡"], skills: [{ uptie_level: 1, skill_order: 1, name: "삼연[三連]", atk_type: "slash", sin_affinity: "lust", coins: 3, base_power: 3, coin_power: 2, description: "…", icon_url: "https://…/1041501.webp" }, { uptie_level: 4, skill_order: 1, name: "삼연[三連]", atk_type: "slash", sin_affinity: "lust", coins: 3, base_power: 3, coin_power: 3, description: "…", icon_url: "https://…/1041501.webp" }], passives: [{ uptie_level: 3, passive_type: "…", name: "…", description: "…" }], image_url: "https://…/10415_normal_info.webp", url: "https://saigo-no-dante.com/ko/sinners/ryoshu/identities/29de8739-…", card_url: "https://saigo-no-dante.com/ko/sinners/ryoshu/identities/29de8739-…/opengraph-image" }] }),
  },
  {
    id: "egos",
    catalogOnly: true,
    name: { ko: "E.G.O", en: "E.G.O", ja: "E.G.O" },
    query: "?lang=ko",
    summary: { ko: "E.G.O 전체입니다. id를 주면 스킬과 패시브를 포함합니다.", en: "Every E.G.O. With an id the skills and passives are included.", ja: "すべての E.G.O です。id を指定するとスキルとパッシブを含みます。" },
    params: [LANG, ONE],
    sample: json({ data: [{ id: "4cf6d936-…", name: "오감도", sinner_id: "yi-sang", grade: "ZAYIN", sin_affinity: "sloth", cost: [0, 0, 2, 0, 0, 1, 0], image_url: "https://…/20101_awaken_profile.webp", url: "https://saigo-no-dante.com/ko/sinners/yi-sang/ego/4cf6d936-…" }] }),
  },
  {
    id: "ego-gifts",
    catalogOnly: true,
    name: { ko: "기프트", en: "E.G.O gifts", ja: "ギフト" },
    query: "?lang=ko",
    summary: { ko: "기프트 전체와 강화 단계별 효과입니다. id는 게임 ID도 됩니다.", en: "Every gift with its effect at each enhancement. The id may be the game id.", ja: "すべてのギフトと強化段階ごとの効果です。id にはゲーム ID も使えます。" },
    params: [LANG, ONE],
    sample: json({ data: [{ id: "0b7e…", game_id: 9043, name: "사원증", keyword: "충전", grade: "2", price: 190, effect_base: "…", effect_plus: "…", effect_plusplus: "…", image_url: "https://…/ego-gift-ec45cf61.webp" }] }),
  },
  {
    id: "theme-packs",
    catalogOnly: true,
    name: { ko: "테마팩", en: "Theme packs", ja: "テーマパック" },
    query: "?lang=ko",
    summary: { ko: "테마팩 전체입니다. 층 정보와 기프트 ID 목록을 포함합니다.", en: "Every theme pack with its floor data and gift ids.", ja: "すべてのテーマパックです。階の情報とギフト ID の一覧を含みます。" },
    params: [LANG, ONE],
    sample: json({ data: [{ id: 1003, name: "헬스치킨", difficulty: "normal", ego_gift_ids: [9079, 9078], attack_type: "slash", image_url: "https://…/theme-packs/1003.webp" }] }),
  },
  {
    id: "md-events",
    catalogOnly: true,
    name: { ko: "거던 이벤트", en: "Dungeon events", ja: "鏡ダンジョンイベント" },
    query: "?lang=ko",
    summary: { ko: "거울 던전 이벤트 전체와 선택지, 판정 결과입니다.", en: "Every Mirror Dungeon event with its choices and outcomes.", ja: "すべての鏡ダンジョンイベントと選択肢、判定結果です。" },
    params: [LANG, ONE],
    sample: json({ data: [{ id: 901001, name: "…", desc_text: "…", image_url: "https://…/events/901001.webp", theme_ids: [1003], choices: [{ sort_order: 0, message: "…", result_text: "…", outcome: "…", next_event_id: null }] }] }),
  },
  {
    id: "keywords",
    catalogOnly: true,
    name: { ko: "키워드", en: "Keywords", ja: "キーワード" },
    query: "?lang=ko",
    summary: { ko: "키워드 전체입니다. key가 다른 데이터의 keywords 값과 맞습니다.", en: "Every keyword. The key matches the keywords values of the other data.", ja: "すべてのキーワードです。key が他のデータの keywords の値と一致します。" },
    params: [LANG, ONE],
    sample: json({ data: [{ key: "화상", name: "화상", description: "…", max_stack: 99, sin_affinity: null, category: "…" }] }),
  },
];

/** The body of POST /api/v1/news. Top-level, author and per-language names follow features/news/lib/payload.ts exactly (a test compares them). */
const NEWS_BODY: Field[] = [
  f("id", "string", { ko: "1–120자. 보내는 쪽에서 정하는 고유 값입니다. 같은 id를 다시 보내면 통째로 덮어씁니다. 언어를 뺀 값을 씁니다: steam:{gid}, x:{tweet_id}, youtube:{video_id}", en: "1–120 characters, unique on your side. Posting the same id again replaces the whole item. Leave the language out: steam:{gid}, x:{tweet_id}, youtube:{video_id}", ja: "1〜120文字。送信側で決める一意の値です。同じ id を再送すると丸ごと上書きします。言語を含めない値にします: steam:{gid}, x:{tweet_id}, youtube:{video_id}" }, true),
  f("feed", "string", { ko: "어느 소식인지. limbus(림버스 공식), project_moon(프문 소식), hampang(햄햄팡팡)", en: "Which news it is: limbus (official Limbus), project_moon (Project Moon news), hampang (HamHamPangPang)", ja: "どのニュースか。limbus(リンバス公式)、project_moon(プロムンのニュース)、hampang(ハムハムパンパン)" }, true),
  f("platform", "string", { ko: "어디서 왔는지. steam, x, youtube, chzzk, partner(봇이 직접 만든 알림)", en: "Where it came from: steam, x, youtube, chzzk or partner (a notice the bot wrote itself)", ja: "どこから来たか。steam, x, youtube, chzzk, partner(ボット自身が作った通知)" }, true),
  f("category", "string", { ko: "notice(기본), update, maintenance, event, video, live", en: "notice (default), update, maintenance, event, video or live", ja: "notice(既定)、update, maintenance, event, video, live" }),
  f("published_at", "datetime", { ko: "게시 시각. 시간대가 붙은 ISO 8601(2026-10-06T18:00:00+09:00). 캘린더 날짜는 한국 시간으로 나눕니다.", en: "When it was published: ISO 8601 with an offset (2026-10-06T18:00:00+09:00). The calendar day is the Korean date.", ja: "公開時刻。オフセット付きの ISO 8601(2026-10-06T18:00:00+09:00)。カレンダーの日付は韓国時間で決まります。" }, true),
  f("starts_at", "datetime | null", { ko: "점검·이벤트·방송의 시작 시각", en: "Start of a maintenance, event or stream", ja: "メンテナンス・イベント・配信の開始時刻" }),
  f("ends_at", "datetime | null", { ko: "끝나는 시각. starts_at보다 앞설 수 없습니다. 방송은 끝난 뒤 같은 id로 채워 다시 보냅니다.", en: "End time, not before starts_at. For a stream, post the same id again with it once it ends.", ja: "終了時刻。starts_at より前にはできません。配信は終了後に同じ id で埋めて再送します。" }),
  f("spoiler", "boolean", { ko: "기본 false. true면 이미지와 영상을 가리고 누르면 보여 줍니다.", en: "Default false. When true, images and videos stay covered until clicked.", ja: "既定は false。true なら画像と動画を隠し、クリックで表示します。" }),
  f("author", "object | null", { ko: "글쓴이. 림버스 공식 계정이 아닌 글(프문 소식, 햄햄팡팡)에 넣습니다.", en: "The author, for posts not from the official Limbus account (Project Moon news, HamHamPangPang).", ja: "投稿者。リンバス公式以外の投稿(プロムンのニュース、ハムハムパンパン)に入れます。" }),
  f("author.name", "string", { ko: "1–80자. author를 넣으면 필수", en: "1–80 characters. Required when author is given", ja: "1〜80文字。author を入れる場合は必須" }, true),
  f("author.handle", "string | null", { ko: "@ 없는 계정 이름", en: "Account name without @", ja: "@ なしのアカウント名" }),
  f("author.url", "string | null", { ko: "글쓴이 주소(https)", en: "Author address (https)", ja: "投稿者の URL(https)" }),
  f("content", "object", { ko: "언어별 내용. ko, en, ja 중 하나 이상. 없는 언어는 ko, en, ja 순으로 대신 보여 줍니다. 다른 키(jp 등)는 거부합니다.", en: "Text per language: at least one of ko, en, ja. A missing language falls back in ko, en, ja order. Other keys (jp …) are rejected.", ja: "言語別の内容。ko・en・ja のうち1つ以上。ない言語は ko, en, ja の順で代わりに表示します。ほかのキー(jp など)は拒否します。" }, true),
  f("content.{lang}.title", "string", { ko: "1–200자", en: "1–200 characters", ja: "1〜200文字" }, true),
  f("content.{lang}.body", "string", { ko: "0–4,000자의 일반 텍스트. 줄바꿈은 그대로 보입니다. Discord 마크다운은 빼고 보냅니다.", en: "Plain text, 0–4,000 characters. Line breaks are kept. Strip Discord markdown.", ja: "0〜4,000文字のプレーンテキスト。改行はそのまま表示します。Discord のマークダウンは外します。" }),
  f("content.{lang}.url", "string | null", { ko: "원문 주소(https). 봇이 만든 알림처럼 원문이 없으면 뺍니다.", en: "Address of the original (https). Leave it out when there is none, as for a notice the bot wrote.", ja: "原文の URL(https)。ボットが作った通知のように原文がなければ省きます。" }),
  f("content.{lang}.media", "array", { ko: "최대 10개. 적은 순서대로 보여 줍니다.", en: "Up to 10, shown in this order.", ja: "最大10件。この順番で表示します。" }),
  f("content.{lang}.translated", "boolean", { ko: "기본 false. 기계 번역이면 true", en: "Default false. true for machine translation", ja: "既定は false。機械翻訳なら true" }),
  f("content.{lang}.media[].type", "string", { ko: "image, youtube, video", en: "image, youtube or video", ja: "image, youtube, video" }, true),
  f("content.{lang}.media[].url", "string", { ko: "image: 이미지 주소. https이고 steamstatic.com, twimg.com, ytimg.com, pstatic.net, livecloud-thumb.akamaized.net(하위 도메인 포함)만 받습니다. video: 영상이 있는 원문 주소(https)", en: "image: the image address, https on steamstatic.com, twimg.com, ytimg.com, pstatic.net or livecloud-thumb.akamaized.net (subdomains included). video: the https page that has the video", ja: "image: 画像の URL。https で steamstatic.com, twimg.com, ytimg.com, pstatic.net, livecloud-thumb.akamaized.net(サブドメイン含む)のみ。video: 動画のある原文の URL(https)" }),
  f("content.{lang}.media[].id", "string", { ko: "youtube: 주소가 아닌 영상 ID 11자", en: "youtube: the 11-character video id, not a URL", ja: "youtube: URL ではなく動画 ID の11文字" }),
  f("content.{lang}.media[].thumbnail", "string", { ko: "video: 미리보기 이미지(선택). 이미지와 같은 호스트 규칙", en: "video: optional still, under the same host rule as images", ja: "video: サムネイル(任意)。画像と同じホスト規則" }),
];

const NEWS_SAMPLE = {
  id: "steam:5124582150142200443",
  feed: "limbus",
  platform: "steam",
  category: "update",
  published_at: "2026-10-06T18:00:00+09:00",
  content: {
    ko: { title: "10월 8일 정기 점검 및 업데이트 안내", body: "관리자님, 안녕하세요.\n10월 8일(목) 정기 점검 내용을 안내드립니다.", url: "https://store.steampowered.com/news/app/1973530/view/5124582150142200443?l=koreana", media: [{ type: "image", url: "https://clan.fastly.steamstatic.com/images/42694509/notice_ko.png" }] },
    en: { title: "Scheduled Update Notice for Oct 8th", body: "Greetings, Dear Managers.", url: "https://store.steampowered.com/news/app/1973530/view/5124582150142200443?l=english", media: [{ type: "image", url: "https://clan.fastly.steamstatic.com/images/42694509/notice_en.png" }] },
    ja: { title: "10月8日 定期メンテナンスおよびアップデートのお知らせ", body: "管理人様、こんにちは。", url: "https://store.steampowered.com/news/app/1973530/view/5124582150142200443?l=japanese", media: [{ type: "image", url: "https://clan.fastly.steamstatic.com/images/42694509/notice_ja.png" }] },
  },
};

const NEWS_ENDPOINTS: Endpoint[] = [
  {
    id: "news",
    method: "POST",
    path: "/api/v1/news",
    group: "news",
    name: { ko: "소식 보내기", en: "Post news", ja: "ニュース送信" },
    summary: { ko: "캘린더에 소식 하나를 저장합니다. 새 id는 201, 같은 id는 덮어쓰고 200입니다.", en: "Stores one news item for the calendar. A new id answers 201; the same id replaces the item and answers 200.", ja: "カレンダーにニュースを1件保存します。新しい id は 201、同じ id は上書きで 200 です。" },
    params: [f("dry_run", "string", { ko: "1이면 검증만 하고 저장하지 않습니다. 저장됐을 때의 값을 item으로 돌려줍니다.", en: "With 1 the item is only validated, not stored. The value that would be stored comes back as item.", ja: "1 にすると検証だけ行い保存しません。保存される値を item で返します。" })],
    body: NEWS_BODY,
    query: "?dry_run=1",
    bodySample: json(NEWS_SAMPLE),
    sample: json({ data: { id: "steam:5124582150142200443", created: true, day: "2026-10-06", url: "https://saigo-no-dante.com/ko/calendar?date=2026-10-06" } }),
    errors: [400, 401, 403, 413, 429, 503],
  },
  {
    id: "news-delete",
    method: "DELETE",
    path: "/api/v1/news",
    group: "news",
    name: { ko: "소식 지우기", en: "Delete news", ja: "ニュース削除" },
    summary: { ko: "이 키의 파트너가 보낸 소식 하나를 지웁니다. 없는 id면 deleted가 false입니다.", en: "Deletes one item this key's partner posted. For an unknown id, deleted is false.", ja: "このキーのパートナーが送ったニュースを1件削除します。存在しない id では deleted が false です。" },
    params: [f("id", "string", { ko: "보낼 때 쓴 id", en: "The id it was posted with", ja: "送信時に使った id" }, true)],
    query: "?id=steam:5124582150142200443",
    sample: json({ data: { id: "steam:5124582150142200443", deleted: true } }),
    errors: [400, 401, 403, 429, 503],
  },
];

/** One body per kind of news the Limpi bot relays, for the partner tab. Each must pass features/news/lib/payload.ts (a test posts them through it). */
export const NEWS_EXAMPLES: { id: string; name: Text; note: Text; body: unknown }[] = [
  {
    id: "steam",
    name: { ko: "Steam 공지", en: "Steam news", ja: "Steam のお知らせ" },
    note: { ko: "id는 steam:{gid}. 세 언어를 한 요청에", en: "id is steam:{gid}. All three languages in one request", ja: "id は steam:{gid}。3言語を1リクエストに" },
    body: NEWS_SAMPLE,
  },
  {
    id: "x",
    name: { ko: "림버스 X", en: "Limbus on X", ja: "リンバスの X" },
    note: { ko: "번역은 translated: true. 영상은 type video에 원문 주소와 thumbnail", en: "Translations carry translated: true. A video is type video with the post address and a thumbnail", ja: "翻訳は translated: true。動画は type video に原文 URL と thumbnail" },
    body: {
      id: "x:1975432109876543210", feed: "limbus", platform: "x", published_at: "2026-10-06T12:00:00+09:00",
      content: {
        ko: { title: "신규 인격 PV 공개", body: "신규 인격 PV가 공개되었습니다.", url: "https://x.com/LimbusCompany_B/status/1975432109876543210", media: [{ type: "video", url: "https://x.com/LimbusCompany_B/status/1975432109876543210/video/1", thumbnail: "https://pbs.twimg.com/ext_tw_video_thumb/1975432109876543210/pu/img/still.jpg" }] },
        en: { title: "New Identity PV released", body: "The new Identity PV has been released.", url: "https://x.com/LimbusCompany_B/status/1975432109876543210", translated: true },
      },
    },
  },
  {
    id: "project-moon",
    name: { ko: "프문 소식", en: "Project Moon news", ja: "プロムンのニュース" },
    note: { ko: "글쓴이는 author. 리포스트·인용은 Discord에 내보낸 글 그대로 body", en: "The poster goes in author. For a repost or quote, body is the text sent to Discord", ja: "投稿者は author。リポスト・引用は Discord に流した文面を body に" },
    body: {
      id: "x:1975400000000000001", feed: "project_moon", platform: "x", published_at: "2026-10-05T19:30:00+09:00",
      author: { name: "ProjectMoon", handle: "ProjectMoon_", url: "https://x.com/ProjectMoon_" },
      content: { ko: { title: "프로젝트 문 공식 굿즈 예약 안내", body: "공식 굿즈 예약 판매가 시작되었습니다.", url: "https://x.com/ProjectMoon_/status/1975400000000000001", media: [{ type: "image", url: "https://pbs.twimg.com/media/GoodsNotice.jpg" }] } },
    },
  },
  {
    id: "hampang-x",
    name: { ko: "햄햄팡팡 (X)", en: "HamHamPangPang (X)", ja: "ハムハムパンパン (X)" },
    note: { ko: "feed는 hampang, platform은 x 또는 youtube", en: "feed is hampang, platform is x or youtube", ja: "feed は hampang、platform は x か youtube" },
    body: {
      id: "x:1975411111111111111", feed: "hampang", platform: "x", published_at: "2026-10-06T10:00:00+09:00",
      author: { name: "햄햄팡팡", handle: "Ham_PangPang" },
      content: { ko: { title: "10월 둘째 주 메뉴 안내", body: "이번 주 한정 메뉴를 소개합니다.", url: "https://x.com/Ham_PangPang/status/1975411111111111111", media: [{ type: "image", url: "https://pbs.twimg.com/media/HamMenu.jpg" }] } },
    },
  },
  {
    id: "hampang-youtube",
    name: { ko: "YouTube 업로드", en: "YouTube upload", ja: "YouTube 動画" },
    note: { ko: "영상은 type youtube에 영상 ID", en: "The video is type youtube with its video id", ja: "動画は type youtube に動画 ID" },
    body: {
      id: "youtube:dQw4w9WgXcQ", feed: "hampang", platform: "youtube", category: "video", published_at: "2026-10-04T20:00:00+09:00",
      author: { name: "햄햄팡팡" },
      content: { ko: { title: "[hamhampangpang] 신메뉴 소개 영상", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", media: [{ type: "youtube", id: "dQw4w9WgXcQ" }] } },
    },
  },
  {
    id: "live",
    name: { ko: "라이브 방송", en: "Live stream", ja: "ライブ配信" },
    note: { ko: "시작 때 starts_at, 종료 때 같은 id에 ends_at을 채워 재전송", en: "starts_at at the start; at the end, the same id again with ends_at", ja: "開始時に starts_at、終了時に同じ id へ ends_at を入れて再送" },
    body: {
      id: "chzzk:live:15672341", feed: "limbus", platform: "chzzk", category: "live", published_at: "2026-10-03T19:00:00+09:00", starts_at: "2026-10-03T19:00:00+09:00",
      content: { ko: { title: "림버스 컴퍼니 시즌 방송", url: "https://chzzk.naver.com/live/b5ed5db484d04faf4d150aedd362f34b", media: [{ type: "video", url: "https://chzzk.naver.com/live/b5ed5db484d04faf4d150aedd362f34b", thumbnail: "https://livecloud-thumb.akamaized.net/chzzk/livecloud/KR/stream/15672341/live/thumbnail/image_720.jpg" }] } },
    },
  },
  {
    id: "maintenance",
    name: { ko: "점검 알림", en: "Maintenance notice", ja: "メンテナンス通知" },
    note: { ko: "platform은 partner, url 없음. 기간은 starts_at, ends_at", en: "platform is partner, no url. The period is starts_at and ends_at", ja: "platform は partner、url なし。期間は starts_at、ends_at" },
    body: {
      id: "maintenance:2026-10-08", feed: "limbus", platform: "partner", category: "maintenance", published_at: "2026-10-08T10:00:00+09:00", starts_at: "2026-10-08T10:00:00+09:00", ends_at: "2026-10-08T12:00:00+09:00",
      content: { ko: { title: "정기 점검이 시작되었습니다", body: "10:00–12:00 정기 점검" }, en: { title: "Scheduled maintenance has started", body: "Scheduled maintenance 10:00–12:00 KST" }, ja: { title: "定期メンテナンスが始まりました", body: "10:00〜12:00 定期メンテナンス" } },
    },
  },
];

/** The endpoints an account may use. Nothing about the others is returned. */
export function endpointsFor(can: { catalog: boolean; news: boolean }): Endpoint[] {
  const data = SOURCES.filter((source) => can.catalog || !source.catalogOnly).map(({ catalogOnly, withCatalog, ...own }): Endpoint => ({
    ...own,
    ...(can.catalog && withCatalog ? withCatalog : {}),
    method: "GET",
    path: `/api/v1/${own.id}`,
    group: catalogOnly ? "catalog" : "public",
    errors: READ_ERRORS,
  }));
  return can.news ? [...data, ...NEWS_ENDPOINTS] : data;
}

export type CodeKind = "curl" | "python" | "javascript";
export const CODE_KINDS: [CodeKind, string][] = [["curl", "curl"], ["python", "Python"], ["javascript", "JavaScript"]];

// JSON written as a Python literal (True, False, None), indented like the JSON it came from.
function python(value: unknown, pad: string): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value !== "object") return JSON.stringify(value);
  const inner = `${pad}    `;
  const rows = Array.isArray(value) ? value.map((item) => python(item, inner)) : Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${python(item, inner)}`);
  if (!rows.length) return Array.isArray(value) ? "[]" : "{}";
  const [open, close] = Array.isArray(value) ? "[]" : "{}";
  return `${open}\n${rows.map((row) => `${inner}${row},`).join("\n")}\n${pad}${close}`;
}

/** The request as a command or snippet a developer can paste. */
export function codeSample(kind: CodeKind, request: { method: string; url: string; body?: unknown }, key = "YOUR_API_KEY"): string {
  const { method, url, body } = request;
  const hasBody = body !== undefined;
  if (kind === "curl")
    return [
      `curl ${method === "GET" ? "" : `-X ${method} `}"${url}"`,
      `  -H "Authorization: Bearer ${key}"`,
      ...(hasBody ? [`  -H "Content-Type: application/json"`, `  -d '${json(body).replace(/'/g, "'\\''")}'`] : []),
    ].join(" \\\n");
  if (kind === "python")
    return [
      "import requests",
      "",
      `response = requests.${method.toLowerCase()}(`,
      `    "${url}",`,
      `    headers={"Authorization": "Bearer ${key}"},`,
      ...(hasBody ? [`    json=${python(body, "    ")},`] : []),
      ")",
      "print(response.status_code, response.json())",
    ].join("\n");
  const headers = hasBody ? `{ Authorization: "Bearer ${key}", "Content-Type": "application/json" }` : `{ Authorization: "Bearer ${key}" }`;
  return [
    `const response = await fetch("${url}", {`,
    ...(method === "GET" ? [] : [`  method: "${method}",`]),
    `  headers: ${headers},`,
    ...(hasBody ? [`  body: JSON.stringify(${json(body).replace(/\n/g, "\n  ")}),`] : []),
    "});",
    "console.log(response.status, await response.json());",
  ].join("\n");
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
