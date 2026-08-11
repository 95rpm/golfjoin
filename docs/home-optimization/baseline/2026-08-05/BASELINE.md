# 골프조인 메인페이지 0단계 기준선

| 구분 | 내용 |
|---|---|
| 측정일 | 2026-08-05 (Asia/Seoul) |
| 계획 단계 | 0단계 — 기준선 고정과 복구 준비 |
| 작업 범위 | 읽기 전용 진단, 기준선 기록, 복구 절차 초안 |
| 기능 코드 변경 | 없음 |
| 현재 상태 | 부분 완료 — 로그인 PC·MO 콜드/웜 HAR과 모바일 Web Vitals 기준선 완료, 비로그인 PC·MO 정식 HAR과 운영 복구 연습 미완료 |

## 1. 현재 진행 상태

- [x] 로컬 주요 파일의 크기, 수정 시각, SHA-256을 기록했다.
- [x] Git 브랜치, 마지막 커밋, 미커밋 변경의 목적을 기록했다.
- [x] 운영 홈 manifest와 상품군 manifest의 현재 revision을 기록했다.
- [x] manifest가 가리키는 공개 GCS 객체의 크기와 3회 응답 시간을 기록했다.
- [x] 비로그인 PC 운영 URL의 실제 렌더링 상태를 확인했다.
- [x] 골프조인 메인이 정상 노출되는 운영 URL을 확정한다.
- [x] HTML 재등록 후 비로그인 PC에서 골프조인 섹션과 MD PICK DOM을 확인했다.
- [x] 비로그인 PC 같은 브라우저의 반복 페이지 이동 완료 시간을 3회 기록했다.
- [x] 비로그인 PC에서 같은 상품군 상품의 웜 상세 진입을 3회 측정했다.
- [x] 로그인 PC에서 새 탭 초기 진입과 같은 탭 재진입의 자산 증가를 3개 표본으로 기록했다.
- [x] 현재 정상 로컬 소스의 복구 스냅샷을 만들고 격리 폴더 복원 연습을 완료했다.
- [x] 정식 HAR·Performance 측정 실행서와 HAR 개인정보 제거 도구를 준비하고 테스트했다.
- [x] PC 로그인 콜드 HAR run01을 저장·개인정보 제거·분석했다.
- [ ] 비로그인/로그인, PC/MO, 콜드/웜 캐시 기준으로 각각 3회 측정한다.
- [ ] LCP, INP, CLS, long task, 스크롤, 상세 오픈 시간을 측정한다.
- [ ] MD PICK·취향맞춤 이미지의 요청 시작·응답·표시 시점을 측정한다.
- [ ] 복구 절차를 실제로 1회 연습하고 10분 이내 완료 여부를 기록한다.

## 2. 로컬 소스 기준선

### Git 상태

| 항목 | 값 |
|---|---|
| 브랜치 | `260804_office` |
| 마지막 커밋 | `5b1586f8db7dc00b25f4b1e78fec9732467966f2` |
| 커밋 시각 | `2026-08-04 17:07:50 +0900` |
| 커밋 제목 | `260804 final` |

### 주요 파일 해시

| 파일 | 크기 | 수정 시각 | SHA-256 |
|---|---:|---|---|
| `golfjoin_main.html` | 2,724,386 bytes | 2026-08-04 18:00:43 | `A6AA39033861F0EE0B192A6AE008D84C4A5499D68C2C7DC8E073AF9839502C75` |
| `golfjoin_admin_dashboard.html` | 504,455 bytes | 2026-08-03 11:15:33 | `7338805FBF0EC76160BBEA049B1ED492D732A0883ED2F22CF8F0C92FA9E42962` |
| `server/google-sheet-proxy-function/index.js` | 434,225 bytes | 2026-08-04 16:18:08 | `F4ACFD372EE8CCB387E784385BF3620082D74D1599B1D34D8EC186D43E3F0C57` |
| `server/google-sheet-proxy-function/home-products.js` | 8,744 bytes | 2026-08-04 10:18:38 | `AEF19B38034DC6565D0B2479E813B4A5E2DCD56EA067BC583CEF21FDD5B75FA9` |
| `GOLFJOIN_HOME_OPTIMIZATION_FINAL_PLAN.md` | 50,028 bytes | 2026-08-04 18:33:38 | `EF17D2B7F00DD2576D5F1514AED0DA6E2F4F1C23E0C8974CF18ABC96AC60D9DF` |

> 계획서 해시는 이 기준선 문서와 체크박스를 추가하면서 변경될 수 있다. 기능 소스 기준선은 `golfjoin_main.html`과 서버 파일 해시를 사용한다.

## 3. 미커밋 변경 기준선

측정 당시 Git 상태는 다음과 같다.

```text
 M golfjoin_main.html
?? GOLFJOIN_HOME_OPTIMIZATION_FINAL_PLAN.md
```

`golfjoin_main.html`은 마지막 커밋 대비 91줄 추가, 18줄 삭제 상태다. 확인된 변경 목적은 다음과 같다.

- [x] 내예약 로딩 UI에서 흐르는 shimmer를 제거하고 연한 회색 UI 영역과 중앙 공통 로딩을 표시한다.
- [x] 초기 예약 데이터 로딩 중에는 빈 화면보다 로딩 UI를 먼저 표시한다.
- [x] 로그인 회원이 생성·참여한 일정을 일반 추천 섹션에서 제외하고 나의 모임에서만 노출한다.
- [x] 마이메뉴를 열 때 예약 새로고침 상태를 먼저 설정해 첫 렌더가 로딩 상태와 일치하도록 한다.

주의사항:

- [ ] 최적화 구현 전에 현재 미커밋 `golfjoin_main.html`을 별도 복구 가능한 형태로 보존한다.
- [ ] `git reset --hard`, `git checkout --` 같은 명령으로 현재 변경을 제거하지 않는다.
- [ ] 최적화 변경은 위 변경을 기준선으로 삼아 덮어쓰지 않는다.

## 4. 운영 manifest 기준선

### 홈 manifest

| 항목 | 값 |
|---|---|
| URL | `https://storage.googleapis.com/golfjoin-bucket/web/golfjoin_home_manifest.json` |
| HTTP | 200 |
| 응답 시간 | 276ms |
| 크기 | 443 bytes |
| ETag | `4a8ce1791c6f4023a9102778fda3e54b` |
| Cache-Control | `public, max-age=60` |
| schema | `secret-golf-join-home-manifest-v1` |
| generatedAt | `2026-08-04T13:30:55+09:00` |
| activePublicationRevision | `ghc_e59296c905891b101b6525b2` |
| activeCardsObjectName | `web/home-cards/ghc_e59296c905891b101b6525b2.json` |
| availabilityRevision | `gpa_8efb6e29decc5ed8efe8d9c5` |
| minimumAdvanceDays | `7` |
| bookableFrom | `2026-08-11` |

### 상품군 manifest

| 항목 | 값 |
|---|---|
| URL | `https://storage.googleapis.com/golfjoin-bucket/web/product-family/manifest.json` |
| HTTP | 200 |
| 응답 시간 | 70ms |
| 크기 | 608 bytes |
| ETag | `9fa7150740883d2a5548f9404089bc93` |
| Cache-Control | `public, max-age=15, must-revalidate` |
| schema | `golfjoin-product-family-manifest-v1` |
| activePublicationRevision | `pfc_549a82879c8323031a3e7f76` |
| previousPublicationRevision | `pfc_28a8e210d943f00d03457306` |
| sourceCatalogRevision | `2026-08-04T13:30:55+09:00` |
| publishedAt | `2026-08-04T13:31:07+09:00` |
| analysisRevision | `pfa_f947c20758f73f5c7807a293` |
| familyCount | `28` |
| memberCount | `66` |

홈 정적 카드의 `generatedAt`과 상품군의 `sourceCatalogRevision`은 같은 시각이고, 상품군 발행은 12초 뒤다. 현재 두 manifest는 별도 파일이므로 이 12초 사이에는 서로 다른 세대가 선택될 위험이 남아 있다.

## 5. 공개 GCS 객체 기준선

아래 시간은 같은 PowerShell 프로세스에서 `Cache-Control: no-cache`로 각각 3회 내려받은 값이다. 실제 브라우저 캐시 성능과 동일한 값은 아니며, 공개 객체 자체의 대략적인 네트워크 기준선으로만 사용한다.

### 홈 카드

| 실행 | 상태 | 응답 시간 | 크기 |
|---:|---:|---:|---:|
| 1 | 200 | 1,084ms | 215,709 bytes |
| 2 | 200 | 901ms | 215,709 bytes |
| 3 | 200 | 1,061ms | 215,709 bytes |

| 항목 | 값 |
|---|---|
| 평균 | 약 1,015ms |
| ETag | `5715d7726ba34e4e33faaf1743e55782` |
| Cache-Control | `public, max-age=31536000, immutable` |
| SHA-256 | `1055D19B07216252450487D6FD0B16492A0B5AAFEA2410B95DC8047488015369` |

### 상품군 catalog

| 실행 | 상태 | 응답 시간 | 크기 |
|---:|---:|---:|---:|
| 1 | 200 | 596ms | 105,937 bytes |
| 2 | 200 | 537ms | 105,937 bytes |
| 3 | 200 | 509ms | 105,937 bytes |

| 항목 | 값 |
|---|---|
| 평균 | 약 547ms |
| ETag | `28019e4f3072cc4ea189d653dacaf787` |
| Cache-Control | `public, max-age=31536000, immutable` |
| SHA-256 | `B66B36E2BA55AEF6C5E642EE3BF4521CC274CC08540B5F6F6D6257BFC8F16782` |

## 6. 운영 페이지 노출 확인

확인 URL:

```text
https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1
https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1
```

### 6.1 HTML 재등록 전 확인

2026-08-05 최초 비로그인 브라우저 확인 결과:

| 항목 | 결과 |
|---|---|
| PC URL 제목 | `시크릿투어 : 감동은 계획이다` |
| 로그인 상태 | 로그아웃 상태 (`로그인`, `회원가입` 표시) |
| `#joinMdPickSection` | 없음 |
| `[data-join-section]` | 0개 |
| 문서 내 `golfjoin` 문자열 | 없음 |
| 골프조인 관련 class/source | 없음 |
| 전체 HTML 길이 | 약 31,708자 |
| body 높이 | 943px |
| 화면 내용 | 기존 시크릿투어 `국내골프` 빈 영역 |
| 모바일 URL | `www.secret-tour.com`으로 리다이렉트되어 동일 화면 표시 |

최초 판정:

- [x] 최초 확인 환경의 운영 페이지에는 골프조인 메인 소스가 포함되어 있지 않았다.
- [x] 최초 빈 화면의 수치를 골프조인 메인 기준선으로 사용하지 않았다.
- [x] 사용자에게 운영 HTML 재등록을 요청했다.

### 6.2 HTML 재등록 후 확인

