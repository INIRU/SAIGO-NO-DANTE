## 무엇을

<!-- 사용자가 보게 되는 변화와 그 이유를 적습니다. -->

## 검증

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] 화면이 바뀌면 캡처로 확인 (ko / en / ja, 390px)

## 병합 후

- [ ] 동기화 코드(`scripts/sync/**`)나 동기화가 쓰는 DB 스키마를 바꿨다면 추출 도구 번들 PR (`docs/data-sync/developing.md` "추출 도구 번들 함께 갱신")
- [ ] DB 마이그레이션을 운영에 적용했다면 파일 이름을 적용된 버전과 맞춤
- [ ] 병합 뒤 `gh pr view <번호> --json state`가 `MERGED`인지 확인
