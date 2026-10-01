# 추출본 반영: 실행 안내

게임 추출본(ZIP)을 사이트 DB와 Storage에 반영하는 방법이다. 규칙은 [rules.md](rules.md), 동기화 코드를 고칠 때는 [developing.md](developing.md), 과거 반영 기록은 [provenance.md](provenance.md)를 본다.

## 어디서 실행되는가


- **평소:** 추출 도구가 추출 직후 자동으로 반영한다. 사람은 도구의 반영 기록과 작업 폴더의 `report.json`을 본다.
- **Mac에서 직접:** 새 동기화 코드를 병합 전에 시험하거나, 자동 반영이 실패해 다시 돌릴 때 쓴다. 저장소의 `scripts/sync/apply-extraction.ts`가 번들과 같은 코드다.
- 기본 실행은 계획만 세운다(dry-run). `--fix`는 운영 DB와 Storage를 바꾸므로 Mac에서는 사용자가 승인한 범위에서만 붙인다. 추출 도구의 무인 자동 반영은 2026-09-27에 상시 승인된 경로다.

## 입력

- ZIP 이름은 `LimbusAssets_<시각>.zip`이고 안은 `Data/static-data/<분류>/*.json`, `Localize/{kr,en,jp}`, `Images/`, `Reports/`다.
- 준비 단계(`prepare-extracted-assets.ts`)가 ZIP 전체를 검사한 뒤(해시, 크기, JSON 파싱, 목록 누락, 이름 충돌) 작업 폴더에 `complete-data/*.txt`와 `KR|EN|JP/`를 만든다. 그래서 풀어 둔 폴더를 `LIMBUS_DATA_DIR`로 직접 주지 않고 항상 `--zip`으로 넣는다.
- `--work`는 빈 폴더여야 한다. 그 안에 준비된 입력, `backup/`, `report.json`이 생긴다. 이 폴더가 되돌리기의 입력이므로 반영을 확인할 때까지 지우지 않는다.
- macOS `unzip`은 한글 이름에서 실패한다. 손으로 풀어 볼 때는 `ditto -x -k <zip> <폴더>`를 쓴다.

## 명령

```bash
# 번들: apply-extraction, game-text-refs, identity-data, mirror-dungeon-data, rebuild-mirror-events, sync-extracted-identities + Windows용 sharp,
# 추출 도구의 테마팩 합성용: build-theme-packs.py, theme-composition/ 오버레이 원본 3개, SCDream5.woff2, Windows용 휴대용 Python(python/)
node scripts/sync/build-site-sync.mjs "<림버스 에셋>/tools/site-sync" --win
# 옆에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, REVALIDATION_SECRET, NEXT_PUBLIC_SITE_URL만 담은 .env.local을 둔다.

# 저장소에서 같은 흐름을 직접 실행(기본은 dry-run, --fix가 적용)
node --import tsx scripts/sync/apply-extraction.ts --zip <LimbusAssets_*.zip> --work <빈 작업 폴더> [--fix]
# DB가 이미 이 추출본과 같아야 할 때: 반영하면 바뀔 것이 하나라도 있으면 종료 코드 1
node --import tsx scripts/sync/apply-extraction.ts --zip <LimbusAssets_*.zip> --work <빈 작업 폴더> --expect-clean

# 키워드 아이콘만(rules.md "키워드 아이콘"): ZIP을 같은 방식으로 검사한 뒤 아이콘 계획만 세운다. --fix가 올린다.
node --import tsx scripts/sync/apply-extraction.ts --zip <LimbusAssets_*.zip> --work <빈 작업 폴더> --keyword-icons-only [--fix]
# 기존 인격의 스킬 아이콘만(--skill-icons-only), 둘 다(--icons-only): 모두 끝에 이미지 감사를 한다.
node --import tsx scripts/sync/apply-extraction.ts --zip <LimbusAssets_*.zip> --work <빈 작업 폴더> --icons-only [--fix]

# 운영 DB가 참조하는 이미지가 Storage에 있는지 읽기 전용으로 확인(아래 "이미지 누락 감사"): 아무것도 쓰지 않는다.
node --import tsx scripts/sync/audit-images.ts [--json <파일>] [--limit <종류별 키 수>] [--strict]
```

## 단계와 백업

