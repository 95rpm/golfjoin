# PC 로그인 콜드 HAR 1회차 분석

| 구분 | 값 |
|---|---|
| 측정일 | 2026-08-05 |
| 환경 | PC Chrome, 로그인, Network `Disable cache` 사용 |
| 사용자 동작 | 새로고침 후 약 20초 동안 스크롤·클릭 없음 |
| 진행 상태 | 필수 3회 중 1회 완료 |
| 기능 코드 변경 | 없음 |

## 1. 파일과 개인정보 검증

- [x] raw HAR을 Git에서 제외되는 `hars/raw`에 보관했다.
- [x] raw HAR SHA-256을 기록했다: `57E677D0D0B12B9B99CA4DFC188DC5453CD0DEF9E3FCAC9FEC664202DA0FD764`
- [x] raw HAR 12,666,337 bytes, 요청 121개를 확인했다.
- [x] 개인정보 제거본을 생성했다.
- [x] 민감 필드 10개가 모두 `[REDACTED]` 처리됐다.
- [x] 이메일·휴대폰·Bearer·응답 본문·쿠키 잔존은 모두 0건이다.
- [x] 개인정보 제거본 SHA-256: `806988B1016625F99E121EC853AFC88CDFB80218A0284E38B5088BE46B21CB16` — `:path` 헤더 보강 후 재생성본
- [x] 분석 JSON SHA-256: `937F95272DDC4A282C78D4949493E94CEA5F527533A48E12CD10CD90D969C657`

## 2. 페이지 전체 기준선

| 지표 | 값 |
|---|---:|
| 요청 수 | 121개 |
| DOMContentLoaded | 2,145ms |
| Load | 4,152ms |
| 마지막 요청 종료 | 16,642ms |
| 실제 전송량 합계 | 5,388,106 bytes, 약 5.14MiB |
| HTTP 200 | 115개 |
| HTTP 204 | 5개 |
| 네트워크 실패 | 1개 |
| 동일 URL 중복 요청 그룹 | 0개 |

`Load`가 4.15초에 끝나도 골프조인 요청은 16.64초까지 계속됐다. 브라우저의 페이지 로드 완료 표시만으로는 사용자가 느끼는 골프조인 준비 완료를 판단할 수 없다.

## 3. 자원 유형별 전송량

| 유형 | 요청 | 전송량 | 전체 비율 |
|---|---:|---:|---:|
| 이미지 | 47 | 3,351,177 bytes | 62.2% |
| JavaScript | 44 | 1,094,831 bytes | 20.3% |
| HTML 문서 | 2 | 489,613 bytes | 9.1% |
| fetch | 11 | 382,263 bytes | 7.1% |
| CSS | 8 | 67,674 bytes | 1.3% |

초기 트래픽의 가장 큰 비중은 이미지다. 특히 `man1~4.webp`, `woman1~2.webp` 6개가 1,736,452 bytes로 전체 전송량의 약 32.2%를 차지했다.

| 묶음 | 요청 | 전송량 | 해석 |
|---|---:|---:|---|
| `golfjoin_img` 정적 이미지 | 27 | 2,364,686 bytes | 초기 화면 장식·아이콘·참여자 이미지 비중이 큼 |
| 시크릿투어 상품 대표이미지 | 7 | 948,854 bytes | 다운로드는 빠르지만 일부 요청 시작이 매우 늦음 |
| 골프조인 정적 web JSON | 4 | 322,864 bytes | 응답 45~140ms로 현재 병목 아님 |
| Cloud Function | 9, preflight 포함 | 59,379 bytes | 크기는 작지만 서버 대기시간이 김 |

## 4. 정적 데이터 타임라인

| 요청 | 시작 | 소요 | 전송량 |
|---|---:|---:|---:|
| 상품군 manifest | 1,952ms | 140ms | 638 bytes |
| 홈 manifest | 1,952ms | 105ms | 473 bytes |
| revision 홈 카드 | 2,194ms | 60ms | 215,771 bytes |
| revision 상품군 catalog | 2,206ms | 45ms | 105,982 bytes |

manifest 요청 자체가 페이지 시작 후 약 1.95초에야 시작하지만, 요청이 시작된 뒤 GCS 응답은 빠르다. 따라서 현재 첫 병목은 GCS 다운로드 속도보다 정적 데이터 요청을 시작하는 부팅 순서에 가깝다.

## 5. 로그인 API 타임라인

| 요청 | 시작 | 종료 | 소요 | 서버 대기 | 전송량 |
|---|---:|---:|---:|---:|---:|
| `home_bootstrap_light` | 1,989ms | 3,952ms | 1,963ms | 1,281ms | 29,594 bytes |
| 공개 `new_schedule_applications` | 6,629ms | 8,045ms | 1,416ms | 1,412ms | 14,172 bytes |
| 회원 `new_schedule_applications` | 6,629ms | 8,138ms | 1,509ms | 1,507ms | 8,048 bytes |
| 회원 `join_applications` | 8,227ms | 9,564ms | 1,337ms | 1,334ms | 7,356 bytes |
| `join_wishes_lookup` | 9,594ms | 10,328ms | 734ms | 653ms | 77 bytes |
| `home_stats` | 10,352ms | 11,650ms | 1,298ms | 1,216ms | 132 bytes |

