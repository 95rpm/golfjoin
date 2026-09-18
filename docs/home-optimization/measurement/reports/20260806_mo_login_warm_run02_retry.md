# `8A853...` 모바일 로그인 웜 HAR 공식 run02

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`

## 1. 측정 파일 판정

- [!] 최초 `20260806_mo_login_warm_run02.har`은 Network 필터가 적용된 상태로 저장돼 홈 카드 요청 1개만 포함했다.
- [x] 최초 파일은 공식 통계에서 제외하고 측정 절차 확인용으로만 보존한다.
- [x] 재측정 파일에는 문서·CSS·JavaScript·이미지·Fetch를 포함한 요청 119개가 들어 있다.
- [x] 주소창 이동, HTTP 캐시, 회원 앱 캐시 조건이 공식 run01과 같다.
- [x] 재측정 파일을 공식 Warm run02로 채택한다.

## 2. 공식 run01과 비교

| 지표 | 공식 run01 | 공식 run02 | 변화 | 판정 |
|---|---:|---:|---:|---|
| 요청 수 | 117개 | 119개 | +1.7% | 안정적 |
| 총 전송량 | 557,090 bytes | 548,340 bytes | -1.6% | 안정적 |
| DOMContentLoaded | 876ms | 673ms | -23.2% | run02가 빠름, run03 확인 |
| Load | 5,057ms | 4,337ms | -14.2% | 20% 안 |
| 골프조인 API | 3개 | 3개 | 0% | 앱 캐시 재현 |
| 골프조인 핵심 API 종료 | 6,240ms | 5,333ms | -14.5% | 20% 안 |
| 0-byte 요청 | 103개 | 106개 | +2.9% | HTTP 캐시 재현 |
| 상품 대표이미지 수 | 16개 | 16개 | 0% | 같은 구성 |
| 상품 대표이미지 전송 | 0 bytes | 0 bytes | 동일 | HTTP 캐시 재현 |
| 홈 카드 완료 → MD PICK 이미지 묶음 | 3,123ms | 2,866ms | -8.2% | 안정적 |
| MD PICK 묶음 → `30001242` | 8,346ms | 8,275ms | -0.9% | 고정 지연 반복 |
| 304 응답 | 3개 | 3개 | 동일 | 같은 재검증 경로 |
| 중복 요청 그룹 | 0개 | 0개 | 동일 | 정상 |
| Supabase status 0 | 1개 | 1개 | 동일 | 지속 예외 후보 |

요청 수·전송량·Load·핵심 API·MD PICK 이미지 시점은 두 번 모두 같은 범위다. DOMContentLoaded는 run02가 203ms 더 빨라 상대 변화가 23.2%지만 절대값은 모두 1초 이하다. run03을 수집한 뒤 중앙값과 상대 범위로 최종 판정한다.

## 3. HTTP 캐시 검증

| 자산 | run02 결과 | 실제 전송 |
|---|---|---:|
| 버전 홈 카드 `home-cards/ghc_...json` | status 200, cache | 0 bytes |
| 홈 manifest | status 304 | 13 bytes |
| 상품군 manifest | status 304 | 13 bytes |
| 버전 상품군 catalog | status 304 | 13 bytes |
| CSS 9개 | cache | 0 bytes |
| JavaScript 40개 | cache | 0 bytes |
| 폰트 2개 | cache | 0 bytes |
| 이미지 55개 | 53개 cache | 합계 44 bytes |
| 상품 대표이미지 16개 | cache | 0 bytes |

- [x] 119개 요청 중 106개가 0 bytes다.
- [x] 이미지의 44 bytes는 추적 이미지 2개이며 상품 이미지 전송은 없다.
- [x] literal `no-cache`는 동적 골프조인 API 3개, preflight, analytics의 총 5개뿐이다.
- [x] GCS manifest 2개와 상품군 catalog는 `max-age=0`으로 304 재검증됐다.
- [x] 모든 하위 요청이 강제 재검증된 실패 표본과 다르다.
- [!] 상품군 catalog의 304 왕복 제거는 후속 최적화 후보로 유지한다.

메인 HTML은 490,537 bytes로 전체 전송량의 약 89.5%다. 이미지와 정적 자산이 캐시된 웜 진입에서는 큰 단일 HTML이 가장 무거운 자산이라는 사실이 run01에 이어 반복됐다.

## 4. 앱 캐시와 API 시점

| API | 시작 | 소요 | 종료 |
|---|---:|---:|---:|
| `home_bootstrap_light` | 591ms | 169ms | 760ms |
| 전체 `new_schedule_applications` | 4,399ms | 613ms | 5,012ms |
| 회원 `new_schedule_applications` | 4,399ms | 934ms | 5,333ms |

- [x] 회원 `join_applications`, `join_wishes_lookup`, `home_stats`는 앱 캐시 재사용으로 실행되지 않았다.
- [x] bootstrap 뒤 두 일정 API가 같은 4.399초에 병렬로 시작했다.
- [x] bootstrap 종료 → 일정 API 시작 공백은 3,639ms로 run01의 4,193ms보다 13.2% 짧다.
- [x] 가장 느린 일정 API는 934ms로 run01의 1,096ms보다 14.8% 짧다.
- [x] run01 끝부분의 별도 `/mypage/member` 요청은 run02에서 발생하지 않았다.

## 5. 대표이미지 시점

- 홈 카드 JSON 완료: 0.688초
- 첫 개인화 대표이미지 캐시 조회: 2.295초
- 홈 카드 완료 → 첫 개인화 대표이미지: 1.607초
- MD PICK 이미지 묶음 캐시 조회: 3.554초
- 홈 카드 완료 → MD PICK 이미지 묶음: 2.866초
- `goodSeq=30001242` 별도 캐시 조회: 11.829초

- [x] MD PICK 이미지 묶음은 run01과 8.2% 이내로 반복됐다.
- [x] 상품 대표이미지 16개는 모두 0 bytes다.
- [!] `goodSeq=30001242`는 주 이미지 묶음보다 8.275초 늦다. run01의 8.346초와 거의 같아 고정 타이머 경로임을 다시 확인했다.

## 6. 파일 무결성과 개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw HAR | 13,016,208 bytes | `7AD214F5C913419B6DE1D84B491684FFBA3FF3CECDA4CC0C312E10C70FBC58FF` |
| 개인정보 제거본 | 586,090 bytes | `6B41E249CF9580B8B50816206C8A2D555F0F8028E1EE981FEA4C9A44182A94B9` |
| 안전 분석본 | 20,055 bytes | `64C64170CEFDA0E1EC0CBECCF601E106A540C4BDB4843E36EE6D008C25C228F2` |

- [x] raw HAR은 `.gitignore` 대상이다.
- [x] 제거본의 미삭제 민감값, Cookie 값, 응답 본문, 요청 본문은 0건이다.
- [x] 제거본과 안전 분석본의 이메일·경계가 있는 국내 휴대전화 패턴은 0건이다.
- [x] 안전 분석본의 `memberSeq`, `memberId`, `memberMobile`, `memberEmail`, Cookie는 0건이다.
- [x] 제품 HTML은 수정하지 않았다.
- [x] 측정 전 HTML 해시는 두 번 모두 `8A853...`로 일치했다.

## 7. 다음 단계

- [x] 공식 Warm run01 채택
- [x] 공식 Warm run02 채택
- [ ] 같은 조건의 공식 Warm run03 측정
- [ ] 3회 중앙값·상대 범위 계산
- [ ] Cold·Warm 기준선을 Phase 1 전후 비교표로 고정
