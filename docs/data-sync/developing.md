# 동기화 코드를 고칠 때

동기화는 추출 도구의 번들(`tools/site-sync`)이 실행하지만 코드는 이 저장소의 `scripts/sync/`에 있다. 수정은 여기서 하고, 사이트 PR이 병합된 뒤 번들을 다시 만들어 추출 도구에 넣어야 끝난다. 하지 않으면 Windows 추출 도구는 이전 코드로 DB에 반영한다.

## 순서

2. **실패하는 테스트:** 판정 규칙은 DB를 모르는 순수 함수로 두고(`scripts/sync/*-rules.ts`, `ego-stages.ts`, `source-paths.ts` 등) 테스트한다. 테스트는 `scripts/sync/*.test.ts`와 `tests/sync/`에 있다.
3. **구현.**
4. **Mac dry-run:** 최신 추출본 ZIP으로 `apply-extraction`을 `--fix` 없이 돌린다([runbook.md](runbook.md) "명령"). 운영 DB를 읽기만 한다. 동작을 바꾸지 않는 수정(파일 분리, 이름 변경, 공유 모듈)은 `--expect-clean`으로 돌려 종료 코드 0이어야 하고, 동작을 바꾸는 수정은 `report.json`의 `pendingChanges`에 의도한 차이만 나와야 한다.
5. **사이트 PR → CI → 병합 확인**(`gh pr view <번호> --json state`가 `MERGED`).
6. **번들 갱신 PR**(아래).
7. **운영 반영:** 다음 추출 때 도구가 자동으로 하거나, 사용자 승인을 받고 Mac에서 `--fix`로 한다. 끝나면 같은 입력의 dry-run이 차이 0인지 본다.

새 칸을 추가하는 경우는 [adding-a-field.md](adding-a-field.md)에 처음부터 끝까지 적었다.

## 코드 지도

| 파일 | 하는 일 |
|---|---|
| `apply-extraction.ts`, `extraction-steps.ts` | 전체 순서: ZIP 검사 → 백업 → 단계별 dry-run과 적용 → 이미지 업로드 → 읽기 검증 → 캐시 갱신 → 이미지 감사 |
| `prepare-extracted-assets.ts`, `source-paths.ts` | ZIP 검사와 `complete-data` 준비, 원본 파일 찾기 |
| `game-text-refs.ts`, `game-text-refs-rules.ts` | `[Id]` 참조 표(`game_text_refs`)와 키워드 대표 참조 |
| `identity-data.ts`, `identity-metadata.ts` | 인격, 스킬, 패시브, 획득처, 키워드 메타 |
| `bootstrap-data.ts`, `ego-stages.ts`, `ego-passives.ts`, `ego-keywords.ts`, `ego-drift.ts`, `ego-artwork.ts` | E.G.O 행, 단계별 스킬·패시브, 원화 |
| `mirror-dungeon-data.ts`, `mirror-dungeon-rules.ts` | 기프트, 테마팩, 레시피 |
| `rebuild-mirror-events.ts`, `mirror-event-graph.ts`, `mirror-event-source.ts` | 거울 던전 이벤트 그래프 |
| `placeholder-rules.ts` | 자리표시 토큰 규칙 |
| `keyword-icons.ts`, `skill-icons.ts`, `theme-images.ts` | 없는 이미지 올리기 |
| `image-audit.ts`, `audit-images.ts` | DB가 참조하는 이미지가 Storage에 있는지 |
| `extraction-restore.ts` | 되돌리기(표 14개 `RESTORE_TABLES`와 올린 이미지) |
| `sync-result.ts` | 단계 결과(`SYNC_SUMMARY`) 출력과 해석, 적용 뒤 남은 차이 판정 |
| `build-site-sync.mjs` | 추출 도구용 번들 빌드 |

`restore-*.ts`, `restore-sanity.cjs`, `backfill-ego-artwork-url.ts`는 끝난 일회성 복구 도구다(배경은 [provenance.md](provenance.md)). 일상 동기화에서는 쓰지 않는다.

## 추출 도구 번들 함께 갱신