`apply-extraction`은 `prepareExtractedAssets`로 ZIP 전체를 검사한 뒤 refs(게임 텍스트 참조 표, `game-text-refs.ts`) → identity → keywords → refs-link(같은 동기화를 한 번 더: keywords 단계가 새로 만든 `keyword_meta` 행을 `keyword_name`으로 잇는다. 이 연결이 없으면 적용 뒤 읽기 검증이 refs 변경을 남은 차이로 본다) → mirror(기프트·테마팩·레시피) → events 순서로 단계마다 dry-run 후 `--fix`를 실행한다. 첫 적용 전에 `identities`, `skills`, `passives`, `ego`, `ego_skills`, `ego_gifts`, `keyword_meta`, `game_text_refs`, `ego_gift_themes`, `ego_gift_recipes`를 작업 폴더 `backup/`에 저장하고, 이벤트 단계는 자체적으로 `md_events`/`md_event_choices`를 백업한 뒤 읽기 검증한다. 실패하면 그 단계에서 멈춘다. 새 인격은 같은 ZIP에서 `sync-extracted-identities`로 이미지를 올린다. 새 E.G.O(숨김·각성 스킬 없는 스토리 전용 E.G.O는 제외)는 단계들이 끝난 뒤 `bootstrap-data.ts --ego-ids`로 행·단계별 스킬·단계별 패시브(`ego_passives`, SkillTag 구획 제목 번역 포함)를 넣고, ZIP의 `<id>_awaken_profile`·`erosion_profile`·`cg`·`e_cg`·`profile_summary`를 `sinners/<수감자>/ego/<폴더>/`에 webp로 올린 뒤(기존 파일은 덮어쓰지 않음) 사이트 캐시를 갱신한다. Drive 아트 목록이 없는 Windows에서는 폴더를 영어 이름으로 정하고 ASCII 밖 글자는 `_uXXXX_`로 쓴다(Drive 폴더 규칙과 같음). 결과는 `report.json`의 `newEgos`에 남는다. 2026-09-28 검증: 9/24 추출본으로 엄숙한 애도(20109)·착영휘도(20509)를 새 E.G.O로 가정해 dry-run한 계획이 DB의 행·패시브·스킬 16개와 필드까지 같았다. 번들에서 `bootstrap-data.mjs`가 `identity-data`를 품으므로, `identity-data`는 파일 이름까지 확인해 직접 실행될 때만 동기화를 시작한다. 키워드 아이콘은 refs-link 직후 올린다(아래). 이벤트 재구성은 복구 폴더가 없으면 선택지 템플릿을 추출본의 `KR/EN/JP_ChoiceEvent*.txt`에서, 이벤트 그림 유무를 Storage `icons/events/` 목록에서 읽는다.

dry-run은 반영하면 바뀔 것을 `report.json`의 `pendingChanges`에 목록으로 남기고 끝에 출력한다(단계별 new·changed·removed, 새 E.G.O, 바뀐 E.G.O, 새 테마팩 그림). 비어 있으면 DB가 추출본과 같다는 뜻이다. 요약을 출력하지 않은 단계가 있으면 그것도 한 건으로 센다. 아이콘·이미지 누락은 여기에 들어가지 않고 아래 이미지 감사가 본다.

적용 도중 실패하거나 읽기 검증이 실패하면 `apply-extraction`은 `extraction-restore`를 스스로 실행해 백업 상태로 되돌리고 멈춘다(`report.autoRestored`, `logs/auto-restore.log`). 자동 되돌리기까지 실패하면 아래 "되돌리기"로 그 작업 폴더를 직접 되돌린다.

## 반영 뒤 확인

1. `report.json`을 본다. 새로 생긴 것(`newEgos`, `newKeywordIcons`, `newSkillIcons`, `newThemeImages`, `egoArtwork`)과 못 채운 것(`keywordsWithoutIcon`, `skillsWithoutIcon`, `giftsWithoutIcon`, `egoWithoutArtwork`, `missingImages`, `leftoverPlaceholders`)이 종류별로 남는다.
2. `--fix`는 끝에 사이트 캐시를 갱신한다(`/api/revalidate`의 `all-game-data`). 로컬 개발 서버는 따로 갱신해야 새 데이터가 보인다.
3. 같은 ZIP으로 `--expect-clean`을 붙여 한 번 더 실행한다. "DB equals the extraction"과 종료 코드 0이 나와야 한다.
4. `npm run audit:data`를 실행한다.
5. Chrome에서 하드 리프레시 후 새 인격·E.G.O·기프트 화면을 확인한다([개발과 검증](../development.md)).

