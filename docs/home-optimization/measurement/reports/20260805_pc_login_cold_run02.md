# PC 로그인 콜드 HAR 2회차 분석

| 구분 | 값 |
|---|---|
| 측정일 | 2026-08-05 |
| 환경 | PC Chrome, 로그인, Network `Disable cache` 사용 |
| 사용자 동작 | 새로고침 뒤 측정 중 스크롤·클릭 없음 |
| 진행 상태 | 필수 3회 중 2회 완료 |
| 기능 코드 변경 | 없음 |

## 1. 파일과 개인정보 검증

- [x] raw HAR은 Git에서 제외되는 `hars/raw`에 보관했다.
- [x] raw HAR은 12,845,682 bytes, 요청 123개다.
- [x] raw HAR SHA-256: `EFB92A23BF72896368C3AAC47BAB691372ED2FC3BE086FBAE5F892C66F99D9A4`
- [x] 개인정보 제거본을 생성했다.
- [x] 민감 필드 10개는 모두 `[REDACTED]` 처리됐다.
- [x] 제거본에서 이메일·휴대폰·Bearer·쿠키·요청/응답 본문 잔존은 모두 0건이다.
- [x] 개인정보 제거본 SHA-256: `809635E48FE092CA29E869D72EF3612F6B93AACE3AB88E7FBDE992FCBFCA4723` — `:path` 헤더 보강 후 재생성본
- [x] 분석 JSON SHA-256: `56BCBF12E3B7BEB803429AD6776448E466550361A9675534795B9444808FF58B`

## 2. 페이지 전체 기준선

| 지표 | run02 |
|---|---:|
| 요청 수 | 123개 |
| DOMContentLoaded | 1,929ms |
| Load | 8,760ms |
| 마지막 요청 종료 | 33,746ms |
| 실제 전송량 합계 | 5,524,351 bytes, 약 5.27MiB |
| HTTP 200 | 117개 |
| HTTP 204 | 5개 |
| 네트워크 실패 | 1개 |
| 동일 메서드·URL 중복 그룹 | 4개 |

`DOMContentLoaded`는 1.93초였지만 네트워크 요청은 33.75초까지 이어졌다. 브라우저의 기본 로드 완료 표시만으로 골프조인 섹션의 준비 완료를 판단할 수 없다는 점이 run01과 동일하게 재현됐다.

## 3. 자원 유형별 전송량

| 유형 | 요청 | 전송량 | 전체 비율 |
|---|---:|---:|---:|
| 이미지 | 49 | 3,486,938 bytes | 63.1% |
| JavaScript | 44 | 1,094,852 bytes | 19.8% |
| HTML 문서 | 2 | 489,613 bytes | 8.9% |
| fetch | 11 | 382,374 bytes | 6.9% |
| CSS | 8 | 68,026 bytes | 1.2% |

초기 전송량의 가장 큰 부분은 다시 이미지였다. 아바타 `man1~4.webp`, `woman1·3.webp`와 재요청된 `woman1.webp`까지 합치면 2,029,954 bytes다. 같은 `woman1.webp`의 두 번째 요청 326,320 bytes는 캐시 비활성 조건에서 발생한 중복 전송이다.

## 4. 정적 데이터 타임라인

| 요청 | 시작 | 소요 | 전송량 |
|---|---:|---:|---:|
| 상품군 manifest | 1,629ms | 106ms | 638 bytes |
| 홈 manifest | 1,630ms | 112ms | 473 bytes |
| revision 상품군 catalog | 1,942ms | 25ms | 105,982 bytes |
| revision 홈 카드 | 1,943ms | 27ms | 215,771 bytes |

GCS의 실제 응답은 25~112ms로 빨랐다. 정적 JSON 서버 전송은 이번 회차에서도 주 병목이 아니다.

## 5. 로그인 API 타임라인

| 요청 | 시작 | 종료 | 소요 | 서버 대기 | 전송량 |
|---|---:|---:|---:|---:|---:|
| `home_bootstrap_light` | 1,720ms | 1,992ms | 272ms | 76ms | 29,705 bytes |
| 공개 `new_schedule_applications` | 8,757ms | 9,567ms | 810ms | 804ms | 14,166 bytes |
| 회원 `new_schedule_applications` | 8,758ms | 9,587ms | 829ms | 821ms | 8,051 bytes |
| 회원 `join_applications` | 9,631ms | 10,469ms | 838ms | 836ms | 7,359 bytes |
| `join_wishes_lookup` | 10,502ms | 11,545ms | 1,043ms | 964ms | 77 bytes |
| `home_stats` | 11,567ms | 11,720ms | 153ms | 73ms | 132 bytes |

관찰 결과:

