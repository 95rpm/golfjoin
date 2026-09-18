# PC 로그인 웜 공식 run02 분석

| 구분 | 값 |
|---|---|
| 측정일 | 2026-08-05 |
| 환경 | PC Chrome, 로그인, 명시적 예열 직후 일반 새로고침 |
| 앱 캐시 조건 | 예열 후 60초 안에 측정 시작 |
| 홈 카드 revision | `ghc_ae528dd46cf2061fe653d927`, 예열된 동일 revision |
| 공식 표본 | PC 로그인 웜 3회 중 2회차로 채택 |
| 기능 코드 변경 | 측정 작업에서는 없음 |

## 1. 파일과 개인정보 검증

- [x] raw HAR은 Git에서 제외되는 `hars/raw`에 보관했다.
- [x] raw HAR은 12,413,798 bytes, 요청 116개다.
- [x] raw HAR SHA-256: `7CE8735CBA4285C94AFF01ECB501E3493EC29F68546266F2D97AC832242F4BCB`
- [x] 개인정보 제거본에서 이메일·인코딩 이메일·휴대폰·Bearer·쿠키·응답 본문 잔존은 모두 0건이다.
- [x] 미가림 구조화 민감 필드와 URL 민감 쿼리는 모두 0건이다.
- [x] 개인정보 제거본 SHA-256: `DD37CE8F6DAA890C3C321CF89059F16213DD11E90BCC95E0C3EC575E54701403`
- [x] 분석 JSON SHA-256: `0718D7443BE6CAEEAFBB149E6EE62683638AD90504E30154917D7E3EB6AFE055`

## 2. 공식 표본 채택 근거

| 조건 | 공식 run01 | 대체 run02 | 판정 |
|---|---:|---:|---|
| 예열 직후 앱 캐시 | 신선함 | 신선함 | 동일 |
| Cloud Function fetch | 3개 | 3개 | 동일 |
| revision 홈 카드 전송 | 0 bytes | 0 bytes | 동일 |
| 상품 대표이미지 전송 | 0 bytes | 0 bytes | 동일 |
| `join/wishes/stats` 재호출 | 없음 | 없음 | 동일 |

- [x] HTTP 캐시와 앱 회원 캐시 조건이 run01과 같다.
- [x] 현재 홈 카드 revision은 예열된 상태로 본문 재전송이 없다.
- [x] 조건이 달랐던 기존 run02 진단 표본을 대체하는 공식 run02로 채택한다.

## 3. 페이지 전체 결과

| 지표 | 공식 run02 |
|---|---:|
| 요청 수 | 116개 |
| DOMContentLoaded | 913ms |
| Load | 2,754ms |
| 마지막 요청 종료 | 19,413ms |
| 실제 전송량 합계 | 548,015 bytes, 약 0.52MiB |
| 전송량 0인 요청 | 100개, 86.2% |
| 이미지 전송량 | 56 bytes |
| 동일 메서드·URL 중복 그룹 | 1개, 재전송 0 bytes |

이번 회차에는 HAR 저장 과정의 `/mypage/member` 세션 확인이 포함되지 않았다. 마지막 요청은 19.41초에 다시 적용된 `taste_bg1.webp`이며 캐시 사용으로 전송량은 0이었다.

## 4. 캐시 효과

| 유형 | 요청 | 전송량 | 전송량 0 요청 |
|---|---:|---:|---:|
| CSS | 8 | 0 bytes | 8개 |
| JavaScript | 44 | 0 bytes | 44개 |
| 이미지 | 48 | 56 bytes | 45개 |
| fetch | 8 | 56,665 bytes | 1개 |
| HTML 문서 | 2 | 489,610 bytes | 0개 |

- [x] CSS와 JavaScript는 모두 본문 재전송 없이 캐시에서 처리됐다.
- [x] 상품·아바타·취향맞춤 이미지는 모두 캐시에서 처리됐다.
- [x] 이미지 네트워크 전송은 외부 추적 픽셀뿐이다.
- [x] 전체 전송량의 대부분은 매번 받는 HTML 문서 489,610 bytes다.

## 5. 정적 데이터

| 요청 | 상태 | 소요 | 전송량 |
|---|---:|---:|---:|
| 상품군 manifest | 304 | 70ms | 13 bytes |
| 홈 manifest | 304 | 19ms | 13 bytes |
| revision 홈 카드 | 200, cache | 6ms | 0 bytes |
| revision 상품군 catalog | 304 | 60ms | 13 bytes |

