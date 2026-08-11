# `8A853...` PC 비로그인 Warm 공식 run03

측정일: 2026-08-06 KST  
운영 URL: `https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`

## 1. 최종 판정

- [x] 전체 121개 중 108개 요청이 0 bytes로 브라우저 캐시를 재사용했다.
- [x] 상품 대표이미지 14개는 모두 0 bytes다.
- [x] 버전 홈 카드 JSON은 0 bytes로 재사용됐다.
- [x] `no-cache`는 앞선 공식 표본과 같은 5개다.
- [x] 총 전송량은 523,674 bytes다.
- [x] 공식 PC 비로그인 Warm run03으로 채택한다.
- [x] run01~03의 중앙값과 상대 범위를 계산할 수 있는 세 표본이 완성됐다.

## 2. 핵심 결과

| 지표 | run03 |
|---|---:|
| 요청 수 | 121개 |
| 총 전송량 | 523,674 bytes |
| DOMContentLoaded | 553ms |
| Load | 8,472ms |
| 0-byte 요청 | 108개 |
| 상품 대표이미지 | 14개 / 0 bytes |
| 홈 카드 완료 | 574ms |
| `home_bootstrap_light` 완료 | 660ms |
| 첫 상품이미지 요청 | 3,909ms |
| 마지막 상품이미지 요청 | 15,910ms |

CSS 8개와 JavaScript 44개는 모두 0 bytes이며, 이미지 54개 중 52개도 0 bytes다. 실제 이미지 전송 44 bytes는 상품 이미지가 아니라 분석 추적 이미지 2개다.

## 3. 대표이미지 지연 순서

- 첫 2개: 약 3.91초
- 다음 11개: 약 7.10초
- `goodSeq=30001242`: 약 15.91초

7.10초 묶음과 마지막 이미지 사이의 공백은 약 8.82초다. 앞선 공식 표본의 8.76초·8.91초 사이에 들어가므로 프런트의 고정 지연 경로가 세 번째로 반복됐다.

## 4. HTTP·앱 캐시 검증

- [x] 홈 manifest: 304 / 13 bytes
- [x] 상품군 manifest: 304 / 13 bytes
- [x] 버전 홈 카드 JSON: status 200 / 0 bytes
- [x] 상품군 catalog: 304 / 13 bytes
- [x] 골프조인 API는 `home_bootstrap_light` 1개만 실행
- [x] `home_stats`는 앱 캐시에서 재사용되어 호출되지 않음
- [x] 회원별 식별 요청 없음

메인 HTML은 490,846 bytes로 전체 Warm 전송량의 약 93.7%다. run01·run02와 1 byte 차이뿐이므로 Warm 재방문의 지배적인 네트워크 자산이라는 결론이 유지된다.

## 5. 원홈페이지 요청

- `getEventTab.json`: 20ms
- `getEventGoodsList.json`: 12ms

합계 약 32ms로 골프조인 대표이미지 지연의 병목이 아니다.

## 6. 파일 무결성과 개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw HAR | 12,895,656 bytes | `975F616295122B5F679D272136399028706EAEF5B59E9A39C2FCB81F0F7249E6` |
| 개인정보 제거본 | 579,693 bytes | `92BACE43D46C66E5BC152525B7A9EEE46B5CE7EBCFB211B608D664B7BF9079FD` |
| 안전 분석본 | 18,917 bytes | `095CD5A0BE2892B5A654D061EAD6DA92146CB7583FA8DAB31843407C2EF1EC6D` |

- [x] raw HAR은 `.gitignore` 적용 대상이다.
- [x] 요청·응답 본문과 Cookie 값이 제거됐다.
- [x] 비회원 표본에 회원별 `memberKey`, `memberSeq`, `memberId`, `memberMobile`, `memberEmail` 요청은 없다.
- [x] 측정 도구 테스트 8/8을 통과했다.
- [x] 측정 전후 `golfjoin_main.html` SHA-256은 두 번 모두 `8A853...`다.
- [x] 제품 HTML은 수정하지 않았다.

## 7. 다음 단계

- [x] PC 비로그인 Warm 공식 run03 채택
- [x] PC 비로그인 Warm 3회 기준선 작성
- [ ] 모바일 비로그인 Cold 3회 측정