- [x] `home_bootstrap_light`는 run01의 1,963ms와 달리 272ms로 빨랐다.
- [x] 그럼에도 공개·회원 `new_schedule_applications`는 페이지 시작 약 8.76초 뒤에야 시작했다.
- [x] 즉, 보조 데이터 시작 지연은 bootstrap 서버 응답 지연만으로 설명되지 않는다.
- [x] 공개·회원 new schedule 두 요청은 병렬이고, 이후 `join → wishes → stats`는 다시 순차 실행됐다.
- [x] `HOME_SECONDARY_HYDRATION_DELAY_MS`, idle 대기와 순차 `await` 구조가 두 회차 모두에서 네트워크 폭포를 만든다는 증거가 강화됐다.

## 6. MD PICK 대표이미지 지연

| goodSeq | 요청 시작 | 다운로드 소요 | Initiator |
|---|---:|---:|---|
| 30001104 | 8,710ms | 23ms | parser/lazy 표시 경로 |
| 30001089 | 8,710ms | 18ms | parser/lazy 표시 경로 |
| 30001092 | 16,705ms | 28ms | `preloadMdPickCountryImages` |
| 30001084 | 16,705ms | 25ms | `preloadMdPickCountryImages` |
| 30001242 | 16,707ms | 28ms | 지연 preload 구간 |

대표이미지는 요청이 시작된 뒤 18~28ms 만에 다운로드됐다. 이미지 서버가 느린 것이 아니라, 일부 이미지를 8.71초 또는 16.71초까지 요청하지 않은 것이 지연의 원인이다. run01의 14.62초와 절대 시점은 달랐지만 원인 유형은 동일하다.

## 7. 동일 URL 중복 이미지

| 자산 | 첫 요청 | 재요청 | 재전송량 |
|---|---:|---:|---:|
| `woman1.webp` | 270ms | 5,041ms | 326,320 bytes |
| `taste_bg1.webp` | 1,504ms | 23,717ms | 52,500 bytes |
| `taste_bg2.webp` | 13,703ms | 28,730ms | 68,134 bytes |
| `taste_bg3.webp` | 18,707ms | 33,733ms | 35,991 bytes |
| 합계 |  |  | 482,945 bytes |

`Disable cache` 측정이므로 일반 웜 캐시와 전송량은 다를 수 있다. 다만 같은 페이지 실행 안에서 같은 URL을 다시 DOM에 연결하거나 배경 이미지로 다시 사용한 흔적은 실제로 확인됐다. run03에서 반복되는지 확인한 뒤 2단계의 중복 DOM·이미지 로더 개선 범위를 확정한다.

## 8. 원 홈페이지 요청과 실패 자산

| 요청 | 시작 | 소요 | 전송량 |
|---|---:|---:|---:|
| `getEventTab.json?eventPlanSeq=3` | 1,655ms | 20ms | 413 bytes |
| `getEventGoodsList.json?eventPlanSeq=3&tabSeq=1` | 1,788ms | 15ms | 220 bytes |

원 홈페이지의 두 요청은 합계 633 bytes이고 모두 20ms 이내였다. 이번 회차에서도 골프조인 병목이 아니다.

Supabase의 `productCC1.jpg` 기본 이미지 1건은 다시 `ERR_NAME_NOT_RESOLVED`로 실패했다. 동일 오류가 두 회차에서 재현됐으므로 별도 정리 대상이다.

## 9. run01과 비교

| 지표 | run01 | run02 | 변화 |
|---|---:|---:|---:|
| DOMContentLoaded | 2,145ms | 1,929ms | -10.1% |
| Load | 4,152ms | 8,760ms | +111.0% |
| 마지막 요청 종료 | 16,642ms | 33,746ms | +102.8% |
| 전송량 | 5,388,106 bytes | 5,524,351 bytes | +2.5% |
| 이미지 전송량 | 3,351,177 bytes | 3,486,938 bytes | +4.1% |

`Load`와 마지막 요청 종료의 편차는 아직 허용 범위를 크게 넘는다. run02의 마지막 활동은 33.73초에 재요청된 `taste_bg3.webp`였다. 사용자에게 보이는 완료 시점과 동일하다고 단정할 수는 없지만, 지연 실행과 중복 이미지 요청이 페이지 수명 주기를 길게 끄는 사실은 분명하다.

## 10. run02 판정

- [x] GCS 정적 JSON 응답 자체는 빠르다.
- [x] bootstrap이 빨라도 보조 회원 API가 8초대까지 시작되지 않는 현상이 재현됐다.
- [x] MD PICK 대표이미지는 다운로드보다 요청 시작이 늦다.
- [x] 로그인 API 순차 실행이 재현됐다.
- [x] 동일 이미지 URL 4개 그룹, 482,945 bytes 재전송을 확인했다.
- [x] 원 홈페이지 이벤트 API는 병목이 아니다.
- [x] Supabase 기본 이미지 DNS 실패가 재현됐다.
- [ ] 같은 조건 run03을 저장한다.
- [ ] 3회 편차와 중앙값을 계산해 최종 기준선을 확정한다.

분석용 안전 자료:

- `20260805_pc_login_cold_run02.sanitized.json`
- `20260805_pc_login_cold_run02.analysis.json`