신규 revision 홈 카드를 예열한 뒤에는 본문 전송량이 0으로 정상 재사용됐다. 반면 revision catalog는 다시 304 재검증을 거쳤다.

## 6. 로그인 API

| 요청 | 시작 | 종료 | 소요 | 전송량 |
|---|---:|---:|---:|---:|
| `home_bootstrap_light` | 801ms | 975ms | 174ms | 31,059 bytes |
| 공개 `new_schedule_applications` | 4,955ms | 5,457ms | 502ms | 17,499 bytes |
| 회원 `new_schedule_applications` | 4,955ms | 5,525ms | 570ms | 8,048 bytes |

- [x] 공식 run01과 같이 Cloud Function fetch는 3개다.
- [x] `join_applications`, `join_wishes_lookup`, `home_stats`는 신선한 앱 캐시를 재사용해 호출되지 않았다.
- [x] 마지막 회원 API는 5.52초에 종료됐다.
- [x] Bootstrap 응답은 174ms로 빠르다.

## 7. MD PICK과 취향맞춤

- MD PICK 렌더 경로 대표이미지 확인: 4,078ms
- 고정 지연 프리로드 구간: 12,395ms
- 상품 대표이미지 실제 전송량: 0 bytes

취향맞춤 배경은 다음 순서로 요청 목록에 나타났다.

| 자산 | 시작 | 전송량 |
|---|---:|---:|
| `taste_bg1.webp` 최초 | 500ms | 0 bytes |
| `taste_bg2.webp` | 9,396ms | 0 bytes |
| `taste_bg3.webp` | 14,407ms | 0 bytes |
| `taste_bg1.webp` 재적용 | 19,411ms | 0 bytes |

자동 테마 순환 때문에 같은 `taste_bg1.webp`가 다시 나타나 전체 Finish를 19.41초까지 늘렸다. 네트워크 비용은 없으므로 Finish가 사용자 체감 완료와 일치하지 않는다는 증거다.

## 8. 공식 run01과 비교

| 지표 | 공식 run01 | 공식 run02 | 변화 |
|---|---:|---:|---:|
| 요청 | 117 | 116 | -0.9% |
| DOMContentLoaded | 940ms | 913ms | -2.9% |
| Load | 2,536ms | 2,754ms | +8.6% |
| 마지막 요청 | 14,086ms | 19,413ms | +37.8% |
| 전송량 | 956,189 bytes | 548,015 bytes | -42.7% |
| 이미지 전송량 | 297,661 bytes | 56 bytes | -100.0% |
| 전송량 0 요청 | 99개 | 100개 | +1개 |
| Cloud Function fetch | 3개 | 3개 | 동일 |
| 보조 회원 API 시작 | 4,139ms | 4,955ms | +19.7% |
| 마지막 회원 API 종료 | 6,054ms | 5,525ms | -8.7% |
| MD PICK 지연 프리로드 | 12,092ms | 12,395ms | +2.5% |

DOMContentLoaded, Load, API 종료, MD PICK 지연 시점은 두 회차가 유사하다. 전체 전송량 차이는 run01에서만 예열되지 않은 `woman2.webp`와 일부 외부 스크립트가 내려온 영향이다. 마지막 요청 편차는 전송량 0인 취향맞춤 자동 순환 시점 때문에 커서 성능 합격 지표로 사용하지 않는다.

## 9. 반복 실패와 원 홈페이지 요청

- [x] Supabase `productCC1.jpg` DNS 실패가 다시 발생했다.
- [x] `getEventTab.json`은 15ms, 413 bytes다.
- [x] `getEventGoodsList.json`은 16ms, 220 bytes다.
- [x] 원 홈페이지 두 요청은 웜에서도 병목이 아니다.

## 10. 판정

- [x] 공식 PC 로그인 웜 run02로 채택한다.
- [x] 웜 HTTP 캐시와 앱 캐시 재현을 확인했다.
- [x] 이미지·스크립트 캐시는 정상 작동한다.
- [x] 고정 8초 프리로드와 취향맞춤 자동 순환은 남아 있다.
- [ ] 같은 명시적 예열 방식으로 공식 run03을 저장한다.
- [ ] 공식 3회 중앙값과 편차를 확정한다.
