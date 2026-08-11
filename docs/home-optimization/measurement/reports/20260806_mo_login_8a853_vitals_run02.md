# `8A853...` 모바일 로그인 콜드 Web Vitals run02

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
환경: Chrome Device Toolbar 모바일 UA, 412×915, 로그인, Disable cache, No throttling  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`  
사용자 흐름: 새로고침 → 15초 대기 → MD PICK 상세 열기/닫기 → 나의 모임 → 내예약 → 닫기

## 1. 결론

- [x] LCP는 1,372.751ms로 양호하다.
- [!] CLS는 0.205466으로 run01과 같은 초기 레이아웃 이동이 반복됐다.
- [!] 내예약 INP 후보는 607.656ms로 run01보다 21.0% 줄었지만 여전히 느림 구간이다.
- [!] 초기 30초 long task는 18개, 합계 21.66초, 최대 4.39초다.
- [x] `home_bootstrap_light`는 한 번만 실행돼 run01의 snapshot 재호출은 반복되지 않았다.
- [!] snapshot 재호출이 없어도 초기 long task 합계는 run01보다 3.2%만 줄었다.
- [x] 분석본 개인정보 0건과 raw trace Git 제외를 확인했다.
- [ ] run03으로 INP와 전체 기록 long task의 20% 초과 변동을 최종 판정한다.

## 2. 핵심 수치

| 지표 | run01 | run02 | 변화 |
|---|---:|---:|---:|
| LCP | 1,303.790ms | 1,372.751ms | +5.3% |
| CLS | 0.209722 | 0.205466 | -2.0% |
| INP 후보 | 769.319ms | 607.656ms | -21.0% |
| 초기 long task 수 | 16개 | 18개 | +2개 |
| 초기 long task 합계 | 22,362.720ms | 21,657.233ms | -3.2% |
| 초기 최대 long task | 4,305.449ms | 4,389.266ms | +1.9% |
| 전체 기록 long task 수 | 28개 | 24개 | -4개 |
| 전체 기록 long task 합계 | 33,310.927ms | 25,278.157ms | -24.1% |

## 3. 두 표본의 예비 반복 판정

| 지표 | 2회 상대 범위 | 예비 판정 |
|---|---:|---|
| LCP | 약 5.2% | 안정적 |
| CLS | 약 2.1% | 안정적으로 나쁨 |
| 초기 long task 합계 | 약 3.2% | 안정적으로 큼 |
| 초기 최대 long task | 약 1.9% | 안정적으로 큼 |
| INP 후보 | 약 23.5% | run03 필요 |
| 전체 기록 long task 합계 | 약 27.4% | run03 필요 |

두 번 모두 LCP는 양호하지만 CLS와 초기 메인 스레드 점유는 거의 같은 수준으로 반복됐다. INP는 클릭 시점과 데이터 상태에 따라 변하지만 두 번 모두 500ms를 넘었다.

## 4. CLS

최대 이동은 시작 1,511.9ms, 점수 0.205466이다.

영향 요소:

- 원 홈페이지 `.s_board_w`
- `.hero-calendar-shape`
- `#joinSectionNavSlot`
- `#join-section-mdpick`

run01에도 동일 요소가 1,367.7ms에 같은 점수 0.205466을 만들었다. 초기 골프조인 공간 미확보 문제는 높은 신뢰도로 재현됐다.

13,812.7ms에는 MD PICK과 칩이 0.063491만큼 별도 이동했지만 최대 세션은 초기 이동이다.

## 5. INP

| 사용자 상호작용 | 시작 | 지연 |
|---|---:|---:|
| MD PICK 상품상세 열기 | 17,785ms | 48.526ms |
| 상품상세 닫기 | 32,329ms | 47.882ms |
| 나의 모임 열기 | 39,775ms | 67.876ms |
| 내예약 열기 | 41,230ms | 607.656ms |
| 내예약 닫기 | 49,938ms | 50.865ms |

가장 느린 상호작용은 run01과 동일하게 내예약 열기다.

- 클릭 직후 main-thread task: 577.194ms
- click 이벤트 처리: 569.296ms
- 운영 HTML inline `onclick`: 546.036ms
- 클릭 뒤 레이아웃: 4.532ms

run01의 inline click 684.453ms보다 짧아졌지만 같은 실행 경로가 여전히 한 프레임을 500ms 이상 막는다.

## 6. 부트스트랩 비교

run02의 `home_bootstrap_light`는 한 번만 실행됐다.

- 시작: 1,554.725ms
- 응답: 1,812.058ms
- 종료: 1,824.067ms
- 호출 경로: `initializeGolfJoinHome()`

run01의 두 번째 `hydrateHomeSecondaryData()` snapshot 갱신 호출은 없었다. 그런데도 초기 long task 합계는 22.36초에서 21.66초로 3.2%만 감소했다.

따라서 snapshot fallback은 표본 변동을 키우는 보조 요인이지만 초기 메인 스레드 병목의 주원인은 아니다. 반복 전체 홈·MD PICK 렌더 구조가 1순위라는 기존 결론을 유지한다.

## 7. 파일 무결성·개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw trace | 16,266,946 bytes | `A27C62EF267EFDA611FDBB58C78C087264AB3DD4D3AAABBE368E47F8E4670F6D` |
| 안전 분석본 | 132,114 bytes | `FA7028518064E1B7B2EA7F2E3C88D6E1D2625250EDEFEA850E6D6BDAE790FA9B` |

- [x] raw trace는 `.gitignore` 대상이다.
- [x] 분석본 회원 필드명·이메일·휴대폰·쿠키는 모두 0건이다.
- [x] 분석 종료 시 로컬 HTML 해시는 `8A853...`으로 유지됐다.
- [x] 측정·분석 과정에서 제품 HTML을 수정하지 않았다.

## 8. 다음 측정

- [ ] 같은 조건으로 run03을 저장한다.
- [ ] run03 전에 65초 동안 앱 캐시 만료를 보장한다.
- [ ] LCP·CLS·INP·초기 및 전체 long task의 3회 중앙값과 상대 범위를 계산한다.
- [ ] snapshot 1회/2회 경로를 분리해 병목 우선순위를 확정한다.