사용자가 HTML을 다시 등록한 뒤 같은 운영 URL을 재확인했다.

| 항목 | 결과 |
|---|---|
| 로그인 상태 | 로그아웃 상태 |
| viewport | 1,280 × 720 |
| `#joinMdPickSection` | 정상 생성 |
| `[data-join-section]` | 4개 |
| 문서 전체 이미지 | 75개 |
| 안정화 후 로드된 전체 이미지 | 51개 |
| MD PICK 내부 이미지 | 19개 |
| 안정화 후 로드된 MD PICK 이미지 | 16개 |
| 문서 높이 | 5,852px |
| MD PICK 섹션 시작 위치 | 약 870px |
| 추천여행 대표이미지 위치 | 약 1,025px |
| 취향맞춤 대표이미지 위치 | 약 1,597px |

반복 페이지 이동 완료 시간:

| 실행 | 이동 완료 시간 | 비고 |
|---:|---:|---|
| 1 | 886ms | 이동 직후 MD PICK 3/19 로드, 1초 후 3/19, 3초 후 10/19 |
| 2 | 512ms | 이동 완료 확인, 직후 상세 DOM 계측 연결은 약 9초 뒤 가능 |
| 3 | 481ms | 이동 완료 확인, 직후 상세 DOM 계측 연결은 약 8~9초 뒤 가능 |

| 요약 | 값 |
|---|---:|
| 평균 이동 완료 시간 | 약 626ms |
| 최소 | 481ms |
| 최대 | 886ms |

주의사항:

- [x] 위 이동 완료 시간은 같은 브라우저의 반복 진입 값이며 진짜 콜드 캐시 LCP가 아니다.
- [x] 첫 실행에서 이동 완료 3초 후에도 MD PICK 이미지는 10/19만 로드되어 이미지 지연 현상을 재확인했다.
- [x] 안정화 후에도 lazy 정책에 따라 MD PICK 이미지는 16/19만 로드됐다.
- [x] 대표상품 이미지는 대부분 `loading="lazy"`, `decoding="async"` 상태임을 재확인했다.
- [ ] 브라우저 캐시를 완전히 비운 콜드 진입 3회를 별도로 측정한다.
- [ ] PerformanceObserver 또는 동등한 계측으로 LCP·CLS·long task를 별도로 기록한다.

### 6.3 PC 가로 넘침

1,280px viewport에서 문서 `scrollWidth`는 1,445px로 165px 가로 넘침이 확인됐다.

- [x] 가장 멀리 넘친 요소는 골프조인 카드가 아니라 원 홈페이지의 `.quick_item`, `.btn_quick_allow` 퀵메뉴임을 확인했다.
- [x] 닫힌 `.join-my-drawer`는 화면 왼쪽 바깥에 위치하지만 오른쪽 문서 폭을 늘리는 주원인은 아니었다.
- [ ] 실제 PC 사용자 화면에서도 하단 가로 스크롤이 생기는지 별도로 확인한다.
- [ ] 원 홈페이지 퀵메뉴를 골프조인 영역에서 숨기거나 문서 폭에 포함되지 않게 할지 2단계에서 결정한다.

### 6.4 상품군 상품 상세 웜 진입

측정 상품:

```text
태국 우돈타니 로얄크릭 3박5일 로얄크릭
대표 goodSeq: 30001104
```

같은 페이지와 브라우저 캐시 상태에서 상세를 닫고 다시 여는 방식으로 3회 측정했다.

| 실행 | 클릭 처리 반환 | 상세 모달·여행기간 준비 | 전역 로딩 종료 | 모달 이미지 |
|---:|---:|---:|---:|---:|
| 1 | 3,120ms | 9,034ms | 9,034ms | 19/19 로드 |
| 2 | 3,102ms | 8,631ms | 8,631ms | 19/19 로드 |
| 3 | 3,052ms | 8,829ms | 8,829ms | 19/19 로드 |

| 요약 | 값 |
|---|---:|
| 클릭 처리 반환 평균 | 약 3,091ms |
| 상세 사용 가능 평균 | 약 8,831ms |
| 상세 사용 가능 최소 | 8,631ms |
| 상세 사용 가능 최대 | 9,034ms |
| 최대·최소 편차 | 403ms, 평균 대비 약 4.6% |

관찰 결과:

- [x] 상세가 준비되기 전에는 전역 `상품을 확인하고 있어요` 로딩이 표시됐다.
- [x] 전역 로딩 중 `body`와 문서 overflow가 `hidden`으로 설정돼 배경 스크롤이 잠겼다.
- [x] 상세 모달, 여행기간 옵션, 전역 로딩 종료가 거의 같은 시점에 발생했다.
- [x] 웜 캐시에서도 약 8.6~9.0초가 반복되어 일시적인 단일 네트워크 지연만으로 보기 어렵다.
- [x] 상세를 닫은 뒤 `detailOpen=false`, `loadingOpen=false`, 문서 overflow 복원을 확인했다.
- [ ] 콜드 캐시에서 같은 상품 상세를 3회 측정한다.
- [ ] 상품군이 없는 상품 상세를 같은 방식으로 비교 측정한다.
- [ ] 상세 껍데기만 먼저 여는 신규 구조에서는 100ms 목표를 적용한다.

### 6.5 로그인 PC 초기 진입과 이미지 지연

측정 조건:

| 항목 | 값 |
|---|---|
| 운영 URL | `https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1` |
| 로그인 확인 | 상단 `로그아웃`, `마이페이지` 노출 확인 |
| viewport | 1,604 × 748, DPR 1 |
| 측정 방식 | 로그인 쿠키를 유지한 같은 탭 새로고침 1회 + 새 탭 초기 진입 2회 |
| 캐시 조건 | HTTP 캐시를 강제로 비우지 않은 웜 캐시. 새 탭은 탭 내부 상태만 비어 있는 조건 |
| 수집 단위 | 페이지에서 관측된 고유 자산 URL. 동일 URL의 반복 요청은 1개로 합쳐질 수 있음 |

> 아래 시간은 페이지 이동 시작부터 자산 목록 스캔이 끝난 시점이다. 정식 HAR의 request start, response end, LCP가 아니며, 자산 스캔 자체의 수 초 비용이 포함된다. 따라서 절대 성능 목표가 아니라 요청과 이미지가 늦게 추가되는 순서를 판단하는 기준으로 사용한다.

| 표본 | 진입 반환 | 첫 관측 | 중간 관측 | 안정 관측 |
|---:|---:|---|---|---|
| 1, 같은 탭 첫 재진입 | 806ms | 7.150초: 전체 109, 이미지 47, API 1 | 10.065초: 전체 113, 이미지 47, API 5 | 20.354초: 전체 117, 이미지 50, API 6 |
| 2, 새 탭 초기 진입 | 861ms | 7.049초: 전체 98, 이미지 36, API 1 | 9.363초: 전체 110, 이미지 45, API 3 | 14.632초: 전체 114, 이미지 46, API 6 |
| 3, 캐시가 데워진 뒤 새 탭 | 842ms | 4.078초: 전체 99, 이미지 38, API 1 | 6.529초: 전체 107, 이미지 44, API 3 | 35.001초: 전체 111, 이미지 47, API 3 |

첫 진입에서 관측된 골프조인 정적 데이터는 다음 네 경로다.

- [x] 상품군 `manifest.json`
- [x] 홈 `golfjoin_home_manifest.json`
- [x] revision 홈 카드 JSON
- [x] revision 상품군 catalog JSON

로그인 첫 진입에서 최대 6개까지 관측된 Cloud Function 요청은 다음과 같다. 회원 식별값과 개인정보성 쿼리는 문서에 남기지 않았다.

- [x] `action=home_bootstrap_light`
- [x] 공개 `new_schedule_applications`
- [x] 회원 조건 `new_schedule_applications`
- [x] 회원 조건 `join_applications`
- [x] `action=join_wishes_lookup`
- [x] `action=home_stats`

같은 탭 또는 로컬 캐시가 데워진 뒤에는 뒤의 3개 요청이 발생하지 않고 앞의 3개만 관측되는 회차가 있었다. 이는 첫 진입과 웜 재진입의 네트워크 경로가 실제로 다르다는 뜻이며, 정식 HAR에서 캐시 적중과 호출 조건을 다시 구분해야 한다.

이미지 관찰:

- [x] 로그인 상태에서는 `나의 모임` 섹션이 추가되어 MD PICK 섹션 시작점이 약 1,424px로 내려갔다.
- [x] 페이지 최상단에서 MD PICK 섹션의 19개 이미지 중 9개만 완료 상태였다.
- [x] 새 탭 표본 1에서 상품 대표이미지 7개가 약 7.049초 관측 후부터 9.363초 관측 사이에 뒤늦게 추가됐다.
- [x] 같은 표본에서 `taste_bg2.webp`는 9.363초 이후 14.632초 관측 사이에 추가됐다.
- [x] 새 탭 표본 2에서도 상품 대표이미지 4개가 4.078초 이후 6.529초 관측 사이에 추가됐고, 추가 상품 이미지와 취향맞춤 배경은 그 뒤에 관측됐다.
- [x] 위 결과는 로그인 데이터 지연뿐 아니라 `나의 모임`이 MD PICK을 더 아래로 밀고 대표이미지에 `loading="lazy"`가 적용된 것이 이미지 요청 지연에 함께 영향을 준다는 기존 진단과 일치한다.

원 홈페이지 요청 확인:

- [x] `event/getEventTab.json?eventPlanSeq=3`
- [x] `event/getEventGoodsList.json?eventPlanSeq=3&tabSeq=1`

두 요청은 골프조인 정적·Cloud Function 요청과 별도로 원 홈페이지 자산 목록에서 관측됐다. 골프조인 코드가 새로 만든 호출로 단정하지 않고, 원 게시판 페이지의 기존 호출로 분리해 추적한다.

남은 제한:

- [x] Chrome 캐시를 비활성화한 동일 조건의 run03을 저장하고 3회 기준선을 확정했다.
- [ ] LCP·INP·CLS·long task를 정식 계측한다.
- [ ] `나의 모임`을 닫았다가 다시 열 때 어떤 회원 API가 재호출되는지 별도 기록한다.
- [ ] 실제 모바일 viewport와 UA에서 같은 항목을 측정한다.

### 6.6 PC 로그인 콜드 HAR run01

정식 HAR 3회 중 첫 번째 파일을 분석했다. 상세 보고서는 `docs/home-optimization/measurement/reports/20260805_pc_login_cold_run01.md`에 기록했다.

| 지표 | run01 |
|---|---:|
| 요청 | 121개 |
| DOMContentLoaded | 2,145ms |
| Load | 4,152ms |
| 마지막 요청 종료 | 16,642ms |
| 전송량 | 5,388,106 bytes |
| 이미지 전송량 | 3,351,177 bytes, 62.2% |
| MD PICK 대표이미지 요청 시작 | 약 14,620ms |
| MD PICK 대표이미지 다운로드 | 22~42ms |
| Cloud Function fetch | 6개 |
| 동일 URL 중복 그룹 | 0개 |
| 네트워크 실패 | Supabase 기본 이미지 1건 |

