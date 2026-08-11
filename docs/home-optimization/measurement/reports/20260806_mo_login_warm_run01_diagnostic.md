# `8A853...` 모바일 로그인 웜 HAR run01 진단 표본

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`

## 1. 판정

- [x] 로그인 앱 캐시는 웜 상태였다.
- [!] HTTP 캐시는 웜 상태가 아니었다.
- [!] 109개 요청 중 status 0 한 건을 제외한 108개에 `Cache-Control: no-cache`가 붙었다.
- [!] immutable 홈 카드 JSON도 219,187 bytes를 다시 전송했다.
- [x] 원인은 캐시를 끄지 못한 것이 아니라 실제 측정 진입이 브라우저의 reload 동작으로 처리된 것이다.
- [x] 공식 모바일 로그인 웜 run01 통계에서는 제외한다.
- [x] 앱 캐시 효과를 확인하는 진단 표본으로만 보존한다.

## 2. 콜드 중앙값 비교

| 항목 | 콜드 3회 중앙값 | 웜 진단 | 변화 |
|---|---:|---:|---:|
| 요청 수 | 130개 | 109개 | -16.2% |
| 전송량 | 6.01MiB | 5.26MiB | -12.4% |
| 전체 네트워크 기록 | 16,480ms | 12,925ms | -21.6% |
| DOMContentLoaded | 1,902ms | 1,817ms | -4.5% |
| Load | 9,803ms | 4,912ms | -49.9% |
| 골프조인 API | 6개 | 3개 | -50.0% |
| 상품 이미지 요청 | 14개 | 7개 | -50.0% |

HTTP 캐시가 사용되지 않았는데도 Load와 요청 수가 줄어든 것은 회원 앱 캐시가 초기 화면 구성과 API 경로를 바꿨기 때문이다. 이를 HTTP 웜 효과로 해석하면 안 된다.

## 3. 앱 캐시 상태

실행된 골프조인 API:

- `home_bootstrap_light`
- 전체 `new_schedule_applications`
- 회원 `new_schedule_applications`

실행되지 않은 API:

- 회원 `join_applications`
- `join_wishes_lookup`
- `home_stats`

따라서 회원 보조 데이터 캐시는 실제로 사용됐다. 앱 캐시만으로도 API가 6개에서 3개로 줄고 Load가 약 절반이 됐다.

## 4. HTTP 캐시 미사용 증거

| 객체 | 응답 정책 | 실제 요청 | 전송량 |
|---|---|---|---:|
| 홈 manifest | `max-age=60` | `no-cache` | 473 bytes |
| 버전 홈 카드 | 1년 `immutable` | `no-cache` | 219,187 bytes |
| 상품군 manifest | `max-age=15` | `no-cache` | 638 bytes |
| 버전 상품군 catalog | 1년 `immutable` | `no-cache` | 105,982 bytes |
| 상품 대표이미지 | 서버 요청 | `no-cache` | 전량 재전송 |

버전 홈 카드와 catalog가 immutable인데도 전송됐으므로 이번 실행을 HTTP 웜으로 채택할 수 없다.

## 5. 소스 캐시 정책에서 발견한 점

- 홈 카드 JSON은 `fetchGolfJoinHomeJson()`의 기본값 `force-cache`를 사용한다.
- 홈 manifest는 최신 revision 확인을 위해 명시적으로 `no-cache`를 사용한다.
- 상품군 loader의 `fetchGolfJoinProductFamilyJson()` 기본값은 `no-cache`다.
- 이 기본값이 상품군 manifest뿐 아니라 이미 revision이 붙은 immutable catalog에도 그대로 적용된다.

따라서 정상적인 주소 이동으로 공식 웜을 측정해도 홈 카드 JSON은 캐시되어야 하지만 상품군 catalog 105,982 bytes는 현재 코드상 다시 검증·전송될 수 있다. 이는 후속 저위험 최적화 후보다.

## 6. 파일 무결성과 개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw HAR | 12,227,114 bytes | `A531A974F78C9F2B89301E6139D565D115A9C3CD66D2A8B9BC983F2BC57416BA` |
| 개인정보 제거본 | 739,719 bytes | `AA70FDD14269686E2CD042A835254425BB3D315A29FF9A75C49241479CC0FAAF` |
| 안전 분석본 | 15,094 bytes | `19C16108475A5BDE1BB7AD1A5E0345BDBDA83AD035C3E99C22CD12FB3BF6F0EB` |

- [x] raw HAR은 `.gitignore` 대상이다.
- [x] 제거본의 Cookie·본문은 제거되고 회원 쿼리값은 `[REDACTED]`다.
- [x] 안전 분석본 개인정보는 0건이다.
- [x] 제품 HTML은 수정하지 않았다.

## 7. 공식 재측정 조건

- [ ] 예열 후 실제 측정 진입은 reload 버튼이 아니라 주소창 `Ctrl+L` → `Enter`를 사용한다.
- [ ] 실제 측정 요청 대부분에 `Cache-Control: no-cache`가 붙지 않아야 한다.
- [ ] 버전 홈 카드 JSON은 memory/disk cache 또는 0 bytes 전송이어야 한다.
- [ ] 회원 앱 캐시가 유지되어 보조 API가 3개 이하인지 확인한다.
- [ ] 위 조건을 만족하는 대체 run01을 공식 표본으로 채택한다.
