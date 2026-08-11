# `8A853...` 모바일 비로그인 Warm 공식 run02

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
환경: Chrome Device Toolbar 모바일 UA, 약 412×915, 로그아웃, HTTP·비회원 앱 캐시 Warm, `No throttling`  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`

## 1. 최종 판정

- [x] 전체 111개 중 100개 요청이 0 bytes로 브라우저 캐시를 재사용했다.
- [x] 상품 대표이미지 14개는 모두 0 bytes다.
- [x] CSS 9개·JavaScript 40개·폰트 2개는 모두 0 bytes다.
- [x] 홈 카드 JSON은 0 bytes로 재사용됐다.
- [x] 골프조인 API는 `home_bootstrap_light` 1개만 실행됐다.
- [x] 공식 모바일 비로그인 Warm run02로 채택한다.
- [ ] run03에서 중앙값과 상대 범위를 확정한다.

## 2. 공식 run01과 반복성 비교

| 지표 | run01 | run02 | 변화 | 판정 |
|---|---:|---:|---:|---|
| 요청 수 | 113개 | 111개 | -1.8% | 후속 세션 확인 2개 차이 |
| 총 전송량 | 522,714 bytes | 522,804 bytes | +0.017% | 사실상 동일 |
| DOMContentLoaded | 688ms | 797ms | +15.9% | 20% 이내 |
| Load | 9,925ms | 9,683ms | -2.4% | 안정적 |
| 홈 카드 완료 | 701ms | 821ms | +17.1% | 20% 이내 |
| 핵심 상품이미지 묶음 | 9,748ms | 9,500ms | -2.5% | 안정적 |
| 마지막 상품이미지 | 17,746ms | 17,528ms | -1.2% | 안정적 |
| 핵심 묶음→마지막 이미지 | 7,998ms | 8,028ms | +0.4% | 고정 타이머 반복 |
| 상품이미지 전송량 | 0 bytes | 0 bytes | 동일 | 완전 캐시 |
| 골프조인 API | 1개 | 1개 | 동일 | 앱 캐시 반복 |

run01은 첫 4개가 4.65초에 먼저 요청되고 나머지 9개가 9.75초에 요청됐다. run02는 13개가 9.50초에 함께 요청됐다. 초기 묶음 구성은 렌더 순서에 따라 달라졌지만 마지막 `goodSeq=30001242`가 핵심 묶음보다 약 8초 늦는 구조는 동일하다.

## 3. Cold 기준선과 비교

| 지표 | MO 비로그인 Cold 중앙값 | Warm run02 | 변화 |
|---|---:|---:|---:|
| 총 전송량 | 6,028,228 bytes | 522,804 bytes | -91.3% |
| DOMContentLoaded | 1,696ms | 797ms | -53.0% |
| Load | 11,738ms | 9,683ms | -17.5% |
| 홈 카드 완료 | 1,775ms | 821ms | -53.7% |
| 핵심 상품이미지 묶음 | 11,115ms | 9,500ms | -14.5% |
| 마지막 상품이미지 | 19,125ms | 17,528ms | -8.4% |
| 상품이미지 전송량 | 1,329,239 bytes | 0 bytes | -100% |

전송량은 91.3% 줄지만 마지막 이미지 요청은 8.4%만 빨라진다. 이미지 다운로드와 무관한 프런트 타이머가 여전히 지배적이다.

## 4. HTTP·앱 캐시 검증

| 자산 | 결과 | 실제 전송 |
|---|---|---:|
| CSS 9개 | cache | 0 bytes |
| JavaScript 40개 | cache | 0 bytes |
| 폰트 2개 | cache | 0 bytes |
| 이미지 49개 | 47개 0 bytes | 44 bytes |
| 홈 manifest | 304 | 13 bytes |
| 상품군 manifest | 304 | 13 bytes |
| 홈 카드 JSON | status 200, cache | 0 bytes |
| 상품군 catalog | 304 | 13 bytes |

- [x] `no-cache`는 bootstrap·분석 요청에 한정된 3개다.
- [x] run01의 추가 2개는 약 23초 뒤 실행된 `/mypage/member`, `/mypage/mypage` 요청이었다.
- [x] 이번 run02에는 후속 마이페이지 세션 확인이 없어 HAR 전체 기록도 마지막 상품이미지 완료 시점인 17.53초에 끝났다.

메인 HTML은 490,462 bytes로 전체 Warm 전송량의 약 93.8%다.

## 5. 오류와 개인정보 경계

- [x] HTTP 404와 5xx는 0건이다.
- [x] Supabase `productCC1.jpg` status 0은 계속 발생한다.
- [x] 회원별 일정·참여·찜 요청은 0건이다.
- [x] 모바일 원페이지의 `getEventTab.json`, `getEventGoodsList.json`은 실행되지 않았다.

## 6. 파일 무결성과 개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw HAR | 12,013,322 bytes | `F748D1FC40183F7C4C7EEBB132BD886679D316ECBDE6F75CF067FE926A8D1819` |
| 개인정보 제거본 | 508,095 bytes | `63554BE773732B702A26A997D2CBEABAB8AA4CBE20697B87F60C8602B9791A2E` |
| 안전 분석본 | 17,342 bytes | `DDA8A150431B4108E4002B099B91B8E3B945A21493A7F722080373CB6FDEAC92` |

- [x] raw HAR은 `.gitignore` 적용 대상이다.
- [x] 요청·응답 본문과 Cookie 값이 제거됐다.
- [x] 이메일·휴대전화·회원 식별값이 안전 분석본에 없다.
- [x] 측정 도구 테스트 8/8을 통과했다.
- [x] 측정 전후 `golfjoin_main.html` SHA-256은 두 번 모두 `8A853...`다.
- [x] 제품 HTML은 수정하지 않았다.

## 7. 다음 단계

- [x] MO 비로그인 Warm 공식 run02 채택
- [ ] 동일 조건으로 공식 run03 측정
- [ ] 3회 중앙값·상대 범위 확정