- [x] MD PICK 대표이미지 지연은 이미지 서버보다 8초 타이머와 `requestIdleCallback`에 의한 요청 시작 지연임을 확인했다.
- [x] 로그인 회원 API의 `new schedule → join → wishes → stats` 순차 흐름을 확인했다.
- [x] 원 홈페이지 `getEventTab`, `getEventGoodsList`는 합계 633 bytes, 17ms·50ms로 병목이 아님을 확인했다.
- [x] 같은 조건 run02를 저장하고 개인정보 제거 후 분석했다.
- [x] 같은 조건 run03을 저장하고 3회 편차를 계산했다.

### 6.7 PC 로그인 콜드 HAR run02

정식 HAR 3회 중 두 번째 파일을 분석했다. 상세 보고서는 `docs/home-optimization/measurement/reports/20260805_pc_login_cold_run02.md`에 기록했다.

| 지표 | run01 | run02 |
|---|---:|---:|
| 요청 | 121개 | 123개 |
| DOMContentLoaded | 2,145ms | 1,929ms |
| Load | 4,152ms | 8,760ms |
| 마지막 요청 종료 | 16,642ms | 33,746ms |
| 전송량 | 5,388,106 bytes | 5,524,351 bytes |
| 이미지 전송량 | 3,351,177 bytes | 3,486,938 bytes |
| MD PICK 대표이미지 요청 시작 | 약 14,620ms | 약 8,710ms·16,705ms |
| 동일 URL 중복 그룹 | 0개 | 4개 |
| 중복 이미지 재전송량 | 0 bytes | 482,945 bytes |

- [x] run02에서는 bootstrap이 272ms로 빨랐지만 보조 회원 API가 약 8.76초 뒤에야 시작했다. 서버 응답뿐 아니라 클라이언트의 delay·idle 실행 정책이 시작 지연의 독립 원인임을 확인했다.
- [x] MD PICK 대표이미지는 요청 뒤 18~28ms 만에 받아졌지만 요청 시작 자체가 8.71초·16.71초로 늦었다.
- [x] 캐시 비활성 조건에서 아바타 1종과 취향맞춤 배경 3종이 재요청되어 482,945 bytes가 추가 전송됐다.
- [x] 마지막 요청 종료가 run01보다 102.8% 늦어 2회만으로는 안정된 기준선을 확정할 수 없음을 확인했다.
- [x] 원 홈페이지의 두 이벤트 API는 합계 633 bytes, 각각 20ms·15ms로 다시 병목에서 제외됐다.
- [x] run03을 저장한 뒤 3회 중앙값과 편차를 확정했다.

### 6.8 PC 로그인 콜드 HAR run03

정식 HAR 세 번째 파일을 분석했다. 상세 보고서는 `docs/home-optimization/measurement/reports/20260805_pc_login_cold_run03.md`에 기록했다.

| 지표 | run03 |
|---|---:|
| 요청 | 121개 |
| DOMContentLoaded | 1,986ms |
| Load | 9,003ms |
| 마지막 요청 종료 | 19,016ms |
| 전송량 | 5,622,678 bytes |
| 이미지 전송량 | 3,585,358 bytes, 63.8% |
| Bootstrap | 207ms |
| 보조 회원 API 시작 | 9,660ms |
| MD PICK 지연 프리로드 시작 | 약 17,002ms |
| MD PICK 대표이미지 다운로드 | 19~28ms |
| 동일 URL 중복 그룹 | 1개 |
| 중복 이미지 재전송량 | 326,322 bytes |

- [x] Bootstrap이 207ms로 빨라도 보조 회원 API가 9.66초에야 시작했다.
- [x] MD PICK 지연 프리로드가 약 17.00초에 시작됐지만 실제 다운로드는 28ms 이내였다.
- [x] `woman1.webp`가 같은 실행에서 두 번 요청되어 326,322 bytes가 재전송됐다.
- [x] 마지막 요청은 19.00초에 시작된 `taste_bg3.webp`였고 실제 다운로드는 약 13ms였다.
- [x] Supabase 기본 이미지 DNS 실패가 세 회차 모두 재현됐다.

### 6.9 PC 로그인 콜드 HAR 3회 통합 기준선

통합 보고서는 `docs/home-optimization/measurement/reports/20260805_pc_login_cold_3run_baseline.md`에 기록했다.

| 지표 | run01 | run02 | run03 | 중앙값 | 범위 편차 |
|---|---:|---:|---:|---:|---:|
| 요청 | 121 | 123 | 121 | 121 | 1.7% |
| DOMContentLoaded | 2,145ms | 1,929ms | 1,986ms | 1,986ms | 10.9% |
| Load | 4,152ms | 8,760ms | 9,003ms | 8,760ms | 55.4% |
| 마지막 요청 종료 | 16,642ms | 33,746ms | 19,016ms | 19,016ms | 89.9% |
| 전송량 | 5,388,106 | 5,524,351 | 5,622,678 bytes | 5,524,351 bytes | 4.2% |
| 이미지 전송량 | 3,351,177 | 3,486,938 | 3,585,358 bytes | 3,486,938 bytes | 6.7% |
| Bootstrap | 1,963ms | 272ms | 207ms | 272ms | 646.4% |
| 보조 회원 API 시작 | 6,629ms | 8,757ms | 9,660ms | 8,757ms | 34.6% |
| 마지막 회원 API 종료 | 11,650ms | 11,720ms | 11,543ms | 11,650ms | 1.5% |
| MD PICK 지연 프리로드 시작 | 14,620ms | 16,705ms | 17,002ms | 16,705ms | 14.3% |

- [x] MD PICK의 안정 기준선은 지연 프리로드 시작 중앙값 16,705ms이며, 실제 다운로드보다 요청 시작이 병목이다.
- [x] 로그인 데이터 완료 기준선은 마지막 회원 API 종료 중앙값 11,650ms다.
- [x] DOMContentLoaded·전송량·이미지 전송량은 범위 편차가 10.9% 이하다.
- [ ] Load·마지막 요청 종료는 지연 배경 이미지 때문에 편차가 55.4%·89.9%로 커서 단독 합격 지표로 사용하지 않는다.
- [ ] LCP·CLS·long task·실제 이미지 표시 시점을 trace로 추가 측정한다.

### 6.10 HAR 개인정보 제거 도구 재검증

run03 검사 중 HTTP/2 `:path` 헤더 안의 URL 인코딩 회원값을 추가로 제거해야 함을 발견했다. 제거 도구와 테스트를 보강하고 세 제거본을 모두 다시 만들었다.

- [x] 일반 이메일·URL 인코딩 이메일·휴대폰·Bearer 잔존 0건을 확인했다.
- [x] 요청·응답 쿠키와 응답 본문 잔존 0건을 확인했다.
- [x] 구조화된 민감 필드와 URL 안의 미가림 민감 쿼리 0건을 확인했다.
- [x] 측정 도구 테스트 4/4가 통과했다.
- [x] 상세 기록을 `docs/home-optimization/measurement/SANITIZER_PRIVACY_RECHECK.md`에 남겼다.

### 6.11 PC 로그인 웜 HAR run01

PC 로그인 웜 캐시 3회 중 첫 번째 파일을 분석했다. 상세 보고서는 `docs/home-optimization/measurement/reports/20260805_pc_login_warm_run01.md`에 기록했다.

| 지표 | 콜드 중앙값 | 웜 run01 | 변화 |
|---|---:|---:|---:|
| 요청 | 121개 | 117개 | -3.3% |
| DOMContentLoaded | 1,986ms | 940ms | -52.7% |
| Load | 8,760ms | 2,536ms | -71.1% |
| 페이지 자체 마지막 요청 | 19,016ms | 14,086ms | -25.9% |
| 전송량 | 5,524,351 bytes | 956,189 bytes | -82.7% |
| 이미지 전송량 | 3,486,938 bytes | 297,661 bytes | -91.5% |
| 보조 회원 API 시작 | 8,757ms | 4,139ms | -52.7% |
| 마지막 회원 API 종료 | 11,650ms | 6,054ms | -48.0% |
| MD PICK 지연 프리로드 시작 | 16,705ms | 12,092ms | -27.6% |

- [x] 117개 중 99개 요청의 실제 전송량이 0이었다.
- [x] 상품 대표이미지는 모두 전송량 0으로 캐시에서 처리됐다.
- [x] Cloud Function fetch는 콜드 6개에서 웜 3개로 줄었다.
- [x] 아바타 `woman2.webp` 한 장은 새로 선택되어 297,617 bytes가 전송됐다.
- [x] HAR의 42.18초 마지막 요청은 저장 과정의 포커스·가시성 변경으로 실행된 `/mypage/member` 세션 확인이므로 페이지 자체 Finish와 분리했다.
- [ ] run02·run03을 저장한 뒤 웜 캐시 편차와 캐시 재현성을 확정한다.

### 6.12 PC 로그인 웜 HAR run02 진단 표본

두 측정 사이에 회원 앱 캐시의 60초 TTL이 만료됐고 홈 카드 revision도 `ghc_e592...`에서 `ghc_ae528...`로 바뀌었다. 따라서 이 파일은 동일 조건 반복 기준선에서 제외하고 실제 재진입 진단 자료로 보존한다.

| 지표 | 웜 run01 | 웜 run02 진단값 |
|---|---:|---:|
| 요청 | 117개 | 119개 |
| DOMContentLoaded | 940ms | 1,098ms |
| Load | 2,536ms | 8,558ms |
| 페이지 자체 마지막 요청 | 14,086ms | 18,526ms |
| 전송량 | 956,189 bytes | 1,038,654 bytes |
| 이미지 전송량 | 297,661 bytes | 44 bytes |
| Cloud Function fetch | 3개 | 6개 |
| 마지막 회원 API 종료 | 6,054ms | 11,945ms |
| MD PICK 지연 프리로드 | 12,092ms | 16,516ms |

- [x] HTTP 이미지 캐시는 정상 작동해 기능 이미지는 모두 전송량 0이었다.
- [x] 앱 캐시 만료로 회원 API가 다시 6개가 되고 완료가 콜드 수준으로 늦어졌다.
- [x] 신규 홈 카드 JSON 219,187 bytes가 다운로드됐다.
- [x] HAR 저장 동작이 만든 89.03초 `/mypage/member`는 페이지 자체 Finish에서 제외했다.
- [x] 상세 보고서를 `docs/home-optimization/measurement/reports/20260805_pc_login_warm_run02.md`에 기록했다.
- [ ] 명시적 예열 직후 60초 안에 대체 run02를 다시 측정한다.

### 6.13 측정 중 로컬 기능 소스 동시 변경

