# 게임 업데이트 대응

림버스 컴퍼니가 업데이트되면 사이트에 올라가는 게임 데이터(인격·E.G.O·키워드·거울 던전·스토리 맵·스킬 모션 영상)를 무엇으로, 어떤 순서로 다시 뽑고 올리는지 적는다. `/game-updated` 스킬이 이 문서를 따라 움직인다.

**언제 읽나**: 게임이 업데이트된 날, 새 인격이 나온 날, 사이트에 새 게임 데이터가 안 보일 때.
관련: [배포와 복구](deployment.md), 추출 도구 [실행](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/runbook.md)·[규칙](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/rules.md), 로컬 작업 저장소 `E:\Limbus Assets`의 `docs/story-map/README.md`, `docs/new-identity/`, `docs/web/`.

## 폴더와 도구

| 이름 | 위치 | 하는 일 |
|---|---|---|
| 추출 도구 | `C:\림도구\추출기` (저장소 `INIRU/limbus-asset-extractor`) | 게임 받기, 이미지·데이터 추출, Spine, 사이트 DB·Storage 반영(`site-sync/`) |
| 작업 저장소 | `E:\Limbus Assets` (push 안 함) | 스토리 맵 내보내기, 새 빌드 보관·코드 차이, 전투 시뮬레이션 기록, 스킬 모션 영상 렌더링·R2 업로드 |
| 모션 클라이언트 | `C:\림도구\버스` → `C:\림도구\SAIGO-NO-SKILL`, `C:\림도구\SAIGO-NO-BUS` | 스킬 모션 확인용 게임 클라이언트. 새 빌드마다 맞춘다 |
| 사이트 | 이 저장소 | 스토리 맵 업로드 스크립트, 캐시 비우기 API, 공지 스킬 |

## 한눈에 보기

| 영역 | 사이트에서 | 자동/수동 | 도구 |
|---|---|---|---|
| 게임 받기 | — | 반자동 | 추출 도구 `Update-LimbusGame.ps1` |
| 새 빌드 보관·코드 차이 | — | 수동 | 작업 저장소 `pipeline/il2cpp/new_build.py` |
| 인격·E.G.O·패시브·키워드·참조 | 수감자/인격/EGO, 키워드 | 자동 | 추출 도구 사이트 반영 |
| 인격·E.G.O 그림, 스킬 아이콘, Spine | 인격 상세, 도감 | 자동 | 추출 도구 |
| 거울 던전 기프트·테마·레시피·이벤트 | 거울 던전 | 자동 | 추출 도구 |
| 스토리 맵(지도·적·던전·이벤트) | DB → 스토리 맵 | 수동 | 작업 저장소 `pipeline/story_map.py` + 이 저장소 `upload-story-map.ts` |
| 모션 클라이언트 | — | 반자동 | `C:\림도구\버스\update.sh` |
| 스킬 모션 영상 | 모션 | 수동, 사용자 확인 필요 | 작업 저장소 `rerender-identity` |
| 공지 | 공지 | 수동 | 이 저장소 `announce` 스킬 |

## 순서

### 1. 업데이트 확인과 새 빌드 보관

