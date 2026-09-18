# 12단계 Builder·캘린더·딥링크 전체 상품 의존 감사

## 결론

브라우저의 `ensureExternalGolfJoinProductsLoaded()` 직접 호출은 9곳이다. 현재 한 번 호출되면 우선 `golfjoin_home_summary.json` 약 5.71MB·11,047행을 읽고, 실패하면 `golfjoin_local_data.json` 약 16.1MB·17,565행 또는 ERP 실시간 수집으로 복구한다.

9곳 중 전체 11,047~17,565개 행사가 실제로 필요한 곳은 없다. 필요한 데이터는 다음 네 종류로 분리할 수 있다.

1. 현재 월과 인접 월의 출발 가능 행사
2. 선택 지역과 월에 속한 행사
3. 이미 선택된 상품군의 구성 상품·가용일
4. `goodSeq + eventSeq` 또는 저장된 상품 ID 한 건

따라서 12단계는 기존 전체 로더를 즉시 삭제하지 않고, 소비자별 작은 조회를 먼저 연결한 뒤 호출 사유 계측이 0건인 것을 확인하는 방식으로 진행한다.

## 현재 파일 규모

| 파일 | 논리 크기 | 행사 수 | 상품 수 | 기간 |
|---|---:|---:|---:|---|
| `golfjoin_home_cards.json` | 273,053 bytes | 511 | 129 | 2026-08-07~2026-09-08 |
| `golfjoin_home_summary.json` | 5,706,480 bytes | 11,047 | 131 | 2026-07-07~2026-12-31 |
| `golfjoin_local_data.json` | 16,102,995 bytes | 17,565 | 163 | 2026-05-12~2026-12-31 |

`golfjoin_home_cards.json`은 메인 카드에는 적합하지만 Builder 전체 달력 범위를 담당하기에는 기간이 짧다. 반대로 홈 요약과 전체 파일은 단일 상품 복귀나 현재 월 달력에는 지나치게 크다.

## 직접 호출자 9곳

| 번호 | 호출자 | 현재 필요한 기능 | 실제 최소 데이터 | 대체 경로 |
|---:|---|---|---|---|
| 1 | `openCalendarSheet()` | 참여 가능 일정 달력 | 표시 월·인접 월 | 월 shard 3개 |
| 2 | `resetBuilderModal()` | Builder 첫 달력 | 현재 월·인접 월 | 월 shard 3개, 화면 먼저 표시 |
| 3 | `continueBuilderAfterLogin()` | 로그인 전 보던 상품상세 복원 | 상품 한 건 | `goodSeq + eventSeq` 직접 조회 |
| 4 | `openBuilderFromRegionSearch()` | 선택 지역 Builder 달력 | 지역+표시 월 | 지역·월 shard |
| 5 | `openMdPickBuilder()` | MD PICK 상품군으로 Builder 시작 | 선택 상품군 | 현재 카드+상품군 가용일 캐시 |
| 6 | `openMdPickBuilderWithCurrentDate()` | 선택 상품·날짜로 Builder 시작 | 선택 행사 한 건 | 현재 상세 객체+가용일 캐시 |
| 7 | `openJoinMyEmptyRecommendRegion()` | 빈 내예약의 지역 추천 | 지역 후보 카드 | 지역 index 또는 지역·월 shard |
| 8 | `continueJoinExternalDetailAfterLogin()` | 로그인 후 알림톡 상세 복원 | 일정 또는 상품 한 건 | 회원 일정 우선, 없으면 직접 조회 |
| 9 | `resumeJoinExternalDeepLinkOnce()` | 초기 딥링크 상세 열기 | 일정 또는 상품 한 건 | bootstrap 일정 우선, 없으면 직접 조회 |

## 위험도 분류

### 바로 제거 가능한 두 호출

- `openMdPickBuilder()`
- `openMdPickBuilderWithCurrentDate()`

두 경로는 진입 전에 이미 현재 카드·상품군·선택 행사 정보가 있다. 전체 상품을 기다리는 것은 기능상 필요하지 않다. 다만 Builder 내부에서 이후 월을 이동할 때 필요한 shard 조회는 별도로 연결해야 한다.

### 직접 조회로 바꿔야 하는 세 호출

