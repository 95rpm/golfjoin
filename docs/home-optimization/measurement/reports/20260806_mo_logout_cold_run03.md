# `8A853...` 모바일 비로그인 Cold HAR run03

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
환경: Chrome Device Toolbar 모바일 UA, 약 412×915, 로그아웃, `Disable cache`, `No throttling`  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`

## 1. 최종 판정

- [x] 모바일·로그아웃·HTTP/앱 캐시 Cold 조건이 앞선 두 표본과 같다.
- [x] 비회원 API `home_bootstrap_light`, `home_stats` 2개가 실행됐다.
- [x] 회원별 일정·참여·찜 요청은 0건이다.
- [x] 상품 대표이미지 14개·약 1.329MB가 세 번째로 고정됐다.
- [x] 첫 13개 이미지 뒤 마지막 이미지까지 약 8.01초 지연이 세 번째로 반복됐다.
- [x] 공식 모바일 비로그인 Cold run03으로 채택한다.
- [x] 3회 중앙값·상대 범위를 계산할 수 있는 표본이 완성됐다.

## 2. 핵심 결과

| 지표 | run03 |
|---|---:|
| 요청 수 | 119개 |
| 총 전송량 | 6,028,228 bytes |
| DOMContentLoaded | 1,405ms |
| Load | 12,239ms |
| 상품이미지 수 | 14개 |
| 상품이미지 전송량 | 1,329,347 bytes |
| 상품이미지 최대 다운로드 | 59ms |
| 홈 카드 완료 | 1,464ms |
| 첫 상품이미지 요청 | 11,600ms |
| 마지막 상품이미지 요청 | 19,606ms |
| 마지막 상품이미지 완료 | 19,621ms |

## 3. 고정 지연 경로

- 홈 카드 완료→첫 상품이미지: **10,136ms**
- 첫 13개→마지막 `goodSeq=30001242`: **8,006ms**
- bootstrap 완료→`home_stats` 시작: **10,179ms**

실제 상품이미지 다운로드는 최대 59ms다. 브라우저가 요청을 보내기 전에 8~10초를 기다리는 프런트 실행 순서가 네트워크보다 압도적으로 크다.

비회원 API:

| API | 시작 | 소요 | 완료 |
|---|---:|---:|---:|
| `home_bootstrap_light` | 1,282ms | 243ms | 1,525ms |
| `home_stats` | 11,704ms | 832ms | 12,536ms |

## 4. 조건부 중복 이미지

run03에서는 아래 배경 이미지가 각각 두 번씩 다운로드됐다.

| 이미지 | 첫 전송 | 중복 전송 |
|---|---:|---:|
| `taste_bg1.webp` | 52,483 bytes | 52,491 bytes |
| `taste_bg2.webp` | 68,109 bytes | 68,116 bytes |
| `taste_bg3.webp` | 35,964 bytes | 35,973 bytes |

중복으로 추가된 전송량은 156,580 bytes다. 모바일 로그인 Cold에서도 조건부로 확인됐던 preload·DOM 교체 경쟁 후보이며, 상품 대표이미지 14개 지표와 분리해 기록한다.

## 5. 리소스와 오류

| 유형 | 요청 | 전송량 |
|---|---:|---:|
| 이미지 | 52개 | 3,837,713 bytes |
| JavaScript | 40개 | 938,677 bytes |
| HTML 문서 | 2개 | 490,482 bytes |
| fetch | 9개 | 357,606 bytes |
| 폰트 | 2개 | 341,272 bytes |
| CSS | 9개 | 61,428 bytes |

- [x] HTTP 404와 5xx는 0건이다.
- [x] 외부 Supabase `productCC1.jpg` 1개가 다시 status 0으로 끝났다.
- [x] 모바일 원페이지의 `getEventTab.json`, `getEventGoodsList.json`은 실행되지 않았다.
- [x] 회원 식별정보가 붙은 요청은 0건이다.

## 6. 파일 무결성과 개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw HAR | 12,943,584 bytes | `73DA7FD05B85EAE51EE00E76D6D4A88BC0AF909FB0C520275DE4817B1FA71747` |
| 개인정보 제거본 | 775,773 bytes | `3CEEF2C6D831DBBE631429B0947A3FF6F76E1B66B43D8BF42C1B441454508AD0` |
| 안전 분석본 | 18,069 bytes | `E5501D28039B8864DAF627E41EC22B68B8252F8825DED8A03105240FC1B81ADA` |

- [x] raw HAR은 `.gitignore` 적용 대상이다.
- [x] 요청·응답 본문과 Cookie 값이 제거됐다.
- [x] 이메일·휴대전화·회원 식별값이 안전 분석본에 없다.
- [x] 측정 도구 테스트 8/8을 통과했다.
- [x] 측정 전후 `golfjoin_main.html` SHA-256은 두 번 모두 `8A853...`다.
- [x] 제품 HTML은 수정하지 않았다.

## 7. 다음 단계

- [x] MO 비로그인 Cold 공식 run03 채택
- [x] MO 비로그인 Cold 3회 기준선 작성
- [ ] MO 비로그인 Warm 공식 run01 측정