관찰 결과:

- [x] `home_bootstrap_light`가 끝난 뒤 다음 회원 요청 시작까지 약 2.68초 공백이 있다.
- [x] 공개·회원 `new_schedule_applications` 두 요청만 병렬이다.
- [x] 그 뒤 `join_applications → wishes → stats`는 거의 직렬로 이어진다.
- [x] 작은 응답인데도 receive보다 wait가 대부분이므로 다운로드 크기보다 서버 응답과 순차 실행이 지연 원인이다.
- [x] 코드의 `HOME_SECONDARY_HYDRATION_DELAY_MS = 1500`, `requestIdleCallback(... timeout: 2500)`와 순차 `await` 구조가 HAR 흐름과 일치한다.

## 6. MD PICK 대표이미지 지연 원인 확정

페이지 `Load`는 4,152ms에 끝났지만 MD PICK 대표이미지 5개는 14,620ms에 요청을 시작했다. `Load`보다 약 10.47초 늦다.

| goodSeq | 요청 시작 | 다운로드 소요 | 전송량 |
|---|---:|---:|---:|
| 30001104 | 14,620ms | 22ms | 93,426 bytes |
| 30001089 | 14,620ms | 42ms | 162,767 bytes |
| 30001092 | 14,620ms | 32ms | 128,083 bytes |
| 30001084 | 14,620ms | 35ms | 135,232 bytes |
| 30001242 | 14,623ms | 35ms | 115,269 bytes |

요청을 시작한 뒤 다운로드는 22~42ms로 매우 빠르다. 따라서 대표이미지가 늦는 주원인은 이미지 서버가 아니라 요청 시작을 약 14.6초까지 미루는 코드다.

HAR initiator는 `preloadMdPickCountryImages`를 가리킨다. 로컬 코드에서도 다음 구조가 확인됐다.

- `scheduleMdPickImagePreload()`가 먼저 8,000ms 타이머를 기다린다.
- 그 뒤 timeout이 없는 `requestIdleCallback(run)`을 다시 기다린다.
- 실제 이미지는 `preloadMdPickCountryImages()` 안에서 `new Image()`로 요청한다.
- 관련 위치: `golfjoin_main.html`의 `preloadMdPickCountryImages`, `scheduleMdPickImagePreload`.

즉, 이전에 의심했던 중첩 idle 대기가 이번 정식 HAR에서 직접 확인됐다. 2단계 저위험 개선의 최우선 대상이다.

## 7. 추가 오류와 원 홈페이지 요청

### 실패 이미지

`productCC1.jpg` 1건이 1,812ms에 시작해 `net::ERR_NAME_NOT_RESOLVED`로 실패했다. 로컬 HTML에는 이 Supabase URL이 MD PICK·취향맞춤·상세·내예약의 기본 이미지로 여러 곳에 남아 있다. 런타임 실제 대표이미지로 교체되더라도 불필요한 실패 요청과 이미지 깜빡임 가능성이 있으므로 별도 정리 대상이다.

### 원 홈페이지 요청

| 요청 | 시작 | 소요 | 전송량 |
|---|---:|---:|---:|
| `getEventTab.json?eventPlanSeq=3` | 1,979ms | 17ms | 413 bytes |
| `getEventGoodsList.json?eventPlanSeq=3&tabSeq=1` | 2,088ms | 50ms | 220 bytes |

두 요청의 합계는 633 bytes이고 각각 17ms, 50ms다. 원 홈페이지 호출로 분리되며 이번 성능 병목으로 볼 수준은 아니다.

## 8. run01 판정

- [x] 정적 GCS JSON 응답 속도는 정상 범위다.
- [x] 로그인 회원 API는 지연 시작과 순차 실행이 문제다.
- [x] MD PICK 대표이미지는 서버 다운로드가 아니라 8초 타이머와 idle 대기로 늦는다.
- [x] 초기 이미지가 3.35MB로 전체 전송량의 62.2%를 차지한다.
- [x] 실패한 Supabase 기본 이미지 요청 1건이 있다.
- [x] 원 홈페이지 이벤트 API 두 건은 작고 빠르다.
- [ ] 동일 조건 run02를 저장한다.
- [ ] 동일 조건 run03을 저장한다.
- [ ] 3회 편차를 계산해 확정 기준선으로 승격한다.

분석용 원자료:

- `20260805_pc_login_cold_run01.sanitized.json`
- `20260805_pc_login_cold_run01.analysis.json`
