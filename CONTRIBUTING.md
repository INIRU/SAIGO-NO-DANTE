# 기여 방법


## 시작하기

설치와 실행, 명령 목록은 [README.md](README.md)의 "빠르게 시작하기"에 있다. 환경 변수는 [이름과 용도](docs/reference/env.md)를 본다.

## 작업 순서

1. **준비**: `git fetch` 후 최신 `origin/main`에서 브랜치를 만든다. `gh pr list --state open`으로 남은 PR을 본다. main에는 직접 커밋하지 않는다.
3. **테스트 먼저**: 동작이 바뀌는 변경은 실패하는 테스트를 먼저 쓰고, 실제로 실패하는 것을 실행해서 확인한 뒤 구현한다. 버그 수정에는 같은 버그가 다시 생기면 잡히는 테스트를 더한다.
4. **구현**: 화면을 고치면 [DESIGN.md](DESIGN.md)를 먼저 읽는다.
5. **검증**: `npm test`, `npm run typecheck`, `npm run build` 중 변경에 맞는 것을 실행한다. 실행하지 않은 검증은 성공했다고 적지 않는다.
6. **커밋**: 기능별로 작은 Conventional Commit(`feat(planner): …`, `docs: …`)을 만든다. 파일을 하나씩 적어 stage하고, `git add .`와 `git add -A`는 쓰지 않는다. 커밋마다 검증 결과와 남은 문제를 짧게 전한다.
7. **PR**: 브랜치를 push하고 PR을 연다. push·배포와 로컬 커밋은 구분해서 말한다.
8. **병합 확인**: PR을 병합했다고 말하기 전에 `gh pr view <번호> --json state`가 `MERGED`인지 확인한다.

## 그 밖의 규칙

