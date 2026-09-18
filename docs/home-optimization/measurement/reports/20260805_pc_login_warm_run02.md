# PC 로그인 웜 HAR 2회차 진단

| 구분 | 값 |
|---|---|
| 측정일 | 2026-08-05 |
| 환경 | PC Chrome, 로그인, HTTP 캐시 활성 |
| 실제 조건 | 앱 회원 캐시 60초 만료 + 홈 카드 revision 변경 발생 |
| 기준선 사용 | 진단 자료로 보존, 동일 조건 3회 편차에서는 제외 |
| 기능 코드 변경 | 없음 |

> 동시 변경 주의: HAR 저장은 16:04:37에 끝났고 로컬 `golfjoin_main.html`은 그 뒤 16:06:03에 다른 작업에서 변경됐다. 측정 작업은 이 기능 파일을 수정하거나 되돌리지 않았으며 상세 기록은 `docs/home-optimization/baseline/2026-08-05/CONCURRENT_SOURCE_CHANGE.md`에 남겼다.

## 1. 파일과 개인정보 검증

- [x] raw HAR은 Git에서 제외되는 `hars/raw`에 보관했다.
- [x] raw HAR은 12,023,458 bytes, 요청 119개다.
- [x] raw HAR SHA-256: `88A74C653E93D5E840B1CDC1A99840AF71B46F75FF42506427F0B7020C1862DE`
- [x] 개인정보 제거본에서 이메일·인코딩 이메일·휴대폰·Bearer·쿠키·응답 본문 잔존은 모두 0건이다.
- [x] 미가림 구조화 민감 필드와 URL 민감 쿼리는 모두 0건이다.
- [x] 개인정보 제거본 SHA-256: `BDBFC4F52FA6903D660CDC4F8C4234D21BCD8CC0FC79EAA4FDCCBFBD359A02E4`
- [x] 분석 JSON SHA-256: `B332E34E36C13DA934A514E37F5B485725E1FCE5FFC49A1397B184FB31F0E38B`

## 2. 이 회차를 동일 웜 기준선에서 제외하는 이유

웜 run01 분석과 문서화가 끝난 뒤 run02를 측정해 두 회차 사이에 60초 이상이 지났다. 현재 코드의 회원 읽기 캐시 TTL은 60초다. 또한 측정 사이에 홈 카드 revision이 실제로 교체됐다.

| 항목 | 웜 run01 | 웜 run02 |
|---|---|---|
| 홈 카드 revision | `ghc_e59296c905891b101b6525b2` | `ghc_ae528dd46cf2061fe653d927` |
| 홈 카드 전송 | 0 bytes | 219,187 bytes |
| 회원 Cloud Function fetch | 3개 | 6개 |
| 회원 앱 캐시 | 신선함 | 60초 TTL 만료 |

- [x] HTTP 이미지 캐시는 웜 상태였다.
- [x] 앱 회원 캐시는 run01과 다른 상태였다.
- [x] 홈 데이터 revision도 run01과 달랐다.
- [x] 따라서 두 결과를 같은 조건의 반복 표본으로 평균 내지 않는다.

이 회차는 실제 사용자가 몇 분 뒤 다시 방문했을 때 나타날 수 있는 **HTTP 캐시 웜 + 앱 데이터 캐시 만료 + 신규 홈 revision** 사례로 별도 보존한다.

## 3. 페이지 전체 결과

| 지표 | 웜 run02 진단값 |
|---|---:|
| 요청 수 | 119개 |
| DOMContentLoaded | 1,098ms |
| Load | 8,558ms |
| HAR 전체 마지막 요청 종료 | 89,031ms |
| 페이지 자체 마지막 지연 자산 종료 | 18,526ms |
| 실제 전송량 합계 | 1,038,654 bytes, 약 0.99MiB |
| 전송량 0인 요청 | 96개 |
| 이미지 전송량 | 44 bytes |
| 동일 메서드·URL 중복 그룹 | 0개 |

88.83초에 시작한 `/mypage/member`는 run01과 마찬가지로 HAR 저장 과정의 포커스·가시성 변경이 실행한 `synchronizeJoinErpSession()` 요청이다. 이를 제외한 페이지 자체 마지막 요청은 18.52초의 `taste_bg3.webp`다.

## 4. HTTP 캐시 효과

| 유형 | 요청 | 전송량 | 전송량 0 요청 |
|---|---:|---:|---:|
| CSS | 8 | 0 bytes | 8개 |
| JavaScript | 44 | 254,359 bytes | 41개 |
| 이미지 | 45 | 44 bytes | 43개 |
| fetch | 12 | 292,953 bytes | 0개 |
| HTML 문서 | 2 | 489,613 bytes | 0개 |