웜 run02 HAR 저장 후 검증 도중 로컬 `golfjoin_main.html`이 변경된 것을 확인했으며, 사용자가 알림톡 딥링크 개선 작업이라고 확인했다.

- [x] 측정 시작·복구 스냅샷 해시: `A6AA39033861F0EE0B192A6AE008D84C4A5499D68C2C7DC8E073AF9839502C75`
- [x] 최초 감지 해시: `2195D81C54BE1C7245FCD2C643691573A84C461756EFE7383CB0C9BDF4C164C9`
- [x] 현재 로컬 해시: `F10DABA31F5B510BC6562C0092F6CD8A2D7881DBB1B9E4CCED1B4DDB430845AB`
- [x] 최초 변경은 웜 run02 HAR 저장 16:04:37 이후인 16:06:03에 발생했고, 두 번째 변경은 16:19:38에 발생했다.
- [x] 현재 파일은 스냅샷 대비 외부 딥링크 Promise 잠금 및 `my-section` 로그인 재개 파라미터 보존 관련 25줄 추가, 2줄 제거다.
- [x] 웜 run03은 두 번째 로컬 변경 뒤 저장됐지만 운영 URL을 측정했으므로 배포 증거 없이는 로컬 변경이 반영된 표본으로 보지 않는다.
- [x] 회원별 모임 데이터 로딩 뒤 딥링크 재처리, 로그인 복귀 실패 시 파라미터 복원, 중복 실행 Promise 잠금이라는 변경 목적을 확인했다.
- [x] 사용자가 현재 해시의 HTML을 운영에 재배포할 예정임을 확인했다.
- [x] 이번 측정 작업에서는 기능 파일을 수정하거나 되돌리지 않았다.
- [x] 상세 기록: `docs/home-optimization/baseline/2026-08-05/CONCURRENT_SOURCE_CHANGE.md`
- [ ] 다음 배포 전에 현재 로컬 파일과 실제 배포 대상 파일을 다시 대조한다.

### 6.14 PC 로그인 웜 공식 run02

명시적 예열 직후 60초 안에 대체 run02를 측정했다. 앱 캐시와 HTTP 캐시 조건이 공식 run01과 같아 공식 두 번째 표본으로 채택했다.

| 지표 | 공식 run01 | 공식 run02 | 변화 |
|---|---:|---:|---:|
| 요청 | 117개 | 116개 | -0.9% |
| DOMContentLoaded | 940ms | 913ms | -2.9% |
| Load | 2,536ms | 2,754ms | +8.6% |
| 마지막 요청 | 14,086ms | 19,413ms | +37.8% |
| 전송량 | 956,189 bytes | 548,015 bytes | -42.7% |
| 이미지 전송량 | 297,661 bytes | 56 bytes | -100.0% |
| Cloud Function fetch | 3개 | 3개 | 동일 |
| 마지막 회원 API 종료 | 6,054ms | 5,525ms | -8.7% |
| MD PICK 지연 프리로드 | 12,092ms | 12,395ms | +2.5% |

- [x] 신규 홈 revision은 예열돼 홈 카드 본문 전송량이 0이었다.
- [x] 회원 API는 공식 run01과 같은 3개만 호출됐다.
- [x] CSS·JavaScript·기능 이미지는 모두 캐시에서 처리됐다.
- [x] 마지막 요청 편차는 전송량 0인 취향맞춤 자동 순환이 만든 것으로 확인했다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_warm_run02_retry.md`
- [x] 보강한 `home_stats` 완료 확인 예열 방식으로 공식 run03을 저장했다.

### 6.15 PC 로그인 웜 run03 진단 표본

HTTP 캐시와 홈 revision은 공식 run02와 같았지만 회원 API가 6개 실행돼 앱 캐시 조건이 달랐다. 공식 세 번째 표본에서는 제외한다.

| 지표 | 공식 run02 | run03 진단값 |
|---|---:|---:|
| 요청 | 116개 | 120개 |
| DOMContentLoaded | 913ms | 2,699ms |
| Load | 2,754ms | 5,948ms |
| 마지막 요청 | 19,413ms | 27,451ms |
| 전송량 | 548,015 bytes | 555,614 bytes |
| 이미지 전송량 | 56 bytes | 56 bytes |
| Cloud Function fetch | 3개 | 6개 |
| 마지막 회원 API 종료 | 5,525ms | 17,487ms |
| MD PICK 지연 프리로드 | 12,395ms | 18,048ms |

- [x] CSS·JavaScript·기능 이미지는 모두 캐시에서 처리됐다.
- [x] 현재 홈 카드 revision은 전송량 0으로 재사용됐다.
- [x] 느린 회원 API 폭포 때문에 로그인 데이터 완료가 17.49초로 지연됐다.
- [x] 고정 15초 예열은 서버가 느릴 때 캐시 완료를 보장하지 못할 수 있다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_warm_run03.md`
- [x] `home_stats` 완료 확인 방식으로 대체 공식 run03을 측정하고 공식 표본으로 채택했다.

### 6.16 PC 로그인 웜 공식 run03

캐시 만료 후 예열을 시작하고 `home_stats`가 실제로 끝난 것을 확인한 뒤 즉시 대체 run03을 측정했다.

| 지표 | 공식 run03 |
|---|---:|
| 요청 | 117개 |
| DOMContentLoaded | 832ms |
| Load | 4,019ms |
| 페이지 자체 마지막 요청 | 19,472ms |
| 전송량 | 557,071 bytes |
| 이미지 전송량 | 44 bytes |
| Cloud Function fetch | 3개 |
| 마지막 로그인 관련 API 종료 | 7,499ms |
| MD PICK 지연 프리로드 | 12,470ms |

- [x] 공식 run01·run02와 같이 로그인 초기 Cloud Function은 3개만 호출됐다.
- [x] 홈 카드 revision과 상품 대표이미지는 재전송량 0이었다.
- [x] 개인정보 제거본의 이메일·휴대폰·토큰·쿠키·본문·민감 쿼리 잔존은 모두 0건이다.
- [x] 저장 과정의 `/mypage/member` 요청은 페이지 자체 완료에서 분리했다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_warm_run03_retry.md`

### 6.17 PC 로그인 웜 공식 3회 기준선

동일한 HTTP·앱 캐시 조건의 공식 세 표본으로 중앙값을 확정했다.

| 개선 전 기준 | 중앙값 | 상대 범위 |
|---|---:|---:|
| DOMContentLoaded | 913ms | 11.8% |
| Load | 2,754ms | 53.8% |
| 마지막 로그인 관련 API 종료 | 6,054ms | 32.6% |
| MD PICK 지연 프리로드 | 12,395ms | 3.0% |
| 실제 전송량 | 557,071 bytes | 73.3% |
| Cloud Function fetch | 3개 | 0% |

- [x] MD PICK 지연 프리로드는 이미지 캐시 여부와 무관하게 약 12초대에 실행되는 구조임을 재확인했다.
- [x] CSS·JavaScript·상품 이미지는 웜 캐시에서 재전송되지 않는다.
- [x] 3회 통합 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_warm_3run_baseline.md`
- [ ] Load와 보조 일정 API 시점 편차는 Performance trace에서 JavaScript 실행 지연 여부를 확인한다.

### 6.18 알림톡 딥링크 HTML 재배포 경계

현재 로컬 HTML은 기존 공식 HAR을 수집한 운영 HTML과 다를 수 있다. 사용자가 아래 변경을 포함한 현재 파일을 운영에 다시 배포할 예정이다.

- [x] 회원별 모임 데이터 로딩 후 딥링크 재처리: `golfjoin_main.html:37258`
- [x] 로그아웃→로그인 복귀 시 대상을 못 찾으면 딥링크 파라미터 복원: `golfjoin_main.html:42522`
- [x] 여러 초기화 경로가 겹쳐도 한 Promise를 재사용해 모달 단일 실행: `golfjoin_main.html:42753` 이후
- [x] 배포 대상 로컬 SHA-256: `F10DABA31F5B510BC6562C0092F6CD8A2D7881DBB1B9E4CCED1B4DDB430845AB`
- [x] 기존 PC 로그인 콜드·웜 공식 HAR은 배포 전 기준선으로 보존한다.
- [x] 사용자가 배포 완료를 알렸고 2026-08-05 16:55 KST 운영 응답 200과 세 코드 마커를 확인했다.
- [x] 운영 응답 식별값: UTF-8 2,694,862 bytes, SHA-256 `83A4D89295343EC8D3AB41EB1FD3AFC898206239F4C8C9A042D33439DB25AC1F`
- [ ] 일반 메인 로그인 콜드·웜 각 1회로 네트워크 경로와 주요 지표를 비교한다.
- [x] 배포 후 로그인 HTTP 콜드 run01을 저장·분석했다. 다만 Cloud Function이 3개만 실행돼 앱 캐시 웜 혼합 진단 표본으로 분리했다.
- [ ] 회원 앱 캐시 만료를 확실히 한 대체 콜드 run01을 저장한다.
- [x] 진단 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_postdeploy_cold_run01.md`
- [x] 대체 콜드 run01에서 Cloud Function 6개를 재현하고 공식 배포 후 run01로 채택했다.
- [x] 요청·DOMContentLoaded·Load·전송량·이미지·MD PICK 시점은 기존 콜드 기준의 20% 안이다.
- [ ] 마지막 로그인 API 종료가 26.5% 늦어 같은 조건 run02·run03을 추가 측정한다.
- [x] 공식 run01 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_postdeploy_cold_run01_retry.md`

### 6.19 상세 모달 스크롤 고정 로컬 변경

배포 후 콜드 run01 측정 중 현재 로컬 HTML에 상세 모달 스크롤 잠금·복원 작업이 추가됐다. 아직 운영 반영 여부는 확인되지 않았으므로 앞의 운영 HAR과 분리한다.