`npm run audit:data`(`scripts/audit/data-integrity.ts`)가 운영 DB를 공개 키로 읽어 검사한다. 테마팩의 `ego_gift_ids`·`specific_ego_gift_ids`·`fixed_reward_gift_ids`, 기프트 `convert_to`, 조합식 재료·결과, 이벤트의 기프트·테마팩 참조가 실제 행을 가리키는지 본다. 기프트·테마팩·이벤트·인격·E.G.O의 모든 이미지 URL은 HEAD 200이어야 하고, 기프트·테마팩·인격·E.G.O 이름은 en/ja가 있어야 하며, 인격 소속은 `AFFILIATION_MAP`에 번역이 있어야 한다. 이벤트는 이름 칸을 쓰지 않아 이름 검사에서 제외한다.

`.github/workflows/data-integrity.yml`이 매일 06:00 KST, 수동 실행, 동기화·점검 스크립트를 바꾼 PR에서 이를 실행한다. 문제가 하나라도 있으면 목록을 출력하고 실패한다.

## 이미지 누락 감사

이미지 누락 감사(2026-10-01): `--fix`의 마지막(읽기 검증·자리표시 검사·캐시 갱신 뒤)과 `--icons-only`류 실행의 끝에 `scripts/sync/image-audit.ts`의 `auditImages`가 DB가 참조하는 이미지 키를 모두 Storage 폴더 목록과 대조한다(읽기 전용, 폴더마다 목록 한 번). 키워드 아이콘은 `keywordIconSource`가 정한 파일(별칭·변형 포함, 로컬 자산은 `audit-images.ts`만 `public/`에서 확인), 인격 스킬 아이콘은 `expectedSkillIcons`, 기프트(`ego_gifts.image_url`)·테마팩(`ego_gift_themes.image_url`)·이벤트(`md_events.image_url`)는 `image_url`의 Storage 키다. 테마팩 보스 이미지(`boss_image_url`)는 대상이 아니다. 결과는 `report.missingImages`에 종류별 `{checked, missing, keys}`(키는 앞 20개)로 남고 누락이 있으면 경고를 낸다. 읽기에 실패해도 `{error}`를 남길 뿐 반영을 실패시키거나 되돌리지 않는다. `audit-images.ts`는 같은 검사를 Mac에서 운영 DB에 대해 단독으로 실행한다(`.env.local`의 키가 필요하고 아무것도 쓰지 않으며 `--json`으로 저장, `--strict`는 누락이 있으면 종료 코드 1). 2026-10-01 운영 결과: 키워드 491개 중 7개(위 7개)·스킬 980개 중 1개(1041205)가 없고 기프트 456·테마팩 117·이벤트 157은 전부 있다.

## 되돌리기

되돌리기(2026-09-28): `apply-extraction`은 반영 단계들이 쓸 수 있는 표 14개(`game_text_refs` 포함)(`extraction-restore.ts`의 `RESTORE_TABLES`, 1000행 넘는 표도 끝까지)를 첫 적용 전에 `backup/`에 저장하고, 올린 테마팩·E.G.O 그림을 `report.json`의 `uploads`에 남긴다. `extraction-restore.ts --work <작업 폴더> [--fix]`는 표를 백업 상태로 되돌리고(바뀐 행은 다시 쓰고, 그 반영에서 생긴 행은 삭제), 새로 올린 그림은 지우고 덮어쓴 인격 그림(`identity-images/before`)은 원본으로 돌린 뒤 캐시를 갱신한다. `deck_identities`가 인격 삭제 시 함께 지워지므로, 덱·플랜이 쓰는 신규 인격·E.G.O와 그 스킬·패시브는 남긴다. `--fix`는 먼저 현재 상태를 `restores/<시각>/backup`에 저장해 되돌리기도 되돌릴 수 있다. Windows 도구의 반영 기록에서 미리 보기(dry-run) 후 실행하며, 자동 반영을 끄고 확인 후 반영할 수도 있다. 검증: 현재 DB를 백업으로 뜬 dry-run이 변경 0, 스킬 2행을 바꾸고 인격 1개를 뺀 백업은 스킬 2행 복원과 덱에서 쓰는 인격 유지로 계획됐고, Windows 번들의 `--fix`를 변경 0 백업으로 끝까지 실행했다.