모든 상품·아바타·취향맞춤 이미지는 캐시에서 처리됐고 이미지의 실제 네트워크 전송은 추적 픽셀 44 bytes뿐이었다. 웜 이미지 캐시는 정상이다.

JavaScript에서는 Google Tag Manager와 Facebook 외부 스크립트 등이 다시 전송돼 254KB를 차지했다. 골프조인 기능 자산과 외부 분석 스크립트 비용을 분리해 봐야 한다.

## 5. 정적 데이터 revision 변경

| 요청 | 상태 | 소요 | 전송량 |
|---|---:|---:|---:|
| 상품군 manifest | 304 | 124ms | 13 bytes |
| 홈 manifest | 200 | 124ms | 472 bytes |
| revision 상품군 catalog | 304 | 10ms | 13 bytes |
| 신규 revision 홈 카드 | 200 | 18ms | 219,187 bytes |

홈 manifest가 새 홈 카드 URL을 가리켜 신규 JSON이 정상 다운로드됐다. 상품군 catalog revision은 바뀌지 않았다. 이 현상은 현재 홈·상품군 manifest가 서로 다른 시점에 발행될 수 있다는 기존 혼합 revision 위험을 측정 중 직접 보여 준다.

## 6. 회원 API

| 요청 | 시작 | 종료 | 소요 | 전송량 |
|---|---:|---:|---:|---:|
| `home_bootstrap_light` | 938ms | 1,171ms | 233ms | 31,084 bytes |
| 공개 `new_schedule_applications` | 9,243ms | 9,778ms | 535ms | 17,508 bytes |
| 회원 `new_schedule_applications` | 9,243ms | 9,762ms | 519ms | 8,048 bytes |
| 회원 `join_applications` | 9,842ms | 10,445ms | 603ms | 7,356 bytes |
| `join_wishes_lookup` | 10,480ms | 11,012ms | 532ms | 77 bytes |
| `home_stats` | 11,038ms | 11,945ms | 907ms | 132 bytes |

- [x] 회원 캐시가 만료되자 콜드와 같은 6개 Cloud Function fetch가 다시 나타났다.
- [x] `new schedule → join → wishes → stats` 순차 흐름이 다시 나타났다.
- [x] 마지막 회원 API 종료는 11.94초로 콜드 중앙값 11.65초와 비슷하다.
- [x] HTTP 캐시가 웜이어도 앱 데이터 TTL이 만료되면 로그인 데이터 지연은 거의 콜드 수준으로 돌아간다.

## 7. MD PICK

- 최초 MD PICK 대표이미지 캐시 확인: 8,518ms
- 지연 프리로드: 16,516ms
- 대표이미지 실제 전송량: 모두 0 bytes

이미지 파일은 캐시되어 있지만 데이터·렌더링·프리로드 실행 시점은 콜드와 비슷하게 늦다. 캐시는 네트워크 bytes를 줄일 뿐, 8초 타이머와 렌더링 순서 문제를 해결하지 못한다.

## 8. 웜 run01과 차이

| 지표 | 웜 run01 | 웜 run02 진단값 | 변화 |
|---|---:|---:|---:|
| 요청 | 117 | 119 | +1.7% |
| DOMContentLoaded | 940ms | 1,098ms | +16.8% |
| Load | 2,536ms | 8,558ms | +237.5% |
| 페이지 자체 마지막 요청 | 14,086ms | 18,526ms | +31.5% |
| 전송량 | 956,189 bytes | 1,038,654 bytes | +8.6% |
| 이미지 전송량 | 297,661 bytes | 44 bytes | -100.0% |
| Cloud Function fetch | 3개 | 6개 | +100.0% |
| 보조 회원 API 시작 | 4,139ms | 9,243ms | +123.3% |
| 마지막 회원 API 종료 | 6,054ms | 11,945ms | +97.3% |
| MD PICK 지연 프리로드 | 12,092ms | 16,516ms | +36.6% |

이 차이는 웜 캐시의 자연 편차가 아니라 앱 캐시 TTL과 데이터 revision 조건이 달라진 결과다.

## 9. 판정과 다음 측정

- [x] 파일은 실사용 재진입 진단 자료로 보존한다.
- [x] HTTP 캐시와 앱 데이터 캐시를 별도 조건으로 관리해야 함을 확인했다.
- [x] 홈 revision 변경이 측정 중 실제로 발생했음을 기록했다.
- [x] 동일 웜 3회 통계에서는 제외한다.
- [ ] 신규 revision을 한 번 예열한다.
- [ ] 예열 직후 60초 안에 대체 run02를 측정한다.
- [ ] 같은 방식으로 run03을 측정한다.
