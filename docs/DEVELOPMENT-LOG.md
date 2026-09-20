# 갈수있슈 — 대전 전체 지도

## 개인 GitHub 저장소에서 시작하기

Node.js 22 이상을 사용합니다. `npm ci` → `npm run assets:restore` → `npm run dev` 순서로 실행하세요.
대용량 지도 타일·이미지·기존 모형은 GitHub 코드 업로드와 분리되어 있습니다. 복원 명령은 현재 공개 사이트에서 `asset-manifest.json`에 기록된 파일을 받고 SHA-256을 검증합니다. 기존 파일이 다르면 덮어쓰지 않고 중단합니다. 사이트 파일이 교체되거나 사이트가 없어지면 복원이 실패할 수 있으므로, 첫 복원 후 `public/`를 별도로 백업해 주세요.
GitHub에는 앱·서버·제작 스크립트·테스트·문서를 넣으며, 원본 `research/` 추출 파일과 이전 Git 이력은 포함하지 않습니다. 재수집 절차는 아래를 참고하세요.

버스·지하철 검색은 `.env.example`을 참고해 `.env.local`에 서버용 ODsay 키를 설정하고 별도 터미널에서 `npm run dev:api`를 실행해야 합니다. 실제 키는 GitHub에 올리지 않습니다.
이번 시뮬레이션용 버스·열차는 `src/hero-vehicles.ts`, 사람은 `src/traveler-model.ts`에서 수정합니다. 단위는 미터, +Y는 앞, +Z는 위입니다. 기존 장소·에셋 갤러리 GLB와 별개입니다.

## 함께 개발하기 — 최신 안내

실행·환경변수·브랜치·모형 규격은 [협업 안내](docs/COLLABORATION.md)를 먼저 확인하세요.
대중교통은 외부 앱으로 이동하지 않는 내부 검색과 `보행 → 지하철 → 환승 → 버스 → 보행` 3D 시뮬레이션을 제공합니다.
운영 사이트는 ODsay 웹 키를 서버 비밀값으로 보관하고 같은 도메인의 API를 통해 대중교통 경로를 조회합니다.
API 키는 `.env.local` 또는 서버의 비밀 변수에만 보관합니다.
아래의 과거 작업 기록에 있는 데이터 수·기능 범위는 해당 작업 시점의 기록입니다.

대전의 동구·중구·서구·유성구·대덕구를 탐색하는 React / MapLibre / Three.js 프로토타입입니다. 기본 화면은 실제 좌표와 건물 외곽선을 쓰는 3D 지도입니다. 사이트를 보는 데 Higgsfield 계정이 필요하지 않습니다.

## 이번에 연결한 기능

- 5개 구 전역 이동·확대·축소·회전, 지역 선택, 장소·시설 검색
- 기록된 건물 17,895개와 도로 구간 42,439개를 자체 호스팅 벡터 타일로 표시
- 확대 시 실제 외곽선을 따라 창문·창틀·옥상 가장자리 생성, 공원에 기존 Higgsfield 수목 모델 배치
- 한빛탑은 실제 OSM 위치와 공식 높이 93m를 기준으로 전망대·첨탑 형태 재구성
- OSM 장소 1,762개(엘리베이터 42개, 화장실 109개 포함), 기존 관광공사 안내 3곳과 한빛탑 소개 병합
- 출발·도착 선택, 계단·휠체어 불가·거친 노면·기록된 급경사 조건을 반영하는 실제 도로 그래프 경로 탐색
- 계산된 경로를 따라 기존 Higgsfield 3D 여행자 모델이 움직이는 45초 미리보기; 정지와 다시 재생 가능
- 이동 조건의 브라우저 내 저장, 위치 권한 요청은 현재 위치 버튼을 누를 때만 실행
- ODsay 기반 버스·지하철 통합 경로, 요금·승하차·환승 순서와 지도 노선 표시
- 경로 구간에 따라 확대된 여행자·버스·지하철 모형이 전환되는 3D 환승 시뮬레이션
- 모바일 지도와 하단 패널, 3D 미지원 기기에는 명확히 표시한 2D 벡터 호환 지도
- 이전 12종 미니어처 부품 작업 공간과 한밭수목원 여행 화면 유지

