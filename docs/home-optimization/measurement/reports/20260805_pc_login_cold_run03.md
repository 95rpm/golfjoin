# PC 로그인 콜드 HAR 3회차 분석

| 구분 | 값 |
|---|---|
| 측정일 | 2026-08-05 |
| 환경 | PC Chrome, 로그인, Network `Disable cache` 사용 |
| 사용자 동작 | 새로고침 뒤 측정 중 스크롤·클릭 없음 |
| 진행 상태 | 동일 조건 필수 3회 완료 |
| 기능 코드 변경 | 없음 |

## 1. 파일과 개인정보 검증

- [x] raw HAR은 Git에서 제외되는 `hars/raw`에 보관했다.
- [x] raw HAR은 12,981,960 bytes, 요청 121개다.
- [x] raw HAR SHA-256: `E552BB3BD222DEA5C0743C7B8C6C202DEDB3F13BA4C495D9D7C30B612D76EF00`
- [x] 개인정보 제거본을 생성했다.
- [x] 이메일·URL 인코딩 이메일·휴대폰·Bearer·쿠키·응답 본문 잔존은 모두 0건이다.
- [x] 구조화된 민감 필드 10개와 URL 안의 민감 쿼리가 모두 가려졌다.
- [x] 개인정보 제거본 SHA-256: `A275463CA2F6D9EBACA324382E700BE34737EE14C47E3129AAF8C976C589B7E9`
- [x] 분석 JSON SHA-256: `F4E6EE1F633AFCC6BFF809FB19BFD0D2A1C5892C2CE5B2CF37DAAB3683A263A3`

## 2. 페이지 전체 기준선

| 지표 | run03 |
|---|---:|
| 요청 수 | 121개 |
| DOMContentLoaded | 1,986ms |
| Load | 9,003ms |
| 마지막 요청 종료 | 19,016ms |
| 실제 전송량 합계 | 5,622,678 bytes, 약 5.36MiB |
| 이미지 전송량 | 3,585,358 bytes, 63.8% |
| HTTP 200 | 115개 |
| HTTP 204 | 5개 |
| 네트워크 실패 | 1개 |
| 동일 메서드·URL 중복 그룹 | 1개 |

`Load` 뒤에도 약 10초간 요청이 계속됐다. 마지막 요청은 19.00초에 시작한 `taste_bg3.webp`이며 실제 다운로드는 약 13ms였다. 네트워크가 느려서가 아니라 배경 이미지 요청 시작이 늦었다.

## 3. 정적 데이터 타임라인

| 요청 | 시작 | 소요 | 전송량 |
|---|---:|---:|---:|
| 상품군 manifest | 1,816ms | 110ms | 638 bytes |
| 홈 manifest | 1,816ms | 113ms | 473 bytes |
| revision 상품군 catalog | 2,002ms | 33ms | 105,982 bytes |
| revision 홈 카드 | 2,003ms | 35ms | 215,771 bytes |

GCS 정적 JSON은 33~113ms 안에 응답했다. 세 번째 회차에서도 정적 JSON 서버 전송은 주 병목이 아니다.

## 4. 로그인 API 타임라인

| 요청 | 시작 | 종료 | 소요 | 서버 대기 | 전송량 |
|---|---:|---:|---:|---:|---:|
| `home_bootstrap_light` | 1,860ms | 2,067ms | 207ms | 75ms | 29,610 bytes |
| 공개 `new_schedule_applications` | 9,660ms | 10,292ms | 632ms | 627ms | 14,166 bytes |
| 회원 `new_schedule_applications` | 9,661ms | 10,146ms | 485ms | 483ms | 8,048 bytes |
| 회원 `join_applications` | 10,342ms | 10,850ms | 508ms | 505ms | 7,359 bytes |
| `join_wishes_lookup` | 10,886ms | 11,359ms | 473ms | 395ms | 77 bytes |
| `home_stats` | 11,383ms | 11,543ms | 160ms | 74ms | 132 bytes |

관찰 결과:

- [x] Bootstrap은 207ms로 매우 빨랐지만 보조 회원 요청은 약 9.66초에야 시작했다.
- [x] Bootstrap 서버 속도와 별개로 초기화 순서, 1.5초 타이머와 idle 대기가 요청 시작을 늦춘다는 증거가 세 회차에서 재현됐다.
- [x] 공개·회원 new schedule은 병렬이고, 이후 `join → wishes → stats`는 순차 실행됐다.
- [x] 전체 회원 API의 마지막 종료는 11.54초로 run01·run02와 비슷했다.

## 5. MD PICK 대표이미지

| goodSeq | 요청 시작 | 다운로드 소요 | Initiator |
|---|---:|---:|---|
| 30001104 | 8,997ms | 22ms | parser/lazy 표시 경로 |
| 30001089 | 8,997ms | 19ms | parser/lazy 표시 경로 |
| 30001092 | 17,002ms | 24ms | `preloadMdPickCountryImages` |
| 30001084 | 17,002ms | 28ms | `preloadMdPickCountryImages` |
| 30001242 | 17,005ms | 27ms | 지연 preload 구간 |

다운로드는 모두 28ms 이내였지만 일부 요청은 17초까지 시작되지 않았다. run01·run02와 같은 요청 시작 지연이다.

## 6. 중복 이미지와 이미지 전송량

`woman1.webp`가 227ms와 5,107ms에 두 번 요청되어 두 번째 요청 326,322 bytes가 재전송됐다. 이번 회차의 아바타 요청은 8개, 2,285,079 bytes로 전체 전송량의 약 40.6%다.

- [x] 같은 아바타 URL 중복이 run02·run03에서 재현됐다.
- [x] 아바타만으로 전체 전송량의 큰 비중을 차지한다.
- [ ] 취향맞춤 배경 3종의 중복은 run02에만 나타나므로 후속 trace에서 DOM 생성 시점을 확인한다.

## 7. 원 홈페이지 요청과 실패 자산

| 요청 | 시작 | 소요 | 전송량 |
|---|---:|---:|---:|
| `getEventTab.json?eventPlanSeq=3` | 1,845ms | 39ms | 413 bytes |
| `getEventGoodsList.json?eventPlanSeq=3&tabSeq=1` | 1,937ms | 31ms | 220 bytes |

두 요청은 합계 633 bytes이고 모두 40ms 이내였다. 세 회차 모두 골프조인 병목에서 제외할 수 있다.

Supabase의 `productCC1.jpg`는 이번에도 `ERR_NAME_NOT_RESOLVED`로 실패했다. 같은 실패가 3회 모두 재현됐다.

## 8. run03 판정

- [x] GCS 정적 JSON 응답 자체는 빠르다.
- [x] Bootstrap이 빨라도 보조 회원 API는 9초대까지 시작되지 않는다.
- [x] MD PICK 대표이미지는 다운로드보다 요청 시작이 늦다.
- [x] 로그인 API 순차 실행이 재현됐다.
- [x] 아바타 동일 URL 중복 요청과 큰 이미지 전송량이 재현됐다.
- [x] 원 홈페이지 이벤트 API는 병목이 아니다.
- [x] Supabase 기본 이미지 DNS 실패가 세 번째로 재현됐다.
- [x] 같은 조건 3회 수집을 완료했다.
- [x] 세 회차 중앙값과 편차는 통합 기준선 보고서에 확정했다.

분석용 안전 자료:

- `20260805_pc_login_cold_run03.sanitized.json`
- `20260805_pc_login_cold_run03.analysis.json`