- [x] 현재 로컬 SHA-256: `D46F40D5F6EA800DF28AC15004179A11E92753816701FD4F1AF4155566AB2764`
- [x] 상세 열기 전 현재 좌표를 저장하고 body를 fixed 처리한다.
- [x] 상세 닫기 시 기존 body 스타일과 정확한 좌표를 복원한다.
- [x] 알림톡 딥링크는 나의 모임 섹션 이동 후 좌표를 상세 모달 기준점으로 전달한다.
- [x] PC와 모바일 공통 경로에 적용됐다.
- [x] 사용자가 JavaScript 문법 검사와 스크롤 잠금·복원 단위 테스트 통과를 확인했다.
- [ ] 현재 작업 폴더에는 단위 테스트 파일·로그가 없어 통과 결과는 사용자 제공 근거로 분류한다.
- [x] 사용자가 운영 배포 완료를 알렸고 2026-08-05 17:13 KST 운영 응답 200과 다섯 변경 마커를 확인했다.
- [x] 운영 응답 식별값: UTF-8 2,697,492 bytes, SHA-256 `75614E46A010CD0AEBCA9B9E73464F79134DAEE7F495403AAE2063B7348D3544`
- [x] 이전 알림톡 배포 버전의 콜드 run01은 참고 표본으로 보존하고 현재 버전의 중앙값에는 섞지 않는다.
- [x] 현재 스크롤 수정 버전 기준 콜드 run01부터 다시 측정한다.
- [ ] 배포한다면 상세 열기 전·열린 동안·닫은 후의 `scrollY`와 가로 스크롤을 PC·MO에서 측정한다.
- [x] 현재 스크롤 수정 운영 버전 로그인 콜드 run01을 저장하고 공식 첫 표본으로 채택했다.
- [x] 요청·DOMContentLoaded·Load·페이지 마지막 요청·전송량·이미지·회원 API·MD PICK 시점이 모두 기존 콜드 기준의 20% 안이다.
- [x] run01 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_scrollfix_cold_run01.md`
- [x] 같은 조건의 run02·run03을 추가한다.
- [x] 현재 스크롤 수정 운영 버전 로그인 콜드 run02를 공식 두 번째 표본으로 채택했다.
- [x] run02의 요청·초기 처리·전송량·이미지·MD PICK 시점은 기존 기준의 20% 안이다.
- [x] 마지막 로그인 API 종료는 기존보다 20.4% 늦어 run03 중앙값으로 최종 판정한다.
- [x] run02 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_scrollfix_cold_run02.md`
- [x] 현재 스크롤 수정 운영 버전 로그인 콜드 run03을 공식 세 번째 표본으로 채택했다.
- [x] 현재 버전 3회 중앙값과 편차를 확정했다.
- [x] 요청·DOMContentLoaded·Load·전송량·이미지·MD PICK은 배포 전 대비 회귀가 없다.
- [x] 마지막 로그인 API 종료 중앙값은 14,025ms로 배포 전보다 20.4% 늦다.
- [x] 공개 일정 응답 후 `join_applications` 시작까지 2.17~2.62초 처리 공백이 3회 반복됐다.
- [x] run03 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_scrollfix_cold_run03.md`
- [x] 3회 기준선: `docs/home-optimization/measurement/reports/20260805_pc_login_scrollfix_cold_3run_baseline.md`
- [ ] Performance trace에서 Builder 일정 행 병합·캐시 동기화·upsert 구간을 우선 분석한다.
- [ ] 차이가 20% 이상이거나 API 호출 수가 달라지면 해당 공식 3회를 다시 측정한다.
- [x] 현재 3회 표본을 배포 후 안전 확인값으로 남기고 Performance trace 측정을 시작했다.
- [ ] 알림톡 딥링크 3개 시나리오와 모달 단일 오픈을 기능 검증한다.

### 6.20 현재 운영 버전 로그인 PC Performance trace run01

현재 스크롤 수정 운영 버전의 초기 진입을 Performance 패널로 측정했다. HAR의 2.17~2.62초 구간이 서버 응답 뒤 데이터 병합 때문인지, 메인 스레드 렌더 때문인지 분리하는 것이 목적이다.

| 지표 | run01 |
|---|---:|
| trace 이벤트 | 182,357개 |
| long task | 10개 |
| long task 합계 | 12,106ms |
| 최대 long task | 3,157ms |
| 예약된 전체 홈 렌더 3회 | 약 7,192ms |
| 예약된 MD PICK 단독 렌더 3회 | 약 1,707ms |
| 두 렌더 경로 합계 | 약 8,899ms, long task 합계의 73.5% |
| 일정 API 완료 → `join_applications` 시작 | 55.7ms |

- [x] 일정 API가 끝난 뒤 다음 API까지 실제 trace 간격은 55.7ms였다.
- [x] `scheduleHomeRender()` → `renderJoins()`가 초기 진입 중 세 번 실행되고 최대 3.16초를 점유했다.
- [x] `scheduleMdPickSectionRender()` → `renderMdPickSectionOnly()`도 세 번 실행되고 최대 840ms를 점유했다.
- [x] HAR의 공백을 응답 후 Builder 행 병합·upsert만의 비용으로 본 기존 가설을 수정했다.
- [x] 현재 1순위 병목은 초기 데이터 도착 때마다 반복되는 전체 홈 렌더와 MD PICK 중복 렌더다.
- [x] 같은 조건 run02에서 횟수와 점유 시간이 반복되는지 확인했다.
- [x] 같은 조건 run03에서 3회 반복 여부와 중앙값을 확정했다.
- [x] 3회 중앙값을 확정하기 전 기능 코드는 수정하지 않았다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_scrollfix_performance_run01.md`

### 6.21 현재 운영 버전 로그인 PC Performance trace run02

run01 다음 날 같은 운영 코드와 로그인 조건으로 두 번째 Performance trace를 측정했다. 함수 위치와 로컬 HTML 해시가 run01과 같고, 원본은 Git 제외·안전 분석본은 개인정보 0건을 확인했다.

| 지표 | run01 | run02 |
|---|---:|---:|
| long task 수 | 10개 | 8개 |
| long task 합계 | 12,106ms | 9,377ms |
| 최대 long task | 3,157ms | 3,774ms |
| 전체 홈 렌더 | 3회·약 7,192ms | 2회·약 4,728ms |
| MD PICK 단독 렌더 | 3회·약 1,705ms | 2회·약 938ms |
| 두 렌더 함수 합계 | 약 8,897ms | 약 5,665ms |
| 일정 API 완료 → `join_applications` 시작 | 55.7ms | 52.6ms |

- [x] 반복 전체 홈 렌더와 MD PICK 단독 렌더가 두 번째 trace에서도 재현됐다.
- [x] 호출 횟수는 3회에서 2회로 줄었지만 전체 홈 렌더 한 번의 최대 시간은 3.16초에서 3.77초로 늘었다.
- [x] 일정 응답 완료 후 다음 API까지는 다시 약 53ms여서 응답 후 2초대 병합 가설은 지지되지 않았다.
- [x] 데이터 도착 시점에 따라 렌더 예약이 합쳐지는 정도가 달라진다는 추론을 run03 검증 대상으로 남겼다.
- [x] run03을 저장하고 3회 중앙값·편차와 최종 병목 우선순위를 확정했다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_pc_login_scrollfix_performance_run02.md`

### 6.22 현재 운영 버전 로그인 PC Performance trace run03

같은 운영 코드와 로그인 조건으로 세 번째 Performance trace를 측정했다.

| 지표 | run03 |
|---|---:|
| long task 수 | 7개 |
| long task 합계 | 7,592ms |
| 최대 long task | 2,846ms |
| 전체 홈 렌더 | 3회·약 3,702ms |
| MD PICK 단독 렌더 | 2회·약 912ms |
| 두 렌더 함수 합계 | 약 4,614ms |
| 일정 API 완료 → `join_applications` 시작 | 46.9ms |

- [x] 같은 전체 홈 렌더와 MD PICK 렌더 경로가 세 번째 trace에서도 재현됐다.
- [x] 전체 홈 렌더 세 번 중 한 번은 13.5ms로 빠르게 끝났고 두 번은 약 2.82초와 0.87초였다.
- [x] 응답 완료 후 다음 API까지는 다시 50ms 안팎이었다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_pc_login_scrollfix_performance_run03.md`

### 6.23 현재 운영 버전 로그인 PC Performance trace 3회 기준선

| 개선 전 기준 | 중앙값 | 상대 범위 |
|---|---:|---:|
| long task 합계 | 9,377ms | 48.1% |
| 최대 long task | 3,157ms | 29.4% |
| 부트스트랩 직후 microtask | 2,989ms | 21.1% |
| 전체 홈 렌더 함수 합계 | 4,728ms | 73.8% |
| MD PICK 렌더 함수 합계 | 938ms | 84.6% |
| 두 렌더 함수 합계 | 5,665ms | 75.6% |
| 일정 API 완료 → 다음 API | 52.6ms | 16.8% |

- [x] 반복 전체 홈 렌더와 MD PICK 단독 렌더를 1순위 메인 스레드 병목으로 확정했다.
- [x] HAR의 2초대 구간을 응답 후 데이터 병합만의 비용으로 본 가설을 기각했다.
- [x] 개선 전 중앙값을 고정했다.
- [ ] 주요 실행시간 상대 범위가 20%를 넘어 Phase 0 수치 편차 통과 조건은 미충족이다.
- [x] 편차 자체를 데이터 도착 순서에 민감한 렌더 예약 구조의 문제로 기록했다.
- [x] 3회 기준선: `docs/home-optimization/measurement/reports/20260806_pc_login_scrollfix_performance_3run_baseline.md`

### 6.24 PC 상세 모달 스크롤·로그인 딥링크 운영 검증

로그인된 실제 Chrome 운영 탭과 1,440×900 viewport에서 기능 코드를 바꾸지 않고 검증했다.

| 검사 | 결과 |
|---|---|
| 골프조인 영역 오른쪽 넘침 | 0개 |
| 완료 이미지 중 깨진 이미지 | 0개 |
| 상세 실제 잠금 좌표 | 1,287px |
| 열린 동안 body | fixed, `top: -1287px`, 배경 이동 없음 |
| 닫은 후 좌표 | 1,287px 정확히 복원 |
| 로그인 딥링크 모달 | 1개 open |
| 딥링크 기준 좌표 | 605px |
| 딥링크 닫은 후 좌표 | 605px 정확히 복원 |
| 딥링크 파라미터 | 처리 후 URL에서 제거 |

- [x] PC 상세 모달의 열기·잠금·닫기 복원을 운영에서 검증했다.
- [x] 로그인 상태 나의 모임 딥링크가 회원 데이터 로딩 후 대상 일정을 한 번 열었다.
- [x] 원 홈페이지 우측 `.quick_item`의 일시적인 문서 넘침과 골프조인 내부 넘침을 분리했다.
- [x] 골프조인 내부에는 오른쪽 viewport 초과 요소가 없었다.
- [ ] 실제 모바일 검증은 데스크톱 UA가 모바일 URL을 `www`로 리디렉션해 수행하지 못했다.
- [ ] 정식 LCP·INP·CLS는 Chrome 읽기 전용 자동화 범위에서 추출할 수 없어 수동 DevTools 또는 페이지 계측이 필요하다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_pc_scroll_deeplink_validation.md`

### 6.25 모바일 레이아웃·상세 모달 스크롤 운영 검증

Chrome Device Toolbar의 모바일 기기 모드와 로그인된 운영 페이지에서 기능 코드를 바꾸지 않고 검증했다. 모바일 URL이 `www`로 리디렉션되지 않고 `m.secret-tour.com`에 유지됐다.

| 검사 | 결과 |
|---|---|
| 최초 viewport / document scrollWidth | 412px / 412px |
| 좁아진 viewport / document scrollWidth | 321px / 321px |
| 나의 모임 / 해외조인 BEST 첫 카드 x | 25px / 25px |
| 상세 실제 잠금 좌표 | 1,241px |
| 열린 동안 body | fixed, `top: -1241px`, 배경 이동 없음 |
| 닫은 후 좌표 | 1,241px 정확히 복원 |
| 완료 이미지 중 깨진 이미지 | 0개 |

- [x] 모바일 문서 전체의 가로 넘침이 없었다.
- [x] 나의 모임과 해외조인 BEST의 첫 카드 시작 위치가 두 viewport에서 모두 일치했다.
- [x] 상세 모달을 여는 동안 페이지 좌표가 고정되고 닫은 뒤 정확히 복원됐다.
- [x] 닫은 뒤 잠금 클래스와 inline body 스타일이 제거됐다.
- [ ] 정식 모바일 Web Vitals와 콜드·웜 HAR 3회는 별도 성능 측정으로 남아 있다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mobile_scroll_layout_validation.md`

