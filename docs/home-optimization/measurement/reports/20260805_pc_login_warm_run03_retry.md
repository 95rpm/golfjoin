# PC 로그인 웜 공식 run03 분석

| 구분 | 값 |
|---|---|
| 측정일 | 2026-08-05 |
| 환경 | PC Chrome, 로그인, `home_stats` 예열 완료 직후 일반 새로고침 |
| 앱 캐시 조건 | 마지막 로그인 API 완료를 확인한 뒤 즉시 측정 |
| 홈 카드 revision | `ghc_ae528dd46cf2061fe653d927`, 예열된 동일 revision |
| 공식 표본 | PC 로그인 웜 3회 중 3회차로 채택 |
| 기능 코드 변경 | 측정 작업에서는 없음 |

## 1. 파일과 개인정보 검증

- [x] raw HAR은 Git에서 제외되는 `hars/raw`에 보관했다.
- [x] raw HAR은 12,459,309 bytes, 요청 117개다.
- [x] raw HAR SHA-256: `CF793A83E58DDF96C7844BDE3FE7BACE0AB1F16DABB980AF887D7364F3D512EE`
- [x] 개인정보 제거본에서 이메일·인코딩 이메일·휴대폰·Bearer·쿠키·응답 본문 잔존은 모두 0건이다.
- [x] 미가림 구조화 민감 필드와 URL 민감 쿼리는 모두 0건이다.
- [x] 개인정보 제거본 SHA-256: `FECD958A6AF25C42A45A1E0C5B315DE44A571FA925206D36FC35B4DBAC895AD7`
- [x] 분석 JSON SHA-256: `8E0234FAAB24F785CD9D35E9A78646FE3E488881FF00A34D480B173DF334618F`

## 2. 공식 표본 채택 근거

| 조건 | 공식 run01 | 공식 run02 | 공식 run03 | 판정 |
|---|---:|---:|---:|---|
| Cloud Function fetch | 3개 | 3개 | 3개 | 동일 |
| revision 홈 카드 전송 | 0 bytes | 0 bytes | 0 bytes | 동일 |
| 상품 대표이미지 전송 | 0 bytes | 0 bytes | 0 bytes | 동일 |
| `join/wishes/stats` 재호출 | 없음 | 없음 | 없음 | 동일 |

- [x] HTTP 캐시와 앱 회원 캐시 조건이 앞의 공식 표본과 같다.
- [x] 고정 시간 대신 `home_stats` 예열 완료를 확인한 절차가 정상 작동했다.
- [x] 공식 세 번째 표본으로 채택한다.

## 3. 페이지 전체 결과

| 지표 | 공식 run03 |
|---|---:|
| 요청 수 | 117개 |
| DOMContentLoaded | 832ms |
| Load | 4,019ms |
| 페이지 자체 마지막 요청 종료 | 19,472ms |
| HAR 전체 마지막 요청 종료 | 24,124ms |
| 실제 전송량 합계 | 557,071 bytes, 약 0.53MiB |
| 전송량 0인 요청 | 101개, 86.3% |
| 이미지 전송량 | 44 bytes |

HAR 전체 마지막 요청은 저장 과정에서 창 포커스·가시성이 바뀌며 24.01초에 시작된 `/mypage/member` 세션 확인이다. 페이지 자체 마지막 요청은 19.47초의 `taste_bg1.webp` 자동 재적용이며 전송량은 0이다.

## 4. 캐시 효과

| 유형 | 요청 | 전송량 | 전송량 0 요청 |
|---|---:|---:|---:|
| CSS | 8 | 0 bytes | 8개 |
| JavaScript | 44 | 0 bytes | 44개 |
| 이미지 | 48 | 44 bytes | 46개 |
| fetch | 9 | 65,730 bytes | 1개 |
| HTML 문서 | 2 | 489,613 bytes | 0개 |

- [x] CSS와 JavaScript는 모두 본문 재전송 없이 캐시에서 처리됐다.
- [x] 상품·아바타·취향맞춤 이미지는 모두 캐시에서 처리됐다.
- [x] 이미지 전송 44 bytes는 외부 추적 자산이며 상품 이미지 비용이 아니다.
- [x] 전체 전송량의 대부분은 매번 받는 HTML 문서다.

## 5. 정적 데이터

| 요청 | 상태 | 소요 | 전송량 |
|---|---:|---:|---:|
| 상품군 manifest | 304 | 114ms | 13 bytes |
| 홈 manifest | 304 | 114ms | 13 bytes |
| revision 상품군 catalog | 304 | 11ms | 13 bytes |
| revision 홈 카드 | 200, cache | 5ms | 0 bytes |

revision 홈 카드 본문은 정상적으로 재사용됐다. 두 manifest와 상품군 catalog는 본문을 다시 받지는 않았지만 서버에 변경 여부를 확인하는 304 재검증은 수행했다.

## 6. 로그인 API

| 요청 | 시작 | 종료 | 소요 | 전송량 |
|---|---:|---:|---:|---:|
| `home_bootstrap_light` | 769ms | 936ms | 167ms | 31,072 bytes |
| 공개 `new_schedule_applications` | 6,466ms | 7,499ms | 1,033ms | 17,508 bytes |
| 회원 `new_schedule_applications` | 6,466ms | 7,048ms | 582ms | 8,048 bytes |

- [x] Cloud Function fetch는 공식 run01·run02와 같은 3개다.
- [x] `join_applications`, `join_wishes_lookup`, `home_stats`는 예열된 앱 캐시를 재사용해 호출되지 않았다.
- [x] 마지막 로그인 관련 API는 7.50초에 종료됐다.
- [ ] 보조 일정 API 시작 시점은 공식 run01보다 약 2.33초 늦어 Performance trace에서 JavaScript 예약 지연을 확인한다.

## 7. MD PICK과 취향맞춤

- MD PICK 렌더 경로 대표이미지 확인: 4,059ms
- 고정 지연 프리로드 구간: 12,470ms
- 상품 대표이미지 실제 전송량: 0 bytes

| 자산 | 시작 | 전송량 |
|---|---:|---:|
| `taste_bg1.webp` 최초 | 503ms | 0 bytes |
| `taste_bg2.webp` | 9,454ms | 0 bytes |
| `taste_bg3.webp` | 14,465ms | 0 bytes |
| `taste_bg1.webp` 재적용 | 19,470ms | 0 bytes |

고정 지연 프리로드와 취향맞춤 자동 순환 구조는 그대로 재현됐다. 모두 캐시 적중이므로 네트워크 전송보다 요청을 늦게 시작시키는 JavaScript 구조가 핵심이다.

## 8. 반복 실패와 원 홈페이지 요청

- [x] Supabase `productCC1.jpg` DNS 실패가 다시 발생했다.
- [x] `getEventTab.json`은 15ms, 413 bytes다.
- [x] `getEventGoodsList.json`은 24ms, 220 bytes다.
- [x] 원 홈페이지 두 요청은 웜에서도 병목이 아니다.

## 9. 판정

- [x] 공식 PC 로그인 웜 run03으로 채택한다.
- [x] 공식 웜 표본 3회를 모두 확보했다.
- [x] 이미지·스크립트 HTTP 캐시는 정상 작동한다.
- [x] 앱 캐시 조건을 `home_stats` 완료 확인 방식으로 재현했다.
- [x] 고정 지연 프리로드와 취향맞춤 자동 순환은 남아 있다.
- [ ] Load와 로그인 보조 API 시점 편차의 실행 원인을 Performance trace에서 확인한다.

