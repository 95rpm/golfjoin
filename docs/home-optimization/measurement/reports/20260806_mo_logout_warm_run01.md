# `8A853...` 모바일 비로그인 Warm 공식 run01

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
환경: Chrome Device Toolbar 모바일 UA, 약 412×915, 로그아웃, HTTP·비회원 앱 캐시 Warm, `No throttling`  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`

## 1. 최종 판정

- [x] 전체 113개 중 102개 요청이 0 bytes로 브라우저 캐시를 재사용했다.
- [x] 상품 대표이미지 14개는 모두 0 bytes다.
- [x] CSS 9개·JavaScript 40개·폰트 2개가 모두 0 bytes다.
- [x] 버전 홈 카드 JSON은 0 bytes로 재사용됐다.
- [x] 비회원 앱 캐시가 재사용되어 `home_bootstrap_light` 1개만 실행됐다.
- [x] 공식 모바일 비로그인 Warm run01로 채택한다.
- [ ] 같은 조건으로 run02·run03을 측정해 중앙값과 편차를 확정한다.

## 2. Cold 중앙값과 비교

| 지표 | MO 비로그인 Cold 중앙값 | Warm run01 | 변화 | 의미 |
|---|---:|---:|---:|---|
| 요청 수 | 117개 | 113개 | -3.4% | 호출 개수는 유사 |
| 총 전송량 | 6,028,228 bytes | 522,714 bytes | -91.3% | HTTP 캐시 효과가 큼 |
| DOMContentLoaded | 1,696ms | 688ms | -59.4% | 정적 자산 재사용 효과 |
| Load | 11,738ms | 9,925ms | -15.4% | 고정 작업 때문에 개선폭 제한 |
| 홈 카드 완료 | 1,775ms | 701ms | -60.5% | 버전 JSON 캐시 정상 |
| 첫 상품이미지 요청 | 11,115ms | 4,653ms | -58.1% | 빨라졌지만 즉시는 아님 |
| 마지막 상품이미지 요청 | 19,125ms | 17,746ms | -7.2% | 캐시가 있어도 약 17.75초 |
| 상품이미지 전송량 | 1,329,239 bytes | 0 bytes | -100% | 이미지 서버는 Warm 병목 아님 |
| 골프조인 API | 2개 | 1개 | -50% | `home_stats` 앱 캐시 재사용 |

네트워크 전송량은 91.3% 줄었지만 Load는 15.4%, 마지막 이미지 요청은 7.2%만 개선됐다. 캐시와 무관한 프런트 타이머가 사용자 체감 속도를 제한한다.

## 3. HTTP 캐시 검증

| 자산 | 결과 | 실제 전송 | 판정 |
|---|---|---:|---|
| CSS 9개 | cache | 0 bytes | 정상 재사용 |
| JavaScript 40개 | cache | 0 bytes | 정상 재사용 |
| 폰트 2개 | cache | 0 bytes | 정상 재사용 |
| 이미지 49개 | 47개 0 bytes | 44 bytes | 비영(非零) 이미지는 추적용 2개 |
| 홈 manifest | 304 | 13 bytes | revision 재검증 |
| 상품군 manifest | 304 | 13 bytes | revision 재검증 |
| 버전 홈 카드 JSON | status 200, cache | 0 bytes | 정상 재사용 |
| 상품군 catalog | 304 | 13 bytes | loader 재검증 |

- [x] `no-cache`는 동적 API·분석·후속 세션 확인에 한정된 5개다.
- [x] HTTP 304는 manifest·catalog 3개다.
- [x] 상품 대표이미지 14개는 요청 기록만 남고 본문은 내려받지 않았다.

메인 HTML은 490,462 bytes로 전체 Warm 전송량의 약 93.8%다. 모바일 Warm 재방문에서도 단일 HTML이 가장 큰 네트워크 자산이다.

## 4. Warm에서도 남는 8초 지연

상품이미지 요청 순서:

- 첫 4개: 약 4.65초
- 다음 9개: 약 9.75초
- 마지막 `goodSeq=30001242`: 약 17.75초

9개 묶음→마지막 이미지 공백은 **7,998ms**다. Cold 중앙값 8,009ms와 11ms 차이에 불과하다. 상품이미지가 이미 캐시되어 있어도 코드가 마지막 이미지를 약 8초 뒤에 DOM 요청으로 등록한다.

## 5. 앱 캐시와 오류

실행된 골프조인 API:

- `home_bootstrap_light`: 596ms 시작, 182ms 소요, 778ms 완료

실행되지 않은 비회원 보조 API:

- `home_stats`

- [x] 회원별 일정·참여·찜 요청은 0건이다.
- [x] HTTP 404와 5xx는 0건이다.
- [x] Supabase `productCC1.jpg` status 0은 계속 발생한다.
- [x] 모바일 원페이지의 `getEventTab.json`, `getEventGoodsList.json`은 실행되지 않았다.

## 6. 파일 무결성과 개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw HAR | 12,029,346 bytes | `EFAAE75177024A182EBFD31F481DD2E9709B21367EE296C2E6A6885868D2F2CE` |
| 개인정보 제거본 | 524,304 bytes | `9316704304E2D8D7AFBBB62F32095985892FF1866D2A146D4F1D06B4814D1A32` |
| 안전 분석본 | 17,908 bytes | `C864283DD365F3722E14D0DF1DBA7B2ABF9D59814473BF162A5DD4D030756BA1` |

- [x] raw HAR은 `.gitignore` 적용 대상이다.
- [x] 요청·응답 본문과 Cookie 값이 제거됐다.
- [x] 이메일·휴대전화·회원 식별값이 안전 분석본에 없다.
- [x] 측정 도구 테스트 8/8을 통과했다.
- [x] 측정 전후 `golfjoin_main.html` SHA-256은 두 번 모두 `8A853...`다.
- [x] 제품 HTML은 수정하지 않았다.

## 7. 다음 단계

- [x] MO 비로그인 Warm 공식 run01 채택
- [ ] 동일 조건으로 공식 run02 측정
- [ ] 공식 run03 측정
- [ ] 3회 중앙값·상대 범위 확정