### 6.26 모바일 검증 종료 시 새 로컬 HTML 경계

최종 해시 검사에서 측정 작업이 편집하지 않은 `golfjoin_main.html`의 새 로컬 변경을 확인했다.

- [x] 이전 SHA-256: `D46F40D5F6EA800DF28AC15004179A11E92753816701FD4F1AF4155566AB2764`
- [x] 현재 SHA-256: `CFD15EAB98F445B0E6A182E0560F7B890BA939076E68C3749D98DE6154A1D5E8`
- [x] 현재 크기·수정 시각: 2,728,188 bytes, 2026-08-06 09:56:50 KST
- [x] 사용자 기능 소스를 되돌리거나 덮어쓰지 않았다.
- [x] 기존 trace와 새 로컬 파일을 같은 소스 버전으로 간주하지 않는다.
- [x] 사용자가 현재 로컬 변경은 상세 모달이 열릴 때 뒤 화면이 사라지는 현상 수정본이며 운영 배포를 완료했다고 확인했다.
- [x] 상세 기록: `docs/home-optimization/baseline/2026-08-05/CONCURRENT_SOURCE_CHANGE.md` 7절

### 6.27 모바일 로그인 콜드 Web Vitals run01

상세 모달 배경 보존 수정 운영 배포본에서 모바일 로그인 사용자 흐름을 Performance trace로 측정했다.

| 지표 | run01 | 판정 |
|---|---:|---|
| LCP | 1,295.655ms | 양호 |
| CLS | 0.205466 | 개선 필요 |
| INP 후보 | 650.730ms | 느림 |
| 초기 30초 long task | 15개·17,093.711ms | 개선 필요 |
| 전체 기록 long task | 25개·24,352.877ms | 참고 |

- [x] LCP 요소는 `hero_banner.webp`이며 이미지 로드는 약 477ms에 끝났다.
- [x] CLS의 가장 큰 단일 이동 0.205466은 1,380.9ms에 원 홈페이지 래퍼·히어로·네비·MD PICK이 함께 이동하며 발생했다.
- [x] 가장 느린 상호작용은 내예약 열기이며 click handler가 약 560ms를 동기 점유했다.
- [x] 분석본 개인정보 0건과 raw trace Git 제외를 확인했다.
- [ ] 같은 조건 run02·run03을 저장하고 중앙값·편차를 확정한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_modalbgfix_vitals_run01.md`

### 6.28 새 운영 HTML Web Vitals 기준 재시작

사용자가 run01 뒤 변경된 새 파일의 운영 배포 완료를 알렸다. 배포 완료 메시지 직후 최신 로컬 파일은 2초 간격 검사에서 안정적이었다.

- [x] 새 운영 측정 기준 SHA-256: `09BB07E8F2B2CBBACC2E4D2907AF29A1E61A27C93D55F2D330EA63527CBDABEE`
- [x] 파일 크기·수정 시각: 2,731,573 bytes, 2026-08-06 10:42:51 KST
- [x] 이전 `CFD15...` run01은 CLS·INP 원인 진단 참고 자료로만 보존한다.
- [x] `E8AFF...` 중간 파일은 공식 측정 통계에서 제외한다.
- [ ] `09BB...` 버전의 모바일 로그인 콜드 run01·run02·run03을 새로 수집한다.
- [x] 상세 변경 경계: `docs/home-optimization/baseline/2026-08-05/CONCURRENT_SOURCE_CHANGE.md` 9절

### 6.29 UI 수정 재배포본으로 Web Vitals 기준 이동

`09BB...` run01 저장 전에 UI가 다시 수정·배포됐으므로 아직 측정하지 않은 직전 버전을 건너뛰고 최신 운영 파일에서 공식 3회를 시작한다.

- [x] 최신 운영 측정 기준 SHA-256: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`
- [x] 파일 크기·수정 시각: 2,731,639 bytes, 2026-08-06 10:51:10 KST
- [x] 사용자가 UI 수정 파일의 운영 재배포 완료를 확인했다.
- [x] 직전 `09BB...` 버전에서는 공식 run01을 저장하지 않았다.
- [ ] `8A853...` 버전의 모바일 로그인 콜드 run01·run02·run03을 저장한다.
- [x] 상세 변경 경계: `docs/home-optimization/baseline/2026-08-05/CONCURRENT_SOURCE_CHANGE.md` 10절

### 6.30 `8A853...` 모바일 로그인 콜드 Web Vitals run01

| 지표 | run01 | 판정 |
|---|---:|---|
| LCP | 1,303.790ms | 양호 |
| CLS | 0.209722 | 개선 필요 |
| 내예약 INP 후보 | 769.319ms | 느림 |
| 초기 30초 long task | 16개·22,362.720ms | 개선 필요 |
| 전체 기록 long task | 28개·33,310.927ms | 참고 |

- [x] 초기 LCP는 이전 참고 표본과 비슷했다.
- [x] 초기 영역 이동 0.205466이 유지되고 21.33초 MD PICK·칩 갱신이 최대 CLS 0.209722를 만들었다.
- [x] 내예약 클릭 handler가 684.453ms를 동기 점유했다.
- [x] `home_bootstrap_light`가 최초 초기화와 snapshot fallback 갱신으로 두 번 실행됐다.
- [x] raw trace Git 제외와 분석본 개인정보 0건을 확인했다.
- [ ] run02·run03으로 snapshot 경로와 CLS·INP 반복 여부를 확인한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_8a853_vitals_run01.md`

### 6.31 `8A853...` 모바일 로그인 콜드 Web Vitals run02

| 지표 | run01 | run02 | 예비 판정 |
|---|---:|---:|---|
| LCP | 1,303.790ms | 1,372.751ms | 양호·안정 |
| CLS | 0.209722 | 0.205466 | 개선 필요·반복 |
| 내예약 INP 후보 | 769.319ms | 607.656ms | 느림·변동 20% 초과 |
| 초기 long task 합계 | 22,362.720ms | 21,657.233ms | 큼·안정 |
| 초기 최대 long task | 4,305.449ms | 4,389.266ms | 큼·안정 |

- [x] 동일 초기 CLS 요소와 0.205466 이동이 두 번 모두 재현됐다.
- [x] 내예약 click handler가 두 번 모두 500ms 이상 메인 스레드를 점유했다.
- [x] run02는 snapshot 재호출 없이 `home_bootstrap_light`가 한 번만 실행됐다.
- [x] snapshot 경로가 없어도 초기 long task 합계가 3.2%만 줄어 프런트 반복 렌더를 주원인으로 유지한다.
- [ ] run03으로 INP와 전체 기록 long task의 20% 초과 변동을 판정한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_8a853_vitals_run02.md`

### 6.32 `8A853...` 모바일 로그인 콜드 Web Vitals run03

| 지표 | run03 | 판정 |
|---|---:|---|
| LCP | 1,306.743ms | 양호 |
| CLS | 0.205466 | 개선 필요 |
| 내예약 INP 후보 | 602.240ms | 느림 |
| 초기 30초 long task | 22개·22,412.318ms | 개선 필요 |
| 전체 기록 long task | 28개·24,473.481ms | 참고 |

- [x] 측정 전후 로컬 HTML 해시는 `8A853...`로 안정적이었다.
- [x] 내예약 click handler가 561.858ms를 점유해 세 번째로 같은 병목이 재현됐다.
- [x] `home_bootstrap_light`는 한 번만 실행됐다.
- [x] snapshot 재호출이 없어도 초기 long task 합계가 run01보다 0.2% 많아 프런트 렌더를 주원인으로 확정했다.
- [x] raw trace Git 제외와 분석본 개인정보 0건을 확인했다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_8a853_vitals_run03.md`

### 6.33 `8A853...` 모바일 로그인 콜드 Web Vitals 3회 기준선

| 개선 전 기준 | 중앙값 | 상대 범위 | 판정 |
|---|---:|---:|---|
| LCP | 1,306.743ms | 5.3% | 양호·안정 |
| CLS | 0.205466 | 2.1% | 안정적으로 나쁨 |
| 내예약 INP 후보 | 607.656ms | 27.5% | 불량·편차 초과 |
| 초기 long task 합계 | 22,362.720ms | 3.4% | 안정적으로 매우 큼 |
| 초기 최대 long task | 4,305.449ms | 3.1% | 안정적으로 매우 큼 |
| 전체 long task 합계 | 25,278.157ms | 35.0% | 편차 초과 |

- [x] 공식 3회 모두 같은 운영 SHA-256을 사용했다.
- [x] 초기 전체 홈·MD PICK 반복 렌더를 1순위 병목으로 확정했다.
- [x] 내예약 첫 동기 렌더를 2순위 상호작용 병목으로 확정했다.
- [x] 초기 영역 공간 미확보를 CLS 1순위 원인으로 확정했다.
- [x] snapshot fallback 재호출은 보조 편차 원인으로 분류했다.
- [ ] Phase 0 완료 — 수치 편차, 비로그인 정식 HAR, 운영·스테이징 10분 복구 연습이 남아 있어 미통과다.
- [x] 3회 기준선: `docs/home-optimization/measurement/reports/20260806_mo_login_8a853_vitals_3run_baseline.md`

### 6.34 `8A853...` 모바일 로그인 콜드 HAR run01

| 항목 | run01 |
|---|---:|
| 요청 수 | 130개 |
| 전송량 | 6.01MiB |
| DOMContentLoaded / Load | 1,902ms / 9,803ms |
| 전체 네트워크 기록 | 16,391ms |
| 이미지 | 58개·3.87MiB |
| 상품 대표이미지 | 14개·약 1.27MiB |

- [x] 홈 카드 JSON은 2,031ms에 완료됐다.
- [x] 상품 대표이미지는 11,113ms에 요청을 시작해 데이터 준비 뒤 9,082ms 공백이 있었다.
- [x] 대표이미지 첫 묶음 13개는 요청 시작 뒤 243ms 안에 끝나 서버 다운로드보다 요청 시작 지연이 주원인이었다.
- [x] 마지막 일정 API 종료 뒤 참여 신청 API 시작까지 3,998ms 공백이 있었다.
- [x] `home_bootstrap_light`는 한 번만 실행됐다.
- [x] raw HAR Git 제외, 회원 쿼리값 `[REDACTED]`, 안전 분석본 개인정보 0건을 확인했다.
- [ ] run02·run03으로 이미지 지연·API 공백·중복 요청 반복 여부를 확정한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_cold_run01.md`

