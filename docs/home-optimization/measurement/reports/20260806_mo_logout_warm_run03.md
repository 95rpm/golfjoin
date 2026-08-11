# `8A853...` 모바일 비로그인 Warm 공식 run03

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
환경: Chrome Device Toolbar 모바일 UA, 약 412×915, 로그아웃, HTTP·비회원 앱 캐시 Warm, `No throttling`  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`

## 1. 최종 판정

- [x] 전체 114개 중 103개 요청이 0 bytes로 브라우저 캐시를 재사용했다.
- [x] 상품 대표이미지 14개는 모두 0 bytes다.
- [x] CSS 9개·JavaScript 40개·폰트 2개가 모두 0 bytes다.
- [x] 홈 카드 JSON은 0 bytes로 재사용됐다.
- [x] 골프조인 API는 `home_bootstrap_light` 1개만 실행됐다.
- [x] 공식 모바일 비로그인 Warm run03으로 채택한다.
- [x] 3회 중앙값과 상대 범위를 계산할 수 있는 표본이 완성됐다.

## 2. 핵심 결과

| 지표 | run03 |
|---|---:|
| 요청 수 | 114개 |
| 총 전송량 | 522,782 bytes |
| DOMContentLoaded | 720ms |
| Load | 11,643ms |
| 홈 카드 완료 | 749ms |
| bootstrap 완료 | 846ms |
| 첫 상품이미지 요청 | 5,161ms |
| 핵심 9개 이미지 묶음 | 10,972ms |
| 마지막 상품이미지 요청 | 18,977ms |
| 핵심 묶음→마지막 이미지 | 8,005ms |
| 상품이미지 전송량 | 0 bytes |

## 3. 상품이미지 요청 순서

- 첫 4개: 약 5.16초
- 다음 9개: 약 10.97초
- 마지막 `goodSeq=30001242`: 약 18.98초

핵심 9개 묶음 뒤 마지막 이미지까지 **8,005ms**가 걸렸다. run01 7,998ms, run02 8,028ms와 같은 고정 지연 경로다.

첫 일부 이미지가 미리 요청되는 실행과 13개가 한 번에 요청되는 실행이 섞이므로 전체 첫 이미지 시점만 사용하면 편차가 커진다. 모든 화면에서 공통으로 나타나는 핵심 묶음과 마지막 이미지의 간격을 개선 기준으로 사용해야 한다.

## 4. HTTP·앱 캐시 검증

| 자산 | 결과 | 실제 전송 |
|---|---|---:|
| CSS 9개 | cache | 0 bytes |
| JavaScript 40개 | cache | 0 bytes |
| 폰트 2개 | cache | 0 bytes |
| 이미지 50개 | 48개 0 bytes | 44 bytes |
| 홈 manifest | 304 | 13 bytes |
| 상품군 manifest | 304 | 13 bytes |
| 홈 카드 JSON | status 200, cache | 0 bytes |
| 상품군 catalog | 304 | 13 bytes |

메인 HTML은 490,462 bytes로 전체 Warm 전송량의 약 93.8%다.

## 5. 오류와 개인정보 경계

- [x] 골프조인 API는 `home_bootstrap_light` 1개다.
- [x] `home_stats`는 앱 캐시에서 재사용됐다.
- [x] 회원별 일정·참여·찜 요청은 0건이다.
- [x] HTTP 404와 5xx는 0건이다.
- [x] Supabase `productCC1.jpg` status 0은 계속 발생한다.
- [x] 모바일 원페이지의 `getEventTab.json`, `getEventGoodsList.json`은 실행되지 않았다.

## 6. 파일 무결성과 개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw HAR | 12,374,628 bytes | `3EBE901F8C6872C2DD2FB0CD99FBE28C1DB0B2962662E38CB7234D49A55D1279` |
| 개인정보 제거본 | 529,417 bytes | `45C4EDB6199697110F58BE129C2479F72BA58D4F5E3DE89C9AD9E06750C4A7D1` |
| 안전 분석본 | 17,807 bytes | `D174E913A650D7671C8DA1C14519D92165D98346B011D4753C76BAFF98983B8E` |

- [x] raw HAR은 `.gitignore` 적용 대상이다.
- [x] 요청·응답 본문과 Cookie 값이 제거됐다.
- [x] 이메일·휴대전화·회원 식별값이 안전 분석본에 없다.
- [x] 측정 도구 테스트 8/8을 통과했다.
- [x] 측정 전후 `golfjoin_main.html` SHA-256은 두 번 모두 `8A853...`다.
- [x] 제품 HTML은 수정하지 않았다.

## 7. 다음 단계

- [x] MO 비로그인 Warm 공식 run03 채택
- [x] MO 비로그인 Warm 3회 기준선 작성
- [ ] 운영 전환·복구 리허설과 0단계 최종 판정

