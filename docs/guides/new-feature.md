# 새 기능 만들기

새 기능(또는 기능의 큰 덩어리)을 `features/<기능>/`에 만드는 순서다. 폴더 경계는 `tests/architecture/boundaries.test.ts`가 검사하고, 이 문서는 그 규칙을 따라 하기 쉬운 순서로 풀어 쓴 것이다.

## 1. 계획부터

코드를 쓰기 전에 무엇을 왜 만드는지, 만들거나 고칠 파일, 확인할 방법을 정한다. 기능 폴더 이름은 다른 기능과 겹치지 않는 짧은 영어 이름으로 짓는다.

## 2. 폴더 만들기

```text
features/<기능>/
  index.ts          입구: 타입, 순수 함수, 상수만
  types.ts          (필요하면) 타입
  components/       PascalCase.tsx와 같은 이름의 .module.css
  hooks/            useX.ts
  lib/              kebab-case.ts, 계산과 변환
  server/           서버 전용 코드
    index.ts        서버 입구
```

필요한 폴더만 만든다. 비어 있는 폴더나 껍데기 파일은 만들지 않는다. 페이지(`app/[lang]/…/page.tsx`)는 조회와 화면 조합만 하고, 계산은 `lib/`, 화면 조각은 `components/`, 브라우저 상태는 `hooks/`로 나눈다. 한 라우트에서만 쓰는 작은 조각은 `app/…/_components/`에 두고 기능 폴더에 넣지 않는다.

## 3. 입구를 정한다

밖에서는 세 가지 길로만 가져온다.

| 가져오는 곳 | 파일 | 담는 것 |
|---|---|---|
| `@/features/<기능>` | `index.ts` | 타입, 순수 함수, 상수. 브라우저와 서버 어디서나 안전한 것만 |
| `@/features/<기능>/server` | `server/index.ts` | `server-only`, DB 조회 등 서버 전용 코드 |
| `@/features/<기능>/components/<이름>`, `…/hooks/<이름>` | 파일 하나 | 컴포넌트와 훅은 파일 경로로 하나씩 가져온다 |

- `index.ts`는 컴포넌트와 훅을 다시 내보내지 않는다. 하나만 가져와도 그 기능의 모든 모듈과 CSS가 첫 JS·CSS에 딸려 오기 때문이다.
- `index.ts`는 `server/`나 `server-only` 모듈을 가져오지 않고, `'use client'`도 넣지 않는다.
- `'use client'`와 `'use cache'` 지시문은 파일의 첫 줄에 둔다.
- 하위 폴더(`components/x/Y`), `lib/`, `server/` 안쪽 파일, `.module.css`는 밖에서 직접 가져오지 않는다. 기능 안에서 자기 내부를 가져오는 것은 괜찮다.
- `features/` 안의 파일은 `app/`을 가져오지 않는다. 라우트와 CSS를 같이 쓰고 싶으면 기능 쪽에 CSS를 둔다.

## 4. 공용 코드는 기능을 가져오지 않는다

`components/` 아래 모든 폴더(`ui`, `layout`, `providers`, `cards` …), `lib`, `hooks`는 `features/`를 가져오지 않는다. 여러 기능이 함께 쓰는 코드는 이 공용 폴더에 두고, 기능이 공용 코드를 가져온다.

여러 기능이 같이 쓰는 카드(인격·E.G.O·덱·플랜 카드, 편성 썸네일, 보유 표시 등)는 `components/cards/`에 둔다. 카드가 어떤 기능의 컴포넌트를 그려야 하면(예: 덱 카드 설명 한 줄의 노트 문법) 그 컴포넌트를 props로 받는다. 덱·플랜 카드의 `NotePreview`(`components/cards/note-preview.ts`)가 그 예다. 카드가 쓰는 타입·순수 함수는 `lib/`로, 브라우저 상태는 `hooks/`로 꺼낸다.

### 기능끼리는 한 방향으로만

기능 A가 기능 B를 가져오면 B는 A를 (다른 기능을 거쳐서도) 가져오지 않는다. 지금 방향은 아래에서 위로 `account·admin·assist·catalog·news·story` → `mirror-dungeon·motion` → `notes` → `decks·friends` → `community·planner` → `tools` → `meta`다. 아래 기능이 위 기능의 코드가 필요해지면 그 코드를 `components/`·`lib/`·`hooks/`로 꺼내거나, 쓰는 쪽을 위 기능으로 옮긴다. 파일끼리도 서로를 불러오는 순환(A→B→A)은 만들지 않는다. 공통 타입·상수를 새 파일로 빼서 끊는다.

그래서 일부 공용 모듈은 일부러 `lib/decks`와 `lib/planner`에 남아 있다. 덱 코드 변환, 플래너 타입·제약 같은 코드를 다른 기능(카탈로그, 메타, 도구, 커뮤니티 등)과 공용 `lib/`가 함께 쓰기 때문이다. 이런 코드를 `features/decks`나 `features/planner`로 옮기면 공용 코드가 기능을 가져오게 되어 경계 검사에 걸린다. 여러 기능이 쓰게 된 코드는 기능 폴더 밖으로 꺼내고, 한 기능만 쓰는 코드는 기능 안에 둔다.

## 5. 테스트는 `tests/` 아래에

단위 테스트는 소스 옆이 아니라 `tests/<소스 경로>/<이름>.test.ts`에만 둔다. 예를 들어 `features/friends/lib/codes.ts`의 테스트는 `tests/features/friends/lib/` 아래에 둔다. 테스트는 기능 내부를 직접 가져와도 된다. E2E는 `e2e/<이름>.spec.ts`다. 순서는 [기여 방법](../../CONTRIBUTING.md)대로 실패하는 테스트를 먼저 쓰고, 실패하는 것을 확인한 뒤 구현한다.

## 6. 경계 검사로 확인한다

```bash
npx vitest run tests/architecture
```

이 테스트가 저장소의 `app`, `components`, `lib`, `hooks`, `features`와 루트의 `proxy.ts`, `instrumentation*.ts`를 읽어 위 규칙을 지킨다. 어긴 줄이 있으면 파일과 규칙 이름(`feature-internal`, `shared-imports-feature`, `entry-exports-server`, `entry-exports-ui`, `feature-imports-app`)을 알려 준다. `feature-direction.test.ts`는 기능끼리 서로를 가져오는 묶음을, `file-cycles.test.ts`는 서로를 불러오는 파일 묶음을 알려 준다. 마지막으로 `npm test`, `npm run typecheck`, `npm run build`를 돌린다. 화면이 있으면 [디자인 기준](../../DESIGN.md)을 먼저 읽고, 첫 JS·CSS 크기가 라우트마다 2KB 넘게 늘지 않았는지 `npm run build` 결과로 비교한다.

## 7. 문서와 기록

환경 변수를 더했다면 [환경 변수](../reference/env.md)에 적는다.