## 자료 범위와 한계

이것은 대전 전역을 탐색할 수 있는 지도이며 모든 실제 건물·시설의 전수 조사본은 아닙니다. 건물 수는 OSM에 등록된 외곽선 수로, 시 경계 부근의 지도 연결용 여유 범위를 포함합니다. 건물의 실제 높이가 없으면 층수×3.2m 또는 일반 기본 높이를 씁니다. 창문, 옥상, 수목과 한빛탑 세부 치수는 시각적 재구성입니다. 지형 높이·건물 내부·출입구 연결을 측량한 3D 디지털 트윈은 아닙니다.

시설 등록은 당일 정상 운영을 뜻하지 않습니다. OSM의 휠체어 표기는 원문 출처와 함께 보여주고, 빈 항목은 미확인으로 유지합니다. 관광공사 시설 안내도 현장 검증·실시간 정보로 표현하지 않습니다.

경로는 62,166개 노드, 83,926개 간선을 가진 정적 보행 가능 도로 그래프의 A* 결과입니다. `foot/access` 금지 구간을 제외하고 사용자가 선택한 기록된 회피 조건을 적용합니다. 보도와 출입구가 별도로 기록되지 않은 경우도 많습니다. 위치를 가장 가까운 그래프 노드에 연결할 때 생기는 점선은 검증되지 않은 연결이며 각 끝점은 180m 이내로 제한합니다. 연결이 끊기면 경로를 만들어 내지 않고 실패 사유를 표시합니다.

현장 접근성이 검증된 길 안내가 아닙니다. 길 표면·경사·휠체어 정보 중 일부가 없으면 해당 구간 거리를 경고합니다. 시간은 설정 속도(휠체어·유아차 0.8m/s, 그 외 1.1m/s)로 추산하며 신호·대기·휴식을 포함하지 않습니다. 경로 미리보기 캐릭터는 실제 GPS 위치·실시간 이동 속도를 뜻하지 않습니다. ODsay 대중교통 결과는 예상 경로이며 저상버스 배차, 엘리베이터 운영, 실시간 도착을 보장하지 않습니다.

## 원천·라이선스·캠페인 BEFORE 자료

- OSM / Geofabrik South Korea: https://download.geofabrik.de/asia/south-korea.html
- 원본 스냅샷: **2026-09-15T20:20:37Z**, 수집·가공: 2026-09-16
- 대전 경계: OSM relation 2349984, 5개 구 경계 역시 OSM relations
- © OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright
- 가공된 지도·경로 데이터도 ODbL 조건으로 제공합니다. `research/city/*.geojson`, `public/data/places.json`, `public/data/walk-network.json`, `public/data/tiles/`가 재사용 가능한 추출 데이터입니다.
- 한빛탑 공식 형태·높이 안내: https://www.djto.kr/kor/page.do?menuIdx=652
- 기존 관광공사 안내·사진은 `src/places.ts`의 원문 링크와 기존 `public/assets/`를 유지했습니다. 이 안내와 이미지에 ODbL을 새로 적용하지 않습니다.
- 도로 이름의 글리프는 브라우저의 로컬 글꼴로 생성합니다. 외부 글리프 서버를 기다리지 않습니다. 지도 타일과 장소·동선 데이터, 지도 엔진 Worker는 이 사이트 자체에서 제공합니다.
- `research/city/raw-place-rows.json.gz`: 추출 당시의 장소 원본 OSM 태그 행. 빈 값과 미확인을 추측으로 채우지 않았습니다.
- `research/city/raw-place-rows.csv`: 촬영용 열 보기. 원본 태그의 선별된 필드이며 전체 원문은 위 JSON입니다.
- `research/city/raw-incline-rows.json`: 경사 판독 검증에 사용한 실제 원본 경사 값.
- `research/city/manifest.json`, `tiles-manifest.json`, `verification.json`: 데이터 규모·타일·검증 기록.
- 이 제작용 행 자료는 서비스 UI에 넣지 않았습니다.

