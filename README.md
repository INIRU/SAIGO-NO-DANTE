# 최애의 관리자 · SAIGO NO DANTE

Limbus Company 팬 데이터베이스와 덱·거울 던전 플래너. Next.js 16, React 19, TypeScript, Supabase 기반이며 한국어·영어·일본어를 지원한다.

수감자/인격/EGO 도감, 거울 던전 기프트·조합, 덱과 플래너 공유, 보유 현황, 랜덤 편성, 키워드·메타 분석, 공지를 제공한다.
스프라이트 조작, AI 요약, 티어표, 뽑기 시뮬레이터, 스토리 뷰어와 공식 캘린더는 제거했다.

```bash
npm ci
# docs/deployment.md를 참고해 .env.local 설정
npm run dev
```

```bash
npm run typecheck
npm test
npm run build
```


원본 게임 자료와 운영 DB 백업은 앱 코드와 별도로 보존한다. 로컬 실행·빌드 성공과 운영 서비스의 재개는 구분한다.