추출과 사이트 작업은 이 저장소의 세션 하나에서 한다. 아래에 해당하는 변경은 사이트 PR이 병합된 뒤 같은 세션이 추출 도구(`INIRU/limbus-asset-extractor`)의 `tools/site-sync`도 갱신해야 끝난다. 하지 않으면 Windows 추출 도구는 이전 동기화 코드로 DB에 반영한다.

언제:
- 번들에 들어가는 코드가 바뀔 때: `scripts/sync/**`(테스트 제외), `scripts/assets/sync-extracted-identities.cjs`, `scripts/assets/event-image-source.ts`, `scripts/assets/build-theme-packs.py`, `public/fonts/SCDream5.woff2`, 그리고 번들이 가져오는 `lib/` 파일(현재 `lib/constants/game.ts`, `lib/game-text/placeholders.ts`, `lib/keywords/category.ts`, `lib/keywords/description-overrides.ts`, 키워드 아이콘 해석용 `lib/constants/keywords.ts`와 그것이 가져오는 `sin.ts`·`game-ui.ts`·`keyword-icon-aliases.json`·`keyword-icon-variants.json`·`lib/generated/game-ui-versions.json`, 스킬 아이콘 키 해석용 `lib/utils/images.ts`와 `lib/utils/game-ui.ts`). 정확한 목록은 빌드 결과의 `// <경로>` 주석으로 확인한다.
- DB 스키마가 바뀌어 동기화가 쓰는 표·컬럼이 달라질 때. 추출 도구의 `scripts/site-db-diff.cjs`(비교할 표 목록 `TABLES`)와 `tests/site-db-diff.test.cjs`도 같이 본다.
- 동기화가 새 원본 파일을 읽을 때. 추출 도구는 게임 데이터 전체를 ZIP의 `complete-data`에 넣으므로 보통 추출 쪽 수정은 없지만, 9/24 이후 추출본에 그 파일이 있는지 확인한다.

어떻게(매니저가 하고, 병합은 사용자 승인):
1. 추출 도구 저장소를 `git pull`해 최신으로 맞춘다. 다른 세션이 먼저 갱신했을 수 있다.
2. 사이트 main에서 번들을 만든다. 워크트리에서는 합성 원본 경로를 지정한다.
   ```bash
   LIMBUS_COMPOSITION_ASSET_DIR=/Users/iniru/Documents/Project/Limbus/assets/recovery-2026-09-10/theme-composition \
     node scripts/sync/build-site-sync.mjs ../limbus-asset-extractor/tools/site-sync --win
   ```
3. 바뀐 단계를 번들로 dry-run한다(예: `node --env-file=<사이트 .env.local> mirror-dungeon-data.mjs --gifts-only`, `LIMBUS_DATA_DIR`에 최신 추출본 `complete-data`). 사이트 코드로 돌린 dry-run과 결과가 같아야 한다.
4. 스키마가 바뀌었으면 추출 도구의 Mac에서 도는 테스트를 돌린다: `node --test tests/data-diff.test.cjs tests/data-file-diff.test.cjs tests/game-data.test.cjs tests/manual-gallery.test.cjs tests/site-db-diff.test.cjs`. `gallery`·`package` 테스트는 Windows 산출물이 있어야 해서 Mac에서는 실패한다.
5. 추출 도구 저장소에서 `chore/site-sync-<사이트 main 짧은 해시>` 브랜치에 번들 파일(`apply-extraction.mjs`, `bootstrap-data.mjs`, `extraction-restore.mjs`, `identity-data.mjs`, `mirror-dungeon-data.mjs`, `rebuild-mirror-events.mjs`, `sync-extracted-identities.cjs`, `game-text-refs.mjs`, 바뀌었으면 `build-theme-packs.py`)를 명시해 커밋하고 PR을 연다. 본문에 사이트 커밋과 dry-run 결과를 적는다.
6. 병합 뒤 사용자에게 Windows PC 갱신(README의 방법)을 알린다.

같은 코드로 다시 빌드한 번들은 빌드한 폴더 경로 주석(`// ../../.../node_modules/...`)만 다르다. 그 줄을 빼고 비교하면 같아야 한다.

`--win` 번들은 Windows용 sharp를 담아 Mac에서 실행되지 않는다. Mac에서 번들 자체를 시험하려면 `--win` 없이 임시 폴더에 한 번 더 빌드한다.