### 6.35 `8A853...` 모바일 로그인 콜드 HAR run02

| 항목 | run01 | run02 | 예비 판정 |
|---|---:|---:|---|
| 요청 수 | 130개 | 138개 | 슬라이드·측정 태그 차이 |
| 전송량 | 6.01MiB | 6.22MiB | +3.5% |
| 대표이미지 요청 지연 | 9,082ms | 8,890ms | 안정적 반복 |
| 일정→참여 API 공백 | 3,998ms | 3,658ms | 반복 |
| 대표이미지 전송량 | 1,329,244 bytes | 1,329,226 bytes | 동일 |

- [x] 홈 카드 JSON은 2,125ms에 완료되고 대표이미지는 11,015ms에 요청됐다.
- [x] 대표이미지 다운로드 자체는 최대 262ms로 빨랐다.
- [x] `home_bootstrap_light`는 한 번만 실행됐다.
- [x] `taste_bg1~3`와 국기 3종의 이중 요청이 run01과 동일하게 반복됐다.
- [x] 전송량 222KB 증가는 슬라이드 `woman` 이미지 구성과 측정 태그 호출 차이였다.
- [x] 외부 Supabase 상품 이미지 status 0·blocked가 두 번 반복됐다.
- [x] raw HAR Git 제외와 안전 분석본 개인정보 0건을 확인했다.
- [ ] run03으로 중앙값·상대 범위와 실패 후보를 확정한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_cold_run02.md`

### 6.36 `8A853...` 모바일 로그인 콜드 HAR run03

| 항목 | run03 |
|---|---:|
| 요청 수·전송량 | 122개·5.68MiB |
| DOMContentLoaded / Load | 1,870ms / 9,873ms |
| 대표이미지 요청 지연 | 7,815ms |
| 일정→참여 API 공백 | 57ms |
| 대표이미지 | 14개·1,329,253 bytes |

- [x] 홈 카드 JSON은 1,932ms에 끝나고 대표이미지는 9,747ms에 요청됐다.
- [x] 첫 대표이미지 13개는 최대 261ms 안에 다운로드됐다.
- [x] 일정→참여 API 공백이 57ms로 줄어 고정 서버 지연 가설을 기각했다.
- [x] 골프조인 배경·국기 이중 요청은 이번 실행에서 발생하지 않아 조건부 중복으로 분류했다.
- [x] Supabase 이미지 status 0·blocked가 세 번째 반복됐다.
- [x] raw HAR Git 제외와 안전 분석본 개인정보 0건을 확인했다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_cold_run03.md`

### 6.37 `8A853...` 모바일 로그인 콜드 HAR 3회 기준선

| 개선 전 기준 | 중앙값 | 상대 범위 | 판정 |
|---|---:|---:|---|
| 요청 수 | 130개 | 12.3% | 안정 |
| 전송량 | 6.01MiB | 9.0% | 안정 |
| Load | 9,803ms | 1.4% | 안정 |
| 홈 카드 완료 → 대표이미지 요청 | 8,890ms | 14.2% | 안정적으로 늦음 |
| 대표이미지 전송량 | 1,329,244 bytes | 0.002% | 고정 |
| 대표이미지 개별 최대 소요 | 261ms | 7.2% | 서버는 빠름 |
| bootstrap → 일정 API | 7,826ms | 8.8% | 고정 지연 구조 |
| 일정 API → 참여 API | 3,658ms | 107.7% | 데이터 순서 의존 |

- [x] `scheduleMdPickImagePreload()`의 8,000ms 타이머를 대표이미지 지연의 직접 원인으로 확정했다.
- [x] 이미지 서버 응답 속도는 1순위 원인에서 제외했다.
- [x] 로그인 API 공백은 응답 순서와 반복 렌더의 결합 문제로 판정했다.
- [x] `goodSeq=30001242` 이미지가 세 번 모두 별도 지연된 사실을 기록했다.
- [x] 골프조인 이미지 이중 요청은 조건부, Supabase status 0은 지속 실패·취소 후보로 분류했다.
- [ ] Phase 0 전체 완료 — 비로그인·모바일 웜 기준과 운영 복구 연습이 남아 있다.
- [x] 3회 기준선: `docs/home-optimization/measurement/reports/20260806_mo_login_cold_3run_baseline.md`

### 6.38 모바일 로그인 웜 run01 진단 표본

| 항목 | 콜드 중앙값 | 웜 진단 | 비고 |
|---|---:|---:|---|
| 요청 수 | 130개 | 109개 | -16.2% |
| 전송량 | 6.01MiB | 5.26MiB | HTTP 캐시 미사용 |
| Load | 9,803ms | 4,912ms | 앱 캐시 효과 포함 |
| 골프조인 API | 6개 | 3개 | 앱 캐시 웜 |
| no-cache 요청 | 해당 없음 | 108/109개 | 공식 웜 부적합 |

- [x] 회원 `join_applications`, 찜, 홈 통계 요청이 없어 회원 앱 캐시 사용을 확인했다.
- [x] immutable 홈 카드 219,187 bytes가 다시 전송돼 HTTP 캐시 미사용을 확인했다.
- [x] 모든 정상 요청에 `Cache-Control: no-cache`가 붙어 reload navigation으로 판정했다.
- [x] 공식 웜 통계에서 제외하고 진단 표본으로 보존한다.
- [x] 상품군 catalog가 소스 기본 `no-cache`로 로드되는 별도 최적화 후보를 확인했다.
- [ ] 주소창 `Ctrl+L` → `Enter` 방식으로 공식 run01을 다시 측정한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_warm_run01_diagnostic.md`

### 6.39 `8A853...` 모바일 로그인 웜 공식 run01

주소창 `Ctrl+L` → `Enter` 방식으로 다시 이동해 HTTP 캐시와 회원 앱 캐시가 함께 적용된 표본을 확보했다.

| 항목 | 콜드 중앙값 | 웜 공식 run01 | 변화·판정 |
|---|---:|---:|---|
| 요청 수 | 130개 | 117개 | -10.0% |
| 전송량 | 6,299,253 bytes | 557,090 bytes | -91.2% |
| DOMContentLoaded | 1,902ms | 876ms | -53.9% |
| Load | 9,803ms | 5,057ms | -48.4% |
| 골프조인 API | 6개 | 3개 | 앱 캐시 웜 |
| 상품 대표이미지 전송 | 1,329,244 bytes | 0 bytes | HTTP 캐시 웜 |
| 골프조인 핵심 API 종료 | 16,391ms | 6,240ms | -61.9% |

- [x] 버전 홈 카드 JSON은 disk cache에서 0 bytes로 재사용됐다.
- [x] CSS 9개·스크립트 40개·폰트 2개와 상품 대표이미지가 0 bytes로 재사용됐다.
- [x] 전체 117개 중 103개가 0 bytes이고, literal `no-cache`는 동적 요청 중심 6개뿐이다.
- [x] 회원 참여·찜·통계 API가 생략돼 앱 캐시 사용을 확인했다.
- [x] 최초 진단 표본은 통계에서 계속 제외하고 이번 대체 파일을 공식 run01로 채택한다.
- [!] HAR 전체 기록 18,808ms는 18.735초에 시작한 별도 `/mypage/member` 요청의 영향을 받는다. 페이지 Load와 골프조인 핵심 API 종료를 분리해 비교한다.
- [!] immutable 상품군 catalog는 소스 기본 `no-cache` 정책 때문에 304 재검증한다. 본문은 13 bytes지만 네트워크 왕복 제거 후보로 남긴다.
- [!] Supabase `productCC1.jpg` status 0과 `goodSeq=30001242` 별도 지연은 계속 재현됐다.
- [ ] 같은 조건의 run02·run03을 저장하고 3회 중앙값·편차를 확정한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_warm_run01_retry.md`

### 6.40 `8A853...` 모바일 로그인 웜 공식 run02

최초 저장본은 Network 필터 때문에 요청 1개만 포함돼 제외하고, 전체 요청 119개를 담은 재측정 파일을 공식 run02로 채택했다.

| 항목 | 공식 run01 | 공식 run02 | 변화·판정 |
|---|---:|---:|---|
| 요청 수 | 117개 | 119개 | +1.7%, 안정적 |
| 전송량 | 557,090 bytes | 548,340 bytes | -1.6%, 안정적 |
| DOMContentLoaded | 876ms | 673ms | -23.2%, run03 확인 |
| Load | 5,057ms | 4,337ms | -14.2%, 20% 안 |
| 골프조인 API | 3개 | 3개 | 앱 캐시 반복 |
| 골프조인 핵심 API 종료 | 6,240ms | 5,333ms | -14.5%, 20% 안 |
| 상품 대표이미지 전송 | 0 bytes | 0 bytes | HTTP 캐시 반복 |
| 홈 카드 → MD PICK 이미지 | 3,123ms | 2,866ms | -8.2%, 안정적 |
| MD PICK → `30001242` | 8,346ms | 8,275ms | -0.9%, 고정 지연 반복 |

- [x] 홈 카드·CSS·JavaScript·폰트·상품 대표이미지의 0-byte 캐시 재사용을 반복 확인했다.
- [x] 119개 중 106개가 0 bytes이고 literal `no-cache`는 동적 요청 중심 5개뿐이다.
- [x] 로그인 보조 API가 3개로 유지돼 회원 앱 캐시를 반복 확인했다.
- [x] 요청·전송량·Load·핵심 API·MD PICK 이미지 시점은 주요 편차 20% 안이다.
- [!] DOMContentLoaded는 run02가 더 빨라 두 번 사이 상대 변화가 23.2%다. run03 중앙값으로 판정한다.
- [!] 상품군 catalog 304 재검증, Supabase status 0, `goodSeq=30001242` 약 8.3초 별도 지연이 반복됐다.
- [ ] 같은 조건의 run03을 저장하고 3회 중앙값·편차를 확정한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_warm_run02_retry.md`

### 6.41 `8A853...` 모바일 로그인 웜 공식 run03

| 항목 | run03 | 판정 |
|---|---:|---|
| 요청 수 | 118개 | 전체 요청 정상 저장 |
| 전송량 | 548,650 bytes | run01·run02 범위 안 |
| DOMContentLoaded | 827ms | 1초 안 |
| Load | 4,244ms | 세 번 중 가장 빠름 |
| 골프조인 API | 3개 | 앱 캐시 반복 |
| 상품 대표이미지 전송 | 0 bytes | HTTP 캐시 반복 |
| 홈 카드 → MD PICK 이미지 | 3,004ms | 세 번 중앙값 |
| MD PICK → `30001242` | 8,276ms | 고정 지연 반복 |

- [x] 공식 세 번째 표본으로 채택했다.
- [x] 골프조인 공용 이미지 26개가 304로 재검증됐지만 본문 다운로드는 0 bytes다.
- [x] 이미지 요청에 강제 `no-cache`가 없어 정상 캐시 만료 재검증으로 판정했다.
- [!] 고정 URL·`max-age=3600` 공용 이미지의 26회 왕복을 별도 최적화 후보로 기록했다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_warm_run03.md`

