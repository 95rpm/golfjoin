# `8A853...` 모바일 로그인 웜 HAR 공식 run01

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`

## 1. 최종 판정

- [x] 주소창 `Ctrl+L` → `Enter`로 새 navigation을 만들어 측정했다.
- [x] 버전 홈 카드 JSON은 disk cache에서 0 bytes로 재사용됐다.
- [x] CSS 9개, 스크립트 40개, 폰트 2개가 모두 0 bytes로 재사용됐다.
- [x] 로그인 보조 API는 콜드 6개에서 3개로 줄어 앱 캐시도 웜 상태였다.
- [x] 모든 요청에 `no-cache`가 붙었던 최초 진단 표본과 달리, 이번에는 literal `no-cache` 요청이 117개 중 6개뿐이다.
- [x] HTTP 캐시와 앱 캐시가 동시에 사용된 공식 웜 run01로 채택한다.
- [ ] 같은 조건의 run02·run03을 추가해 중앙값과 편차를 확정한다.

## 2. 콜드 3회 중앙값과 비교

| 지표 | 콜드 중앙값 | 공식 웜 run01 | 변화 | 쉬운 설명 |
|---|---:|---:|---:|---|
| 요청 수 | 130개 | 117개 | -10.0% | 앱 캐시로 회원 보조 요청이 줄었다. |
| 총 전송량 | 6,299,253 bytes | 557,090 bytes | -91.2% | 이미지·CSS·스크립트를 대부분 다시 받지 않았다. |
| DOMContentLoaded | 1,902ms | 876ms | -53.9% | HTML 구조가 준비되는 시간이 절반 이하로 줄었다. |
| Load | 9,803ms | 5,057ms | -48.4% | 브라우저의 기본 로드 완료가 약 4.75초 빨라졌다. |
| 전체 이미지 전송량 | 4,058,206 bytes | 44 bytes | -99.999% | 44 bytes는 추적 이미지 2개의 전송량이며 상품 이미지는 0 bytes다. |
| 상품 대표이미지 전송량 | 1,329,244 bytes | 0 bytes | -100% | 이미 저장된 상품 이미지를 브라우저에서 즉시 재사용했다. |
| 골프조인 API 수 | 6개 | 3개 | -50.0% | 참여·찜·통계 캐시가 재사용됐다. |
| 골프조인 핵심 API 종료 | 16,391ms | 6,240ms | -61.9% | 회원용 핵심 데이터 갱신이 약 10.15초 일찍 끝났다. |
| HAR 전체 기록 | 16,480ms | 18,808ms | +14.1% | 18.74초에 별도 `/mypage/member` 요청이 시작돼 길어진 값이므로 Load와 핵심 API 종료를 함께 봐야 한다. |

전체 HAR 종료 시각 하나만 보면 웜이 느려 보이지만 페이지 Load는 약 48.4% 빨라졌고 골프조인 핵심 API는 6.24초에 끝났다. 마지막 `/mypage/member` 요청은 별도 지연 세션 확인 후보로 기록하고, 메인 캐시 효과와 섞어 판단하지 않는다.

## 3. HTTP 캐시 검증

| 자산 | 결과 | 실제 전송 | 판정 |
|---|---|---:|---|
| 버전 홈 카드 `home-cards/ghc_...json` | status 200, disk cache | 0 bytes | 정상 재사용 |
| 홈 manifest | status 304 | 13 bytes | 최신 revision만 재검증 |
| 상품군 manifest | status 304 | 13 bytes | 최신 revision만 재검증 |
| 버전 상품군 catalog | status 304 | 13 bytes | 본문은 재전송하지 않았지만 불필요한 재검증 후보 |
| CSS 9개 | status 200, cache | 0 bytes | 정상 재사용 |
| 스크립트 40개 | status 200, cache | 0 bytes | 정상 재사용 |
| 폰트 2개 | status 200, cache | 0 bytes | 정상 재사용 |
| 이미지 52개 | 50개 0 bytes | 합계 44 bytes | 상품·UI 이미지는 캐시, 추적 이미지 2개만 소량 전송 |

- [x] 전체 117개 중 103개가 0 bytes다.
- [x] 304 응답 3개는 합계 39 bytes만 전송했다.
- [x] 버전 홈 카드에 `no-cache`가 붙지 않았다.
- [x] 최초 진단의 219,187-byte 홈 카드 재전송이 사라졌다.
- [!] 현재 상품군 loader의 기본 `no-cache` 정책 때문에 immutable catalog도 304 재검증한다. 본문 재전송은 없지만 네트워크 왕복은 Phase 1 이후 최적화 후보로 남긴다.

메인 HTML 문서 전송량은 490,537 bytes로 전체 557,090 bytes의 약 88.1%다. 웜 캐시에서 이미지 전송이 거의 사라진 뒤에는 큰 단일 HTML이 가장 무거운 자산이므로, 후속 단계의 CSS·JavaScript 분리와 revision 자산화 효과를 비교할 기준이 된다.

## 4. 앱 캐시와 API 시점

실행된 골프조인 API:

- `home_bootstrap_light`: 0.785초 시작, 166ms 소요
- 전체 `new_schedule_applications`: 5.144초 시작, 1,096ms 소요
- 회원 `new_schedule_applications`: 5.145초 시작, 472ms 소요

실행되지 않은 보조 API:

- 회원 `join_applications`
- `join_wishes_lookup`
- `home_stats`

- [x] 회원 앱 캐시가 재사용돼 초기 API가 3개로 유지됐다.
- [x] bootstrap 종료 뒤 일정 API 시작까지 공백은 4,193ms로, 콜드 중앙값 7,826ms보다 짧다.
- [x] 두 일정 API는 거의 동시에 시작했다.
- [!] 전체 일정 API 한 건의 서버 대기 시간이 약 1.09초다. run02·run03에서 반복 여부를 확인한다.
- [!] 18.735초의 `/mypage/member` 요청은 핵심 API와 별도로 추적한다.

## 5. 상품 대표이미지 시점

- 홈 카드 JSON 완료: 0.893초
- 나의 모임과 겹치는 첫 대표이미지 캐시 조회: 2.078초
- 홈 카드 완료 → 첫 대표이미지: 1.185초
- MD PICK 렌더 대표이미지 캐시 조회 시작: 4.016초
- 홈 카드 완료 → MD PICK 이미지 묶음: 3.123초
- `goodSeq=30001242`의 별도 캐시 조회: 12.362초

이번 웜 표본에는 개인화된 나의 모임 이미지 2개가 추가돼 `/goods/main/` 이미지 URL이 16개지만, 모두 0 bytes다. MD PICK에 해당하는 기존 14개 이미지도 모두 브라우저 캐시를 재사용했다.

- [x] 이미지 서버 다운로드 시간은 웜 진입의 병목이 아니다.
- [x] 최초 화면에 필요한 이미지가 캐시에 있으면 실제 네트워크 전송 없이 표시할 수 있다.
- [!] `goodSeq=30001242`는 콜드 3회에 이어 웜에서도 주 이미지 묶음보다 약 8.35초 늦게 조회됐다. 소스의 별도 지연 경로는 여전히 남아 있다.

## 6. 예외와 후속 확인

- 중복 요청 그룹은 0개다.
- Supabase `productCC1.jpg` status 0은 콜드 3회와 동일하게 남았다.
- literal `no-cache` 6개는 동적 골프조인 API 3개, preflight 1개, analytics 1개, `/mypage/member` 1개다.
- GCS manifest 2개와 상품군 catalog 1개는 `max-age=0` 재검증이므로, 모든 하위 요청을 강제 재검증했던 실패 표본과는 다르다.

## 7. 파일 무결성과 개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw HAR | 12,609,414 bytes | `B4F572DDD34F1F59DCE97AC56C4CFA1848F17F4B704C7A88C816E9D02CE26A83` |
| 개인정보 제거본 | 571,209 bytes | `C78D73F93FAA697538A413C4B1E5EDAB677E1784002368EAF2FCD5CD51C61779` |
| 안전 분석본 | 20,226 bytes | `075760ED3EB8101A646D936EE5429AE0AABC4F00EF9170C252549E2F154F7FE5` |

- [x] raw HAR은 `.gitignore` 대상이다.
- [x] 제거본의 미삭제 민감 헤더·쿼리값, Cookie, 응답 본문, 요청 본문은 모두 0건이다.
- [x] 제거본과 안전 분석본의 이메일 및 경계가 있는 국내 휴대전화 패턴은 0건이다.
- [x] 안전 분석본의 `memberSeq`, `memberId`, `memberMobile`, `memberEmail`, Cookie는 모두 0건이다.
- [x] 제품 HTML은 수정하지 않았다.
- [x] 측정 전후 HTML SHA-256은 두 번 모두 `8A853...`로 일치했다.

## 8. 다음 단계

- [x] 공식 웜 run01 채택
- [ ] 동일 HTML·모바일 로그인·캐시 조건으로 공식 웜 run02 측정
- [ ] 공식 웜 run03 측정
- [ ] 3회 중앙값·상대 범위 계산
- [ ] Cold·Warm 기준선을 Phase 1 전후 비교표로 고정