- `continueBuilderAfterLogin()`
- `continueJoinExternalDetailAfterLogin()`
- `resumeJoinExternalDeepLinkOnce()`

이 경로들은 전체 목록에서 한 건을 찾기 위해 전체 파일을 읽는다. 딥링크와 로그인 복귀 상태에 `goodSeq`, `eventSeq`, `scheduleId`, `applicationId`를 보존하고, 일정 데이터에서 먼저 찾은 뒤 공개 직접 조회 index를 사용해야 한다.

### shard가 필요한 네 호출

- `openCalendarSheet()`
- `resetBuilderModal()`
- `openBuilderFromRegionSearch()`
- `openJoinMyEmptyRecommendRegion()`

캘린더는 현재 월과 인접 월, 지역 검색은 선택 지역과 월만 읽는다. 월 이동 시 다음 인접 월을 미리 읽되, 전체 기간을 한 번에 받지 않는다.

## 권장 발행 구조

### Root index

`web/product-discovery/<revision>/index.json`

- schema와 revision
- 데이터 기준시각
- 지원 시작·종료 월
- 월 shard 주소와 bytes/hash
- 지역 index 주소
- 직접 상품 index 주소
- 기존 전체 로더 fallback 주소

### 월 shard

`web/product-discovery/<revision>/months/2026-08.json.gz`

- 해당 월에 출발 가능한 행사만 포함
- `goodSeq + eventSeq` 중복 금지
- 날짜·지역·가격·상품군·가용 상태 등 달력/검색 최소 필드만 포함
- gzip, immutable, 해시 검증

### 지역 index

`web/product-discovery/<revision>/regions.json.gz`

- 정규화된 국가·도시별로 관련 월과 상품코드 목록 제공
- 상세 행사 전체를 중복 저장하지 않음

### 직접 상품 index

`web/product-discovery/<revision>/products.json.gz`

- `goodSeq:eventSeq`에서 월 shard와 행 위치 또는 작은 직접 조회 객체 주소로 연결
- 로그인 복귀와 딥링크는 전체 월을 순회하지 않음

## 안전 원칙

- [x] 기존 `ensureExternalGolfJoinProductsLoaded()`는 모든 소비자 전환 전까지 유지한다.
- [x] 신규 index·shard 계약 오류, 404, hash 불일치 시 해당 소비자만 기존 전체 로더로 복구한다.
- [x] Release root는 모든 신규 객체 검증 후 마지막에 교체한다.
- [x] 월 이동·지역 변경·딥링크마다 요청 세대를 사용해 늦은 결과를 폐기한다.
- [x] 회원 일정은 공개 직접 조회보다 회원 bootstrap/cache를 우선한다.
- [x] 각 기존 전체 로더 fallback에는 호출자·사유·Release revision을 기록한다.

## 12단계 세부 작업 순서

- [x] 12-0a 전체 상품 로더 정의와 직접 호출자 9곳을 전수 확인한다.
- [x] 12-0b 현재 파일 크기·행사·상품·월·지역 범위를 수치화한다.
- [x] 12-0c 호출자를 월·지역 shard, 상품군 캐시, 직접 조회로 분류한다.
- [x] 12-1a product-discovery root·월 shard·지역·직접 index 계약을 작성한다.
- [x] 12-1b 현재 운영 데이터로 후보 객체를 로컬 생성하고 전체 원본과 동등성을 검사한다.
- [x] 12-2a 브라우저 loader·캐시·request generation·fallback 계측을 구현한다.
- [x] 12-2b MD PICK Builder 두 경로의 불필요한 전체 로더 대기를 먼저 제거한다.
- [x] 12-2c 캘린더·지역 검색을 월/지역 shard로 전환한다.
- [x] 12-2d 로그인 복귀·딥링크를 회원 일정 우선+직접 조회로 전환한다.
- [x] 12-3 PC·MO·로그인 복귀·빈 나의 모임·MD PICK·Builder 회귀검사를 통과한다.
- [x] 12-4 Gate OFF 발행, Shadow, 제한 활성화, 전체 로더 fallback 실전 복구를 검증한다. — 운영 Cloud Function·HTML 배포, Product Discovery OFF fallback, 같은 revision ON 복원, PC·MO 월 shard 요청과 전체 상품 로더 0건을 확인했다.
- [x] 12-5 종료 판정을 기록한다. — 별도 중앙 2주 관찰은 사용자 결정으로 범위에서 제외한다. 대신 Legacy 전체 상품 fallback과 Product Discovery Gate OFF 복구를 유지하고 Legacy 삭제를 금지한다.