### 6.42 `8A853...` 모바일 로그인 웜 HAR 3회 기준선

| 지표 | 중앙값 | 상대 범위 | 판정 |
|---|---:|---:|---|
| 요청 수 | 118개 | 1.7% | 안정적 |
| 총 전송량 | 548,650 bytes | 1.6% | 안정적 |
| DOMContentLoaded | 827ms | 24.6% | 절대 차이 204ms, 모두 1초 안 |
| Load | 4,337ms | 18.8% | 20% 안 |
| 골프조인 API | 3개 | 0% | 앱 캐시 고정 |
| 골프조인 핵심 API 종료 | 5,333ms | 18.7% | 20% 안 |
| 상품 대표이미지 전송 | 0 bytes | 0% | HTTP 캐시 고정 |
| 홈 카드 → MD PICK 이미지 | 3,004ms | 8.6% | 안정적 |
| MD PICK → `30001242` | 8,276ms | 0.9% | 고정 지연 |

- [x] Cold 대비 전송량 91.3%, Load 55.8%, 핵심 API 종료 67.5% 감소를 확정했다.
- [x] Warm 총 전송량의 약 89.4%를 메인 HTML 490,537 bytes가 차지한다.
- [x] 로그인 앱 캐시와 상품 대표이미지 HTTP 캐시의 재현성을 확정했다.
- [!] DCL·홈 카드 완료의 상대 범위는 약 25%지만 절대 편차는 약 0.2초다.
- [!] 일정 API 개별 응답은 479~1,096ms로 변하지만 전체 완료 시각은 상대 범위 18.7%다.
- [ ] Phase 0 전체 완료 — 비로그인 PC/MO 기준선과 운영·스테이징 복구 훈련이 남아 있다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_mo_login_warm_3run_baseline.md`

### 6.43 `8A853...` PC 비로그인 Cold HAR run01

| 항목 | run01 | 판정 |
|---|---:|---|
| 요청 수 | 122개 | 전체 요청 정상 저장 |
| 전송량 | 5,997,156 bytes | Cold 첫 기준 |
| DOMContentLoaded | 1,734ms | 반복 확인 필요 |
| Load | 9,611ms | 반복 확인 필요 |
| 홈 카드 완료 | 1,884ms | 데이터는 빠르게 준비 |
| 첫 대표이미지 요청 | 8,956ms | 데이터 뒤 7,072ms 지연 |
| 마지막 대표이미지 요청 | 19,002ms | 네 단계 분할 요청 |
| 골프조인 API | 2개 | 비로그인 정상 경로 |
| bootstrap → `home_stats` | 7,091ms | 고정 지연 후보 |

- [x] 회원 식별 쿼리와 회원 전용 API가 0건임을 확인했다.
- [x] `getEventTab.json`, `getEventGoodsList.json`은 원홈페이지 XHR이며 합계 약 31ms로 병목에서 제외했다.
- [x] 개별 대표이미지 최대 다운로드 약 45ms로 이미지 서버를 1순위 원인에서 제외했다.
- [!] 대표이미지 14개가 8.96·13.98·16.96·19.00초 네 묶음으로 요청됐다.
- [!] `home_stats`는 bootstrap 뒤 약 7.09초 늦게 시작하고 자체 응답도 약 1.43초 걸렸다.
- [ ] run02·run03을 저장해 반복성과 중앙값을 확정한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_pc_logout_cold_run01.md`

### 6.44 `8A853...` PC 비로그인 Cold HAR run02

| 항목 | run01 | run02 | 예비 판정 |
|---|---:|---:|---|
| 요청 수 | 122개 | 122개 | 동일 |
| 전송량 | 5,997,156 | 5,444,429 bytes | -9.2% |
| DOMContentLoaded | 1,734 | 1,716ms | -1.1% |
| Load | 9,611 | 10,145ms | +5.6% |
| 홈 카드 → 첫 이미지 | 7,072 | 7,586ms | +7.3%, 반복 |
| 첫 이미지 → 마지막 이미지 | 10,046 | 10,024ms | -0.2%, 고정 구조 |
| bootstrap → 통계 | 7,091 | 8,335ms | +17.6%, 반복 |
| 통계 종료 | 10,412 | 10,936ms | +5.0% |
| 상품이미지 전송 | 1,329,351 | 1,329,351 bytes | 동일 |

- [x] 상품이미지 7개·3개·1개·3개 네 단계 요청이 정확히 반복됐다.
- [x] 회원 식별 요청 0건과 비회원 API 2개를 반복 확인했다.
- [x] 원홈페이지 XHR 2개는 다시 합계 약 29ms로 병목에서 제외했다.
- [!] 개별 이미지 최대 소요는 151ms지만 요청 전 대기 7.59초보다 훨씬 작다.
- [!] HAR 끝의 비로그인 마이페이지 302 두 건은 별도 세션 확인으로 분리한다.
- [ ] run03으로 중앙값·편차를 확정한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_pc_logout_cold_run02.md`

### 6.45 `8A853...` PC 비로그인 Cold HAR run03

| 항목 | run03 | 판정 |
|---|---:|---|
| 요청 수 | 125개 | 전체 요청 정상 저장 |
| 전송량 | 6,006,963 bytes | 기존 범위 안 |
| DOMContentLoaded | 1,698ms | 세 번 중 가장 빠름 |
| Load | 10,012ms | 중앙값 일치 |
| 홈 카드 → 첫 이미지 | 7,535ms | 중앙값 일치 |
| 첫 이미지 → 마지막 이미지 | 10,035ms | 중앙값 일치 |
| bootstrap → 통계 | 7,613ms | 중앙값 일치 |
| 통계 종료 | 10,822ms | 중앙값 일치 |

- [x] 공식 세 번째 표본으로 채택했다.
- [x] 이미지 7개·3개·1개·3개 분할 요청을 세 번째로 확인했다.
- [x] 회원 식별 요청 0건과 비회원 API 2개를 확인했다.
- [!] 끝부분 비로그인 마이페이지 302는 대표이미지 완료와 분리한다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_pc_logout_cold_run03.md`

### 6.46 `8A853...` PC 비로그인 Cold HAR 3회 기준선

| 지표 | 중앙값 | 상대 범위 | 판정 |
|---|---:|---:|---|
| 요청 수 | 122개 | 2.5% | 안정적 |
| 전송량 | 5,997,156 bytes | 9.4% | 안정적 |
| DOMContentLoaded | 1,716ms | 2.1% | 안정적 |
| Load | 10,012ms | 5.3% | 안정적 |
| 홈 카드 완료 | 1,796ms | 4.9% | 안정적 |
| 홈 카드 → 첫 이미지 | 7,535ms | 6.8% | 고정 지연 |
| 첫 이미지 → 마지막 이미지 | 10,035ms | 0.22% | 타이머 체인 확정 |
| 상품이미지 전송 | 1,329,351 bytes | 0.005% | 고정 |
| bootstrap → 통계 | 7,613ms | 16.3% | 지연 반복 |
| 통계 종료 | 10,822ms | 4.8% | 안정적 |

- [x] 대표이미지 서버 최대 소요 151ms를 1순위 원인에서 제외했다.
- [x] 이미지 네 단계 분할과 통계 API 시작 지연을 클라이언트 실행 순서 문제로 확정했다.
- [x] 원홈페이지 XHR 합산 중앙값 약 30ms를 병목에서 제외했다.
- [!] Supabase 이미지 status 0은 세 번 모두 반복됐다.
- [ ] PC 비로그인 Warm 3회와 MO 비로그인 기준선이 남아 있다.
- [x] 상세 보고서: `docs/home-optimization/measurement/reports/20260806_pc_logout_cold_3run_baseline.md`

## 7. 현재 미완료·차단 항목

- [ ] 비로그인 PC 골프조인 HAR 3회 저장 — 공식 Cold 3회 기준선을 완료했고 Warm 3회가 남았다.
- [ ] 비로그인 MO 골프조인 HAR 3회 저장 — 모바일 UA 기능 검증은 완료했지만 정식 HAR 3회는 미저장.
- [x] 로그인 PC 운영 화면과 초기 진입 자산 증가 3개 표본 — 로그인 확인, 최대 6개 Cloud Function 경로와 대표이미지 지연 구간 기록.
- [x] 로그인 PC 정식 HAR과 MO 측정 — PC와 MO 로그인 콜드·웜 HAR 및 모바일 Web Vitals 공식 3회 기준선을 완료했다.
- [x] 모바일 로그인 LCP·INP·CLS·long task 정식 측정 — `8A853...` 운영 버전 3회 중앙값과 편차, 원인 실행 경로를 확정했다.
- [ ] PC 로그인 LCP·INP·CLS 정식 측정 — long task 3회는 확보했지만 PC Web Vitals와 상호작용 INP는 별도 수동 DevTools 또는 페이지 계측이 필요하다.
- [ ] MD PICK·취향맞춤의 정확한 request start/response/display 타이밍 — PC 로그인 콜드 3회에서 request start와 response는 확정했으며 실제 표시 시점은 trace가 남아 있다.
- [x] 비로그인 PC 상품군 대표 상품 웜 상세 3회 성능 측정 — 평균 약 8.83초.
- [ ] 비로그인 PC 콜드 상세와 상품군 없는 상품 비교 측정 — 아직 미실시.
- [x] 로컬 복구 패키지 격리 연습 — 2.383초, 핵심 해시 5/5 일치, 테스트 36/36 통과.
- [ ] 운영·스테이징 10분 복구 연습 — 게시판과 Cloud Function 실제 전환 대상을 확정해야 함.
- [x] 정식 측정 실행 준비 — PC/MO·로그인/비로그인·cold/warm 체크리스트와 HAR·trace 측정 도구 테스트 8/8 통과.

## 8. 다음 진행 조건

- [x] 운영 게시판에 골프조인 메인 HTML이 현재 등록돼 있는지 확인했다.
- [x] 비로그인 PC 운영 URL을 확인했다.
- [x] 모바일 UA에서 사용하는 `m.secret-tour.com/event/plan_view` URL과 렌더링을 확인한다.
- [x] 로그인 측정에 사용할 테스트 계정을 사용자 측 Chrome에 로그인한다.
- [x] 정상 골프조인 화면 확인 후 로그인 PC 초기 진입 자산 증가를 3개 표본으로 측정한다.
- [ ] 복구 실행서에 따라 현재 정상 소스를 보존하고 복구 연습을 수행한다.
