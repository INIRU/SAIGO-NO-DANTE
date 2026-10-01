# 필드 하나 추가하기

게임 원본에 있는 값을 사이트에 새로 보여 주려면 DB, 동기화, 사이트, 추출 도구 번들이 함께 바뀐다. 아래 순서대로 하면 빠지는 곳이 없다. 예시는 2026-10-01에 추가한 `passives.sin_requirements`(패시브 발동 조건의 죄악 전부)다.

## 1. 원본 확인

- 최신 추출본에서 값이 어느 파일의 어느 키에 있는지, 몇 건인지 센다. 예: `passive*.txt`의 조건 목록, 죄악이 둘 이상인 패시브 51개.
- 파일이 장(章)·시즌별로 나뉘어 있는지 본다. `passive.txt`만 읽으면 `passive-a1c8p2.txt` 같은 파일의 값을 놓친다. 파일 이름에 고정 번호(`md7`, `t1~t6`)를 쓰지 않는다.
- 글자 값이면 KR/EN/JP 파일이 모두 있는지, 원문 태그와 `{0}` 자리가 있는지 본다([rules.md](rules.md) "게임 원문 저장과 참조 표", "자리표시 토큰").

## 2. 계획


## 3. 마이그레이션

- `supabase/migrations/<UTC 시각>_<이름>.sql`. 칸 추가는 nullable 또는 상수 기본값으로 한다(기존 행을 다시 쓰지 않음). 예: `20261001070034_passive_requirements_keyword_flavor.sql`.
- 새 표라면 RLS를 켜고 공개 읽기 정책이 필요한지 정한다([데이터 모델](../data-model.md)).
- 운영 DB 적용은 사용자 승인 범위에서 한다. 적용한 뒤 파일 이름의 시각을 적용된 버전과 맞춘다.
- 동기화는 칸이 없는 DB에서 쓰기 전에 멈추거나 그 값만 건너뛰어야 한다. 마이그레이션보다 번들이 먼저 나가도 데이터를 망치지 않게 한다.

## 4. 동기화

- 원본에서 값을 뽑는 부분을 순수 함수로 만들고 테스트를 먼저 쓴다(예: `passiveCondition`, `tests/sync/`).
- 해당 단계가 행에 값을 넣게 한다(인격·패시브는 `identity-data.ts`, E.G.O는 `bootstrap-data.ts`·`ego-stages.ts`, 기프트·테마팩은 `mirror-dungeon-data.ts`).
- dry-run 출력과 `SYNC_SUMMARY`에 이 칸의 차이가 보여야 한다. 차이를 세지 않는 칸은 적용 뒤 읽기 검증도 통과시켜 버린다.
- 되돌리기: 칸이 `RESTORE_TABLES`(`extraction-restore.ts`)의 표에 있으면 함께 돌아간다. 새 표를 동기화가 쓰면 `RESTORE_TABLES`에 추가하고, 추출 도구의 `scripts/site-db-diff.cjs` `TABLES`와 `tests/site-db-diff.test.cjs`도 고친다.

## 5. 사이트

- 타입(`lib/types`)과, 칸을 이름으로 고르는 조회(`lib/db/queries.ts`, `app/api/**`의 `select(...)`)에 추가한다. `select('*')`가 아닌 곳은 빠뜨리면 값이 오지 않는다.
- 계산은 `lib/`, 화면은 `components/`에 둔다. 화면 문구는 `messages/{ko,en,ja}.json` 세 곳에 넣는다.
- 캐시: 게임 데이터 조회는 `cacheTag`를 쓴다. 새 조회를 만들면 `lib/constants/cache-tags.ts`의 기존 태그를 붙여 동기화 뒤 갱신(`all-game-data`)에 포함되게 한다.

## 6. 검증

- `npm test`, `npm run typecheck`, `npm run build`.
- Mac dry-run([runbook.md](runbook.md) "명령"): 계획에 나온 행 수가 1번에서 센 수와 맞는지 본다.
- 화면은 ko/en/ja와 390px에서 캡처로 확인한다.

## 7. 반영

1. 사이트 PR → CI → 병합 확인.
2. 승인을 받고 `--fix`로 채운다. 덮어쓰는 값이 있으면 이전 값을 저장소 밖 `Limbus/backups/`에 남긴다.
3. 같은 입력으로 dry-run을 다시 돌려 차이 0을 확인하고, 운영 화면을 하드 리프레시로 본다.
4. 추출 도구 번들 PR([developing.md](developing.md) "추출 도구 번들 함께 갱신").

## 8. 문서

- [데이터 모델](../data-model.md)의 표 목록과 해당 절.
- 규칙이 생겼으면 [rules.md](rules.md), 반영 기록은 [provenance.md](provenance.md)의 날짜 절.
