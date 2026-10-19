# 개발 문서


## 새 작업 시작하기


| 하려는 일 | 먼저 읽을 문서 |
|---|---|
| 화면이나 컴포넌트를 고친다 | [디자인 기준](../DESIGN.md), [구조](architecture.md), [개발과 검증](development.md) |
| 새 추출본을 반영한다, 반영을 되돌린다 | [추출본 반영](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/runbook.md) |
| 동기화 코드를 고친다(코드는 추출 도구 저장소 `site-sync/`에 있다) | [동기화 코드를 고칠 때](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/developing.md), [동기화 규칙](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/rules.md) |
| 게임 원본의 값을 새로 보여 준다(칸 추가) | [필드 하나 추가하기](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/adding-a-field.md), [데이터 모델](data-model.md) |
| 이미지·아이콘의 원본 위치, 과거 백업과 반영 기록을 찾는다 | [출처와 복구 기록](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/provenance.md) |
| 어시스트의 화면 인식을 고치거나 평가한다 | [어시스트 화면 인식](assist.md) |
| 표나 칸을 바꾼다, 권한을 확인한다 | [데이터 모델](data-model.md) |
| 개발자 API에 자원을 더한다, 파트너 봇 연동을 본다 | [개발자 API와 협업 파트너](partner-api.md) |
| 배포, 서버 접속, 환경 변수, 롤백 | [배포와 복구](deployment.md) |


## 문서 목록

- [구조](architecture.md): 화면, 도메인 로직, 서버 경계.
- [개발과 검증](development.md): 실행, 테스트, 캐시, 알려진 UI 주의점.
- [데이터 모델](data-model.md): 현재 표와 칸, 권한, 스키마 변경 기록.
- [개발자 API와 협업 파트너](partner-api.md): `/api/v1` 자원, 한도, 파트너 권한, 소식 보내기 양식, Discord 봇 연동.
- 데이터 동기화: [실행](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/runbook.md), [코드 수정](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/developing.md), [규칙](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/rules.md), [필드 추가](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/adding-a-field.md), [출처와 기록](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/provenance.md).
- [어시스트 화면 인식](assist.md): 인식 방법, 설정, 평가 도구와 측정 기록.
- [배포와 복구](deployment.md): 서버·터널 구성, 자동 배포, 되돌리기, 집 IP가 바뀔 때 SSH 열기, Cloudflare 설정, 환경 변수, 요금 알림.
- [디자인 기준](../DESIGN.md): 색, 글꼴, 게임 에셋, 공용 컴포넌트, 레이아웃·움직임·스켈레톤 규칙.

## 지원 화면

지원 화면은 수감자/인격/EGO, 거울 던전, 덱, 플래너, 보유 현황, 랜덤 편성, 키워드/메타, 경험치·월간 광기 계산기, 개발자 API 키 관리, 공개 프로필과 활동 점수, 공지와 문의 화면이다. 관리자 화면은 공지·문의·유저 관리를 제공한다.
인격 스프라이트 조작, AI 요약, 티어표, 추출 시뮬레이터, 스토리 뷰어와 공식 캘린더, 디스코드 봇 소개 페이지는 제거했다. 과거 DB 기록과 SQL 마이그레이션은 보존하며, 제거 기능의 테이블은 비공개 보관 스키마로 이동했다.
