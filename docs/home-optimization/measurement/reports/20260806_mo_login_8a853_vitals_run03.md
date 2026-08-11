# `8A853...` 모바일 로그인 콜드 Web Vitals run03

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
환경: Chrome Device Toolbar 모바일 UA, 약 412×915, 로그인, Disable cache, No throttling  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`  
사용자 흐름: 새로고침 → 15초 대기 → MD PICK 상세 열기/닫기 → 나의 모임 → 내예약 → 닫기

## 1. 결론

- [x] run03 파일과 측정 전후 로컬 HTML 해시가 `8A853...`로 일치했다.
- [x] LCP는 1,306.743ms로 양호했다.
- [!] CLS는 0.205466으로 개선 필요 구간이며, run02와 같은 초기 이동이 반복됐다.
- [!] 내예약 INP 후보는 602.240ms로 불량 구간이었다.
- [!] 초기 30초 long task는 22개, 합계 22.41초, 최대 4.26초였다.
- [x] `home_bootstrap_light`는 한 번만 호출됐다.
- [!] snapshot 재호출이 없는 run02·run03에서도 같은 초기 long task와 내예약 지연이 유지됐다.
- [x] 분석본의 회원 필드명·이메일·전화번호·Cookie 문자열은 모두 0건이었다.

## 2. 핵심 수치

| 지표 | run03 | 판정 |
|---|---:|---|
| LCP | 1,306.743ms | 양호 |
| LCP 요소 | `IMG`, 80,032px² | hero 이미지 |
| CLS 최대 세션 | 0.205466 | 개선 필요 |
| INP 후보 | 602.240ms | 불량 |
| 상호작용 수 | 5개 | 계획한 흐름 충족 |
| 초기 30초 long task | 22개 | 많음 |
| 초기 long task 합계 | 22,412.318ms | 매우 큼 |
| 초기 최대 long task | 4,255.023ms | 매우 큼 |
| 전체 기록 long task | 28개 | 참고 |
| 전체 기록 long task 합계 | 24,473.481ms | 매우 큼 |

## 3. CLS

최대 세션 윈도우는 시작 1,412.128ms, 점수 0.205466이다. run02의 1,511.9ms·0.205466과 같은 초기 레이아웃 이동이다.

| 시작 시점 | 점수 | 설명 |
|---:|---:|---|
| 1,412.128ms | 0.205466 | 초기 원 페이지 래퍼·히어로·골프조인 네비·MD PICK 이동 |
| 12,979.490ms | 0.063491 | 회원·통계 데이터 반영 뒤 MD PICK·칩 별도 이동 |

브라우저 CLS는 1초 간격 또는 5초 길이로 나뉜 세션 윈도우 중 최대값을 사용하므로 두 점수를 단순 합산하지 않는다.

## 4. 상호작용과 INP

| 사용자 동작 | 시작 | 지연 |
|---|---:|---:|
| MD PICK 상품상세 열기 | 17,828ms | 61.912ms |
| 상품상세 닫기 | 33,744ms | 45.752ms |
| 나의 모임 열기 | 38,184ms | 89.213ms |
| 내예약 열기 | 39,571ms | 602.240ms |
| 내예약 닫기 | 45,242ms | 48.423ms |

가장 느린 `나의 모임 → 내예약` 구간:

- main-thread task: 569.370ms
- click 이벤트 처리: 561.858ms
- inline `onclick`: 541.631ms
- 이후 레이아웃: 3.958ms

현재 소스에서는 `openJoinMyMenu()`가 모달을 연 직후 `renderJoinMyMenu(member)`를 동기 실행하고, 회원 일정 API가 끝난 뒤 다시 렌더한다. 첫 렌더가 클릭 응답을 500ms 이상 막는 것이 직접 원인이다.

## 5. 부트스트랩과 회원 API

`home_bootstrap_light`는 한 번만 실행됐다.

- 시작: 1,459.650ms
- 응답: 1,732.858ms
- 종료: 1,739.902ms
- 전체 요청 시간: 280.252ms

초기 회원 데이터 요청은 약 10.13초에 시작했고 `home_stats`는 13.02초에 끝났다. 내예약 클릭 뒤에는 일정 API 3개가 다시 시작됐다.

run01의 snapshot fallback 재호출이 없는데도 초기 long task 합계가 run01보다 0.2% 많다. 따라서 snapshot 재호출은 편차 요인이지만 주 병목은 아니다.

## 6. 초기 메인 스레드

- 최대 task: 17,943ms 시작, 4,255ms 지속
- 초기 부트스트랩 직후 task: 1,833ms 시작, 3,773ms 지속
- 지연 홈 렌더 idle callback: 5,664ms 시작, 3,480ms 지속
- 추가 홈 렌더 idle callback: 12,091ms 시작, 877ms 지속

PC Performance 3회에서 확인한 `scheduleHomeRender()` → `renderJoins()` 및 `scheduleMdPickSectionRender()` → `renderMdPickSectionOnly()` 반복 병목과 같은 패턴이다.

## 7. 파일 무결성·개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw trace | 15,772,152 bytes | `CBE2599CF519036A18B0A9257957DC89A83803C43D7B07582298A08BBE846EAC` |
| 안전 분석본 | 157,008 bytes | `0B03BA22A1A2BD5C10A22E01DA72EC22A2130FC1D2498B9861A132ABDBD631F0` |

- [x] raw trace는 `.gitignore` 대상이다.
- [x] 분석본에서 회원 식별 필드명·이메일·전화번호·Cookie 문자열은 0건이다.
- [x] 측정·분석 과정에서 제품 HTML은 수정하지 않았다.

## 8. 판정

- [x] run03은 공식 `8A853...` 세 번째 표본으로 채택한다.
- [x] LCP·CLS·초기 long task는 세 번 반복 가능한 기준선이 됐다.
- [!] INP와 전체 기록 long task 합계는 3회 상대 범위가 20%를 넘지만, 세 번 모두 내예약 동기 렌더가 최악의 상호작용이었다.
- [!] 모바일 로그인 기준선은 확보했지만 Phase 0 전체 통과 조건은 아직 충족하지 못했다.
