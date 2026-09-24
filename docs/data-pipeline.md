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

기존 `identity-data.ts` 등의 파서는 준비된 `complete-data`를 입력으로 사용할 수 있다. 그러나 `appearance`는 게임 내부 이름이고 현재 이미지 폴더명과 다를 수 있으므로, 준비 성공만으로 `--fix`를 실행하지 않는다. 이미지 경로·누락·데이터 차이를 검토한 뒤 DB/Storage 적용 범위를 정한다. 이 준비 스크립트는 WebP 변환, 업로드, DB 변경을 수행하지 않는다.

### 테마팩 합성 재사용

사용자가 지정한 iCloud `My Project/무제 폴더/theme-pack-image-work/`는 기존 테마팩 합성 작업 자료다. 저장소의 `scripts/assets/build-theme-packs.py`가 이미 사용하는 비닐·로고·보스·경고·배턴·극한 테두리 합성은 유지한다. `LIMBUS_EXTRACTED_ASSET_ROOT`를 지정하면 새 manifest의 원래 `name`과 `path`로 테마팩/보스 원본을 찾아 합성한다. 이름이 중복되거나 파일이 없으면 중단하며 한국어 폴더명을 추정하지 않는다.

공통 오버레이 원본은 `MainUI_MirrorDungeon4_4.png`, `MainUI_MirrorDungeon6_17.png`, `Baton.png`다. 앞의 두 파일은 iCloud 작업 폴더의 `reference/composition_assets/`에 있고, 세 파일 모두 초기 복구 자료의 `theme-composition/`에 보존돼 있다. 새 묶음의 테마팩 이미지만으로는 공통 오버레이를 대체하지 않는다.

어시스트의 선택 테두리는 Drive 원본 `MainUI_MirrorDungeon4_4.png`(파일 ID `1tu_cNQt61d20xXAWco-sZbEqaFs76h7y`, SHA-256 `8f4d38e68080474f86b9255fa9f8c3e4b373b4bccf3e8e473232fd63b3d1176d`)의 좌상단 기준 영역 `(0, 210, 436, 950)`을 자른 `public/assets/game-ui/themes/selected-frame.webp`다. 크기는 436×740이며 무손실 WebP의 RGBA 픽셀 일치와 중앙 투명도를 확인했다. 선택한 팩에만 원본 테두리를 겹치고 중앙의 선택 문구는 UI에서 현지화한다.

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

`before-bootstrap/`, `before-identity-sync/`, `before-mirror-restore/`, `before-sanity-restore/`, `before-artwork-link/`, `before-ego-passives/`를 보존한다. 코드 revert가 DB나 Storage를 자동 복원하지 않는다. 복원하려면 해당 백업의 대상 테이블·행·컬럼을 확인해야 한다.

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

스킬 S3 단색 배경의 `Icon_skillFrame_Invert.png` 좌표는 장식과 다르다. 0부터 세는 셀 7 `(3,1)`에서 시작해 분노→색욕→나태→탐식→우울→오만→질투 순으로 이어진다. S1/S2는 `Invert_2`의 셀 0/8에서 시작한다. `extract-skill-frames.py`로 52개 무손실 WebP와 버전 해시를 재생성하며 `python3 scripts/assets/test_skill_frames.py`가 S3 죄악 매핑을 검증한다. 참고 원본: https://drive.google.com/drive/folders/1gVBj0xtrWDByf7P1-sgalIJnCL5aiKMr .
