# 게임 데이터와 이미지 복구

초기 복구는 사용자가 지정한 [게임 추출 Drive](https://drive.google.com/drive/folders/1Nk9WWMxEcovs5Ewku5ICT1PbfByNcV_z)를 사용했다. 이후 업데이트 입력은 사용자의 게임 추출본이다. [Dante’s Planner](https://dante-planner.com)는 화면과 레이어의 시각적 참고다. 인격 테두리 12개도 초기 Drive에서 찾아 사용했다. 참고 사이트의 이미지나 JSON을 새로 가져오지 않는다.

2026-09-12부터 추가 로케일 입력은 사용자의 [최애의 관리자/assets/26.09.12](https://drive.google.com/drive/folders/1f81Nt5q-w_fm7Utf1SXbGsZvHRZ0mKnC)에 있는 `Localize.zip`을 사용한다. 기존 복구 입력은 보존한다.

## 어시스트 이미지 인식

`scripts/vision/build_embedding_index.py`는 기존 기프트·이벤트 아트를 ImageNet 사전학습 MobileNetV3-small의 동일한 인코더로 576차원 벡터화한다. `--input`, `--output-index`, `--output-model`을 지정하며, 로컬 아트를 재사용하려면 `--gift-dir`와 `--event-dir`를 전달한다. 출력은 `public/models/assist-scene/visual-encoder.onnx`와 `embedding-index.json`이다. 기프트 투명 영역은 어두운 배경에 합성하고 이벤트는 화면과 대응하는 그림 영역을 사용한다. Worker 수정 후 `npm run build:assist-worker`로 배포 번들을 갱신한다.

화면은 로컬 Worker에서만 처리한다. 현재 장면 분류와 정해진 화면 영역의 이미지 임베딩을 함께 사용하고, 코사인 유사도 및 차순위와의 차이가 부족하면 후보를 내지 않는다. 후보는 3초 후 만료되며 획득·선택 기록은 사용자가 직접 처리한다. 같은 그림을 공유하는 이벤트는 복수 후보로 반환하고, 텍스트만 있는 선택지는 그림으로 식별하지 않는다. 벡터 검색은 브라우저의 로컬 인덱스에서 수행한다.

현재 검증 범위는 본인 영상의 16:9 화면이다. 같은 영상에서 조정한 185개 검수 프레임의 실제 Chrome Worker 결과는 이벤트 15/18 프레임, 보상 기프트 6/20 프레임의 10개 후보, 상점 구매창 2/22 프레임의 2개 후보였다. 수락한 그림은 원본과 일치했으며, 비이벤트 167개에서는 이벤트 후보가 없었고 보상·상점 이외 143개에서는 기프트 후보가 없었다. 독립 영상의 일반 정확도가 아니며 상점 목록의 작은 아이콘·다른 배치·검은 여백이 있는 캡처는 아직 보장하지 않는다. `scripts/vision/evaluate_visual_worker.mjs`로 실제 Worker를 다시 평가하며 프레임과 상세 평가 자료는 로컬에 보관한다.

### 화면 전체 OCR 보조 인식

이미지 인식과 별도로 Tesseract.js Worker가 3초 간격으로 화면 전체의 글자를 읽는다. 실행 중에는 프레임을 추가로 쌓지 않으며, 언어별 모델·WASM·Worker는 `/models/assist-ocr/`에서 같은 출처로 제공한다. `npm run build:assist-ocr`로 번들과 언어 파일을 준비하며 일반 빌드에도 포함된다. 화면·OCR 원문을 서버로 보내거나 기록하지 않는다.

읽은 글자는 기프트 이름, 이벤트 지문과 선택지 문구의 후보를 찾는 데만 사용한다. 짧은 일반 문구와 다른 이벤트가 공유하는 선택지는 보수적으로 제외한다. OCR 후보는 6초 후 만료되며 이미지 후보와 합치되 두 점수를 직접 비교하지 않는다. 획득과 선택 기록은 자동으로 변경하지 않는다. OCR 초기화에 실패해도 기존 이미지 인식은 계속된다.

### 인식 모드, 감지 설정, 합성·판매 (2026-09-24)

- **인식 모드:** `lib/vision/recognition-profile.ts`의 최고 성능·성능·밸런스·품질 네 단계다. 판정 규칙은 같고 읽는 양만 다르다. 이전 품질 설정이 기본값인 밸런스가 되었다. 품질은 밸런스와 같은 단일 패스를 더 자주 읽는다(장면 0.5초, 화면 1초/0.4초, 팝업 5장). 예전 품질의 2x2 겹침 타일(1.5배 확대, SAHI 방식 `tileGrid`/`mergeTileRects`)은 정지 화면은 조금 더 잘 읽었지만 한 번 읽는 데 2.4배 오래 걸려(약 800ms) 1초 안팎의 확인 창을 놓쳤다. 2026-09-24 재생 비교(새 품질/밸런스): 9/23 연속 합성 재료 17/17·17/17(예전 품질 14/17), 9/21 5칸 연속 9/11·9/11, 5/5 체인 7/7·6/7, 9/24 연속(PiP 가림) 27/30·27/30(예전 품질 26/30), 판매 5/5, 잘못된 변경 0.
- **감지 설정:** `lib/vision/detection-settings.ts`의 기프트, 테마팩·층, 선택지 이벤트 세 가지이며 기본값은 모두 켜짐이다. 끈 항목은 해당 OCR·아이콘 읽기 자체를 하지 않는다.
- **합성:** 판단 기준은 처리 시각이 아니라 프레임 캡처 시각이다. 연속 합성은 각각 따로 증거를 내고, 별의 가호로 약 0.3초 뒤 별도 팝업으로 돌아온 재료는 다시 획득한다.
- **판매:** `lib/vision/sell-evidence.ts`가 처리한다. 확인 창 문구에서 기프트와 가격을 읽고, 창을 띄우기 전과 닫은 뒤의 우측 상단 코스트("현재 ▸ 판매 후")를 비교해 판매와 취소를 구분한다.
- **스킬 교체:** 상점의 스킬 교체 창도 장면 분류기에서는 `shop`으로 잡힌다. `lib/vision/skill-exchange.ts`는 전체 화면 OCR에서 "[수감자] 스킬 교체" 제목과 "SKILL1x3" 보유 현황 세 줄을 읽는다. 플랜 모드에서는 PiP의 이번 층 기프트 위에 플랜 배분까지 필요한 교체(S1→S3 우선, S1→S2, S2→S3)를 표시한다. 창이 보이는 동안에는 판매 창과 같은 빠른 주기로 읽는다. 한국어 제목은 2026-09-21 영상 프레임 4장으로 확인했다. 영어와 일본어 제목 문구는 확인하지 못해서, 보유 현황 줄이 함께 읽힐 때만 인정한다.
- **런 시작 장면 라벨:** 장면 모델은 시작 기프트 화면을 `reward_choice`, 관측 화면을 `start_gift`, 확인 창 전반을 `sell`로 분류한다. 그래서 1층 시작 구간은 테마 선택 이후 장면(또는 0.8 이상의 `theme_select` 한 프레임)이 보일 때 끝난다.
- **인식 개선 샘플:** 사용자가 설정에서 참여를 켠 경우만 보낸다(`lib/vision/assist-samples.ts`). 어시스트가 읽는 동작마다(합성 한 번 `fusion`, 기프트 획득 창 `popup:<에피소드>`, 판매 `sale`) 프레임 그룹을 브라우저에 둔다. 300ms마다 한 장을 보고 화면이 바뀐 장면만 JPEG(1280px)로 담으며, 동작 직전 3장이 앞에 붙고 그룹당 최근 45장까지 남긴다. 제대로 읽으면 그룹을 버리고, 실패하면 뒤 3장을 붙여 올린다. 20초 동안 다시 보지 못한 그룹은 버린다. 올릴 때는 `/api/assist/samples`가 장마다 서명된 업로드를 내주고 브라우저가 비공개 버킷에 직접 올린다(버킷은 JPEG 400KB까지만 받음). 참여 동의 키는 v2로 바뀌어 이전 참여자에게 다시 묻는다.
- **획득 팝업 자리와 사전 해독 (2026-09-26):** 색 이름판은 1920×1080 게임 화면 기준 획득 팝업 자리(`POPUP_PLATE` 중심에서 110px 안, 폭 170~330px, 가로세로 1.8~2.45)에 있을 때만 읽는다(`acquisitionPlate`). 획득 팝업 샘플은 "기프트를 획득했습니다" 헤더를 읽었을 때만 올린다. GPU OCR은 이름판 줄을 기프트 이름 전체와 CTC 확률로 비교해(`ctcLexiconBest`, CRNN의 lexicon 해독) 1위가 2위보다 9 nat 이상 앞서고 greedy 경로보다 12 nat 이하로 모자라면 그 이름을 이름 읽기 하나로 더한다. 아이콘이나 다른 이름과 어긋나면 전처럼 판정을 보류한다.
- **영어·일본어 클라이언트 (2026-09-28):** 어시스트 설정의 게임 언어(한국어·English·日本語)가 OCR 인식 모델과 화면 문구를 고른다. 한국어는 `korean_PP-OCRv5_mobile_rec`, 영어는 `en_PP-OCRv5_mobile_rec`(7.8MB), 일본어는 `PP-OCRv6_small_rec`(21MB)를 쓰고 검출 모델은 공유한다(출처는 `public/models/assist-ocr/paddle/PROVENANCE.md`). PP-OCRv6 사전에는 한글이 없어서 한국어는 v5를 유지한다. 층·테마팩 선택, 획득 팝업 헤더, 합성 제목·질문·재료 칸 기준, 판매 확인 창, 스킬 교체 제목의 문구는 게임 현지화 파일(`../assets/data/{kr,en,jp}`)에서 가져왔고, 합성 창 기준 폭(`QUESTION_WIDTHS`, `TITLE_WIDTHS`)은 언어마다 다르다. 다른 언어의 이벤트·선택지 원문은 `/api/assist/texts/[lang]`에서 필요할 때 받는다. 모델과 문구는 유튜브 플레이 영상(영어 2편, 일본어 2편)의 0.5fps 프레임 OCR로 확인했고, 정답 라벨로 한 전체 재생 비교는 아직 없다.
- **층·테마팩 확정 (2026-09-28):** 새 층 지도는 1~2초만 보였다가 몇 분 뒤에 다시 나오는 일이 많아서, 같은 층·테마팩을 두 번 읽어야 확정하던 규칙에서는 층 기록이 그만큼 늦었다(9/24 한국어 녹화 3→4층 80초, 1→2층은 4분 뒤 다음 지도까지). 이제 배너 아래 줄이 테마팩 이름과 글자 그대로 같고 한 글자 차이 안에 다른 팩 이름이 없으면(`explorationThemeReads`의 `certain`), 층 숫자가 현재 층·다음 층이거나 앞선 판독과 같을 때 한 번에 확정한다. 한 글자 틀린 판독이나 `Line 2`처럼 숫자 하나 차이 팩은 전처럼 두 번 확인한다. 영어 배너는 검출기가 "Exploring"과 "Floor 3"을 따로 잡는 일이 많아 같은 높이의 박스를 한 줄로 합친 뒤(`joinRowLines`) 층을 읽고, 층 숫자 앞 문장부호("Exploring, Floor 3")도 무시한다. 일본어 팩 이름은 탁점·반탁점과 장음 부호를 빼고 대조한다("カジノブア" → カジノプアー). 재생 결과 층 기록은 배너가 처음 보인 뒤 1초 안이다: 한국어 1→2·2→3·3→4층, 영어 스피드런 1·2·3층(이전에는 1·3층 기록 안 됨).
- **인식 보고 (2026-09-26):** 같은 참여 동의로, 캡처 한 번마다 무작위 세션 ID를 만들고 획득 팝업·합성·판매를 읽었는지(`read`) 보류했는지(`held`) 센다(`lib/vision/assist-report.ts`). 실행 중 컴패니언의 자동 기록 밖에서 인벤토리가 바뀌면 직접 고친 기록(`add`/`remove`, 자동으로 넣은 기프트를 지우면 `auto: true`)으로 남긴다. 보고에는 그때의 캡처 크기(`width`, `height`)가 함께 실린다. 캡처 종료·페이지 이탈·15분마다 `/api/assist/reports`가 `limbus.assist_reports`에 넣고 180일 뒤 지운다. 샘플 메타데이터의 `session`이 같은 세션을 가리키므로 고친 기록을 샘플 라벨로 쓴다. 조회:

  ```sql
  -- 동작별 인식률(최근 7일)
  select a.key as action, sum((a.value->>'read')::int) as read, sum((a.value->>'held')::int) as held
  from limbus.assist_reports r, jsonb_each(r.counts) a
  where r.created_at > now() - interval '7 days' group by 1;
  -- 캡처 형태별 인식률: 정확히 16:9면 전체 화면, 그 밖은 창 모드로 본다(크기는 2026-09-27 이후 보고에만 있다)
  select case when r.meta->>'width' is null then '모름' when (r.meta->>'width')::int * 9 = (r.meta->>'height')::int * 16 then '16:9' else '창 모드·기타' end as capture,
    a.key as action, sum((a.value->>'read')::int) as read, sum((a.value->>'held')::int) as held
  from limbus.assist_reports r, jsonb_each(r.counts) a group by 1, 2 order by 1, 2;
  -- 직접 고친 기록: remove·auto=true는 오답, add는 누락
  select c->>'op' as op, (c->>'auto')::boolean as auto, count(*)
  from limbus.assist_reports r, jsonb_array_elements(r.corrections) c group by 1, 2;
  -- 샘플 라벨: 같은 세션에서 샘플 직후 60초 안에 고친 기프트
  select s.path, s.reason, c->>'op' as op, c->>'giftId' as gift
  from limbus.assist_samples s join limbus.assist_reports r on r.session::text = s.meta->>'session',
    jsonb_array_elements(r.corrections) c
  where (c->>'clientAt')::bigint between (s.meta->>'clientAt')::bigint and (s.meta->>'clientAt')::bigint + 60000;
  ```

**평가 도구:**

- `scripts/vision/replay_assist.mjs`: 영상 구간을 실제 어시스트 페이지에 화면 공유처럼 재생해 인벤토리 변화를 정답과 비교한다. `--slow ocr=<ms>,scene=<ms>`로 느린 기기를 흉내 낸다.
- `scripts/vision/bench_ocr_modes.ts`: 같은 프레임을 밸런스·품질로 읽어 앱 판정 함수로 채점한다.
- `scripts/vision/replay_samples.ts`: 내려받은 인식 개선 샘플의 프레임을 앱과 같은 480px 이름판 검출, 실제 OCR·장면 Worker, 앱 팝업 판정으로 다시 읽는다. `REPLAY_GATE=0`은 자리 조건 없이, `REPLAY_NO_TEMPLATES=1`은 아이콘 템플릿 없이(첫 사용·느린 네트워크) 읽는다. 개발 서버 없이 빌드된 Worker와 `.env.local`만 쓴다.

앞의 두 도구는 개발 서버, 세 도구 모두 로컬 Chrome이 필요하다. 영상, 샘플, 정답, 결과는 저장소 밖(`~/Downloads/assist-analysis-2026-09-24/`, `/tmp/assist-samples`)에 둔다.

**2026-09-26 샘플 재생 (팝업 실패 샘플 90건, 1,291장, Apple M 시리즈 WebGPU):** 획득 헤더가 있는 실제 팝업 36개를 이름판과 대조해 정답을 붙였다.

| | 이전 | 변경 후 |
|---|---|---|
| 팝업 읽기(OCR+아이콘) | 698회 | 191회 |
| 그중 획득 팝업이 아닌 이름판 | 647회 | 140회 |
| 실제 팝업 판정(아이콘 템플릿 있음) | 35/36, 오답 0 | 35/36, 오답 0 |
| 실제 팝업 판정(아이콘 템플릿 없음) | 33/36, 오답 0 | 35/36, 오답 0 |
| 올라갈 샘플(같은 프레임 기준) | 17건(헤더 없는 이름판 16) | 1건 |

남은 보류 1건은 `회중시계 : 타입 E`로, OCR이 "라임트"로 세 글자를 틀렸고 `타입 Y`와 효과 문구가 같다. 앱에서 실제로 올라온 샘플은 64/90건이 획득 헤더가 없는 화면(기프트 정보·구매 창, 스킬 교체, 보스 연출, 업적)이었다. 조합 재료 샘플 28건은 이 도구로 재생하지 않았다.

**2026-09-26 배포 후 추가 샘플 (팝업 실패 13건, 이전 빌드 #255에서 업로드):** 현재 코드로 다시 읽으면 획득 헤더가 있는 팝업 10개를 모두 맞게 판정한다(10/10, 오답 0). 나머지는 헤더 없는 구매·정보 창이라 현재 빌드에서는 올라오지 않는다. 합치면 실제 획득 팝업 45/46, 오답 0이다. 남은 `타입 E`는 한 프레임에서만 읽혔고 이름 사전 해독이 이미 맞는 이름을 1위로 골랐지만 2위보다 7.6 nat 앞서 기준(9 nat)에 못 미쳤다. 그래서 여러 프레임의 점수 합산으로는 풀리지 않는다. 조합 화면에서는 기준에 못 미친 1위 이름도 약한 후보로 레시피 판정에 넘기고, 인벤토리로 만들 수 있는 유일한 레시피 결과일 때만 기록한다(바로 뒤에 `타입 Y`를 합성했으므로 두 케이스와 두 시계침을 모두 보유한 상태에서 `타입 E`로 정해진다). 이 재생 도구는 인벤토리를 모르므로 후보(`others: 9729`)까지만 확인하고, 레시피 판정은 단위 테스트로 확인한다.

**2026-09-24 결과 (본인 영상, 밸런스):**

- 5재료 합성: 4/4
- 9/23 연속 합성 6회: 재료 17/17, 결과 6/6
- 9/24 연속 합성 11회: 재료 26~27/30, 결과 12/12
- 9/21 5칸 상점 합성 5회: 재료 8/11, 결과 5/5
- 판매: 26회 중 25회 기록, 취소 2회 모두 미기록
- 잘못 제거된 재료: 없음

남은 누락은 휠에서 어둡거나 가는 아이콘을 약하게 읽는 경우와, 마지막 재료를 고른 뒤 0.3초 안에 합성하는 경우다. 품질 모드는 정지 프레임에서 합성 확인 창 인식이 34/36에서 36/36으로 올랐지만, 한 장을 읽는 데 2.3배가 걸려 실제 재생에서는 이득이 없었다.

**2026-09-26 잔영 합성 (합성 샘플 60건 재생):** 첫 실제 인식 보고에서 합성은 44번 중 9번만 재료를 모두 읽었다(20%). `scripts/vision/replay_fusion_samples.ts`는 합성 샘플을 앱과 같은 방식으로 다시 읽는다. 전체 화면 OCR로 확인 창과 선택 화면을 찾고, 장면 Worker로 확인 창 칸과 휠 위치를 읽은 뒤(OCR 기준점 포함), `fusionMaterials`로 모은다. 샘플에는 인벤토리가 없어 보유 후보는 잔영 5종만 넘긴다(`REPLAY_CANDIDATES=vestiges`). 변경 전에는 확인 창 42개 중 9개(21%)가 재료를 모두 알아봐 실제 보고와 같았다. 실패 대부분에 잔영이 있었다. 잔영 5종은 같은 병 그림이라 1위와 2위가 다른 잔영이고 격차가 0.04~0.07이었다. 또 한 판독에서 같은 기프트가 두 칸에 나오면 판독 전체를 버려서, 잔영 두 개를 넣은 합성은 다른 재료까지 버려졌다. 이제 재료 칸 순위에서 잔영 5종을 하나(`FUSION_VESTIGE_ID`)로 묶어 잔영이 아닌 아이콘과만 격차를 재고, 잔영 중복은 허용한다. 변경 후 34/42(81%)가 완전했고, 변경 전에 읽은 재료는 하나도 바뀌거나 빠지지 않았다. 새로 잡힌 잔영 아닌 재료 3개는 여러 프레임에서 0.87~0.92(격차 0.25~0.37)로 읽혔지만, 같은 판독의 잔영 중복 때문에 버려졌던 것이다. 남은 8개는 확인 창이 아이콘이 나타나기 전에 닫혔거나, 아이콘 자체가 템플릿과 잘 맞지 않는 경우다.

**2026-09-26 보유 기프트로 재료 칸 판정 (영상 재생, balanced, 9/24는 PiP 가림):** 합성 재료 칸은 카탈로그 전체 아이콘과 비교한다. 놓친 재료는 대부분 맞는 아이콘을 1위로 읽었지만, 보유하지 않은 닮은 아이콘과의 격차가 0.15~0.16으로 기준(0.2)에 못 미쳤다(9/21 #6 `9072` 0.65/0.15, #8 `9109` 0.73/0.16). 이제 전체 1위가 보유 기프트(또는 잔영)일 때는 격차를 다른 보유 기프트와만 잰다(`heldSlotRead`). 보유하지 않은 아이콘이 1위이면 전체 판정을 그대로 두므로, 인벤토리에 빠진 재료가 닮은 보유 기프트로 바뀌지 않는다.

| 구간 | 변경 전 | 변경 후 |
|---|---|---|
| 9/21 5칸 연속(#5~#9) 재료 | 8/11 | 10/11, 10/11, 9/11, 10/11(4회) |
| 9/24 연속 11회 재료 | 28/30 | 28/30, 27/30 |
| 9/23 연속 6회, 9/21 5/5 체인 재료 | 17/17, 7/7 | 17/17, 7/7 |
| 잘못된 변경 | 0 | 0 |

남은 누락은 아이콘 자체가 템플릿과 잘 맞지 않는 경우다(9/21 #7 `9049` 최고 0.45, 9/24 #3 `9791`은 다른 아이콘으로 읽힘). 확인 창은 0.3~0.5초만 떠 있어 첫 읽기가 아이콘이 나타나기 전(빈 칸)에 끝나기도 한다. 빈 칸이면 100ms 뒤 다시 읽게 해 봤지만 창이 그 전에 닫혀 읽기 횟수가 늘지 않았고, 적용하지 않았다. quality 모드의 같은 구간은 9/11로 전과 같았다.

**2026-09-27 아이콘 대조와 확인 창 없는 합성 (합성 샘플 59개 확인 창·정답 영상 6구간):** 운영 보고(빌드 449a1ff, 47건)에서 합성은 93번 중 23번만 재료를 모두 읽었고, 자동 기록을 지운 오답은 0이었다. 샘플을 다시 보니 원인은 셋이었다.

- **아이콘 대조:** 흰색에 가까운 아이콘(안식 9750)은 불투명 픽셀의 색만 비교하면 안쪽 명암이 거의 없어 후보 8개에도 못 들었다. `iconTemplate`은 이제 한 템플릿에 두 상관을 둔다. 하나는 아이콘을 검은 칸에 그린 모습(색×알파, 그린 영역 1px 확장)으로 외곽선까지 보는 상관이고, 다른 하나는 불투명 픽셀의 색만 보는 기존 상관이다. 불투명 픽셀을 앞에 두어 한 번 훑으며 둘을 누적하고 큰 값을 쓴다. 외곽선만 쓰면 어두운 아이콘(가시오랏줄 9169, 옭아맨 타래 9107)이 1차 선별에서 빠졌다.
- **속도:** 이중 상관은 칸당 시간을 1.6배로 늘렸고, 1.4초 간격 연속 합성 영상에서 휠 판독 횟수가 줄어 재료가 27~30/33에서 19~23/33으로 떨어졌다. 그래서 16px 템플릿으로 한 배율만 훑어 상위 40개와 보유 기프트만 3배율 1차 선별로 넘긴다(`rankIconsInRegion`의 `tiny`, `always`). 칸당 시간은 Node 기준 81ms에서 66ms가 됐다. 보유 기프트를 항상 넘기는 이유는, 예비 선별이 생체 맹독 바이알(9111)을 한 번 잘라 보유하지 않은 닮은 아이콘이 1위가 됐기 때문이다(9/23 영상).
- **휠 재료 교체:** 같은 휠 자리에서 채택된 기프트가 둘이면 충돌로 보고 버렸다. 이제 휠에서는 가장 최근 것을 쓴다(샘플 8b74aa01: 9004 → 9061). 확인 창은 떠 있는 동안 바뀌지 않으므로 그대로 둔다.
- **확인 창 없는 합성:** 재료 수를 상점 칸 수로 가정해 2~3개로 하는 5칸 합성은 끝내 완성되지 않았다. 이제 가장 많이 채워진 휠 상태의 칸 수를 쓴다(`wheelSelectionSize`).

`replay_fusion_samples.ts`는 이제 `REPLAY_OCR_CACHE`로 OCR을 재사용하고, 확인 창마다 휠만으로 읽은 결과(`wheelOnly`, 완전한 확인 창 판독을 정답으로 비교)와 확인 창 없는 결과(`noDialog`)를 함께 낸다.

| 합성 샘플 재생 | 변경 전 | 변경 후 |
|---|---|---|
| 확인 창 재료 완성 | 47/59 | 50/59 |
| 휠만으로 완성(규칙 변경만 적용 시) | 43/56 | 45/56 |
| 틀린 재료 | 0 | 0 |

획득 팝업 샘플은 정답 36개 중 35개로 같고(오답 0), 새 샘플의 획득 팝업 13개도 이름판과 같은 기프트로 판정했다. 예전에 템플릿과 잘 맞지 않던 가시밭길(9049)도 팝업 아이콘이 채택됐다.

정답 영상은 새로 9/25 연속 합성(16회, 30초, 확인 창 0.1~0.9초, `~/Downloads/assist-analysis-2026-09-24/replay/truth-0925.json`)을 만들었다. 재료는 확인 창 0.2초 전 1080p 휠에서, 결과는 팝업 이름판에서 정했다. 실시간 재생은 실행마다 재료 2~3개씩 흔들려, 영상에서는 퇴행이 없다는 것까지 확인했다.

| 영상 재생(balanced) | 변경 전 | 변경 후 |
|---|---|---|
| 9/25 연속 16회 재료 | 27, 30 /33 | 24, 31 /33 |
| 9/24 연속 11회(PiP 가림) 재료 | 27~28/30 | 26, 27, 28 /30 |
| 9/23 연속 6회 재료·결과 | 17/17, 6/6 | 17/17, 6/6 (2회) |
| 9/21 5칸 연속 재료 | 9~10/11 | 9/11 |
| 9/21 5칸 체인 재료 | 7/7 | 7/7 |
| 잘못된 변경 | 0 | 0 |

남은 누락은 대부분 타이밍이다. 1.4초 간격 연속 합성에서는 선택이 끝난 휠이 0.3초 남짓만 보이고, 확인 창은 아이콘이 나타나기 전에 닫힌다. 반쯤 나타난 확인 창 칸은 배경 무늬가 섞여 두 대조 모두 0.4 안팎이다. 재료 칸의 등급 숫자(노란 막대)와 키워드 배지로 후보를 줄이는 방법은 시험하지 않았다.

**2026-09-27 합성 재료 아이콘 분류 모델:** 템플릿 대조는 칸 하나에 수십~수백 ms가 걸리고, 반쯤 나타난 칸·어두운 아이콘·작은 창 모드 캡처에 약했다. 합성 재료 칸은 이제 학습한 분류 모델(`public/models/assist-scene/icon-classifier.onnx`, MobileNetV3-small, 96px)이 한 번에 읽는다. 획득 팝업 아이콘은 그대로 템플릿과 임베딩으로 읽는다.

- **학습 데이터:** 카탈로그 아이콘 452개를 실제 빈 칸 1,568개(본인 녹화와 인식 개선 참여 샘플의 빈 칸) 위에 판독 영역 크기(±14%)로 붙인다. 그 기프트의 등급 숫자와 키워드 배지를 얹고, 채워진 칸의 줄무늬 고리(사이트 게임 칸 배경에서 안쪽을 뚫은 것)를 80%에 둔다. 이어 반투명(25%), 22~96px 해상도, JPEG, 밝기, 흐림, 커서를 섞는다. 잔영 5종은 한 부류, 빈 칸이 한 부류다(449부류).
- **평가:** 실제 칸 887개를 썼다. 강한 템플릿 판독 679개, 약하지만 완전한 확인 창 재료와 일치한 칸 157개, 9/25 1080p 휠·반쯤 나타난 칸 34개, 결과 팝업 17개다. 세 번째 학습 단계부터 887/887이 1위였다.
- **점수:** 로짓을 1.5배 해 소프트맥스를 쓴다. 라벨 평활화로 확률이 낮게 눌려서다(중앙값 0.90). 이때 887개 중 884개가 강한 판독 기준(0.85, 격차 0.25)을 넘는다. 같은 칸에서 정답 부류를 지우면(모델이 모르는 기프트처럼) 1위는 최대 0.27이라 어떤 기준도 넘지 않는다. 2배에서는 0.65까지 올라가 쓰지 않았다. 보유 기프트가 1위면 다른 보유 기프트와 격차를 잰다(템플릿과 같은 규칙).
- **안전:** 밝기로 빈 칸을 먼저 가르고, 모델이 채워진 칸을 빈 칸이라 하면 알 수 없음으로 둔다. 보유 기프트 중 모델에 없는 것(학습 뒤 게임에 추가된 기프트)이 있으면 그 요청은 템플릿으로 읽는다. 워커의 모델 실행은 한 줄로 세운다. WebGPU에 새 세션을 만드는 동안 장면 모델이 첫 추론을 하다 멈춘 적이 있어서, 아이콘 세션은 준비 신호 전에 차례로 만든다.

| 검증 | 예전 코드 | 템플릿 개선(#267) | 분류 모델 |
|---|---|---|---|
| 합성 샘플, 확인 창 재료 완성 | 47/59 | 50/59 | **55/59** |
| 합성 샘플, 휠만으로 완성 | 43/56 | 45/56 | **55/56** |
| 합성 샘플, 확인 창 없는 결과 완성 | – | 1/9 | **5/9** |
| 9/25 연속 16회 재료 | 27, 30 /33 | 24, 31 /33 | **29, 31, 30, 32 /33** |
| 9/24 연속 11회(가림) 재료 | 27~28/30 | 26~28/30 | **29, 29 /30** |
| 9/23 연속 6회 재료 | 17/17 | 17/17 | 17, 16 /17 |
| 9/21 5칸 연속 재료 | 9~10/11 | 9/11 | **11, 11 /11** |
| 9/21 5칸 체인 재료 | 7/7 | 7/7 | 7/7 |
| 칸 판독 요청(9/25, 중앙값) | 약 170ms | – | **10ms** |
| 틀린 재료·잘못된 변경 | 0 | 0 | 0 |

두 판독이 모두 완성한 샘플 확인 창 50개는 재료가 같았다. 모델만 새로 완성한 5개(가시 장미 9159, 반쯤 나타난 바스라진 기억 9152, 막 나타난 잔영 등)는 프레임을 보고 확인했다. 남은 누락은 0.12초 확인 창으로 끝난 마지막 연속 합성과 어두운 대기만성형 타투(9026)가 가끔 빠지는 경우다. 칸 판독이 빨라졌지만 휠 판독 횟수(한 구간 41~52회)는 그대로다. 횟수를 정하는 캡처 훅의 규칙은 바꾸지 않았다.

**재학습:** 게임에 기프트가 추가되면 그 기프트를 가진 합성만 템플릿으로 돌아간다. 샘플을 내려받아 `replay_fusion_samples.ts`를 돌린 뒤 아래를 실행하고, 결과의 `real` 점수와 영상 재생을 확인해 모델 파일 두 개를 교체한다. 영상에서 만든 평가 칸은 `real-extra.json`(같은 형식)으로 더한다.

```bash
python3 scripts/vision/build_icon_dataset.py --samples <samples> --rows <rows.json> --replay <fusion replay .json> --out <dir>
python3 scripts/vision/train_icons.py --data <dir> --out <model dir>   # Apple GPU(MPS)로 12단계 약 17분
cp <model dir>/icon-classifier.onnx <model dir>/icon-labels.json public/models/assist-scene/
```

**2026-09-28 느린 기기의 합성 누락:** 인식 보고(#268 이후 빌드)에서 합성은 55번 중 41번(75%)만 재료를 모두 읽었다. 보류 14건 중 11건이 "확인 창 없음"이었고 9건이 한 사용자(2560×1440, AMD GPU)에게서 나왔다. 올라온 프레임에는 확인 창이 재료까지 2~3장 찍혀 있었다. `replay_fusion_samples.ts`로 다시 읽으면 확인 창 14개 중 12개가 완성돼 판독 능력의 문제가 아니었다. 원인은 느린 기기에서 판독 차례가 밀리는 것이었다.

- 화면 OCR 한 줄을 전체 화면 판독과 탐험 배너 판독이 나눠 쓴다. 느린 기기에서는 배너 판독 한 번이 약 2초라, 합성 화면에서 전체 화면 판독이 10초 동안 한 번도 돌지 않았다. 이제 상점·합성·판매·스킬 교체 화면에서는 배너를 읽지 않는다. 배너는 지도에만 있다.
- 확인 창 없는 결과는 결과 직전의 휠 상태로 재료를 읽는다. 그런데 느린 기기는 결과 팝업을 3~4초 뒤에 판정하고, 그동안 결과 연출이 새 휠 상태를 쌓아 "최근 16개·4초" 보관에서 직전 상태가 밀려났다. 보관을 40개·8초로 늘렸다(640px 잘라낸 상태 하나 약 1MB, 합성 화면에서만 쌓임).

`replay_assist.mjs --slow ocr=<ms>,scene=<ms>`는 워커 응답을 늦게 전달해 느린 기기를 흉내 낸다. 도구는 이제 항상 캔버스를 거쳐 화면을 넘긴다. `video.captureStream()`을 바로 넘기면 앱이 최신 프레임과 판독용 사본을 쥐고 있는 동안 영상 디코더가 멈췄다. 같은 시각 부하에서 번갈아 잰 결과(balanced, 9/23 연속 6회):

| 조건 | 변경 전 | 변경 후 |
|---|---|---|
| 보통 속도 | 재료 16/17, 결과 6/6 | 16/17, 6/6 |
| OCR 2초·장면 0.3초 지연 | 재료 0/17, 결과 5/6 | **15/17, 6/6** |
| 9/21 5칸 체인(보통 속도) | 7/7 | 7/7 |
| 잘못된 변경 | 0 | 0 |

시스템 부하가 높을 때(준비 시간 약 20초, 장면 분류 0~5회)는 변경 후에도 0~3/17로 떨어진다.

**첫 합성:** 합성 화면을 연 지 3~4초 안에 합성하면, OCR이 선택 화면을 한 번도 읽기 전이라 휠이 보이는지 판단할 기준 모양이 없다. 그래서 결과가 등록되지 않았다. 합성 화면을 15초 보여 준 재생에서는 같은 합성을 3/3 읽었으니, 실제로는 들어오자마자 합성할 때만 생기는 누락이다. 이제 기준 모양이 없으면 결과를 버리지 않고 선택 화면을 읽을 때까지 기다린다(휠 상태 보관 시간 안에서). 대기 중인 결과보다 선택 화면 판독을 먼저 처리해, 기준 모양이 생긴 판독에서 바로 읽는다. 9/23 단일 합성을 느린 조건과 합성 화면 4초로 재생하면 변경 전 0/3, 변경 후 0·2·0·3/3이다. 보통 속도는 3/3, 16/17, 7/7로 같고 잘못된 변경은 없다. 남은 실패는 기다린 뒤 고른 휠 상태가 빈 상태이거나, 어두운 아이콘(손목 보호대 9069)이 0.70으로 기준에 못 미친 경우다.

**2026-09-29 한국어 기록 점검과 조합식 합성:** 인식 보고는 보낼 때마다 집계를 0으로 되돌리는 구간값이라 세션별로 모두 더해야 한다(마지막 보고만 세면 빠진다). 전체 합산(빌드 13개, 39세션)은 획득 팝업 2216/9, 판매 131/6, 합성 141/106(읽음/보류)이다. 첫 합성 수정 이후 빌드(87f428c·38ba1be)는 팝업 365/1, 판매 15/0, 합성 38/8이다. 영어·일본어 게임 화면의 보고와 샘플은 아직 없었다(샘플 메타에는 이제 `language`가 남는다). 9/28 샘플 25건을 현재 코드로 다시 읽으면 합성 확인 창 21개 중 17개가 완성되고, 획득 팝업 실패 2건(카르밀라와 밀라르카의 이름 혼동, 잔영 팝업)은 모두 맞게 읽힌다. 남은 합성 4건 중 둘은 조합식 합성(피안개 3/3, 회중시계 : 타입 E 2/5)으로, 확인 창이 아이콘이 나타나기 전에 닫혀 재료가 1개씩만 읽혔다. 하나는 무작위 합성의 막 나타난 잔영 칸이다. 컴패니언은 결과 팝업이 레시피 결과이면 원래 레시피 재료를 지웠지만, 캡처 단계는 레시피를 몰라 이런 합성을 보류로 세고 샘플을 올렸다. 이제 캡처 훅이 확인 창 판독을 끝낼 때 대기 중인 결과 팝업으로 `recipeFusionMaterials`(RunClient의 `completeFusion`)를 부른다. 결과의 레시피 중 재료 수가 확인 창과 같고, 읽힌 재료(잔영 제외)를 모두 포함하며, 인벤토리에 전부 있는 레시피가 하나뿐이면 그 재료로 합성을 완성해 읽음으로 센다. 둘 이상이거나 없으면 읽은 재료만 쓴다. 결과 하나에 레시피가 여럿이고 모두 보유했을 때(피안개 3재료·4재료)는 확인 창에서 읽은 재료를 포함한 레시피를 먼저 고른다. 검증은 두 샘플의 판독·결과·레시피를 옮긴 단위 테스트다(재생 도구는 인벤토리와 결과를 모른다).

**2026-09-29 게임 원문 대조와 복구:**

- **서식 태그와 자리표시자:** 이벤트 지문·선택지·결과 원문의 Unity 태그(`<color=#ebcaa2>`, `<b>`, `<size=…>`, `<sprite …>`)가 정규화 뒤 `colorebcaa2` 같은 글자로 남아, 그 구간은 화면 글자와 절대 일치하지 않았다. `lib/vision/text-normalize.ts`의 `gameTextPieces`가 태그를 지우고 `{0}`(수감자 이름) 자리에서 원문을 나눈다. 이름이 들어가는 자리를 걸친 비교 창은 만들지 않는다.
- **일본어 OCR 유사 글자:** 탁점·반탁점·장음 부호를 빼고, 작은 가나와 모양이 같은 글자(力/カ, 口/ロ, 工/エ, シ/ツ, ソ/ン, 一/ー)를 양쪽에서 같은 글자로 접는다(`ocrNormalized`). 이벤트·선택지·기프트 이름, 획득 팝업 이름판, 판매 창 이름에 쓴다. 획득 헤더 판정은 그대로다.
- **두 단 화면:** 검출 줄을 위에서 아래로 이으면 이벤트 지문 줄 사이에 오른쪽 선택지 줄이 끼어든다. `columnText`가 같은 왼쪽 끝으로 이어지는 줄을 단락으로 모아 원래 읽기 순서 뒤에 덧붙인다(`|`로 구분, 비교 창은 넘지 않는다).
- **판매 이름:** 한 글자 차이 이름은 5글자 이상이고 다른 모든 이름과 3글자 이상 떨어질 때만 인정한다(획득 팝업과 같은 `nearestName`). 판매는 이후 코스트 증가로 한 번 더 확인된다.
- **복구:** GPU OCR이 실행 오류나 8초 시간 초과를 한 번 내면 캡처가 끝날 때까지 Tesseract만 썼다. 이제 10초·45초·3분 뒤 다시 불러오고, 5분 이상 정상 동작한 뒤의 실패는 대기를 처음부터 센다. 전체 화면 OCR 요청의 오류는 그 프레임만 건너뛰고 3회 연속일 때 레인을 정리하며, 레인이 모두 없으면 5초·20초·60초 뒤 워커를 다시 만든다(예전에는 워커 하나일 때 OCR이 캡처 끝까지 꺼졌다). 장면 워커는 준비된 뒤 추론 5회 연속 실패에서만 캡처를 끝낸다(예전에는 한 번에 화면 공유 전체가 끝났다).
- **메인 스레드:** 카탈로그 비교 색인을 카탈로그마다 한 번 만들고(읽기마다 재구성하던 것), 실행 화면의 층 패널을 memo로 감싸 캡처 상태 갱신마다 다시 그리지 않는다. OCR 워커는 줄마다 캔버스를 새로 만들지 않는다.

검증은 단위 테스트와 합성 화면이다. 실제 PaddleOCR 모델(WASM, 헤드리스 Chromium)로 1920×1080 합성 이벤트 화면(태그·`{0}`가 있는 지문 옆에 선택지 3개가 끼어드는 두 단 배치, 흐림 1.2px)을 읽으면, 변경 전 대조는 선택지 0/3과 다른 이벤트의 선택지 1개를 잡았고 변경 후는 선택지 3/3과 선택지로 이벤트를 확정했다(지문 창으로 이벤트를 찾은 것은 양쪽 같다). 이 작업 환경은 운영 DB와 녹화·샘플, GPU가 없어 `replay_assist.mjs`·`replay_samples.ts`·`replay_fusion_samples.ts` 재생과 인식 보고 집계는 하지 못했다. 배포 뒤 인식 보고(`limbus.assist_reports`)와 이벤트 샘플로 확인한다.

기프트 448개·이벤트 330개·선택지 736개의 실제 카탈로그로 본인 영상의 이벤트 두 장면, 보상 한 장면, 전투 한 장면을 확인했다. 이벤트 한 장면을 0.75배로 축소해 1800×1200 화면의 비중앙에 배치해도 같은 이벤트와 두 선택지를 찾았다. 보상에서는 두 기프트를 찾았고 전투에서는 후보가 없었다. 이는 제한된 장면의 회귀 검증이며 모든 해상도·언어·영상의 인식률을 뜻하지 않는다. 글자가 없거나 작은 아이콘만 있는 화면의 임의 위치 이미지 인식은 아직 해결되지 않았다.

### 게임 원문 텍스트 임베딩

`scripts/embeddings/`는 기프트 이름·강화별 효과, 이벤트 이름·지문, 선택지 문구·설명·결과를 ko/en/ja 각각 벡터화한다. 비어 있는 번역은 다른 언어로 대체하지 않는다. 입력 JSON은 `gifts`, `events`, `choices` 배열이며 기존 DB의 해당 행을 읽어 준비한다. 생성물과 모델은 저장소 밖에 보관한다.

모델은 `intfloat/multilingual-e5-small`의 고정 revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`이며 가중치 해시도 검증한다. 원문은 `passage:`, 검색문은 `query:` 접두사를 사용한다. 384 토큰 단위·32 토큰 겹침으로 긴 지문을 나누고 masked mean pooling과 L2 정규화로 384차원 벡터를 만든다. 이미지의 576차원 벡터와는 별도다. 원문·표시 텍스트·모델·토크나이저·전처리 버전을 기록하며 `--reuse-from`으로 변경되지 않은 벡터를 재사용한다.

```bash
python scripts/embeddings/build_text_embeddings.py \
  --source <catalog.json> --model-dir <pinned-model-directory> \
  --output-dir <new-private-output-directory> --dry-run
# 생성 시 --dry-run 제거. 기존 벡터 재사용은 --reuse-from <previous-output-directory>.
python scripts/embeddings/sync_text_embeddings.py --artifact <output-directory>
# 검토 후 실제 동기화: ASSIST_DATABASE_URL 환경 변수와
# --apply --expect-source-hash <manifest-source-sha256> 필요.
python -m unittest discover -s scripts/embeddings -p 'test_*.py'
```

2026-09-23에는 기프트 448개·이벤트 330개·선택지 736개의 비어 있지 않은 원문 9,528개 필드를 9,530개 벡터로 생성해 `limbus.assist_text_embeddings`에 적재했다. 초기 적재는 기존 서버용 Supabase 클라이언트의 배치 upsert를 사용했으며 원본 테이블은 변경하지 않았다. DB 행 수·차원·정규화·접근 권한·검색 RPC를 확인했다. 동일 입력 재생성에서는 9,530개를 모두 재사용했고 결과 파일 해시가 같았다. 세 언어의 대표 원문 검색 12건이 해당 필드를 1위로 반환했지만 이는 화면 인식률을 뜻하지 않는다.

현재 텍스트 벡터는 서버 전용 검색 자료다. 실시간 화면 OCR은 브라우저에서 처리하며 이 DB에 OCR 원문을 전송하거나 벡터 검색 결과로 자동 획득을 기록하지 않는다.

## 사용자 전체 추출본 준비

현재 입력은 `~/Downloads/LimbusAssets` 폴더다. 이전에 잘못 압축한 `LimbusAssets_2026-09-19-full.zip`은 입력으로 사용하지 않는다. 새 입력의 `Reports/manifest.json`, `data-manifest.json`, `run.json`을 기준으로 이미지 7,138개와 JSON 8,122개(정적 데이터 1,587 / KR 2,177 / EN 2,171 / JP 2,187)를 검사한다. 추출 보고서의 `latestGameServerVersionVerified=false`이므로 추출 날짜를 최신 게임 서버 버전 검증으로 해석하지 않는다.

```bash
# 기본 실행: 원본 전체 검증과 <output>.report.json 작성. DB/Storage 접근 없음.
npx tsx scripts/sync/prepare-extracted-assets.ts \
  --source "$HOME/Downloads/LimbusAssets" \
  --output "$HOME/Downloads/LimbusAssets-ready-2026-09-19"

# 같은 명령에 --prepare를 붙이면 검증 후 로컬 입력을 생성한다.
# 기존 업로드 경로 후보를 비교하려면 --previous-artwork <artwork-upload-results.json> 추가.
```

`--prepare`는 새 출력 폴더의 `complete-data/`에 `.txt` 입력과 `KR/EN/JP` 하위 디렉터리를 만든다. JSON 본문은 BOM만 제거하고 보존하며 오래된 로케일을 섞지 않는다. 해시·파일 크기·PNG 크기·JSON 파싱·목록 누락·파일명 충돌을 검사하고, 실패하면 데이터 출력을 만들지 않는다. 원본이나 저장소 내부 출력, 이미 채워진 출력 폴더는 거부한다. 재준비에는 새로운 출력 경로를 지정한다.

`image-catalog.json`은 원래 이름·게임 ID·container·pathId·해시·크기·분류를 보존하는 연결 조사 자료다. `dbLinked`는 추출 당시의 메타데이터이며 현재 서비스 DB와의 연결 보장이 아니다. `previousArtworkCandidates`도 기존 업로드 기록에서 파일명이 정확히 같은 경로 후보일 뿐, 이미지 내용 일치나 업로드 승인을 뜻하지 않는다. 스킬 이미지 대상은 수감자 인격·E.G.O가 사용하는 이미지로 제한하며 신규 인격은 정적 데이터로 확인한다. 색상이 다른 중복 원본 `9002401`, `9100401`, `9100402`는 `enemy-skill.json`의 적 스킬이므로 대상에서 제외하고 원본만 보존한다.

이미지는 바로 덮어쓰지 않는다. 새 `_profile`은 256×256 얼굴 이미지이고 현재 카드의 `_info` 세로 이미지와 다르다. 새 묶음에는 `_info`와 UI 아틀라스가 없으므로 기존 자료를 유지하며, 이름만 바꿔 대체하지 않는다. 새 인격 `10416`, `10816`의 원본과 정적 데이터는 있지만 카드용 이미지 연결은 별도 확인이 필요하다. 키워드는 기존 영문 표시명 slug와 새 내부 ID가 달라 원문 `iconId` 관계를 확인해야 한다.

기존 `identity-data.ts` 등의 파서는 준비된 `complete-data`를 입력으로 사용할 수 있다. `appearance`는 게임 내부 이름이고 현재 이미지 폴더명과 다를 수 있으므로, 기존 인격의 이미지 경로는 자동으로 바꾸지 않는다(새 인격 이미지만 DB의 `folder_name`으로 올린다). 데이터 적용은 아래 자동 반영의 단계별 dry-run·백업을 거친다. 이 준비 스크립트 자체는 WebP 변환, 업로드, DB 변경을 수행하지 않는다.

### Windows 추출 도구에서 자동 반영 (2026-09-27)


```bash
# 번들: apply-extraction, game-text-refs, identity-data, mirror-dungeon-data, rebuild-mirror-events, sync-extracted-identities + Windows용 sharp,
# 추출 도구의 테마팩 합성용: build-theme-packs.py, theme-composition/ 오버레이 원본 3개, SCDream5.woff2, Windows용 휴대용 Python(python/)
node scripts/sync/build-site-sync.mjs "<림버스 에셋>/tools/site-sync" --win
# 옆에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, REVALIDATION_SECRET, NEXT_PUBLIC_SITE_URL만 담은 .env.local을 둔다.

# 저장소에서 같은 흐름을 직접 실행(기본은 dry-run, --fix가 적용)
node --import tsx scripts/sync/apply-extraction.ts --zip <LimbusAssets_*.zip> --work <빈 작업 폴더> [--fix]

# 키워드 아이콘만(아래 "키워드 아이콘 업로드"): ZIP을 같은 방식으로 검사한 뒤 아이콘 계획만 세운다. --fix가 올린다.
node --import tsx scripts/sync/apply-extraction.ts --zip <LimbusAssets_*.zip> --work <빈 작업 폴더> --keyword-icons-only [--fix]
# 기존 인격의 스킬 아이콘만(--skill-icons-only), 둘 다(--icons-only): 모두 끝에 이미지 감사를 한다.
node --import tsx scripts/sync/apply-extraction.ts --zip <LimbusAssets_*.zip> --work <빈 작업 폴더> --icons-only [--fix]

# 운영 DB가 참조하는 이미지가 Storage에 있는지 읽기 전용으로 확인(아래 "이미지 누락 감사"): 아무것도 쓰지 않는다.
node --import tsx scripts/sync/audit-images.ts [--json <파일>] [--limit <종류별 키 수>] [--strict]
```

`apply-extraction`은 `prepareExtractedAssets`로 ZIP 전체를 검사한 뒤 refs(게임 텍스트 참조 표, `game-text-refs.ts`) → identity → keywords → refs-link(같은 동기화를 한 번 더: keywords 단계가 새로 만든 `keyword_meta` 행을 `keyword_name`으로 잇는다. 이 연결이 없으면 적용 뒤 읽기 검증이 refs 변경을 남은 차이로 본다) → mirror(기프트·테마팩·레시피) → events 순서로 단계마다 dry-run 후 `--fix`를 실행한다. 첫 적용 전에 `identities`, `skills`, `passives`, `ego`, `ego_skills`, `ego_gifts`, `keyword_meta`, `game_text_refs`, `ego_gift_themes`, `ego_gift_recipes`를 작업 폴더 `backup/`에 저장하고, 이벤트 단계는 자체적으로 `md_events`/`md_event_choices`를 백업한 뒤 읽기 검증한다. 실패하면 그 단계에서 멈춘다. 새 인격은 같은 ZIP에서 `sync-extracted-identities`로 이미지를 올린다. 새 E.G.O(숨김·각성 스킬 없는 스토리 전용 E.G.O는 제외)는 단계들이 끝난 뒤 `bootstrap-data.ts --ego-ids`로 행·단계별 스킬·단계별 패시브(`ego_passives`, SkillTag 구획 제목 번역 포함)를 넣고, ZIP의 `<id>_awaken_profile`·`erosion_profile`·`cg`·`e_cg`·`profile_summary`를 `sinners/<수감자>/ego/<폴더>/`에 webp로 올린 뒤(기존 파일은 덮어쓰지 않음) 사이트 캐시를 갱신한다. Drive 아트 목록이 없는 Windows에서는 폴더를 영어 이름으로 정하고 ASCII 밖 글자는 `_uXXXX_`로 쓴다(Drive 폴더 규칙과 같음). 결과는 `report.json`의 `newEgos`에 남는다. 2026-09-28 검증: 9/24 추출본으로 엄숙한 애도(20109)·착영휘도(20509)를 새 E.G.O로 가정해 dry-run한 계획이 DB의 행·패시브·스킬 16개와 필드까지 같았다. 번들에서 `bootstrap-data.mjs`가 `identity-data`를 품으므로, `identity-data`는 파일 이름까지 확인해 직접 실행될 때만 동기화를 시작한다. 키워드 아이콘은 refs-link 직후 올린다(아래). 이벤트 재구성은 복구 폴더가 없으면 선택지 템플릿을 추출본의 `KR/EN/JP_ChoiceEvent*.txt`에서, 이벤트 그림 유무를 Storage `icons/events/` 목록에서 읽는다.

키워드 아이콘 업로드(2026-10-01): 반영이 이벤트 그림·기프트 아이콘·E.G.O 이미지·테마팩·인격 이미지는 올렸지만 키워드 아이콘은 올리지 않아, 키워드 행이 새로 생겨도 그림이 없었다(2026-10-01에 추가된 검은 날개·검은 신의 가호·보존 신역·약속된 못·잿빛 탄환·진동 - 보존). 이제 `--fix`가 keywords 단계와 refs-link 직후 `scripts/sync/keyword-icons.ts`의 `uploadMissingKeywordIcons`를 실행한다. `keyword_meta`의 `icon_slug`로 사이트가 읽을 Storage 키(`icons/keywords/<slug>.webp`, `getKeywordIconUrl`을 그대로 불러 별칭·변형·로컬 자산(`/assets/game-ui`)으로 가는 슬러그는 건너뜀)를 구하고, 폴더 목록(한 번)에 없는 것만 대상으로 한다. 그 키워드의 후보 태그는 keywords 단계가 쓴 감사 파일(`LIMBUS_KEYWORD_AUDIT`, 작업 폴더 `keyword-audit.json`)의 대표 태그와 `game_text_refs`에서 `keyword_name`이 그 키워드인 id 전부다. 각 태그의 스프라이트는 버프 데이터(`*buff*.txt`)의 `iconId`(없으면 태그 자신)이고, 매니페스트에서 `kind '키워드'`·`name`이 같은 이미지가 정확히 하나여야 한다(같은 이름에 해시가 다른 이미지가 둘이면 모호). 태그들이 서로 다른 스프라이트로 이어지면 대표 태그의 것을 쓰고 대표 태그가 없으면 모호로 건너뛴다. 해시를 확인한 뒤 `sharp(...).webp({ lossless: true })`(UI 아이콘은 무손실)로 바꿔 `upsert: false`로 올리고 `uploads`에 `before: null`로 남겨 되돌리기가 지운다. 짝을 못 찾은 키워드는 `report.keywordsWithoutIcon`(이름·슬러그·사유 `no-sprite`/`ambiguous`·태그·스프라이트)에, 올린 것은 `report.newKeywordIcons`(이름·키·스프라이트)에 남고 반영은 멈추지 않는다. `--keyword-icons-only`는 ZIP 검사와 keywords dry-run(감사 파일용, DB 쓰기 없음) 뒤 이 단계만 실행한다(`--fix` 없이는 계획만, `--fix`는 Storage에 올리고 사이트 캐시를 갱신하며 실패하면 올린 것을 되돌린다). 이미 키워드 행만 있고 아이콘이 없을 때(이전 반영이 만든 키워드) 쓴다. 검증: 9/24 추출본으로 dry-run하면 `blessing-of-the-obsidian-god`(NoirShieldUp)·`sanctum-of-conservation`(NoirField)·`promised-nail`(`iconId`로 NoirNailBoss)가 짝지어지고, 그 추출본에 스프라이트가 없는 검은 날개·잿빛 탄환·진동 - 보존과 원래 그림이 없던 `공격 레벨+`는 `no-sprite`로 보고됐다.

키워드 아이콘 판정 기준(2026-10-01, `keywordIconSource`): `keyword_meta.icon_slug` 파일이 Storage에 없다는 것만으로는 누락이 아니다. 사이트는 `getKeywordIconUrl`로 슬러그를 자기 파일, 별칭·변형이 가리키는 다른 Storage 파일, 로컬 자산(`/assets/game-ui/...`: 능력치 아이콘·코인·아틀라스 키워드) 중 하나로 그린다. 사용자 감사의 "509개 중 38개 없음"을 풀어 보면 자기 슬러그 파일을 읽는데 없는 7개(검은 날개·검은 신의 가호·공격 레벨+·보존 신역·약속된 못·잿빛 탄환·진동 - 보존)만 실제로 비어 있고, 25개는 별칭·변형이 가리키는 Storage 파일이 있고(지령[단말기]·[쪽지] 8개는 사용자 지정에 따라 `prescript-2`, 신(心) 2개는 `shin-procuration` 등) 6개는 로컬 아틀라스 자산이다. 별칭·변형이 가리키는 파일을 데이터 스프라이트(`iconId`·태그)와 64x64 픽셀로 비교하면 25개 중 20개가 평균 차이 4 이내(손실 WebP 오차)로 같은 그림이고, 점혈 - 홍루(`nerve-strike-hong-lu-2`)와 지령[쪽지] I~IV(`prescript-2`)는 사용자가 고른 2번 원본이라 데이터 스프라이트와 다르다(건드리지 않는다). 이 단계는 자기 슬러그 파일만 올린다. 별칭 대상 파일이 없는 경우(현재 0건)는 올리지 않고 이미지 감사가 키로 알린다(여러 키워드가 한 파일을 쓰고 그림이 다를 수 있어 어느 스프라이트를 올릴지 정할 수 없다). 2026-09-24 추출본(`Downloads/LimbusAssets 2`)으로 실제 7개를 dry-run하면 3개(검은 신의 가호 NoirShieldUp, 보존 신역 NoirField, 약속된 못 NoirNailBoss)가 짝지어지고, 검은 날개(BlackWingHole)·잿빛 탄환(BulletHole)·진동 - 보존(VibrationFocusing)은 그 추출본의 데이터·이미지에 없는 2026-10-01 신규 키워드라 새 추출이 필요하다. 공격 레벨+(`AttackLevelAdder`)는 버프에 `iconId`가 없고 추출본에도 스프라이트가 없어 원본 그림이 없다(아래 "아직 출처 연결을 확정하지 못한 부분").

스킬 아이콘 업로드(2026-10-01): 새 인격 이미지 업로드(`sync-extracted-identities`)는 새 인격의 스킬만 올려서, 기존 인격이 나중에 얻은 스킬(인격 10412 N사 E.G.O:: 경멸, 경외의 1041205 "경멸 밑으로 쏟아지는 경외의 시선")은 Storage에 없었다. `--fix`는 새 인격 이미지 직후, `--skill-icons-only`/`--icons-only`는 단독으로 `scripts/sync/skill-icons.ts`의 `uploadMissingSkillIcons`를 실행한다. DB의 모든 스킬 행에서 사이트가 읽는 키를 `getSkillIconUrl`·`computeSkillImageIndices`로 그대로 만들고(`image_id`가 있으면 그것, 없으면 인격 id + 번호, 소유 수감자 폴더는 스프라이트 번호 앞 3자리), 수감자 폴더 목록(폴더마다 한 번)에 없는 키만 대상으로 한다. 추출본 매니페스트에서 `kind '스킬'`·`name`이 스프라이트 번호와 같은 이미지가 정확히 하나여야 하고(같은 이름에 해시가 다른 이미지가 둘이면 모호), 해시를 확인한 뒤 무손실 WebP로 `upsert: false`로 올리며 `uploads`에 `before: null`로 남겨 되돌리기가 지운다. 못 올린 것은 `report.skillsWithoutIcon`(키·스프라이트·인격·사유 `no-sprite`/`ambiguous`), 올린 것은 `report.newSkillIcons`에 남고 반영은 멈추지 않는다. 검증: 2026-10-01 운영 DB의 스킬 2,930행은 키 980개이고 없는 것은 `icons/skills/ryoshu/1041205.webp` 1개이며, 9/24 추출본(`Downloads/LimbusAssets 2`)에 그 스프라이트가 있어 dry-run이 1개 업로드를 계획한다.

이미지 누락 감사(2026-10-01): `--fix`의 마지막(읽기 검증·자리표시 검사·캐시 갱신 뒤)과 `--icons-only`류 실행의 끝에 `scripts/sync/image-audit.ts`의 `auditImages`가 DB가 참조하는 이미지 키를 모두 Storage 폴더 목록과 대조한다(읽기 전용, 폴더마다 목록 한 번). 키워드 아이콘은 `keywordIconSource`가 정한 파일(별칭·변형 포함, 로컬 자산은 `audit-images.ts`만 `public/`에서 확인), 인격 스킬 아이콘은 `expectedSkillIcons`, 기프트(`ego_gifts.image_url`)·테마팩(`ego_gift_themes.image_url`)·이벤트(`md_events.image_url`)는 `image_url`의 Storage 키다. 테마팩 보스 이미지(`boss_image_url`)는 대상이 아니다. 결과는 `report.missingImages`에 종류별 `{checked, missing, keys}`(키는 앞 20개)로 남고 누락이 있으면 경고를 낸다. 읽기에 실패해도 `{error}`를 남길 뿐 반영을 실패시키거나 되돌리지 않는다. `audit-images.ts`는 같은 검사를 Mac에서 운영 DB에 대해 단독으로 실행한다(`.env.local`의 키가 필요하고 아무것도 쓰지 않으며 `--json`으로 저장, `--strict`는 누락이 있으면 종료 코드 1). 2026-10-01 운영 결과: 키워드 491개 중 7개(위 7개)·스킬 980개 중 1개(1041205)가 없고 기프트 456·테마팩 117·이벤트 157은 전부 있다.

되돌리기(2026-09-28): `apply-extraction`은 반영 단계들이 쓸 수 있는 표 14개(`game_text_refs` 포함)(`extraction-restore.ts`의 `RESTORE_TABLES`, 1000행 넘는 표도 끝까지)를 첫 적용 전에 `backup/`에 저장하고, 올린 테마팩·E.G.O 그림을 `report.json`의 `uploads`에 남긴다. `extraction-restore.ts --work <작업 폴더> [--fix]`는 표를 백업 상태로 되돌리고(바뀐 행은 다시 쓰고, 그 반영에서 생긴 행은 삭제), 새로 올린 그림은 지우고 덮어쓴 인격 그림(`identity-images/before`)은 원본으로 돌린 뒤 캐시를 갱신한다. `deck_identities`가 인격 삭제 시 함께 지워지므로, 덱·플랜이 쓰는 신규 인격·E.G.O와 그 스킬·패시브는 남긴다. `--fix`는 먼저 현재 상태를 `restores/<시각>/backup`에 저장해 되돌리기도 되돌릴 수 있다. Windows 도구의 반영 기록에서 미리 보기(dry-run) 후 실행하며, 자동 반영을 끄고 확인 후 반영할 수도 있다. 검증: 현재 DB를 백업으로 뜬 dry-run이 변경 0, 스킬 2행을 바꾸고 인격 1개를 뺀 백업은 스킬 2행 복원과 덱에서 쓰는 인격 유지로 계획됐고, Windows 번들의 `--fix`를 변경 0 백업으로 끝까지 실행했다.

새 기프트·이벤트 그림(2026-09-28): mirror 단계 뒤 `ego_gifts.image_url`이 가리키는 `ego-gifts/` 객체가 없으면 ZIP의 `EgoGiftIcon/<게임 ID>.png`(kind `기프트`, name=게임 ID)를 webp로 올리고, ZIP에 아이콘이 없는 기프트는 `report.json`의 `giftsWithoutIcon`에 남긴다. events 단계 전에는 ZIP의 이벤트 삽화(kind `이벤트선택지`, 파일 이름 앞 이벤트 번호)를 `icons/events/<번호>.webp`에 없는 것만 올려, 이벤트 재구성이 원화를 연결하게 한다. 둘 다 기존 파일은 덮어쓰지 않고 `uploads`에 기록해 되돌리기로 지운다. 9/24 추출본 기준으로는 기프트 9818 아이콘 1개(현재 Storage에 없음)만 대상이고 이벤트 원화는 모두 있다. 기존 E.G.O 전체를 추출본으로 다시 쓰는 것은 보류했다: 전체 dry-run에서 2개가 죄악 속성·코스트·내성·패시브까지 DB와 달라 원인 확인이 먼저다(그림 폴더는 기존 값을 유지하도록 했다).

획득 경로는 이미 기록된 뽑기 배너(`gacha_id`, `gacha_name*`)를 유지한다. 최신 추출본에는 지난 픽업 파일이 없고, 수감자별 "특정 추출" 재개 배너가 옛 인격도 목록에 담기 때문이다. 이 규칙 전에는 9/24 추출본 dry-run이 142개 인격 중 141개의 배너 이름을 지우거나 재개 배너로 바꾸려 했다. 배너가 없는 인격만 원본 픽업을 쓴다.

2026-09-27에 9/24 ZIP으로 번들을 Mac에서 `--fix`까지 실행했다(52초). 실제 변경은 10715의 동기화 III에 없는 스킬 빈 행 1개 삭제와 10515의 픽업 배너 1건이었고, 이벤트 339·선택지 754개는 같은 내용으로 다시 쓰여 읽기 검증을 통과했다. 이후 `npm run audit:data` 문제 없음. Windows 실행(`ExtractToDirectory`, win32 sharp)은 아직 실제 PC에서 확인하지 않았다.


### 추출 도구 번들 함께 갱신 (2026-10-01)

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

### 테마팩 합성 재사용

테마팩 카드는 추출 도구가 추출할 때 합성한다(2026-09-27). 게임 데이터 수집 뒤 `scripts/compose-theme-packs.cjs`가 번들의 `build-theme-packs.py`를 `THEME_PACK_FORMAT=png`로 실행해 모든 테마팩 카드를 도감 스냅숏의 `거울던전/합성 테마팩/<id>.png`(kind `합성 테마팩`, name 테마 id, label 한국어 이름)로 넣고 도감을 다시 그린다. 그래서 `.env.local`이 없어도 도감과 업로드 ZIP에 합성본이 있다. PNG 모드는 사이트 카드만 무손실로 저장하며 117장에 약 5초다(webp 인코딩까지 하면 약 330초). Windows PC에는 Python이 없어서 `tools/site-sync/python/`에 공식 CPython 3.12.10 embeddable과 Pillow 11.3.0 wheel(cp312 win_amd64)을 SHA-256 확인 후 풀어 넣는다(`build-site-sync --win`). embeddable의 `._pth`가 자기 폴더를 경로에 넣으므로 pip 없이 `PIL`을 불러온다. 사이트 반영의 마지막 단계는 테마 층 데이터 중 Storage에 `icons/theme-packs/<id>.webp` 또는 `boss/<bossSpriteId>.webp`가 없는 것만 골라(`scripts/sync/theme-images.ts`) ZIP의 `합성 테마팩`·`테마팩보스` PNG를 sharp webp(품질 95)로 바꿔 `--fix`일 때 올린다(`upsert: false`, 기존 이미지는 바꾸지 않는다). ZIP에 필요한 합성본이 없으면 중단한다. 결과는 `report.json`의 `newThemeImages`에 남는다. 검증: 9/24 추출본의 PNG 카드는 기존 webp 설정으로 다시 압축하면 Storage 이미지와 바이트 동일했고, sharp webp로 바꾼 1305·1514·보스도 Storage 이미지와 픽셀 차이 0이었다. 합성본을 넣은 추출본의 검사와 Mac 번들 전체 dry-run도 통과했다. Windows에서의 실제 추출·휴대용 Python 실행은 아직 확인하지 않았다.

사용자가 지정한 iCloud `My Project/무제 폴더/theme-pack-image-work/`는 기존 테마팩 합성 작업 자료다. 저장소의 `scripts/assets/build-theme-packs.py`가 이미 사용하는 비닐·로고·보스·경고·배턴·극한 테두리 합성은 유지한다. `LIMBUS_EXTRACTED_ASSET_ROOT`를 지정하면 새 manifest의 원래 `name`과 `path`로 테마팩/보스 원본을 찾아 합성한다. 이름이 중복되거나 파일이 없으면 중단하며 한국어 폴더명을 추정하지 않는다.

공통 오버레이 원본은 `MainUI_MirrorDungeon4_4.png`, `MainUI_MirrorDungeon6_17.png`, `Baton.png`다. 앞의 두 파일은 iCloud 작업 폴더의 `reference/composition_assets/`에 있고, 세 파일 모두 초기 복구 자료의 `theme-composition/`에 보존돼 있다. 새 묶음의 테마팩 이미지만으로는 공통 오버레이를 대체하지 않는다.

어시스트의 선택 테두리는 Drive 원본 `MainUI_MirrorDungeon4_4.png`(파일 ID `1tu_cNQt61d20xXAWco-sZbEqaFs76h7y`, SHA-256 `8f4d38e68080474f86b9255fa9f8c3e4b373b4bccf3e8e473232fd63b3d1176d`)의 좌상단 기준 영역 `(0, 210, 436, 950)`을 자른 `public/assets/game-ui/themes/selected-frame.webp`다. 크기는 436×740이며 무손실 WebP의 RGBA 픽셀 일치와 중앙 투명도를 확인했다. 선택한 팩에만 원본 테두리를 겹치고 중앙의 선택 문구는 UI에서 현지화한다.

기프트 강화 표시(`-`, `+`, `++`)는 Drive 원본 `MainUI_MirrorDungeon7_2.png`(파일 ID `1gwEx4jyyhyDm8UrllNhuGTLSjus6V4Md`, SHA-256 `3d6f802ccbbeee38a1c5308955a919097012d89b08feab50634850969ffe5547`)에서 자른다. 원본은 `../assets/recovery-2026-09-24/game-ui-sources/`에 두고 `node scripts/assets/extract-gift-enhance-ui.mjs`로 `public/assets/game-ui/gift/enhance-*.webp`와 버전 해시를 갱신한다. 크림색은 강화 단계 선택 버튼, 주황색은 기프트 우상단 표시에 쓴다.

```bash
LIMBUS_EXTRACTED_ASSET_ROOT="$HOME/Downloads/LimbusAssets" \
LIMBUS_DATA_DIR="$HOME/Downloads/LimbusAssets-ready-2026-09-19/complete-data" \
THEME_PACK_WORK_DIR="$HOME/Downloads/LimbusAssets-theme-preview-2026-09-19" \
LIMBUS_COMPOSITION_ASSET_DIR="<기존 복구 자료>/theme-composition" \
python3 scripts/assets/build-theme-packs.py
```

Pillow가 필요하다. 결과는 지정한 작업 폴더의 `output/`과 `diagnostics/`에만 생성하며 업로드하지 않는다. `diagnostics/missing.json`이 비어 있는지 확인하고 실제 합성 결과를 검토한다.

## 초기 복구 입력과 보존

원본과 작업 기록은 저장소 밖 `../assets/recovery-2026-09-10/`에 보존한다. 정상 입력은 **Text / Json**에서 받은 `complete-data/`다. 앞서 조사한 **Json (Text)**의 불완전한 1,856개 파일과 혼동하지 않는다.

| 자료 | 위치 및 검증 |
|---|---|
| JSON 전체 목록 | `drive-complete-json.json`: 10,917개 항목 |
| 동기화 입력 | `complete-data/`: 선택한 3,412개 중 3,411개 JSON 파싱 성공, KR/EN/JP 포함 |
| 텍스트 수신 기록 | `complete-text-results.json`, 원본은 `json-originals/` |
| 이미지 목록 | `drive-complete-{art,icons,ui,events,textures,other-images}.json` |
| 이미지 원본 | `image-originals/`: 선택한 PNG 6,451개 다운로드 성공 |
| WebP 변환 | `image-webp/`, 크기·해시·결과는 `image-download-results.json` |
| UI 원본 | `ui-originals/`, 각 source manifest에 Drive ID와 경로 기록 |

`personality-skin-skill-03`은 원본 JSON의 trailing comma 때문에 수입하지 않았다. 이 파일을 조용히 보정하거나 빈 데이터로 대체하지 않는다. 이미지 6,451개를 받았다는 사실은 모든 게임 내 이미지의 출처와 화면 연결을 확인했다는 뜻이 아니다.

추출 배너명은 같은 Drive의 `json/`에서 `GachaTitle` 8개를 추가로 받아 보완했다. 목록은 `additional-text-sources.json`에 남겼다. 수감자 번호 오버레이 12개와 패닉 원본 2개의 연결은 `detail-ui-source-manifest.json`에 기록했다.

## 동기화 순서

기본 실행은 비교/계획 생성이다. `--fix` 또는 `--apply`는 실제 DB/Storage 쓰기다. 입력과 대상 프로젝트, 차이, 기존 백업을 먼저 확인한다. 기존 사용자/덱/플래너 데이터는 복구 스크립트의 정리 대상이 아니다.

```bash
export LIMBUS_DATA_DIR="../assets/recovery-2026-09-10/complete-data"
npx tsx scripts/sync/bootstrap-data.ts --fix
npx tsx scripts/sync/identity-data.ts --fix
npx tsx scripts/sync/mirror-dungeon-data.ts --fix
node scripts/sync/restore-sanity.cjs --apply
npx tsx scripts/sync/restore-ego-passives.ts --fix
SITE_URL=http://127.0.0.1:3000 npx tsx scripts/sync/identity-data.ts --rebuild-keyword-meta --fix
```

bootstrap은 빈 DB의 수감자/EGO 기초 행과 해석별 스킬을 복구한다. 원본의 희소 단계 패치를 누적하고 실제 최대 단계까지만 생성한다. 스토리 전용 비공개 EGO 5개는 공개 카탈로그에서 제외한다. 해석 V가 있는 EGO는 7개이며 나머지에 V를 만들어 넣지 않는다.

identity-data는 인격 스킬·패시브를 동기화 I~IV 모두 생성한다. 원본에 해당 단계 이하 데이터가 없는 스킬(대부분 S3, 동기화 III 해금)은 그 단계에서 만들지 않는다. `variant_order`는 최고 단계 값을 모든 단계에서 공유한다. 화면은 `(skill_order, variant_order)`·`(passive_type, passive_order)`별 최고 단계 행으로 중복을 제거하기 때문이다.

테마팩의 `fixed_reward_gift_ids`는 `mirror-dungeon-data.ts`가 채운다. 테마팩 원본의 `fixedRewardEgoGifts`(뽕.황 3001: 9242, 9083, 9082, 9081)와, `mapGenOption.bossPool` 스테이지(`mirrordungeon-(ab)battle*`)의 `rewardList`에 확정 기프트가 하나 있는 경우 그 기프트를 모아, `ego_gifts`에 있는 id만 저장한다. 2026-09-24 기준으로 익스트림 1511~1520 팩이 보상 기프트를 하나씩 준다(9250~9255, 9827~9830). 플랜 상세, 플래너 요약, Assist는 이 기프트를 해당 팩이 있는 층의 기프트로 자동 포함하고 팩 전용으로 표시한다. DB의 NULL 목록은 원본 목록이 비어 있어도 `[]`로 다시 쓴다.

`specific_ego_gift_ids`는 원본 `specificEgoGiftPool`에, 원본 id로 이어지지 않는 전용 기프트(`scripts/sync/mirror-dungeon-rules.ts`의 `THEME_EXTRA_EXCLUSIVE_GIFTS`)를 더한 값이다. 3001 뽕.황은 봉이 인형(9242), 1122 선의의 순례는 순례 스토리 던전(912014/912114) 이벤트 971074~971078의 9831~9835, 1124 호박색 어스름의 시련은 이벤트 971092의 아직 따뜻한 커피(9241)다. 테마팩 원본에 동기화가 읽지 않는 항목(예: `specificEgoGiftForUpegsProbs`, `isUnrecordable`, `uiConfigs.showBossIds`)이 있으면 항목과 팩 id를 경고로 출력한다. `LIMBUS_DATA_DIR` 없이 수동 실행하면 스크립트마다 기본 경로가 달라(기프트·테마팩은 옛 로컬 export, 이벤트는 2026-09-10 복구본) 경고를 출력한다.

EGO 패시브는 KR_Passive_Ego를 포함한 세 언어에서 읽는다. CheckAwakenLevel2, CheckAwakenLevelBetween_2_4, CheckAwakenLevel5 조건을 ego_passives의 적용 구간으로 저장한다. 상세의 각성 탭에 맞춰 효과가 바뀌고 해석 I에서는 잠긴다. 기존 모달/API를 위한 EGO 테이블의 패시브 필드는 최대 해석 단계 요약으로 유지한다.

정신력 조건은 원본의 동기화 IV 이하 마지막 조건 목록을 사용한다. 단계별 이력 테이블이 아니다. 안정된 조건 키로 기존 행을 재사용하고, 원본에 없는 참조가 있으면 중단한다.

2026-09-10 읽기 검증 결과:

| 데이터 | 행 수 |
|---|---:|
| 수감자 / 인격 / EGO | 12 / 185 / 112 |
| 인격 스킬 / 패시브 | 1,646 / 934 |
| EGO 스킬 / 그중 해석 V | 862 / 14 |
| EGO 패시브 원본 및 단계 변형 | 119 |
| 정신력 조건 / 템플릿 / 사용 패닉 유형 | 747 / 14 / 2 |
| 기프트 / 테마 / 조합 | 448 / 117 / 67 |
| 거던 이벤트 노드 / 선택 결과 | 330 / 736 |
| 키워드 메타 | 482 |

기프트 9248/9249 및 관련 조합 3개의 한국어 원문이 없어 제공된 EN/JP 텍스트를 사용한다. 번역을 만들어 넣지 않는다. 이벤트 자기 자신으로 돌아가는 선택지는 부모 연결을 덮어쓰지 않으며, 부모 행 생성 뒤 관계를 연결한다.

## 이미지 추출과 업로드

공개 래스터 이미지는 WebP다. 큰 일러스트는 원본 크기를 유지한 quality 90/alphaQuality 100 WebP, UI 글자·문양·테두리는 무손실 WebP를 사용한다. PNG는 외부 작업 폴더의 원본이다.

| 스크립트 | 산출물 |
|---|---|
| `extract-identity-frames.py` | New_MainUI_Formation_3의 3개 희귀도 × 동기화 I~IV = 12개 |
| `extract-skill-frames.py` | Icon_skillFrame_1/3의 7죄악+무속성 × 4슬롯, 별도 공격 유형 배지 |
| `extract-ego-stages.py` | I~V를 공통 캔버스에 배치, 불투명 글자 높이 128px 기준 |
| `extract-ego-card-ui.py` | 원형 프레임, 수감자 배지, 5등급 배너와 문양 |
| `extract-artwork-ui.py` | 수감자 로고·공격 유형·스탯 등의 공용 UI |
| `restore-artwork.cjs` | Drive 원본별 WebP와 UI를 Storage에 업로드하고 공개 URL 해시 검증 |
| `link-artwork.cjs` | 게임 ID를 검증된 파일에 연결, 이미지 컬럼만 갱신 |
| `restore-mirror-assets.ts` | 기프트·선택지·합성 테마 이미지 업로드 및 공개 URL 검증 |

```bash
node scripts/assets/restore-artwork.cjs ../assets/recovery-2026-09-10 --apply
node scripts/assets/link-artwork.cjs ../assets/recovery-2026-09-10 --apply
npx tsx scripts/assets/restore-mirror-assets.ts --fix
```

업로드 기록은 `artwork-upload-results.json`과 `mirror-assets-upload.json`이다. 아트/UI 5,487개 공개 키와 거던 이미지 940개를 검증했다. 아트 기록에는 재실행 전 경로도 남아 있어 현재 계획 5,465개와 수가 다르다. 193개 DB 행의 경로 변경을 읽어 확인했다. EGO 21210은 원본에 프로필이 없어 같은 EGO의 CG/e_CG를 사용한다. Storage에서 거부하는 문자만 결정적으로 이스케이프하고, 원래 파일명과 Drive ID를 기록한다.

스킬 방어 슬롯은 원본의 기본 죄악 장식을 사용하며 슬롯 1과 같은 도형이다. 무속성도 모든 슬롯이 같다. 해시로 동일함을 확인한 중복 파일 20개를 제거하고 같은 URL로 연결했다. 논리적으로 8속성 × 4슬롯을 지원하지만 `extract-skill-frames.py`의 실제 파일은 바탕 22개, 장식 22개, 합성 배지 8개로 총 52개다. `Icon_skillFrame_Invert_2`와 `Icon_skillFrame_Invert`의 바탕 → 스킬 그림 → `Icon_skillFrame_3/1`의 장식 순서로 겹친다. 슬롯 3과 슬롯 1·2의 바탕 좌표도 다르다.

색상은 일반 글자용 `SIN_COLORS`와 분리한 `skill-frame-palette.json`을 쓴다. 단테의 LCB 인격 12개, 스킬/방어 화면 48개와 이상 `10110`의 스킬 2를 추가 대조했다. 원본 프레임의 명암과 알파를 보존하며, 참고 화면의 바탕과 장식 색상을 각각 맞췄다. 참고 이미지 파일은 서비스에 넣지 않는다.

`extract-detail-ui.py`는 원본 아틀라스에서 죄악 자원, 스탯, 등급 링, 패닉, 코인, 수감자 번호·키워드·축복을 포함한 공통 UI 52개를 추출한다. 스탯은 고정 셀 경계가 아니라 완전한 알파 연결 영역의 좌표를 쓴다. HP의 오른쪽과 관통의 왼쪽을 포함한 네 면을 `test_detail_ui.py`가 검증한다. `lib/generated/*-versions.json`의 콘텐츠 해시를 URL에 넣어 기존 Next 이미지 캐시와 서비스 워커가 수정 전 잘린 이미지를 재사용하지 않게 한다.

```bash
npx tsx scripts/sync/restore-identity-metadata.ts --apply
python3 scripts/assets/extract-detail-ui.py ../assets/recovery-2026-09-10
python3 scripts/assets/extract-skill-frames.py ../assets/recovery-2026-09-10/ui-originals
python3 -m unittest scripts/assets/test_detail_ui.py
```

EGO의 WAW/ALEPH 배너 아래 이웃 문양이 섞였던 문제는 추출 좌표를 수정했다. 문양 크기 및 배너의 분리된 알파 조각 검사를 회귀 검증으로 둔다. 로마 단계 표시는 원본 종횡비를 유지한다. 카드 우측 표시가 이름 패널보다 커 보이지 않도록 공통 표시 크기를 1.4rem × 1.2rem으로 조정했다(기존 대비 20% 축소).

최초 키워드 미연결 26개 중 25개를 확인했다. 아래 표는 최초 조사 근거이며, 최종 아이콘 선택은 뒤의 전체 감사와 사용자 지정 2번 우선 규칙을 따른다. 그중 21개는 `lib/constants/keyword-icon-aliases.json`에서 기존 공개 원본 12개 URL로 연결했다. 복제 업로드나 DB 변경 없이 공통 `getKeywordIconUrl`을 사용한다. 원본 ID·Drive 경로·PNG 해시·공개 WebP 해시는 복구 폴더의 `keyword-icon-resolution-audit.json`에 보존했다. 12개 공개 응답을 로컬 변환본과 해시 대조했다.

| 확인된 관계 | 근거 |
|---|---|
| 지령 쪽지 I~IV / 단말기 I~IV | 원본 `IndexPrescript_Base` / `IndexPrescript_Base_2nd`, `Prescript.png` / `Prescript 2.png`. 최종적으로 사용자 지정에 따라 모두 2번 원본 우선 |
| 누적 / 공용 누적 소모 혈찬 | `BloodDinner_Accumulation` / `BloodDinner_Common_Accumulation`, `Total Bloodfeast Consumed.png`, 참고 화면의 동일 아이콘 |
| 신(心) 운명·지혜성, 앙갚음 장부 히스클리프, 점혈 홍루 | 최초 비교에서는 Procuration·싱클레어 장부·돈키호테 점혈과 같은 URL이었다. 홍루는 후속 전체 감사에서 전용 `Nerve Strike - Hong Lu 2.png`를 찾아 우선 연결 |
| 얽힘 / 잔영 | 참고 화면의 Afterimage Entanglement / Dawn's First Crow와 동일 아이콘. 해당 Drive 원본 사용 |
| 당연한 믿음 | `Blandishment`는 노란 머리 아군 그림 `Faith Beyond Question 2.png`. 검은 머리 적군 `Blandishment_Enemy`와 구별 |
| 중지 원한 문신 큰 형님 | 원문 `<s>큰 형님</s>`의 태그 때문에 이름 일치에서 빠졌던 `ReinforcedTattooSpider` 확인 |

나머지 4개는 개별 PNG 목록이 아니라 원본 `Icon_buf_*` 아틀라스에서 찾았다. `extract-detail-ui.py`가 색상·글로우를 보존한 128×128 무손실 WebP로 추출하며 콘텐츠 해시가 붙은 공통 URL을 사용한다.

| 키워드 | 원본 아틀라스 | 좌상단 기준 crop (x0, y0, x1, y1) |
|---|---|---|
| 천퇴성 | `Icon_buf_18_3.png` | 896, 768, 1024, 896 |
| 신(心) 천퇴성 | `Icon_buf_18_3.png` | 896, 896, 1024, 1024 |
| 진동 폭발 | `Icon_buf_3.png` | 512, 384, 640, 512 |
| 일렁임【혈귀】 | `Icon_buf_15.png` | 512, 128, 640, 256 |

비교는 [Dante 키워드 화면](https://dante-planner.com/keyword)의 표시와 DOM 이미지 재사용 관계만 사용했다. 이미지·JSON을 새로 수입하지 않았다.

**아직 출처 연결을 확정하지 못한 부분:** 키워드는 공격 레벨+ (`AttackLevelAdder`) 1개가 남았다. 원문은 있으나 해당 ID의 그림 연결은 확인되지 않았으며, 공격 레벨 증가 (`AttackUp`) 그림으로 임의 대체하지 않는다. 최초 목록 `keyword-icon-source-matches.json`과 `keyword-icons-unresolved.json`은 조사 시작 시점의 기록이며 현재 판정은 위 audit를 따른다. 검증 없이 비슷한 아이콘을 대신 연결하지 않는다. 공통 `KeywordIcon`은 이미지 요청이 실패하면 깨진 그림만 숨기고 키워드 글자와 설명을 유지한다. 도감 상세·아이콘 보기·모달·본문 툴팁·메모 자동완성·수감자 필터·전역 검색에서 같은 URL 해석과 실패 처리를 사용한다.

## 키워드 전체 감사와 누락 복구

기존 347개에 원본으로 확인한 135개를 추가해 482개다. EGO 스킬·패시브에서 59개, 기프트 기본/강화 효과에서 30개, 2026-03-23 도감 백업 중 현재 원문에 이름이 존재하는 항목에서 46개를 복구했다. 과거 백업의 깨진 이름 조합은 그대로 복원하지 않았다. `참선` (`Zazen`)은 기프트 `거짓 광배` 9752 및 강화 19752/29752의 효과에서 확인했다. 같은 이름의 EGO 패시브 제목만으로 버프를 연결하지 않는다.

`collectEgoKeywordTags`는 각성·침식의 모든 해석 단계와 패시브 본문의 실제 태그를 수집한다. 비어 있던 EGO 112개 중 원본에서 키워드를 찾은 108개의 배열을 복구했다. 나머지 4개에는 값을 만들지 않았다. bootstrap과 메타 재생성도 같은 수집기를 사용한다. 기프트는 대표 분류뿐 아니라 강화 단계별 본문의 키워드까지 읽는다.

스킬·패시브 설명의 `[태그]`는 BattleKeywords·Bufs·BuffAbilities에 더해 `*_SkillTag`(KR/EN/JP)로도 번역한다(2026-09-28). SkillTag 이름은 대괄호를 포함하므로 그대로 넣는다. 이 파일을 읽지 않아 E.G.O 패시브의 상시·사용 효과 구획(`[AlwaysUseEGOPassive2010911]` → "[로보토미 E.G.O::엄숙한 애도 이상 전용 상시 효과]")과 `WinDuelEndSkill`·`AllyKillFail`·`EnemyKillFail`, 영어·일본어의 `CriticalOnSucceedAttackHead`·`WinDuelAttackHead`가 원문 태그로 남았다. DB의 84개 필드는 9/10 추출본 SkillTag 번역으로 고치고 원본을 `../assets/recovery-2026-09-28-skilltags/before.json`에 남겼다. apply-extraction은 기존 `ego_passives` 설명을 다시 쓰지 않는다.

`keyword-icon-variants.json`은 Drive GeneralStatusEffects(하위 정신력 폴더 포함)의 동일 이름 ` 2.png`를 우선한다. 원본 파일명이 `_2.png`인 경우와 Mirror Dungeon 하위 폴더도 포함해 현재 69개 별칭을 적용한다. `restore-artwork.cjs`는 업로드 검증이 끝난 실제 숫자 2 접미 파일에서 이 우선순위를 재생성하며, `Unlock - II` 같은 의미상 단계 별칭은 자동 승격하지 않는다. 숫자 2는 일괄 정답이 아니다. 사용자 확인에 따라 신력 단말기 무기 키워드 9종은 원본(접미사 없음)을 우선하며, 명시적 선택은 자동 2번 연결보다 앞서 적용한다. 커다란 검은 파일명 띄어쓰기로 나뉜 두 원본 중 `when-rending-the-body-with-a-greatsword`를 사용한다. 점혈 홍루의 전용 2번은 다른 캐릭터로 향하던 옛 별칭보다 우선한다. 깊은 들숨·두 번째 마탄·뒤틀린 저주 부적·지네 독의 원본 파일명 차이도 공통 별칭으로 연결했다. 기존 메타 분류가 `기타`인데 필터에 이 값이 없어 선택할 수 없던 문제는 3개 언어의 `기타` 선택지를 추가했다. 내용 확인 없이 버프/디버프 분류를 만들어 넣지 않는다.

`keyword-full-icon-audit.json`은 482개 행의 공통 해석 결과인 464개 URL을 전수 검사한 기록이다. 463개는 로컬 파일 또는 공개 WebP 응답과 보존된 업로드 변환본의 해시가 일치한다. 1개 `공격 레벨+`는 여전히 HTTP 400이며 원본 연결 미확정이다. 기존 개별 아이콘 변환본은 손실 WebP를 포함하므로 PNG와 픽셀 단위 일치라고 해석하지 않는다.

```bash
export LIMBUS_DATA_DIR="../assets/recovery-2026-09-10/complete-data"
export LIMBUS_RECOVERY_ROOT="../assets/recovery-2026-09-10"
export LIMBUS_KEYWORD_HISTORY="../limbus-archive/backups/2026-03-23/keyword_meta.json"
export LIMBUS_KEYWORD_AUDIT="$LIMBUS_RECOVERY_ROOT/keyword-source-audit.json"
npx tsx scripts/sync/identity-data.ts --rebuild-keyword-meta
npx tsx scripts/sync/restore-keyword-catalog.ts "$LIMBUS_KEYWORD_AUDIT"
# 생성된 keyword-catalog-plan.json 검토 후 --fix로 적용
npx tsx scripts/assets/audit-keyword-icons.ts "$LIMBUS_KEYWORD_AUDIT" "$LIMBUS_RECOVERY_ROOT" "$LIMBUS_RECOVERY_ROOT/keyword-full-icon-audit.json"
```

적용 전 `before-keyword-catalog/{keyword_meta,ego}.json`을 보존했고, 변경한 135개 메타와 EGO 108개 배열을 DB에서 다시 읽어 확인했다. 적용 후 같은 입력의 계획은 변경 0개다. 기존 도감 행은 삭제하지 않는다. 일반 동기화에서는 역사 백업 경로를 지정하지 않아도 현재 사용 원문을 수집하며 기존 역사 행을 보존한다.

## 테마팩 합성

`scripts/assets/build-theme-packs.py`는 `../theme-pack-image-work/`의 보존 합성법을 복구한 것이다. `MainUI_MirrorDungeon4_4`의 비닐·마스크·경고·로고, `MainUI_MirrorDungeon6_17`의 익스트림 테두리, Baton 레이어를 사용한다. JSON `uiConfigs`가 배경/보스와 표시 여부를 결정한다.

일반 팩은 420×720 캔버스에 배경 (20,15), 보스 (30,110), 로고 (150,477), 경고 (146,68), 배턴을 쌓고 마스크와 비닐을 적용한다. 익스트림은 배경 (53,46) → 배턴 → 붉은 테두리 (2,18) 순서다. 최종 출력은 416×684 WebP다. 세부 좌표는 코드가 기준이다.

```bash
THEME_PACK_WORK_DIR="../assets/recovery-2026-09-10/theme-complete" \
LIMBUS_DATA_DIR="../assets/recovery-2026-09-10/theme-data" \
LIMBUS_THEME_ASSET_ROOT="../assets/recovery-2026-09-10/theme-originals" \
LIMBUS_COMPOSITION_ASSET_DIR="../assets/recovery-2026-09-10/theme-composition" \
python3 scripts/assets/build-theme-packs.py
```

Pillow가 필요하다. 출력 폴더가 비어 있지 않으면 중단하므로 재생성에는 새 작업 경로를 사용한다. 117개 테마 모두 합성했고 HiddenTheme 별칭을 포함하면 118개 파일이다. 이전에 누락됐던 1122의 `Canto_Pilgrimage`는 UI/Main Menu/Event/Intervallos/Pilgrimage of Compassion에서 찾았다. `theme-complete/diagnostics/missing.json`은 빈 목록이다.

## 백업과 재검증

`before-bootstrap/`, `before-identity-sync/`, `before-mirror-restore/`, `before-sanity-restore/`, `before-artwork-link/`, `before-ego-passives-<실행 시각>/`(`--fix`를 돌릴 때마다 새로 만든다)를 보존한다. 코드 revert가 DB나 Storage를 자동 복원하지 않는다. 복원하려면 해당 백업의 대상 테이블·행·컬럼을 확인해야 한다.

인격 메타데이터와 획득 JSON 수정 전 값은 `before-identity-metadata.json`, 적용 계획은 `identity-metadata-plan.json`에 보존한다. 기존 저장소의 2026-03-23 인격 백업 170개 행도 읽기 전용으로 대조했다. `restore-historical-metadata.ts --source=/path/to/identities.json`이 계획을 만들고 `--apply`가 수동 획득처와 누락 대사를 복구한다. 원본 파일 해시와 적용 계획은 `historical-metadata-plan.json`, 수정 직전 값은 `before-historical-metadata.json`이다. 전체 대사 복구 및 원본에서 빈 대표 키워드는 [데이터 모델](data-model.md)에 구분해 기록했다. 이후 일상 동기화에는 과거 복구 스크립트를 반복 적용하지 않고 `identity-data.ts`를 사용한다.

동기화 후 `/api/revalidate`의 `all-game-data` 범위를 호출한다. 서비스 워커와 서버 캐시는 별개이므로 [개발 문서](development.md)의 Chrome 확인도 수행한다. `test-ego-card-ui.py`, `test-ego-stages.py`, `test_build_theme_packs.py`와 Vitest의 데이터/프레임 검사를 실행한다.


### EGO 이름 패널 원본과 합성 (2026-09-10 후속)

7개 모두 Drive `New_MainUI_Formation_1.png`의 원본 좌표 `(1690, 908, 2048, 1063)`에서 나온 358×155 패널이다. 127개 UI 아틀라스에서 표면 무늬를 대조한 뒤, 해당 영역과 기존 7개 WebP의 **전체 알파 채널이 동일함**을 확인했다. 나사·표면 무늬의 위치도 일치하며 회전·리사이즈·트리밍은 없다. 원본 SHA-256, 알파 SHA-256, 죄악별 파일 매핑은 `public/assets/ego-ui/source.json`의 `sinPanels`에 기록했다.

합성은 원본 RGB에 죄악별 RGB/255를 곱하고 알파를 그대로 유지하는 방식이다. 기존 파일은 손실 WebP이므로 정확한 게임 틴트와 당시 인코더 옵션까지는 확정하지 않았다. `extract-ego-card-ui.py`의 `PANEL_TINTS`는 기존 파일에서 추정한 값이며, `--panels-only`로 **별도 검토 디렉터리**에 원본 패널과 7개 재구성 후보를 생성한다. 현재 검토본은 `../assets/recovery-2026-09-10/ego-panel-reconstruction/`에 있다. 공개 패널 7개와 `EgoDisplayCard`의 레이어·배치·애니메이션은 변경하지 않았다. 원본 패널 확인과 바이트 단위 재현은 구분한다.

### 전체 화면에서 발견한 추가 누락

플래너 축복 10개는 Drive `icons/Mirror Dungeon/Mirror of the Dreaming/StartBuffIcon_100.png`~`109.png`의 개별 원본을 크기·색상·알파 그대로 무손실 WebP로 변환했다. 별빛은 `icons/Resources/MainUI_CommonIcon_4.png` (Drive ID `15lolTXDC_8oi4TzM8QsZQJ-jY-jLcTPJ`)의 `(0, 0, 256, 256)` 셀이다. 다섯 별과 가장자리의 낮은 알파 글로우를 유지한다. Dante의 Grace of Stars 화면과 모양을 대조했고 참고 파일을 가져오지 않았다.

`extract-detail-ui.py`와 `public/assets/game-ui/source.json`에 11개 원본 경로·ID·해시·좌표를 기록했다. 축복·기프트·요약·공유 플랜의 별빛은 `getGameUiAsset('start-buffs/starlight')`의 한 URL을 재사용한다. 플래너와 덱 편성의 수감자 번호도 도감과 같은 `sinners/*` 공통 URL을 사용한다. 누락된 기존 Storage 경로로 별도 요청하지 않는다.

기프트의 레거시 `breath` 필터 값은 유지하되 그림은 도감의 `poise.webp` URL로 해석한다. 플래너 키워드 분포도 같은 해석기를 사용한다. 료슈 `10414`의 레거시 폴더 `Lobotomy E.G.O Faint Aroma Solitude`는 원본의 `Lobotomy E.G.O Faint Aroma & Solitude`로 해석한다. 기본/각성 일러스트와 `_info` 4개 공개 응답의 SHA-256이 보존된 업로드 기록과 모두 일치했다. 덱·공유 플랜·컬렉션·검색·메타·상세 모달도 기존 `getIdentityPortraitUrl`/`getIdentityImageUrl`을 거쳐 저장된 레거시 데이터와 현재 데이터가 같은 URL을 쓴다. DB 값을 덮어쓰거나 이미지를 복제 업로드하지 않았다.

### 기프트 배경과 EX 표시

기존 `icons/ego-gift-bg.webp`는 HTTP 400으로 배경이 로딩되지 않았다. Drive `MainUI_BattleSelection_15.png`의 `(846, 1, 1200, 352)`를 `gift/background`로, `MainUI_MirrorDungeon6_5.png`의 `(1719, 1760, 1838, 1882)`를 `gift/grade-ex`로 추출했다. 354×351 / 119×122 원본 RGBA와 무손실 WebP가 일치한다. Dante Planner의 기프트 배경·EX 표시는 화면으로만 비교했으며 그 사이트의 이미지·JSON은 가져오지 않았다.

`GIFT_BG_URL`과 `GiftGrade`를 도감, 모달, 플래너의 선택·관찰·인벤토리 카드가 재사용한다. 참격·관통·타격 기프트 필터도 공통 갈색 `stats/*` 아이콘을 사용한다. 같은 에셋의 별도 Storage 업로드는 하지 않는다.

기프트 모달의 옛 `icons/ui/credits.webp`도 HTTP 400이었다. 가격 숫자는 유지하고 실패하는 선택적 이미지 요청을 제거했다. 코스트 전용 원본의 연결은 아직 확정하지 않았으며 다른 재화 그림으로 대체하지 않았다.


## 거던 이벤트 원화 연결

이벤트 이미지 업로드 뒤에도 `md_events.image_url` 321개가 전부 NULL인 상태를 확인했다. `scripts/assets/restore-event-image-links.ts`는 `mirror-assets-upload.json`의 정확히 일치하는 이벤트 ID만 연결한다. 모든 대상의 공개 WebP 바이트를 업로드 영수증 SHA-256과 비교한 뒤 빈 컬럼만 갱신한다. 기존 URL·선택지·사용자 기록은 수정하지 않는다.

```bash
npx tsx scripts/assets/restore-event-image-links.ts        # 공개 파일 검증 및 계획
npx tsx scripts/assets/restore-event-image-links.ts --fix  # 확인된 빈 연결만 복구
```

144개 행을 연결하고 DB를 다시 조회해 일치 여부를 확인했다. 목록의 루트 이벤트 146개 중 143개가 포함된다. `971110`, `971111`, `971112`는 제공된 Drive 이벤트 목록에서 동일 ID의 원화를 확인하지 못했으므로 미연결로 유지한다. 하위 판정 이벤트에 그림을 추정 배정하지 않는다. 복구 폴더의 `before-event-image-links.json`은 변경 전 이미지 컬럼 백업이고 `event-image-links-plan.json`은 공개 URL·해시·Drive 원본 ID 근거다. 이미지 업로드와 DB 동기화 후 이 연결 검증을 실행한다.


## 거던 이벤트 그래프 재구축

기존 이벤트 321개·선택지 725개를 `before-event-graph-rebuild/`에 보존한 뒤 Drive 원본에서 다시 생성했다. `rebuild-mirror-events.ts`는 정적 노드 367개를 읽고 테마팩 t1–t6·hidden의 이벤트 풀과 고정 이벤트 배치에서 진입점 154개를 찾는다. 이후 `nextEventID` 연결만 따라 하위 노드 176개를 포함한다. 현재 풀에서 도달하지 않는 원본 37개는 삭제하지 않고 입력과 감사 목록에 보존하며 현재 목록에는 게시하지 않는다. 이름·그림·ID 자릿수로 부모를 추정하지 않는다.

원본 `option.index`, `resultIndex`, `eventResult`를 별도로 저장한다. 736개 결과와 183개 연결, 효과 원본 752개를 독립 대조했다. 결과 원문 배열은 해당 인덱스만 선택하며 하나뿐인 공용 원문만 재사용한다. 여러 문장을 합쳐 모든 보상 분기에 중복 배치하지 않는다. 판정·인원·보정·선택 조건은 원본 구조를 보존한다. 판정에 앞서는 별도 `eventDesc` 원문 3개도 `judgment.intro`에 보존하고 참가자 질문 앞에 표시한다. `971012 → 97101201 → 97101202 → 97101203`과 `90102301`의 자기 재시도를 Dante 한국어 화면에서 비교했다. `971032`의 치사랑/어긋난 트랜지스터, 15+ 판정·본사 보정 +5와 실패 피해 20/12도 대조했다. 참고 사이트의 이미지나 JSON은 수입하지 않았다.

효과·대상·조건·UI 템플릿 12개를 사용자 Drive에서 추가로 받았다. `event-text-originals/sources.json`은 원본 ID와 SHA-256을 기록한다. 표시 문자열의 원본 색상·기울임·크기 태그를 보존한다. ID 990000 이상의 이벤트 임시 버프는 가짜 기프트 카드로 만들지 않고 원본 효과 설명을 표시한다.

스토리·발푸르기스 기프트 파일을 일괄 제외하던 규칙에서 이벤트가 실제 참조하는 기프트를 복구했다. 기프트 46개를 추가했고 원본 WebP를 연결했다. 기존 402개 행은 `before-event-gift-restoration.json`에 보존했다. 재구축 그래프의 실제 기프트 참조 누락은 0개다.

```bash
npx tsx scripts/sync/rebuild-mirror-events.ts
SITE_URL=http://localhost:3001 npx tsx scripts/sync/rebuild-mirror-events.ts --fix
```

일반 `mirror-dungeon-data.ts --events-only`도 같은 생성기를 호출한다. `event-graph-rebuild/`에 입력 해시, 계획, 감사, 독립 비교와 적용 후 전체 필드 재조회 결과가 있다. `replace_md_event_graph` RPC는 두 테이블을 단일 트랜잭션으로 교체한다. 연결 오류 시 기존 데이터가 모두 보존됨을 시험했고 anon/authenticated에는 실행 권한이 없다. 덱·플래너·사용자 테이블은 수정하지 않는다. 적용 후 대상 서버의 캐시를 무효화하고 Chrome 재방문을 검사해야 한다. 빌드만 다시 해도 기존 서버 캐시가 남을 수 있다.

**2026-09-26 고정 층·저주 이벤트 누락 수정:** 테마팩 `mapGenSequence`의 `FILL_EMPTY_EVENT`(고정 층의 이벤트 풀)와 `OVERRIDE_RANDOM_EVENT_BY_CURSE_EVENT`(저주 이벤트)도 진입점으로 읽는다(`sequenceEventIds`). 이전에는 이 두 단계만 쓰는 이벤트 6개가 빠졌다: 테마팩 1118의 회전목마(971057, 깨어질 화포)·굴절된 지난 날의 침낭(971058, 애달픈 날숨)·굴절된 사백송이의 장미(971059), 50개 테마팩의 저주 이벤트 육참(971085)·T사 시간선불지급기(971086)·그 날의 음성 기록(971087). 후속 3개를 더해 이벤트 330→339개, 선택지 736→754개로 교체했다. 기존 행은 테마팩 목록 76건, 영어 이름 오타 1건, 선택지 효과 문구 7건만 바뀌었다. 입력은 2026-09-24 추출본이며, 언어별 하위 폴더를 한 폴더로 모은 링크 폴더와 백업·계획·검증 결과를 `../assets/recovery-2026-09-26-events/`에 두었다.

**2026-09-27 완전히 같은 이벤트 사본:** 원본 필드와 한·영·일 문구가 ID 말고 모두 같은 이벤트는 가장 작은 ID를 대표로 두고, 나머지에 `variant_of`와 대표 그림을 저장한다(`identicalEventCopies`). 현재 가시춘 학생의 수업 복습 971071·971072(→971070)뿐이다. 이벤트 갤러리와 어시스트 인식은 사본을 빼고, ID 조회에는 남긴다. `replace_md_event_graph`는 모든 행을 넣은 뒤 `variant_of`를 채운다(마이그레이션 `event_graph_variants`).

같은 날 거울 던전 이벤트 원본 367개 전체를 게임 데이터의 참조와 대조했다. 사이트에 없는 28개는 모두 현재 거울 던전 밖이다: 선의의 순례 던전(이벤트 던전) 12개, 이전 거울 던전 노드 풀 `generatenodepool-event-3-0`에만 있는 9개(현재 `3-1`에서 빠짐), 스토리 던전 2개, 어디서도 참조하지 않는 5개. 현재 노드 풀 `3-1`의 148개 중 146개가 사이트에 있고, 남은 2개(9010391, 90106602)는 게임 데이터에 원본 노드가 없는 참조다.

남은 원본 연결: 한국어 파일을 찾지 못한 노드 7개(`971100/101/102/103`, `97110001/10101/10302`)는 EN/JP 원문으로 연결을 유지한다. 이미지 연결 추가 조사 후 진입점 154개 중 152개에 원화가 있다. `971071/971072` 두 개는 아직 그림 연결을 확정하지 못했다. 위의 초기 146개 목록 검증은 재구축 이전 기록이다.

추가 한국어 조사에서는 `Text/Json` 루트 4,480개와 KR 하위 폴더 2,116개를 페이지 끝까지 다시 조회했다. 한국어 ActionEvents/AbEvents JSON 104개를 다시 내려받아 디코딩한 내용으로 대조했다. Dante 한국어 화면의 네 도입부(격리실의 관리, 형광빛 일렁임, 제압 직전 불사, 구겨진 문의 옆)는 해당 104개와 기존 complete-data/data/json-originals에서 일치 문장을 찾지 못했다. Drive ID와 파일 해시는 복구 자료의 `event-korean-source-review/manifest.json`에 보존한다. 이는 조사 범위 내 미확인 결과이며 한국어 원본 자체가 존재하지 않는다는 단정은 아니다.

### 사용자 추출본의 한국어 이벤트 복구 (2026-09-12)

`../assets/recovery-2026-09-12/Localize.zip`의 ZIP 무결성을 검사하고 `manifest.json`에 Drive ID·ZIP 및 추출 파일 SHA-256을 기록했다. `kr/KR_ActionEvents_lcbcheckup-re.json`, `kr/KR_AbEvents_lcbcheckup-re.json`을 기존 `complete-data/`에 같은 이름의 `.txt`로 추가했다. 재생성 시 한국어 미확인 노드는 7개에서 0개가 된다. 원문 14개 중 거던 그래프에 있는 7개만 사용한다.

새 계획과 DB를 대조해 이벤트 7개·선택 결과 15개의 한국어 필드만 트랜잭션으로 갱신했다. 적용 SQL과 직전 백업은 위 복구 폴더의 `apply-event-localization.sql`, `before-md_events.json`, `before-md_event_choices.json`이다. 전체 330개 이벤트·736개 결과를 재조회해 번역 외 필드와 행 ID 보존을 확인했다. 기존 영어·일본어·보상·확률·연결을 유지한다. 과거의 한국어 미확인 기록은 당시 조사 결과다.

로컬 서버 캐시를 무효화한 뒤 `e2e/event-korean-restoration.spec.ts`의 Chrome PC/모바일 새로고침·재방문 검사를 통과했다. 원격 배포는 하지 않았다.

### 이벤트 ID와 원화 ID가 다른 경우

5자리 `ChoiceEvent` 파일을 업로더가 제외해 원화가 없는 것으로 잘못 분류한 경우를 수정했다. `971100–971103`은 각각 `10711–10714`, `971110–971112`(김삿갓의 과거 1–3)는 각각 `10902–10904` 원화를 사용한다. Drive EN/JP의 해당 스토리·거던 이벤트 도입부가 일치함을 확인하고 Dante의 실제 장면도 시각적으로 대조했다. 참고 사이트 이미지·JSON은 수입하지 않았다.

`scripts/assets/event-image-source.ts`의 명시적 목록을 업로드 파일명 해석·연결 복구·그래프 재생성이 함께 사용한다. 원본의 `illustId`가 있으면 우선하며, 그 밖의 ID에는 이름이나 번호 규칙으로 그림을 추정하지 않는다. 같은 그림은 `icons/events/{원화ID}.webp` 한 URL로 재사용한다. 5자리 원화 43개를 포함해 거던 업로드 영수증은 983개이며, 이번 DB 변경은 검증된 7개 이미지 컬럼뿐이다.

`event-image-source-review/verified-aliases.json`에 Drive ID·경로·PNG 해시·대응 원문 파일 해시와 비교 화면을 보존했다. 연결 전 공개 WebP 바이트를 영수증 해시와 비교하고 7개 컬럼을 적용 후 재조회했다. 매번의 이미지 연결 직전 상태는 `before-event-image-links-{해시}.json`에 보존한다. 재생성 계획에서도 동일한 7개 URL과 미확정 2개가 유지됨을 확인한다.

## 경험치 계산기 자료

`lib/tools/experience.ts`는 1~60레벨 필요 경험치와 경던 1~9단계 보상을 계산한다. 레벨 표는 [사용자 제공 정리](https://gall.dcinside.com/mgallery/board/view/?id=limbuscompany&no=376686)와 [경험치 채광 표](https://wikiwiki.jp/lcbwiki/経験値採光)를 대조했다(2026-09-11 확인). 1→60은 251,629 EXP다.

보상은 Drive `json/exp-dungeon-{01,02-a1c5p1,03-a1c6p3,04-a1c7p2,05-a1c8p2,06-a1c9p1}.json`의 `normalReward.rewards`, 모듈은 `requiredItem`/`skipRequiredItem`, 티켓 EXP는 `item-200-ticket.json`의 211~214를 사용한다. 보상은 고정 수량이며 확률 분포를 가정하지 않는다. 스킵은 티켓별 1.5배 올림이므로 총 EXP에 1.5를 곱한 값과 일부 단계에서 다르다. 관리자 EXP인 `acquireExp`는 인격 EXP에 합산하지 않는다.

원본과 Drive ID 목록은 `../assets/recovery-2026-09-10/experience-sources/`에 보존했다. `scripts/assets/extract-experience-ui.mjs`는 `icons/Resources/MainUI_CommonIcon_2.png`에서 티켓 I~IV, 엔케팔린·모듈의 확인된 256px 셀을 무손실 WebP로 추출한다. 원본 해시와 좌표는 같은 폴더의 `extracted-assets.json`에 기록하며 공개 URL은 `getResourceIconUrl`을 재사용한다.

인격 획득 정보의 자아 파편은 같은 `MainUI_CommonIcon_2.png`의 12인 파편 셀(6행 0~7열, 7행 0~3열, 0부터 시작)을 사용한다. `extract-shard-ui.mjs`로 분리하고 `SinnerShardIcon`에서 파편 원본만 표시한다. 사용자 결정에 따라 유리 오버레이는 넣지 않는다. 수감자별 공통 URL을 재사용하며 인격 상세 일러스트에는 테두리를 추가하지 않는다.

## 월간 광기 계산기 자료

Drive의 `iap-lunacy`, `iap-membership`, `iap-package`, `pricetier`, `chance-iap`, `item-0-currency`와 KR/EN/JP 상품명을 `../assets/recovery-2026-09-10/lunacy-sources/`에 보존했다. 기본 파일에 시즌 7 `a1c9` 패치를 적용한다. `scripts/sync/build-lunacy-catalog.mjs`가 17개 상품의 가격·보상·구매 제한을 생성하며 입력 ID/해시는 manifest와 catalog-provenance에 남긴다. 가격은 사용자 지정 PC·Steam 한국 원화 기준이다. 판매 종료나 이후 가격 변경은 이 추출본으로 확정할 수 없다.

원본 ITEM 1은 유료, ITEM 2는 무료 광기다. 광기 6종의 초회 두 배 보상은 유료 광기이며 초회 이후 일반 보너스는 무료 광기다. 초회와 일반 보너스를 동시에 더하지 않는다. 월정액은 즉시 유료 650/130과 매일 무료 65/39를 분리한다. 구매일 포함 30일, 재구매는 기간 연장으로 처리하고 잔여 60일을 넘는 구매는 제외한다. 현재 구매 UI는 사용자 결정에 따라 월간 광기 21/22와 일반 광기 충전 1~6 상품을 제공한다. 나머지 상품 자료는 이전 저장 계획의 호환성을 위해 남긴다. 추출권은 집계하거나 광기로 환산하지 않는다.

주간 거던 보너스는 목요일부터 3회, 회당 무료 250이다. 하드는 한 번에 세 보너스를 사용하므로 하드 3클리어도 최대 750이다. 목요일 점검 300은 예상값이며 날짜별 제외가 가능하다. [커뮤니티 상점 정리](https://namu.moe/w/Limbus%20Company/%EC%95%84%EC%9D%B4%ED%85%9C%20%EB%B0%8F%20%EC%83%81%EC%A0%90)와 [거던 안내](https://haleta.tistory.com/277?category=1312929)를 대조했다(2026-09-11). 구매 구성의 근거는 Drive 원본이다.

`extract-lunacy-ui.mjs`는 기존 Drive `MainUI_CommonIcon_2.png`의 확인된 첫 256px 셀을 무손실 WebP로 추출한다. 공통 `getResourceIconUrl('lunacy')`과 콘텐츠 해시를 재사용한다.

광기 상품 원화는 사용자 제공 게임 상점 화면(2026-09-12)과 대조했다. `MainUI_CommonIcon_2`의 256px 셀 기준으로 월간 광기(21)는 열 0·행 1의 장미 9개, 소형(22)은 열 0·행 2의 장미 4개, 광기 모음(6)은 열 7·행 2의 빛나는 보물상자다(0부터 시작). `extract-lunacy-ui.mjs`로 WebP와 URL 버전 해시를 생성하고 `product-icon-provenance.json`에 좌표·원본/출력 해시를 기록한다.


## 익스트림 제약 카드

`mirrordungeon-constraint-07.txt`의 `flooridx`는 0부터 시작하므로 10~14를 화면 11~15층으로 표시한다. 시즌 7의 30개 선택지와 선행 제약 보유 여부에 따른 교체 규칙을 사용한다. 제목은 KR/EN/JP `BattleKeywords_Mirror6/7` 원문에 연결하고 효과 수치는 시즌 7 제약 자료를 우선한다. 시즌 6 번역의 신경 촉진 속도 수치는 시즌 7 값으로 보정한다.

`python3 scripts/assets/extract-constraint-ui.py`는 이름과 거미의 거울 원본 `constraint-ui-originals/MainUI_MirrorDungeon7_12.png`의 거미줄 카드·선택 광택·1~5점 장식·누적 점수 판을 추출한다. RGB와 알파를 유지한 무손실 WebP를 겹쳐 쓰며 선택 상태는 글자 없이 광택으로 표시한다. 같은 명령이 층별 규칙과 다국어 제목을 생성한다.

플래너의 획득 안내는 `md_events.gift_ids/theme_ids`와 테마팩 `specific_ego_gift_ids`를 사용한다. 이벤트 링크는 해당 이벤트 모달로 연결된다. 보스 이미지는 원본 `uiConfigs.bossSpriteId`가 연결된 테마팩에서만 표시한다. 확인되지 않은 보스는 추측해 채우지 않는다. 조합 가능 표시는 해당 층까지 계획한 재료와 최종 기프트 목록을 기준으로 하며 실제 플레이 중 재료 소비를 추적하지 않는다.

2026-09-19 새 추출본 `LimbusAssets-2/Reports/manifest.json`에서 신규 인격 `10416`, `10816`의 원본 `_normal_info`/`_gacksung_info` 네 장(537×827)을 확인했다. `scripts/assets/sync-extracted-identities.cjs --ids 10416,10816 --source /Users/iniru/Downloads/LimbusAssets-2 --output /Users/iniru/Downloads/Limbus-info-repair-2026-09-19 --info-only`로 원본 SHA-256을 검증하고 dry-run 후 `--fix`로 WebP 품질 90 변환본만 교체했다. 기존 가로 대체 이미지 네 장은 같은 출력 폴더의 `before/`에 보존했다. 업로드 영수증과 공개 URL 다운로드 해시가 일치하며 전체 일러스트·스킬·DB는 수정하지 않았다. 공통 이미지 URL은 이 네 파일에만 버전 쿼리를 붙여 기존 가로 이미지 캐시를 피한다. 스크립트는 이제 실제 `_info`를 사용하며, 누락된 세로 이미지를 가로 일러스트로 만들어 덮어쓰지 않는다.

E.G.O 상세의 메인 이미지는 256×256 `_awaken_profile` 확대 대신 새 추출본의 `_cg` 원본(1024×1024, 한 장은 1023×1024)을 사용한다. 2026-09-19 manifest SHA-256 대조 후 111장을 WebP 품질 95로 변환해 기존 EGO 폴더의 `{gameId}_cg-{hash12}.webp`에 추가 업로드하고 공개 다운로드 해시를 검증했다. 기존 프로필과 DB는 보존하며 `lib/generated/ego-artwork.json`에 검증된 ID와 해시만 기록한다. 원본·변환본·계획·영수증은 `/Users/iniru/Downloads/Limbus-ego-artwork-2026-09-19/`에 보관한다. 매핑이 없는 이미지 한 건은 기존 URL을 유지한다.

2026-10-01부터 이 목록을 손으로 늘리지 않는다. `limbus.ego.artwork_url`(마이그레이션 `20261001064045_ego_artwork_url.sql`)에 `{gameId}_cg-{hash12}.webp`의 공개 주소를 저장하고, `getEgoArtworkUrl(profileUrl, artworkUrl)`이 이 값을 먼저 쓴다(없으면 `ego-artwork.json`, 그것도 없으면 프로필). `apply-extraction`은 새 E.G.O의 `_cg`를 품질 95 WebP로 한 번 더 인코딩해 SHA-256 앞 12자리로 이름 붙여 올리고(`upsert: false`, 이미 있으면 건너뜀, `uploads`에 기록해 되돌리기에서 지움) 그 주소를 `ego.artwork_url`에 쓴다. 결과는 `report.json`의 `egoArtwork`(`gameId`, `key`, `url`, `uploaded`)와 `egoWithoutArtwork`(ZIP에 `_cg`가 없는 E.G.O)에 남고, 코드는 `scripts/sync/ego-artwork.ts`다. `ego` 표를 백업·복원하므로 열도 함께 돌아간다. 기존 E.G.O 재구축(`--replace`)은 이 열을 건드리지 않는다. 마이그레이션이 없는 DB에서는 새 E.G.O 반영이 멈추고 자동으로 되돌린다.

`scripts/sync/backfill-ego-artwork-url.ts`(dry-run 기본, `--fix`, `--out <영수증>`)는 이미 있는 E.G.O의 `artwork_url`을 채운다. `ego-artwork.json`에 있는 ID는 그 해시의 주소를(HEAD로 객체 존재 확인 후), 없는 ID는 Storage의 `{id}_cg.webp`가 있으면 그 바이트를 내려받아 SHA-256 앞 12자리 이름으로 그대로 복사해 올리고 연결한다(이 파일은 이미 품질 90 WebP라 95로 다시 인코딩하면 화질만 잃으므로 바이트를 바꾸지 않는다). `artwork_url`이 이미 있거나 프로필이 `_awaken_profile`이 아니거나(21210) `_cg.webp`가 없는 행은 건드리지 않아 다시 실행해도 안전하다.

스킬 S3 단색 배경의 `Icon_skillFrame_Invert.png` 좌표는 장식과 다르다. 0부터 세는 셀 7 `(3,1)`에서 시작해 분노→색욕→나태→탐식→우울→오만→질투 순으로 이어진다. S1/S2는 `Invert_2`의 셀 0/8에서 시작한다. `extract-skill-frames.py`로 52개 무손실 WebP와 버전 해시를 재생성하며 `python3 scripts/assets/test_skill_frames.py`가 S3 죄악 매핑을 검증한다. 참고 원본: https://drive.google.com/drive/folders/1gVBj0xtrWDByf7P1-sgalIJnCL5aiKMr .

## 2026-09-24 추출본 반영

입력은 `~/Downloads/LimbusAssets 2`(실행 `2026-09-24T03-41-12-211Z`)이고 준비 출력은 `~/Downloads/LimbusAssets-sync-2026-09-24/`, 백업·계획·영수증은 `~/Downloads/Limbus-sync-2026-09-24/`에 있다. macOS 압축 해제는 한글 경로를 NFD로 저장하므로 준비 스크립트는 manifest와 디스크 경로를 모두 NFC로 비교한다(CJK 호환 한자 포함).

- 신규 인격 10917(오트쿠튀르:: 수선실 로쟈)은 `identity-data.ts --fix --no-acquisition`으로 추가했다. 획득처는 `syncIdentityAcquisition({ gameIds: ['10917'] })`로 이 인격만 적용했고, 일러스트와 스킬 아이콘은 `sync-extracted-identities.cjs --ids 10917`로 올렸다.
- 신규 E.G.O 20610(거절선포)과 20910(거울촉각)은 `bootstrap-data.ts --ego-ids 20610,20910 --output <작업 폴더>`로 추가했다. 이 옵션은 수감자와 다른 E.G.O를 다시 쓰지 않는다. 폴더명은 기존 규칙인 영어 이름을 따른다. 출시일은 원본 `updatedDate`(2026-08-24, 2026-08-20)를 그대로 쓴다.
- 오트쿠튀르 인격 10416·10816·10917의 256px 아바타 프로필(`_normal_profile`, `_gacksung_profile`)이 빠져 있었다. 스크립트가 `_profile`을 고르지 않았기 때문이다. 이제 기본 동기화가 프로필도 고르고, 2026-09-26 `sync-extracted-identities.cjs --ids 10917,10816,10416 --source ~/Downloads/"LimbusAssets 2" --output ~/Downloads/Limbus-profile-sync-2026-09-26 --profile-only --fix`로 6장을 올렸다. 프로필이 없어 풀 일러 주소를 아바타로 저장한 계정 2개는 `avatar_url`을 `_profile` 주소로 고쳤다.
- 동기화 4단계 스킬 아이콘(`1010104_4` 등)은 #247 이후 `image_id`로 쓰이지만 업로드되지 않았다. `sync-extracted-identities.cjs --skill-variants`로 139개 인격의 152장을 올린 뒤 스킬을 재구축했다.
- 스킬 재구축은 이제 같은 `skill_order/uptie_level/variant_order/name`의 기존 행 ID를 유지한다. 노트 스킬 블럭이 `skills.id`를 참조하기 때문이다. 이 규칙이 생기기 전에 바뀐 1,016개 ID는 원래 값으로 되돌렸다(`skill-id-restore-map.json`).
- `keyword_meta`는 `--rebuild-keyword-meta`로 10개를 추가했다. 새 키워드 아이콘은 태그 이름 대신 버프 데이터의 `iconId`로 원본을 찾는다(예: `NoirScissorAlly` → `ScissorsMark`). 기존 키워드 15개의 수정 이미지는 화살표가 겹친 변형이라 확인 전까지 기존 아이콘을 유지한다.
- 거울 던전 기프트·테마팩·레시피는 변경이 없었고, 수감자와 무관한 적 스킬 이미지는 대상에서 제외했다.

## 2026-10-01 추출본 반영

입력은 `~/Downloads/LimbusAssets_2026-10-01T03-42-03-488Z.zip`(풀어 둔 폴더 `~/Downloads/LimbusAssets-2026-10-01`)이다. 새 ZIP은 `Data/static-data/<분류>/*.json`·`Localize/{kr,en,jp}`·`Reports/` 구조이고, `apply-extraction`의 준비 단계가 `complete-data/*.txt`·`KR|EN|JP/`로 바꾼다. 그래서 이 폴더를 `LIMBUS_DATA_DIR`로 직접 주지 않고 항상 `--zip`으로 넣는다. macOS `unzip`은 한글 이름 때문에 실패하므로 손으로 풀 때는 `ditto -x -k`를 쓴다.

9/24 대비: 파일 8,708 → 9,384(추가 676, 삭제·이름 변경 0, 내용 변경 286), 신규 인격 10315, E.G.O 20211·20510 갱신. 심층 비교에서 나온 동기화 개선:

- 패시브 발동 조건은 `passive.txt`·`passive_check4.txt`만 읽어 `passive-a1c8p2` 같은 장별 파일의 조건(30행)을 놓쳤다. 이제 모든 `passive*.txt`를 읽고(`passive.txt` 우선) 죄악이 여럿인 조건(51개 패시브)을 `passives.sin_requirements`(`[{sin, count}]`, 마이그레이션 `20261001070034`)에 모두 저장한다. `sin_affinity`/`sin_count`는 첫 죄악을 유지한다.
- BattleKeywords의 `flavor`(275개)를 `game_text_refs.flavor/_en/_jp`에, Passive_Ego의 `flavor`(2021111, 2051011)를 `ego_passives.flavor/_en/_jp`(마이그레이션 `20261001072328`)에 저장한다.
- E.G.O 원본의 `additionalList`(전환 가능한 추가 각성 스킬: 20211 2021112 부셰, 20608 2060812 종[終], 21209 2120912 광휘)를 `ego_skills`에 skill_order 3부터 넣는다(`ego-stages.ts`의 `egoSkillSlots`). 기존 E.G.O는 `existing-ego` 단계가 차이를 보고 `--replace`로 다시 쓴다.
- 레시피 공통 데이터는 파일 이름의 시즌 번호로 최신을 고르고(`recipeCommonFiles`, md7 고정 제거), 이벤트 재구성은 `theme-floor-t\d+` 전부를 읽는다(t1~t6 고정 제거).
- 새 칸은 추출본으로 먼저 채웠다(패시브 958행, 키워드 대사 275개). 조건이 비어 있던 30행의 이전 값은 저장소 밖 `Limbus/backups/passives-condition-before-2026-10-01.json`에 있다.
- E.G.O 침식 원화: `ego.corrosion_artwork_url`(마이그레이션 `20261001074122`)에 `{id}_e_cg.webp`(옛 이름 `{id}_cg_e.webp`, 20603 등 2개)의 공개 주소를 둔다. 상세 히어로의 침식 탭이 이 그림을 쓴다. `apply-extraction`은 새 E.G.O의 `e_cg`를 올릴 때 기록하고, 기존 104개는 `backfill-ego-artwork-url.ts --fix`가 채웠다(침식이 없는 기본 x01 E.G.O 12개는 비어 있음).
- `keyword_meta.game_id`(493건)는 이 반영에서 처음 채워진다. 「분홍 리본」은 참조가 둘이라 비어 있고 참격·타격 등 15개는 참조가 없다.

## 데이터 무결성 점검

`npm run audit:data`(`scripts/audit/data-integrity.ts`)가 운영 DB를 공개 키로 읽어 검사한다. 테마팩의 `ego_gift_ids`·`specific_ego_gift_ids`·`fixed_reward_gift_ids`, 기프트 `convert_to`, 조합식 재료·결과, 이벤트의 기프트·테마팩 참조가 실제 행을 가리키는지 본다. 기프트·테마팩·이벤트·인격·E.G.O의 모든 이미지 URL은 HEAD 200이어야 하고, 기프트·테마팩·인격·E.G.O 이름은 en/ja가 있어야 하며, 인격 소속은 `AFFILIATION_MAP`에 번역이 있어야 한다. 이벤트는 이름 칸을 쓰지 않아 이름 검사에서 제외한다.

`.github/workflows/data-integrity.yml`이 매일 06:00 KST, 수동 실행, 동기화·점검 스크립트를 바꾼 PR에서 이를 실행한다. 문제가 하나라도 있으면 목록을 출력하고 실패한다.

게임 원본과의 대조는 원본이 로컬에만 있어 CI에서 돌리지 않는다. 새 추출본을 받으면 기프트 이미지를 원본과 축소 비교해 다른 그림이 올라간 항목을 찾는다(2026-09-26에 9818 남겨진 차원 건틀릿이 이 방법으로 발견됐다). 선의의 순례(1122)는 2025-10-23에 끝난 팩이라 현재 원본에서 풀과 이벤트가 비어 있다. 전용 기프트 9831~9839는 `THEME_EXTRA_EXCLUSIVE_GIFTS`로 넣고, 그중 9836~9839는 어디에서도 참조되지 않아 이 목록을 통해 `ego-gift-story-pilgrimage.txt`에서 가져온다. 테마팩 `egoGiftPool`·`specificEgoGiftPool`·`fixedRewardEgoGifts`나 보스 스테이지 확정 보상에만 있는 기프트는 `mirror-dungeon-data.ts`가 `story-*` 파일을 건너뛰어도 포함된다(오랏줄, N사 고정팀 가방, 떼구름, 소흥주가 이렇게 누락됐었다). 같은 기프트가 건너뛴 파일 여러 곳에 있으면 내용이 가장 많은 항목을 쓴다. 원목 술잔(9781)은 `ego-gift-a1c7p3.txt`에 id만 있는 껍데기로, `ego-gift-story-ycgd-BokGak.txt`에 TIER_3·가격 250으로 들어 있다. 기프트 효과 원문의 `{0}`, `{1}`은 게임이 플레이 중에 채우는 실시간 수치라 `{{live}}` 토큰으로 저장한다(봉이 인형 9242: "(현재 {0}%. 최대 100%)" → "(현재 {{live}}%. 최대 100%)"). 예전에는 0으로 채워 "현재 0%"로 보였다. `convert_to`가 있는 기프트의 `{0}`은 변환 대상 이름으로 채운다.

### 테마팩 화면 설정

`ego_gift_themes`의 `name_color`(이름 색, `uiConfigs.textColor`), `name_segments`(단어별 색, KR/EN/JP `specialName`), `attribute_type`·`attack_type`(팩 속성·공격 유형), `boss_unit_ids`(`uiConfigs.showBossIds`), `is_unrecordable`은 동기화가 원본에서 채운다(`themeNameColor`·`themeNameSegments`·`themeBossUnitIds`). 이름 색이 없는 팩은 기본 베이지(`THEME_PACK_DEFAULT_COLOR`)로 그린다. 원본 specialName에 없는 다색 이름(1126 타래 엮기)은 `THEME_NAME_SEGMENT_OVERRIDES`에 둔다. 예전에 손으로 적던 `lib/data/theme-pack-colors.ts`의 색 표는 없앴다.

### 자리표시 토큰

게임 원문이 플레이 중에 채우는 번호 자리(`{0}`, `{1}`, `{0:F1}`)는 DB에 의미 토큰으로 저장하고, 화면이 라벨(칩)로 그린다. 토큰 문법은 `lib/game-text/placeholders.ts`, 동기화 규칙은 `scripts/sync/placeholder-rules.ts` 한 곳에 있다. 규칙은 원문 필드(버프 id, 기프트 `convertDataList`·`descType`, 이벤트 문구)로 정하고 글자를 보고 추측하지 않는다. 라벨 문구는 `messages/*.json`의 `placeholder.*`, 모양은 `components/ui/PlaceholderLabel.tsx`에만 있어서 바꿔도 재동기화가 필요 없다. 게임의 `{0}`·`{amount}`와 겹치지 않게 이중 중괄호를 쓴다.

| 토큰 | 라벨(ko) | 칩 | 어디서 |
| --- | --- | --- | --- |
| `{{live}}` | 게임 중 표시 | 금색 테두리 + 맥박 아이콘 | `descType`이 있는 기프트의 나머지 자리, 충전 누적 소모량 같은 버프 누적값 |
| `{{potency}}` / `{{count}}` | 수치 / 횟수 | 금색 채움 / 밝은 테두리 | 버프·키워드 설명의 `{0}`(`{0:F1}` 포함) / `{1}` |
| `{{target}}` | 대상 | 붉은 톤 + 조준 아이콘 | 압송 채비(TiedWithRope)처럼 대상이 들어가는 버프(`BUFF_PLACEHOLDER_ROLES`) |
| `{{sinner}}` | 수감자 이름 | 사람 아이콘 | 이벤트 지문·결과문의 번호 자리와 `{affectedTarget}` |
| `{{gift:ID}}` | 기프트 이름 | 기프트 그림 + 이름, 누르면 그 기프트 | `convertDataList`가 있는 기프트의 `{0}`(9227 → `{{gift:9228}}`) |
| `{{value}}` | 값 | 점선 테두리 | 규칙이 없는 자리. 동기화 로그에 `⚠ 분류 안 된 자리표시 {5} (KR_Bufs: XxxBuff)`가 나오면 규칙표에 추가한다 |

`apply-extraction.ts`는 적용 뒤 토큰을 쓰는 열(`PLACEHOLDER_CHECK_COLUMNS`: 기프트 효과, 키워드 설명, 이벤트 지문·결과문)에 `{0}`이나 `{name}`이 남은 행을 세어 경고하고 `report.json`의 `leftoverPlaceholders`에 남긴다. 버프의 "(위력)"·"(횟수)"처럼 게임이 직접 쓴 괄호 글자(산나비(위력), 차원 표류의 "(수치)%")는 자리표시가 아니므로 그대로 둔다. 스킬·패시브·E.G.O 설명은 아래 "게임 원문 저장"대로 원문이라 `{0}`가 남는 것이 정상이고, 이벤트 선택지 문구(`message`)는 토큰 규칙 없이 저장되므로 둘 다 검사하지 않는다.

일반 글자로만 보여 주는 곳(검색 부제, 키워드 검색, 이벤트 제목 대체)은 `placeholdersToPlainText`로 "(수치)"처럼 바꾸고, 키워드 카드 미리보기는 `PlaceholderText`로 칩을 그린다. 어시스트 OCR 대조는 토큰 자리에서 원문을 나눈다.

### 게임 원문 저장과 참조 표

동기화는 스킬·패시브·E.G.O 스킬·패시브·flavor·키워드·기프트 효과를 유니티 태그(`<style>`, `<color>`, `<sprite>` 등)와 `[Id]` 참조를 지우거나 이름으로 바꾸지 않은 원문으로 저장하고, 사이트가 `GameText`(`lib/game-text/rich-text.ts`)로 그린다. 스킬 코인 설명은 본문 뒤에 `<coin=N>…</coin>` 묶음으로 붙는다. 번호 자리는 키워드·기프트·이벤트에서만 토큰이고(위 표), 스킬·패시브·E.G.O는 원문 `{0}` 그대로다. 발동 조건(`activation_condition`)만 내부에서 이름으로 바꾼 사본으로 계산한다.

`[Id]`가 가리키는 키워드·조건 라벨(BattleKeywords, SkillTag의 KR/EN/JP 이름·설명)은 `limbus.game_text_refs`에 있고 `scripts/sync/game-text-refs.ts`(dry-run 기본, `--fix`)가 채운다. 이 표는 `apply-extraction`의 첫 단계(`refs`)이며 `keyword_meta`와 이름이 같은 행을 `keyword_name`으로 잇는다. 표가 없는 DB(마이그레이션 `20261001023933_game_text_refs.sql` 미적용)에서 `--fix`는 백업 단계에서 멈추므로 아무것도 쓰지 않는다. 표 행은 지우지 않는다(원문에 없는 DB 행은 완전성 검사의 누락으로 세지 않는다). 어시스트 OCR 대조와 검색 부제는 `gameTextForScreen`·`gameTextToPlain`으로 태그를 벗기고 `[Id]`를 이름으로 바꾼 글자를 쓴다.

대표 참조(`keyword_meta.game_id`, 2026-10-01): 큐레이션 표 `keyword_meta`(이름이 기본키, 아이콘·분류·최대 중첩·효과 유형)와 참조 표 `game_text_refs`(게임 id가 기본키)는 이름·설명이 겹친다. `keyword_meta.game_id`(nullable, `game_text_refs(id)` 외래 키 `on delete set null`, 마이그레이션 `20261001060026_keyword_meta_game_id.sql`)가 키워드마다 대표 참조 한 행을 가리키고, 사이트는 그 행에서 언어별 이름·설명을 읽는다(`lib/keywords/ref-text.ts`; 언어별로 참조 값이 비어 있지 않을 때만, 아니면 `keyword_meta` 열). 표시의 출처는 참조 표이고, `keyword_meta`의 `name_en`·`name_jp`·`description*` 열은 대체 값이자 되돌리기 안전망이라 동기화가 계속 쓴다. 지우지 않는다(열·행 삭제는 별도 작업). 설정은 keywords 단계(`identity-data.ts --rebuild-keyword-meta`)가 한다: `game-text-refs-rules.ts`의 `selectPrimaryRefs`가 (1) keywords 단계가 그 키워드에 정한 자기 태그가 키워드 참조에 있으면 그 id, (2) 아니면 `keyword_name`이 그 이름인 참조가 하나뿐이면 그것, (3) 여럿이면 KR 인격·E.G.O 스킬·패시브·기프트 원문(`KR_Skills*`·`KR_Passive*`·`KR_EGOgift*`, 적·이상체·원호·튜토리얼 제외)에서 `[Id]`로 가장 많이 쓰인 것(공동 1등이면 정하지 않음)을 고르고, 못 고르면 비워 둔다(사이트는 `keyword_meta` 열을 쓴다). 이미 저장된 id는 규칙이 못 정한 이름에서 유지된다. 참조 표에 아직 없는 id는 쓰지 않고(외래 키), 컬럼이 없으면 계산·보고만 한다. 손으로 쓴 설명(`lib/keywords/description-overrides.ts`의 원호 공격·원호 방어)은 한국어에서 `keyword_meta.description`이 이기고, 참조 설명에 `{0}` 같은 날 자리표시가 남았는데 `keyword_meta`에 라벨 토큰판(`{{potency}}`)이 있으면 그것을 쓴다. 참조 이름에 유니티 태그(`[<s>큰 형님</s>]`)가 있으면 태그를 벗긴 글자를 쓴다. dry-run은 `SYNC_SUMMARY`의 `keywordMeta.gameId`(`set`·`byTag`·`only`·`mostUsed`·`ambiguous`·`none`·`refNotInDb`·`columnMissing`)와 모호·없음 목록을 출력한다. 2026-09-24 추출본 dry-run(컬럼 적용 전): 467개 중 설정 461(자기 태그 460, 같은 이름 하나 1, 가장 많이 쓰임 0), 모호 0, 없음 6(검은 날개·관통·잿빛 탄환·진동 - 보존·참격·타격).
