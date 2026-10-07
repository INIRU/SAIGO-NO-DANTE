# 동기화 규칙

지금 동기화가 따르는 규칙과 그 이유다. 동작의 기준은 코드이고, 이 문서는 건드리면 안 되는 것과 판단 근거를 적는다. 실행 방법은 [runbook.md](runbook.md), 규칙의 바탕이 된 조사와 날짜별 기록은 [provenance.md](provenance.md)에 있다.

## 원본

- 입력은 사용자의 게임 추출본이다. [Dante’s Planner](https://dante-planner.com)는 화면 비교에만 쓰고 그 사이트의 이미지나 JSON을 가져오지 않는다.
- 원본에 없는 값(번역, 키워드, 그림, 보스)은 만들어 넣거나 비슷한 것으로 대체하지 않는다. 비워 두고 `report.json`이나 로그로 알린다.
- 원본과 백업은 저장소 밖에 둔다. 이름이 `2.*`라는 이유만으로 지우지 않는다.
- 기존 사용자·덱·플래너 데이터는 동기화의 정리 대상이 아니다.

공개 래스터 이미지는 WebP다. 큰 일러스트는 원본 크기를 유지한 quality 90/alphaQuality 100 WebP, UI 글자·문양·테두리는 무손실 WebP를 사용한다. PNG는 외부 작업 폴더의 원본이다.

## 자리표시 토큰

게임 원문이 플레이 중에 채우는 번호 자리(`{0}`, `{1}`, `{0:F1}`)는 DB에 의미 토큰으로 저장하고, 화면이 라벨(칩)로 그린다. 토큰 문법은 `lib/game-text/placeholders.ts`, 동기화 규칙은 `scripts/sync/placeholder-rules.ts` 한 곳에 있다. 규칙은 원문 필드(버프 id, 기프트 `convertDataList`·`descType`, 이벤트 문구)로 정하고 글자를 보고 추측하지 않는다. 라벨 문구는 `messages/*.json`의 `placeholder.*`, 모양은 `components/ui/PlaceholderLabel.tsx`에만 있어서 바꿔도 재동기화가 필요 없다. 게임의 `{0}`·`{amount}`와 겹치지 않게 이중 중괄호를 쓴다.

| 토큰 | 라벨(ko) | 칩 | 어디서 |
| --- | --- | --- | --- |
| `{{live}}` | 게임 중 표시 | 금색 테두리 + 맥박 아이콘 | `descType`이 있는 기프트의 나머지 자리, 충전 누적 소모량 같은 버프 누적값 |
| `{{potency}}` / `{{count}}` | 수치 / 횟수 | 금색 채움 / 밝은 테두리 | 버프·키워드 설명의 `{0}`(`{0:F1}` 포함) / `{1}` |
| `{{target}}` | 대상 | 붉은 톤 + 조준 아이콘 | 압송 채비(TiedWithRope)처럼 대상이 들어가는 버프(`BUFF_PLACEHOLDER_ROLES`) |
| `{{sinner}}` | 수감자 이름 | 사람 아이콘 | 이벤트 지문·결과문의 번호 자리와 `{affectedTarget}` |
| `{{gift:ID}}` | 기프트 이름 | 기프트 그림 + 이름, 누르면 그 기프트 | `convertDataList`가 있는 기프트의 `{0}`(9227 → `{{gift:9228}}`) |
| `{{value}}` | 값 | 점선 테두리 | 규칙이 없는 자리. 동기화 로그에 `⚠ 분류 안 된 자리표시 {5} (KR_Bufs: XxxBuff)`가 나오면 규칙표에 추가한다 |

`apply-extraction.ts`는 적용 뒤 토큰을 쓰는 열(`PLACEHOLDER_CHECK_COLUMNS`: 기프트 효과, 키워드 설명, 이벤트 지문·결과문)에 `{0}`이나 `{name}`이 남은 행을 세어 경고하고 `report.json`의 `leftoverPlaceholders`에 남긴다. 버프의 "(위력)"·"(횟수)"처럼 게임이 직접 쓴 괄호 글자(산나비(위력), 차원 표류의 "(수치)%")는 자리표시가 아니므로 그대로 둔다. 스킬·패시브·E.G.O 설명은 아래 "게임 원문 저장"대로 원문이라 `{0}`가 남는 것이 정상이고, 이벤트 선택지 문구(`message`)는 토큰 규칙 없이 저장되므로 둘 다 검사하지 않는다.

일반 글자로만 보여 주는 곳(검색 부제, 키워드 검색, 이벤트 제목 대체)은 `placeholdersToPlainText`로 "(수치)"처럼 바꾸고, 키워드 카드 미리보기는 `PlaceholderText`로 칩을 그린다. 어시스트 OCR 대조는 토큰 자리에서 원문을 나눈다.

## 게임 원문 저장과 참조 표

동기화는 스킬·패시브·E.G.O 스킬·패시브·flavor·키워드·기프트 효과를 유니티 태그(`<style>`, `<color>`, `<sprite>` 등)와 `[Id]` 참조를 지우거나 이름으로 바꾸지 않은 원문으로 저장하고, 사이트가 `GameText`(`lib/game-text/rich-text.ts`)로 그린다. 스킬 코인 설명은 본문 뒤에 `<coin=N>…</coin>` 묶음으로 붙는다. 번호 자리는 키워드·기프트·이벤트에서만 토큰이고(위 표), 스킬·패시브·E.G.O는 원문 `{0}` 그대로다. 발동 조건(`activation_condition`)만 내부에서 이름으로 바꾼 사본으로 계산한다.

`[Id]`가 가리키는 키워드·조건 라벨(BattleKeywords, SkillTag의 KR/EN/JP 이름·설명)은 `limbus.game_text_refs`에 있고 `scripts/sync/game-text-refs.ts`(dry-run 기본, `--fix`)가 채운다. 이 표는 `apply-extraction`의 첫 단계(`refs`)이며 `keyword_meta`와 이름이 같은 행을 `keyword_name`으로 잇는다. 표가 없는 DB(마이그레이션 `20261001023933_game_text_refs.sql` 미적용)에서 `--fix`는 백업 단계에서 멈추므로 아무것도 쓰지 않는다. 표 행은 지우지 않는다(원문에 없는 DB 행은 완전성 검사의 누락으로 세지 않는다). 어시스트 OCR 대조와 검색 부제는 `gameTextForScreen`·`gameTextToPlain`으로 태그를 벗기고 `[Id]`를 이름으로 바꾼 글자를 쓴다.

대표 참조(`keyword_meta.game_id`, 2026-10-01): 큐레이션 표 `keyword_meta`(이름이 기본키, 아이콘·분류·최대 중첩·효과 유형)와 참조 표 `game_text_refs`(게임 id가 기본키)는 이름·설명이 겹친다. `keyword_meta.game_id`(nullable, `game_text_refs(id)` 외래 키 `on delete set null`, 마이그레이션 `20261001060026_keyword_meta_game_id.sql`)가 키워드마다 대표 참조 한 행을 가리키고, 사이트는 그 행에서 언어별 이름·설명을 읽는다(`lib/keywords/ref-text.ts`; 언어별로 참조 값이 비어 있지 않을 때만, 아니면 `keyword_meta` 열). 표시의 출처는 참조 표이고, `keyword_meta`의 `name_en`·`name_jp`·`description*` 열은 대체 값이자 되돌리기 안전망이라 동기화가 계속 쓴다. 지우지 않는다(열·행 삭제는 별도 작업). 설정은 keywords 단계(`identity-data.ts --rebuild-keyword-meta`)가 한다: `game-text-refs-rules.ts`의 `selectPrimaryRefs`가 (1) keywords 단계가 그 키워드에 정한 자기 태그가 키워드 참조에 있으면 그 id, (2) 아니면 `keyword_name`이 그 이름인 참조가 하나뿐이면 그것, (3) 여럿이면 KR 인격·E.G.O 스킬·패시브·기프트 원문(`KR_Skills*`·`KR_Passive*`·`KR_EGOgift*`, 적·이상체·원호·튜토리얼 제외)에서 `[Id]`로 가장 많이 쓰인 것(공동 1등이면 정하지 않음)을 고르고, 못 고르면 비워 둔다(사이트는 `keyword_meta` 열을 쓴다). 이미 저장된 id는 규칙이 못 정한 이름에서 유지된다. 참조 표에 아직 없는 id는 쓰지 않고(외래 키), 컬럼이 없으면 계산·보고만 한다. 손으로 쓴 설명(`lib/keywords/description-overrides.ts`의 원호 공격·원호 방어)은 한국어에서 `keyword_meta.description`이 이기고, 참조 설명에 `{0}` 같은 날 자리표시가 남았는데 `keyword_meta`에 라벨 토큰판(`{{potency}}`)이 있으면 그것을 쓴다. 참조 이름에 유니티 태그(`[<s>큰 형님</s>]`)가 있으면 태그를 벗긴 글자를 쓴다. dry-run은 `SYNC_SUMMARY`의 `keywordMeta.gameId`(`set`·`byTag`·`only`·`mostUsed`·`ambiguous`·`none`·`refNotInDb`·`columnMissing`)와 모호·없음 목록을 출력한다. 2026-09-24 추출본 dry-run(컬럼 적용 전): 467개 중 설정 461(자기 태그 460, 같은 이름 하나 1, 가장 많이 쓰임 0), 모호 0, 없음 6(검은 날개·관통·잿빛 탄환·진동 - 보존·참격·타격).

## 인격, 스킬, 패시브

identity-data는 인격 스킬·패시브를 동기화 I~IV 모두 생성한다. 원본에 해당 단계 이하 데이터가 없는 스킬(대부분 S3, 동기화 III 해금)은 그 단계에서 만들지 않는다. `variant_order`는 최고 단계 값을 모든 단계에서 공유한다. 화면은 `(skill_order, variant_order)`·`(passive_type, passive_order)`별 최고 단계 행으로 중복을 제거하기 때문이다.

정신력 조건은 원본의 동기화 IV 이하 마지막 조건 목록을 사용한다. 단계별 이력 테이블이 아니다. 안정된 조건 키로 기존 행을 재사용하고, 원본에 없는 참조가 있으면 중단한다.

획득 경로는 이미 기록된 뽑기 배너(`gacha_id`, `gacha_name*`)를 유지한다. 최신 추출본에는 지난 픽업 파일이 없고, 수감자별 "특정 추출" 재개 배너가 옛 인격도 목록에 담기 때문이다. 이 규칙 전에는 9/24 추출본 dry-run이 142개 인격 중 141개의 배너 이름을 지우거나 재개 배너로 바꾸려 했다. 배너가 없는 인격만 원본 픽업을 쓴다.

## E.G.O

bootstrap은 빈 DB의 수감자/EGO 기초 행과 해석별 스킬을 복구한다. 원본의 희소 단계 패치를 누적하고 실제 최대 단계까지만 생성한다. 스토리 전용 비공개 EGO 5개는 공개 카탈로그에서 제외한다. 해석 V가 있는 EGO는 7개이며 나머지에 V를 만들어 넣지 않는다.

EGO 패시브는 KR_Passive_Ego를 포함한 세 언어에서 읽는다. CheckAwakenLevel2, CheckAwakenLevelBetween_2_4, CheckAwakenLevel5 조건을 ego_passives의 적용 구간으로 저장한다. 상세의 각성 탭에 맞춰 효과가 바뀌고 해석 I에서는 잠긴다. 기존 모달/API를 위한 EGO 테이블의 패시브 필드는 최대 해석 단계 요약으로 유지한다.

## 키워드 아이콘

키워드 아이콘 업로드(2026-10-01): 반영이 이벤트 그림·기프트 아이콘·E.G.O 이미지·테마팩·인격 이미지는 올렸지만 키워드 아이콘은 올리지 않아, 키워드 행이 새로 생겨도 그림이 없었다(2026-10-01에 추가된 검은 날개·검은 신의 가호·보존 신역·약속된 못·잿빛 탄환·진동 - 보존). 이제 `--fix`가 keywords 단계와 refs-link 직후 `scripts/sync/keyword-icons.ts`의 `uploadMissingKeywordIcons`를 실행한다. `keyword_meta`의 `icon_slug`로 사이트가 읽을 Storage 키(`icons/keywords/<slug>.webp`, `getKeywordIconUrl`을 그대로 불러 별칭·변형·로컬 자산(`/assets/game-ui`)으로 가는 슬러그는 건너뜀)를 구하고, 폴더 목록(한 번)에 없는 것만 대상으로 한다. 그 키워드의 후보 태그는 keywords 단계가 쓴 감사 파일(`LIMBUS_KEYWORD_AUDIT`, 작업 폴더 `keyword-audit.json`)의 대표 태그와 `game_text_refs`에서 `keyword_name`이 그 키워드인 id 전부다. 각 태그의 스프라이트는 버프 데이터(`*buff*.txt`)의 `iconId`(없으면 태그 자신)이고, 매니페스트에서 `kind '키워드'`·`name`이 같은 이미지가 정확히 하나여야 한다(같은 이름에 해시가 다른 이미지가 둘이면 모호). 태그들이 서로 다른 스프라이트로 이어지면 대표 태그의 것을 쓰고 대표 태그가 없으면 모호로 건너뛴다. 해시를 확인한 뒤 `sharp(...).webp({ lossless: true })`(UI 아이콘은 무손실)로 바꿔 `upsert: false`로 올리고 `uploads`에 `before: null`로 남겨 되돌리기가 지운다. 짝을 못 찾은 키워드는 `report.keywordsWithoutIcon`(이름·슬러그·사유 `no-sprite`/`ambiguous`·태그·스프라이트)에, 올린 것은 `report.newKeywordIcons`(이름·키·스프라이트)에 남고 반영은 멈추지 않는다. `--keyword-icons-only`는 ZIP 검사와 keywords dry-run(감사 파일용, DB 쓰기 없음) 뒤 이 단계만 실행한다(`--fix` 없이는 계획만, `--fix`는 Storage에 올리고 사이트 캐시를 갱신하며 실패하면 올린 것을 되돌린다). 이미 키워드 행만 있고 아이콘이 없을 때(이전 반영이 만든 키워드) 쓴다. 검증: 9/24 추출본으로 dry-run하면 `blessing-of-the-obsidian-god`(NoirShieldUp)·`sanctum-of-conservation`(NoirField)·`promised-nail`(`iconId`로 NoirNailBoss)가 짝지어지고, 그 추출본에 스프라이트가 없는 검은 날개·잿빛 탄환·진동 - 보존과 원래 그림이 없던 `공격 레벨+`는 `no-sprite`로 보고됐다.

키워드 아이콘 판정 기준(2026-10-01, `keywordIconSource`): `keyword_meta.icon_slug` 파일이 Storage에 없다는 것만으로는 누락이 아니다. 사이트는 `getKeywordIconUrl`로 슬러그를 자기 파일, 별칭·변형이 가리키는 다른 Storage 파일, 로컬 자산(`/assets/game-ui/...`: 능력치 아이콘·코인·아틀라스 키워드) 중 하나로 그린다. 사용자 감사의 "509개 중 38개 없음"을 풀어 보면 자기 슬러그 파일을 읽는데 없는 7개(검은 날개·검은 신의 가호·공격 레벨+·보존 신역·약속된 못·잿빛 탄환·진동 - 보존)만 실제로 비어 있고, 25개는 별칭·변형이 가리키는 Storage 파일이 있고(지령[단말기]·[쪽지] 8개는 사용자 지정에 따라 `prescript-2`, 신(心) 2개는 `shin-procuration` 등) 6개는 로컬 아틀라스 자산이다. 별칭·변형이 가리키는 파일을 데이터 스프라이트(`iconId`·태그)와 64x64 픽셀로 비교하면 25개 중 20개가 평균 차이 4 이내(손실 WebP 오차)로 같은 그림이고, 점혈 - 홍루(`nerve-strike-hong-lu-2`)와 지령[쪽지] I~IV(`prescript-2`)는 사용자가 고른 2번 원본이라 데이터 스프라이트와 다르다(건드리지 않는다). 이 단계는 자기 슬러그 파일만 올린다. 별칭 대상 파일이 없는 경우(현재 0건)는 올리지 않고 이미지 감사가 키로 알린다(여러 키워드가 한 파일을 쓰고 그림이 다를 수 있어 어느 스프라이트를 올릴지 정할 수 없다). 2026-09-24 추출본(`Downloads/LimbusAssets 2`)으로 실제 7개를 dry-run하면 3개(검은 신의 가호 NoirShieldUp, 보존 신역 NoirField, 약속된 못 NoirNailBoss)가 짝지어지고, 검은 날개(BlackWingHole)·잿빛 탄환(BulletHole)·진동 - 보존(VibrationFocusing)은 그 추출본의 데이터·이미지에 없는 2026-10-01 신규 키워드라 새 추출이 필요하다. 공격 레벨+(`AttackLevelAdder`)는 버프에 `iconId`가 없고 추출본에도 스프라이트가 없어 원본 그림이 없다([provenance.md](provenance.md) "아직 출처 연결을 확정하지 못한 부분").

## 스킬 아이콘

스킬 아이콘 업로드(2026-10-01): 새 인격 이미지 업로드(`sync-extracted-identities`)는 새 인격의 스킬만 올려서, 기존 인격이 나중에 얻은 스킬(인격 10412 N사 E.G.O:: 경멸, 경외의 1041205 "경멸 밑으로 쏟아지는 경외의 시선")은 Storage에 없었다. `--fix`는 새 인격 이미지 직후, `--skill-icons-only`/`--icons-only`는 단독으로 `scripts/sync/skill-icons.ts`의 `uploadMissingSkillIcons`를 실행한다. DB의 모든 스킬 행에서 사이트가 읽는 키를 `getSkillIconUrl`·`computeSkillImageIndices`로 그대로 만들고(`image_id`가 있으면 그것, 없으면 인격 id + 번호, 소유 수감자 폴더는 스프라이트 번호 앞 3자리), 수감자 폴더 목록(폴더마다 한 번)에 없는 키만 대상으로 한다. 추출본 매니페스트에서 `kind '스킬'`·`name`이 스프라이트 번호와 같은 이미지가 정확히 하나여야 하고(같은 이름에 해시가 다른 이미지가 둘이면 모호), 해시를 확인한 뒤 무손실 WebP로 `upsert: false`로 올리며 `uploads`에 `before: null`로 남겨 되돌리기가 지운다. 못 올린 것은 `report.skillsWithoutIcon`(키·스프라이트·인격·사유 `no-sprite`/`ambiguous`), 올린 것은 `report.newSkillIcons`에 남고 반영은 멈추지 않는다. 검증: 2026-10-01 운영 DB의 스킬 2,930행은 키 980개이고 없는 것은 `icons/skills/ryoshu/1041205.webp` 1개이며, 9/24 추출본(`Downloads/LimbusAssets 2`)에 그 스프라이트가 있어 dry-run이 1개 업로드를 계획한다.

지원 띠 그림(2026-10-07): 게임의 지원 인격 화면이 쓰는 기울어진 세로 띠 그림(`<ID>_normal_profile_support_personality`, `<ID>_gacksung_profile_support_personality`, 197×982)은 추출 목록에 `인격`으로 들어 있는데 `selectEntries`가 `_info`·`_profile`까지만 받아 올리지 않았다. 그래서 예전에 올린 인격에만 있고 추출 반영으로 들어온 최신 21종에는 없었다(로컬 에셋 폴더 기준 189종 중 168종 보유). 이제 새 인격 이미지 반영이 띠 그림도 같은 폴더에 `<이름>.webp`로 올린다. 띠 그림은 한쪽 상태만 있는 인격이 있어 없다고 실패하지 않는다. 이미 반영된 인격은 `--support-only`로 띠 그림만 채운다:

```bash
node scripts/assets/sync-extracted-identities.cjs --ids 10917,10315 --source <추출본 폴더> --output <작업 폴더> --support-only        # 계획만
node scripts/assets/sync-extracted-identities.cjs --ids 10917,10315 --source <추출본 폴더> --output <작업 폴더> --support-only --fix  # 올리고 검증
```

## 기프트와 이벤트 그림

새 기프트·이벤트 그림(2026-09-28): mirror 단계 뒤 `ego_gifts.image_url`이 가리키는 `ego-gifts/` 객체가 없으면 ZIP의 `EgoGiftIcon/<게임 ID>.png`(kind `기프트`, name=게임 ID)를 webp로 올리고, ZIP에 아이콘이 없는 기프트는 `report.json`의 `giftsWithoutIcon`에 남긴다. events 단계 전에는 ZIP의 이벤트 삽화(kind `이벤트선택지`, 파일 이름 앞 이벤트 번호)를 `icons/events/<번호>.webp`에 없는 것만 올려, 이벤트 재구성이 원화를 연결하게 한다. 둘 다 기존 파일은 덮어쓰지 않고 `uploads`에 기록해 되돌리기로 지운다. 9/24 추출본 기준으로는 기프트 9818 아이콘 1개(현재 Storage에 없음)만 대상이고 이벤트 원화는 모두 있다. 기존 E.G.O 전체를 추출본으로 다시 쓰는 것은 보류했다: 전체 dry-run에서 2개가 죄악 속성·코스트·내성·패시브까지 DB와 달라 원인 확인이 먼저다(그림 폴더는 기존 값을 유지하도록 했다).

## 기프트 수집

게임 원본과의 대조는 원본이 로컬에만 있어 CI에서 돌리지 않는다. 새 추출본을 받으면 기프트 이미지를 원본과 축소 비교해 다른 그림이 올라간 항목을 찾는다(2026-09-26에 9818 남겨진 차원 건틀릿이 이 방법으로 발견됐다). 선의의 순례(1122)는 2025-10-23에 끝난 팩이라 현재 원본에서 풀과 이벤트가 비어 있다. 전용 기프트 9831~9839는 `THEME_EXTRA_EXCLUSIVE_GIFTS`로 넣고, 그중 9836~9839는 어디에서도 참조되지 않아 이 목록을 통해 `ego-gift-story-pilgrimage.txt`에서 가져온다. 테마팩 `egoGiftPool`·`specificEgoGiftPool`·`fixedRewardEgoGifts`나 보스 스테이지 확정 보상에만 있는 기프트는 `mirror-dungeon-data.ts`가 `story-*` 파일을 건너뛰어도 포함된다(오랏줄, N사 고정팀 가방, 떼구름, 소흥주가 이렇게 누락됐었다). 같은 기프트가 건너뛴 파일 여러 곳에 있으면 내용이 가장 많은 항목을 쓴다. 원목 술잔(9781)은 `ego-gift-a1c7p3.txt`에 id만 있는 껍데기로, `ego-gift-story-ycgd-BokGak.txt`에 TIER_3·가격 250으로 들어 있다. 기프트 효과 원문의 `{0}`, `{1}`은 게임이 플레이 중에 채우는 실시간 수치라 `{{live}}` 토큰으로 저장한다(봉이 인형 9242: "(현재 {0}%. 최대 100%)" → "(현재 {{live}}%. 최대 100%)"). 예전에는 0으로 채워 "현재 0%"로 보였다. `convert_to`가 있는 기프트의 `{0}`은 변환 대상 이름으로 채운다.

## 테마팩 데이터

테마팩의 `fixed_reward_gift_ids`는 `mirror-dungeon-data.ts`가 채운다. 테마팩 원본의 `fixedRewardEgoGifts`(뽕.황 3001: 9242, 9083, 9082, 9081)와, `mapGenOption.bossPool` 스테이지(`mirrordungeon-(ab)battle*`)의 `rewardList`에 확정 기프트가 하나 있는 경우 그 기프트를 모아, `ego_gifts`에 있는 id만 저장한다. 2026-09-24 기준으로 익스트림 1511~1520 팩이 보상 기프트를 하나씩 준다(9250~9255, 9827~9830). 플랜 상세, 플래너 요약, Assist는 이 기프트를 해당 팩이 있는 층의 기프트로 자동 포함하고 팩 전용으로 표시한다. DB의 NULL 목록은 원본 목록이 비어 있어도 `[]`로 다시 쓴다.

`specific_ego_gift_ids`는 원본 `specificEgoGiftPool`에, 원본 id로 이어지지 않는 전용 기프트(`scripts/sync/mirror-dungeon-rules.ts`의 `THEME_EXTRA_EXCLUSIVE_GIFTS`)를 더한 값이다. 3001 뽕.황은 봉이 인형(9242), 1122 선의의 순례는 순례 스토리 던전(912014/912114) 이벤트 971074~971078의 9831~9835, 1124 호박색 어스름의 시련은 이벤트 971092의 아직 따뜻한 커피(9241)다. 테마팩 원본에 동기화가 읽지 않는 항목(예: `specificEgoGiftForUpegsProbs`, `isUnrecordable`, `uiConfigs.showBossIds`)이 있으면 항목과 팩 id를 경고로 출력한다. `LIMBUS_DATA_DIR` 없이 수동 실행하면 스크립트마다 기본 경로가 달라(기프트·테마팩은 옛 로컬 export, 이벤트는 2026-09-10 복구본) 경고를 출력한다.

`ego_gift_themes`의 `name_color`(이름 색, `uiConfigs.textColor`), `name_segments`(단어별 색, KR/EN/JP `specialName`), `attribute_type`·`attack_type`(팩 속성·공격 유형), `boss_unit_ids`(`uiConfigs.showBossIds`), `is_unrecordable`은 동기화가 원본에서 채운다(`themeNameColor`·`themeNameSegments`·`themeBossUnitIds`). 이름 색이 없는 팩은 기본 베이지(`THEME_PACK_DEFAULT_COLOR`)로 그린다. 원본 specialName에 없는 다색 이름(1126 타래 엮기)은 `THEME_NAME_SEGMENT_OVERRIDES`에 둔다. 예전에 손으로 적던 `lib/data/theme-pack-colors.ts`의 색 표는 없앴다.

## 테마팩 합성

테마팩 카드는 추출 도구가 추출할 때 합성한다(2026-09-27). 게임 데이터 수집 뒤 `scripts/compose-theme-packs.cjs`가 번들의 `build-theme-packs.py`를 `THEME_PACK_FORMAT=png`로 실행해 모든 테마팩 카드를 도감 스냅숏의 `거울던전/합성 테마팩/<id>.png`(kind `합성 테마팩`, name 테마 id, label 한국어 이름)로 넣고 도감을 다시 그린다. 그래서 `.env.local`이 없어도 도감과 업로드 ZIP에 합성본이 있다. PNG 모드는 사이트 카드만 무손실로 저장하며 117장에 약 5초다(webp 인코딩까지 하면 약 330초). Windows PC에는 Python이 없어서 `tools/site-sync/python/`에 공식 CPython 3.12.10 embeddable과 Pillow 11.3.0 wheel(cp312 win_amd64)을 SHA-256 확인 후 풀어 넣는다(`build-site-sync --win`). embeddable의 `._pth`가 자기 폴더를 경로에 넣으므로 pip 없이 `PIL`을 불러온다. 사이트 반영의 마지막 단계는 테마 층 데이터 중 Storage에 `icons/theme-packs/<id>.webp` 또는 `boss/<bossSpriteId>.webp`가 없는 것만 골라(`scripts/sync/theme-images.ts`) ZIP의 `합성 테마팩`·`테마팩보스` PNG를 sharp webp(품질 95)로 바꿔 `--fix`일 때 올린다(`upsert: false`, 기존 이미지는 바꾸지 않는다). ZIP에 필요한 합성본이 없으면 중단한다. 결과는 `report.json`의 `newThemeImages`에 남는다. 검증: 9/24 추출본의 PNG 카드는 기존 webp 설정으로 다시 압축하면 Storage 이미지와 바이트 동일했고, sharp webp로 바꾼 1305·1514·보스도 Storage 이미지와 픽셀 차이 0이었다. 합성본을 넣은 추출본의 검사와 Mac 번들 전체 dry-run도 통과했다. Windows에서의 실제 추출·휴대용 Python 실행은 아직 확인하지 않았다.

사용자가 지정한 iCloud `My Project/무제 폴더/theme-pack-image-work/`는 기존 테마팩 합성 작업 자료다. 저장소의 `scripts/assets/build-theme-packs.py`가 이미 사용하는 비닐·로고·보스·경고·배턴·극한 테두리 합성은 유지한다. `LIMBUS_EXTRACTED_ASSET_ROOT`를 지정하면 새 manifest의 원래 `name`과 `path`로 테마팩/보스 원본을 찾아 합성한다. 이름이 중복되거나 파일이 없으면 중단하며 한국어 폴더명을 추정하지 않는다.

공통 오버레이 원본은 `MainUI_MirrorDungeon4_4.png`, `MainUI_MirrorDungeon6_17.png`, `Baton.png`다. 앞의 두 파일은 iCloud 작업 폴더의 `reference/composition_assets/`에 있고, 세 파일 모두 초기 복구 자료의 `theme-composition/`에 보존돼 있다. 새 묶음의 테마팩 이미지만으로는 공통 오버레이를 대체하지 않는다.

어시스트의 선택 테두리는 Drive 원본 `MainUI_MirrorDungeon4_4.png`(파일 ID `1tu_cNQt61d20xXAWco-sZbEqaFs76h7y`, SHA-256 `8f4d38e68080474f86b9255fa9f8c3e4b373b4bccf3e8e473232fd63b3d1176d`)의 좌상단 기준 영역 `(0, 210, 436, 950)`을 자른 `public/assets/game-ui/themes/selected-frame.webp`다. 크기는 436×740이며 무손실 WebP의 RGBA 픽셀 일치와 중앙 투명도를 확인했다. 선택한 팩에만 원본 테두리를 겹치고 중앙의 선택 문구는 UI에서 현지화한다.

기프트 강화 표시(`-`, `+`, `++`)는 Drive 원본 `MainUI_MirrorDungeon7_2.png`(파일 ID `1gwEx4jyyhyDm8UrllNhuGTLSjus6V4Md`, SHA-256 `3d6f802ccbbeee38a1c5308955a919097012d89b08feab50634850969ffe5547`)에서 자른다. 원본은 `../assets/recovery-2026-09-24/game-ui-sources/`에 두고 `node scripts/assets/extract-gift-enhance-ui.mjs`로 `public/assets/game-ui/gift/enhance-*.webp`와 버전 해시를 갱신한다. 크림색은 강화 단계 선택 버튼, 주황색은 기프트 우상단 표시에 쓴다.

```bash
LIMBUS_EXTRACTED_ASSET_ROOT="$HOME/Downloads/LimbusAssets" \
LIMBUS_DATA_DIR="$HOME/Downloads/LimbusAssets-ready-2026-09-19/complete-data" \
THEME_PACK_WORK_DIR="$HOME/Downloads/LimbusAssets-theme-preview-2026-09-19" \
LIMBUS_COMPOSITION_ASSET_DIR="<기존 복구 자료>/theme-composition" \
python3 scripts/assets/build-theme-packs.py
```

Pillow가 필요하다. 결과는 지정한 작업 폴더의 `output/`과 `diagnostics/`에만 생성하며 업로드하지 않는다. `diagnostics/missing.json`이 비어 있는지 확인하고 실제 합성 결과를 검토한다.

## 이벤트

**2026-09-27 완전히 같은 이벤트 사본:** 원본 필드와 한·영·일 문구가 ID 말고 모두 같은 이벤트는 가장 작은 ID를 대표로 두고, 나머지에 `variant_of`와 대표 그림을 저장한다(`identicalEventCopies`). 현재 가시춘 학생의 수업 복습 971071·971072(→971070)뿐이다. 이벤트 갤러리와 어시스트 인식은 사본을 빼고, ID 조회에는 남긴다. `replace_md_event_graph`는 모든 행을 넣은 뒤 `variant_of`를 채운다(마이그레이션 `event_graph_variants`).

그래프를 만드는 규칙(테마팩 풀과 고정 배치에서 진입점을 찾고 `nextEventID` 연결만 따라간다, 이름·그림·ID 자릿수로 부모를 추정하지 않는다)과 원화 연결 규칙(`illustId` 우선, 그 밖에는 `scripts/assets/event-image-source.ts`의 명시적 목록만)의 근거는 [provenance.md](provenance.md)의 "거던 이벤트 그래프 재구축"과 "이벤트 ID와 원화 ID가 다른 경우"에 있다.