## 12-0 완료 판정

- [x] 전체 로더 직접 호출자가 9곳으로 고정됐다.
- [x] 9곳 모두 필요한 최소 데이터와 대체 경로가 지정됐다.
- [x] 기존 전체 로더를 제거하지 않는 단계적 전환 원칙이 확정됐다.
- [x] 신규 구조 실패 시 소비자 단위 fallback이 유지된다.

## 12-1 계약·로컬 후보 결과

- [x] Release V2의 시작 객체 5개에는 손대지 않고, 기능을 실제로 열 때만 읽는 별도 `web/product-discovery/manifest.json` 루트를 사용한다.
- [x] 변경되지 않은 데이터는 같은 `gpd_` revision과 SHA-256을 만들도록 입력 순서와 객체 키 순서를 정규화했다.
- [x] 월 shard, 지역 index, `goodSeq:eventSeq` 직접 조회표의 JSON Schema와 교차 불변조건 검증을 추가했다.
- [x] 중복 일정, 잘못된 날짜·가격, 월 경계 불일치, 개수 불일치, 잘못된 객체 URL은 root 교체 전에 실패한다.
- [x] 관련 계약 시험 33/33과 서버 전체 시험 133/133을 통과했다.

실제 로컬 운영 스냅샷 후보는 revision `gpd_3742f22695b820a930cd3bcd`, 일정 11,047건, 월 6개, 지역 38개다.

| 지연 로딩 항목 | 원본 bytes | gzip bytes |
|---|---:|---:|
| root manifest | 906 | 441 |
| 월·지역 index | 7,700 | 1,518 |
| 직접 조회표 | 983,405 | 75,487 |
| 2026-08 월 shard 3,094건 | 1,605,984 | 152,694 |
| 기존 전체 홈 요약 11,047건 | 5,706,481 | 515,056 |

달력에서 2026-08을 처음 열 때 필요한 후보 전송량은 manifest+index+8월 shard 합계 gzip 154,653 bytes다. 기존 전체 홈 요약 gzip 515,056 bytes보다 70.0% 작다. 직접 딥링크도 lookup을 포함해 gzip 230,140 bytes이며 전체 요약보다 55.3% 작다. 이 요청들은 첫 화면이 아니라 해당 기능을 열 때만 발생한다.

12-1은 로컬 계약·후보까지만 완료했다. 아직 서버 발행이나 브라우저 사용은 시작하지 않았으므로 현재 운영 동작에는 영향이 없다.

## 2026-08-14 최종 재감사와 종료 판정

- [x] Product Discovery 서버 발행·Shadow·Gate OFF/ON·PC/MO 운영 검증 완료
- [x] 일반 정상 흐름에서 전체 상품 로더 초기 호출 0건
- [x] 전체 상품 로더는 Product Discovery 장애 복구 3곳과 회원 딥링크 복구 2곳에만 존재
- [x] Legacy 경로 8개를 주 경로 3개·장애 fallback 4개·최후 복구 1개로 분류
- [x] 즉시 삭제 후보 0개
- [x] Legacy 감사 전용 테스트 3/3 통과
- [x] 전체 프런트 단위 테스트 147/147 통과
- [x] 중앙 2주 관찰 미실시를 숨기지 않고 Legacy 삭제 금지 조건으로 전환

쉽게 설명하면 사용자가 캘린더나 Builder를 정상적으로 사용할 때는 필요한 달의 작은 파일만 읽습니다. 오래된 전체 상품 로더는 첫 화면에서 실행되지 않고, 신규 데이터가 실패했거나 오래된 딥링크에 상품 식별자가 부족할 때만 화면을 복구합니다. 지금 삭제해도 초기 속도 이득은 없고 장애 복구 능력만 잃으므로 유지합니다.

최종 판정은 **12단계 기능 전환 완료, Legacy 삭제는 범위 제외·금지**입니다. 이번 재감사는 코드와 문서만 확인했으며 운영 배포 변경은 없습니다.