## 재현

앱: `npm install`, `npm run dev`; 빌드: `npm run build`.

데이터를 다시 만들 때만 Python `osmium`, `shapely` 및 Geofabrik South Korea 원본 PBF가 필요합니다. 원본 국가 PBF는 저장소에 포함하지 않습니다. 기존 `research/city/boundary-geocode.json`은 최초 1회 수집한 대전 경계 응답이며 사용자 검색에 Nominatim API를 호출하지 않습니다.

1. `python scripts/extract-daejeon.py /path/to/south-korea.osm.pbf research/city/boundary-geocode.json`
2. `python scripts/augment-city-water.py /path/to/south-korea.osm.pbf`
3. `node scripts/build-city-tiles.mjs`

스냅샷 교체 시 수집일과 출처 표기, 공식 안내 내용을 함께 검토해야 합니다. 앱에 장기 API 키·서버 인증 정보·사용자 이동 이력은 저장하지 않습니다.

## 기존 정밀 미니어처

Higgsfield 3D project `c49f6c82-c5e7-4d0a-9d49-a7e007e92dfe`, revision 5에서 만든 자산입니다. 절차적 원본은 `design/architecture_revision3.py`, `architecture_revision4.py`, `architecture_revision5.py`, 자산 분리는 `scripts/prepare-architecture.py`입니다. 이 작업 공간은 대전 지형과 구별한 제작용 개념 모형입니다.

## 확인한 범위

TypeScript 컴파일, MapLibre 스타일 검증, 5개 구의 실제 타일 디코딩, 실제 도로 동선 사례, 차단 조건의 우회·실패 처리를 검사했습니다. 사용 가능한 검증 브라우저는 WebGL이 비활성화되어 이 환경에서 실제 GPU 화면 품질은 확인하지 못했습니다.


## 지도 무한 로딩 수정 — 2026-09-16

이전 배포의 지도 초기화가 끝나지 않은 원인은 MapLibre GL JS 6의 별도 Worker 파일이 Vite 배포 결과에 포함되지 않았기 때문입니다. 주 실행 파일은 기본 경로의 `maplibre-gl-worker.mjs`를 찾지만 이전 결과에는 해당 파일이 없었습니다. 공식 Vite 설치 방식인 `?worker&url`와 `setWorkerUrl()`로 약 507KB의 독립 Worker를 명시적으로 묶어 연결했습니다.

공식 참고: https://www.maplibre.org/maplibre-gl-js/docs/

- 모든 지도 요청 주소를 문서 기준 절대 URL로 정규화합니다.
- 지도 스타일 준비와 선택적 3D 디테일 초기화를 분리하고, 기본 지도 타일이 도착한 뒤 세부 모델을 붙입니다.
- 느린 환경에서도 지도 데이터가 도착할 때까지 기다리며 시간 초과로 실패 처리하지 않습니다. 실제 네트워크 오류가 발생한 경우에만 재시도와 2D 호환 지도 선택을 표시합니다.
- 창문 디테일은 PC 50동/6,000개, 모바일 30동/3,000개로 제한하고 수목 표시량과 화면 해상도 상한을 둡니다.
- 세부 모델 오류가 기본 지도의 초기화를 중단하지 않도록 격리하고 콘솔에 구체적인 오류를 남깁니다.
- `node scripts/verify-map-worker.mjs`는 실제 배포 Worker의 존재, 주 파일 연결, 독립 스레드 시작, 대전 스타일과 이미지 목록 처리 응답을 확인합니다. Node의 최소 Worker 환경 어댑터를 사용하므로 브라우저 GPU 검사와는 구별됩니다.
