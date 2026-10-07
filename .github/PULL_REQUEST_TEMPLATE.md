## 무엇을

<!-- 사용자가 보게 되는 변화와 그 이유를 적습니다. -->

## 검증

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] 화면이 바뀌면 캡처로 확인 (ko / en / ja, 390px)

## 병합 후

- [ ] DB 스키마나 추출 도구 `site-sync/lib/`로 복사된 `lib/` 파일을 바꿨다면 추출 도구 반영 PR (`limbus-asset-extractor/site-sync/docs/developing.md`)
- [ ] DB 마이그레이션을 운영에 적용했다면 파일 이름을 적용된 버전과 맞춤
- [ ] 병합 뒤 `gh pr view <번호> --json state`가 `MERGED`인지 확인