- 업데이트 여부: 게임 카탈로그 `C:\Users\iniru\AppData\LocalLow\ProjectMoon\LimbusCompany\com.unity.addressables\catalog_S1.bin`의 수정 시각과 번들 수를 추출 도구의 `state/manual/last-game-update.json`(`catalogBefore`)과 비교한다. Steam 공지는 그림(세로로 긴 PNG)이라 페이지 본문을 `<img>`로 바꿔 읽는다.
- **바로** 새 빌드를 보관한다: 작업 저장소에서 `.venv/Scripts/python pipeline/il2cpp/new_build.py`. Steam이 파일을 다시 덮기 전에 DLL·메타데이터를 `out/_code/game_<mmdd>`로 복사하고 차이(`diff.json`)를 쓴다. 10-22 빌드는 이걸 빠뜨려 잃었다.
- Ghidra 프로젝트(무겁다, 다른 무거운 일과 같이 돌리지 않는다): `analyzeHeadless.bat C:\Users\iniru\tools\gproj_<mmdd> LimbusGA -import "E:\Limbus Assets\out\_code\game_<mmdd>\GameAssembly.dll" -noanalysis` (`ghidra_12.1.4_PUBLIC\support\`).
- 시뮬레이션이 인용하는 함수의 코드 차이를 `out/_logs/build_diff_<mmdd>.md`로 정리한다. 바뀐 게 있으면 6단계(재기록) 대상이다.

### 2. 게임 리소스 받기

- 추출 도구 폴더에서 PowerShell 7(그 PC의 `pwsh.exe`)로 `-File scripts/Update-LimbusGame.ps1 -TimeoutMinutes 9`. 게임을 켜고 로그인·다운로드 확인 창을 누르고, 카탈로그의 번들이 캐시에 다 들어오고 60초 조용하면 끈다(11-05: 약 3분).
- 확인: `state/manual/last-game-update.json`의 `ok: true`, 마지막 줄 "남은 번들 0".
- 게임이 켜져 있는 동안 추출하지 않는다.

### 3. 추출과 사이트 반영 (추출 도구)

- 실행: 추출 도구 폴더에서 `node scripts/gallery-server.cjs --run-once`(그 PC의 `node.exe`). `--update-game`을 붙여 한 번에 돌리면 10분을 넘어 Bash가 끊으므로 2단계와 나눠 돌린다. Spine 단계는 입력이 바뀌면 30분 넘게 걸린다.
- `state/manual/settings.json`의 `autoApply`가 `true`면 추출 뒤 바로 사이트에 반영한다(2026-09-27 소유자가 승인한 무인 경로: ZIP 검증 → 단계별 dry-run → 백업 → 반영 → 확인, 실패하면 자동 되돌리기). 반영만 다시: `--apply-once`.
- 반영 단계(`site-sync/scripts/sync/extraction-steps.ts`): `refs` → `identity --keywords` → `sanity` → `keywords` → `refs-link` → `mirror` → `gift-keywords` → `gift-refs-link` → `events`. 키워드 아이콘은 마지막 키워드 단계(`gift-refs-link`) 뒤에 올린다.
- 반영이 끝나면 사이트 캐시를 비운다(`/api/revalidate`, `scope: all-game-data`).

**결과 확인 (빠뜨리지 않는다)**

| 파일 | 볼 것 |
|---|---|
| `state/manual/status.json` | `phase: "success"`, `failedPhase`·`error`가 비었나 |
| `state/manual/runs/<runId>/run.log` | `ok`만 있나. **`WARN` 줄은 채워야 할 구멍이다**(11-05 `thundercrack.webp` 키워드 아이콘 누락을 경고로만 두고 넘어갔다가 나중에 찾았다) |
| `runs/<runId>/site-sync/run/report.json` | `missingImages`, `keywordsWithoutIcon`, `skillsWithoutIcon`, `giftsWithoutIcon`, `egoWithoutArtwork`, `leftoverPlaceholders`, `autoRestored`가 비었나 |
| `state/manual/last-spine.json` | `ok`, `uploaded`, 팩마다 `mustFix: 0` |

**알려진 함정**

- 기프트에서만 쓰는 새 키워드는 `gift-keywords` 단계에서 생긴다. 그 아이콘은 그 뒤에야 짝지을 수 있다(2026-11-09 고침, 추출 도구 `b91209a`).
- 게임 코드에만 있는 동작 수정(데이터에 안 남는 것)은 반영되지 않는다. 시시포스의 거울 업적, 투사 레벨도 반영 대상이 아니다.
- `gift-constants.cjs`는 대조용이라 새 빌드에서 "unmatched"가 나와도 문장 값으로 반영된다.
- 남은 `state/manual/run.lock`은 PID를 확인한 뒤에만 지운다.

**추출 도구가 틀렸을 때 (유지보수)**

- 소유자 결정(2026-11-09, "추출기 오류난거 있으면 유지보수 하는거지"): `/game-updated`가 돌다 추출 도구의 반영 오류나 누락을 찾으면 추출 도구 저장소에서 고친다. 이 사이트 저장소에는 손대지 않는다.
- 순서: `C:\림도구\추출기\site-sync`에서 고침 → 재발을 막는 테스트 → `npm test`, `npm run typecheck` → `npm run build`(`tools/site-sync` 번들 다시 만듦) → 원본과 번들을 함께 커밋 → push. 번들을 직접 고치지 않는다.
- 이미 빠진 것(그림 등)은 추출 패키지(`exports/packages/<패키지>/LimbusAssets/Images/...`)에서 도구와 같은 방식(예: 키워드 아이콘은 무손실 WebP, `upsert: false`)으로 채우고 보고한다.
- 반영 안전장치(검증, dry-run 실패 시 중단, 백업, 자동 되돌리기)를 약하게 하는 변경은 소유자 확인을 받는다.

### 4. 스토리 맵 (수동)

게임 업데이트가 **끝난 뒤에** 돌린다. 먼저 돌리면 새 장의 적 초상화가 빠진다(2026-11-09: 10장 적 45명).

1. 작업 저장소에서 `.venv/Scripts/python pipeline/story_map.py`, 이어서 `.venv/Scripts/python pipeline/story_map_fx.py`. 결과는 `out/_story_map/`(새 장은 `index.json`에 저절로 들어간다).
2. 사진 없는 적 세기: `sub/*.json`·`dungeon/*.json`에서 `portrait`와 `sd`가 둘 다 비어 있는 적. 게임에 초상화가 없는 적은 내보내기가 전투 SD 모습을 `sd/<id>.webp`로 그린다.
3. 새 장 확인: 지도 조각이 없는 장은 게임이 그림을 뺀 것인지 카탈로그에서 `StageMap_<id>`로 확인한다(콜라보 9120/9121이 그랬다 → `lib/story-map.ts`의 `isCollab`으로 사이트에서 뺐다).
4. 올리기(이 저장소): `npx tsx scripts/data/upload-story-map.ts --prefix story-map -- --dry-run` → 확인 → `--dry-run` 없이. 이미 있는 그림은 그대로 두므로 바뀐 그림은 `--replace <목록 파일>`.
5. **캐시 비우기**: 서버가 장 데이터를 다음 배포까지 캐시한다. `POST https://saigo-no-dante.com/api/revalidate`에 `{"tags":["game-data"]}`, 헤더 `x-revalidation-secret`(`REVALIDATION_SECRET`, 주소에 넣으면 거부). Supabase가 JSON을 10분 캐시하므로 **10분 뒤 한 번 더**.
6. 실제 사이트에서 새 장 하나를 열어 지도, 적 사진, 던전을 본다.

자세한 내보내기 내용: 작업 저장소 `docs/story-map/README.md`, 폰 관련 `docs/story-map/mobile.md`.

### 5. 모션 클라이언트

- `C:\림도구\버스`에서 `bash update.sh`(기본 `SAIGO-NO-SKILL`), 전체 클라이언트는 `CLIENT=/c/림도구/SAIGO-NO-BUS SLIM=0 bash update.sh`. 새 빌드 맞춤 → 설정 → 첫 실행(BepInEx, 몇 분) → 플러그인 빌드 → `tools/client_check.cjs`(스킬 방까지 들어가 스킬이 소리와 함께 재생되면 0).
- 둘은 같은 포트(7766)를 쓰므로 하나씩. 앱 터미널 탭은 ASCII 명령만 받으니 한글 경로는 `.sh`/`.ps1` 파일로 감싼다.
- 함정: "CheckClientVersion" 반복은 다운로드 예/아니오 창이었다. `BepInEx/saigo-no-bus/save.json`에 "mirror" 샘플이 있으면 "no skill room"으로 실패한다.

### 6. 새 인격·재기록·스킬 모션 영상 (사용자 확인 필요)

- 새 인격: 작업 저장소 `docs/new-identity/`(번호 순서). id와 슬러그는 `KR_Personalities.json`에서 찾는다(추측 금지). 조건 이름은 `out/_loc/names.json`에서 손으로(`_table_labels.js --write`를 전체에 돌리면 기존 이름 23개가 바뀐다).
- 기록 → 레이어 → 이펙트 목록 → 점검은 작업 저장소의 `rerender-identity` 스킬 순서대로. **렌더링 전에 바뀐 것과 전/후 샘플을 사용자에게 보이고 승인을 받는다.** 렌더링은 유니티 3개로 나눠 돌고(전체면 약 9시간), 그동안 유니티에 다른 명령을 보내지 않는다.
- 업로드: `node web/layer-proto/make_video.mjs` → `node web/layer-proto/upload_r2.mjs --dry-run` → 실제. 사이트 모션 목록은 R2 `index.json`을 10분 캐시한다(캐시 태그 `motion`).
- 1단계 코드 차이에서 시뮬레이션이 쓰는 함수가 바뀌었으면, 그 함수를 쓰는 인격도 재기록 대상이다.

### 7. 공지 (선택)

- 이 저장소의 `announce` 스킬로 한·영·일 초안을 만든다. 게시와 Discord 전송은 소유자가 한다.

## 끝내기 전에

- 위 표의 영역마다 "했음 / 바뀐 것 없음 / 못 함(이유)"를 한국어로 보고한다. 확인하지 못한 것은 확인 못 했다고 쓴다.
- 새로 알게 된 함정은 이 문서와 작업 저장소 trail 기록에 남긴다.
- 커밋: 작업 저장소는 push 안 함, 추출 도구는 push, 이 저장소는 PR. 이 저장소의 커밋 메시지에는 코드 분석·녹화 도구·사설 서버 관련 말을 쓰지 않는다(`commit-msg` 훅이 막는다).
- 콘솔 프로그램을 백그라운드로 띄우지 않고(사용자 화면을 가린다), 무거운 작업을 여럿 동시에 돌리지 않는다.
