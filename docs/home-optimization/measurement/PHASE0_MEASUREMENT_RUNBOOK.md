# 골프조인 0단계 브라우저 성능 측정 실행서

| 구분 | 내용 |
|---|---|
| 대상 URL | `https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1` |
| 목적 | 개선 전 네트워크와 체감 속도를 같은 조건으로 3회씩 기록 |
| 기능 코드 변경 | 없음 |
| 개인정보 원칙 | raw HAR·trace는 로컬에만 보관하고 Git·채팅·메일에 올리지 않음 |

## 1. 초보자를 위한 설명

- HAR은 브라우저가 어떤 파일과 API를 언제 요청했는지 적은 네트워크 영수증이다.
- Performance trace는 큰 이미지가 언제 보였고, JavaScript가 화면을 얼마나 오래 멈췄는지 보여주는 시간표다.
- 콜드 캐시는 저장된 파일을 사용하지 않는 첫 방문에 가까운 조건이다.
- 웜 캐시는 한 번 받은 파일을 다시 사용하는 재방문 조건이다.
- 같은 측정을 3회 하는 이유는 인터넷 상태에 따른 우연한 차이를 구분하기 위해서다.

## 2. 파일 보관 규칙

- [x] `docs/home-optimization/measurement/hars/raw` 폴더를 만든다.
- [x] `docs/home-optimization/measurement/hars/sanitized` 폴더를 만든다.
- [x] `docs/home-optimization/measurement/traces/raw` 폴더를 만든다.
- [x] raw HAR과 raw trace는 위 raw 폴더에만 둔다.
- [x] raw 파일을 Git에 추가하지 않는다.
- [x] 공유·분석할 HAR은 반드시 `sanitize-har.js`로 처리한다.

권장 파일명:

```text
20260805_pc_logout_cold_run01.har
20260805_pc_logout_warm_run01.har
20260805_pc_login_cold_run01.har
20260805_pc_login_warm_run01.har
20260805_mo_login_cold_run01.har
20260805_pc_login_flow_run01.json.gz
```

## 3. 공통 준비

- [ ] Chrome에서 측정 URL만 남기고 무거운 다운로드·영상 재생을 중지한다.
- [ ] 개발자도구를 연다. — Windows는 `F12` 또는 `Ctrl+Shift+I`.
- [ ] Network 탭으로 이동한다.
- [ ] `Preserve log`를 끈다. — 이전 페이지 기록이 섞이지 않게 한다.
- [ ] 요청 필터가 비어 있는지 확인한다.
- [ ] 네트워크 속도는 `No throttling`으로 시작한다.
- [ ] 페이지 확대/축소는 100%로 맞춘다.
- [ ] 각 실행 전에 페이지 스크롤을 최상단으로 올린다.

## 4. PC 콜드 캐시 HAR

로그인 콜드 측정에서도 로그인 상태를 지우지 않기 위해 사이트 데이터를 삭제하지 않고 Network 탭의 `Disable cache`를 사용한다.

- [ ] `Disable cache`를 켠다.
- [ ] Network의 지우기 버튼으로 현재 요청 목록을 비운다.
- [ ] 페이지를 새로고침한다.
- [ ] 새로고침 뒤 20초 동안 스크롤하거나 클릭하지 않는다.
- [ ] 하단의 requests, transferred, resources, Finish, DOMContentLoaded, Load를 기록한다.
- [ ] 골프조인 Cloud Function 요청이 최대 6개까지 추가되는지 확인한다.
- [ ] 목록에서 마우스 오른쪽 버튼을 누르고 `Save all as HAR with content`로 저장한다.
- [ ] 같은 조건을 3회 반복한다.

측정 조합:

- [x] PC 비로그인 콜드 3회
- [x] PC 로그인 콜드 3회

## 5. PC 웜 캐시 HAR

- [ ] 먼저 `Disable cache`를 끈다.
- [ ] 로그인 앱 캐시까지 같은 조건으로 맞출 때는 70초 기다려 기존 60초 캐시를 만료시킨다.
- [ ] Network 필터에 `golfjoin-sheet-api`를 입력하고 같은 URL을 한 번 일반 새로고침해 캐시를 데운다.
- [ ] 고정 시간만 기다리지 말고 `action=home_stats` 요청이 나타나 Status 200으로 끝날 때까지 기다린다. — 설명: 서버가 느리면 15초가 지나도 로그인 데이터 예열이 끝나지 않을 수 있다.
- [ ] Network 요청 목록을 비운다.
- [ ] Network의 reload 버튼을 누르지 않고 주소창에 포커스를 둔 뒤 `Ctrl+L` → `Enter`로 즉시 다시 이동한다. — 설명: reload는 `Disable cache`를 꺼도 모든 하위 요청에 `Cache-Control: no-cache`를 붙일 수 있다.
- [ ] 주소 이동 뒤 20초 동안 클릭·스크롤하지 않는다.
- [ ] 하단 수치와 HAR을 저장한다.
- [ ] 같은 조건을 3회 반복한다.

측정 조합:

- [x] PC 비로그인 웜 3회
- [x] PC 로그인 웜 3회

## 6. 모바일 에뮬레이션 HAR

이 값은 실제 휴대전화가 아니라 Chrome이 휴대전화 화면과 UA를 흉내 낸 재현용 기준선이다. 최종 확인은 실제 기기에서 별도로 수행한다.

- [x] 개발자도구의 Device Toolbar를 켠다. — `Ctrl+Shift+M`.
- [x] 고정 기기 하나를 선택한다. 권장: iPhone 12 Pro 또는 390×844. — 2026-08-06 운영 기능 검증은 사용자가 선택한 모바일 기기 모드에서 수행했다.
- [x] 기기 선택 후 페이지를 다시 로드해 모바일 UA가 적용되게 한다. — `m.secret-tour.com`이 `www`로 리디렉션되지 않는 것으로 확인했다.
- [ ] 콜드 조건은 `Disable cache`를 켜고 3회 측정한다.
- [ ] 웜 조건은 `Disable cache`를 끄고 캐시를 한 번 데운 뒤 3회 측정한다.
- [x] 모바일 하단 메뉴, 가로 스크롤, 나의 모임 카드 초기 위치를 함께 확인한다. — 문서 가로 넘침 0px, 나의 모임과 해외조인 BEST 첫 카드 x=25px로 일치했다. 상세 기록: `docs/home-optimization/measurement/reports/20260806_mobile_scroll_layout_validation.md`

측정 조합:

- [x] MO 비로그인 콜드 3회
- [x] MO 비로그인 웜 3회
- [ ] MO 로그인 콜드 3회
- [ ] MO 로그인 웜 3회

## 7. Performance trace와 Web Vitals

한 회차는 다음 사용자 흐름을 그대로 수행한다.

1. 페이지 새로고침
2. 15초 대기
3. MD PICK까지 스크롤
4. 첫 상품카드 클릭
5. 상품상세와 여행기간이 정상 표시될 때까지 대기
6. 상세 닫기
7. 로그인 상태면 나의 모임과 내예약 열기
8. 기록 종료

실행 체크:

- [ ] 개발자도구 Performance 탭에서 새로고침 기록을 시작한다.
- [ ] 위 사용자 흐름을 수행한다.
- [ ] 기록을 중지한다.
- [ ] LCP, CLS, Interaction/INP 후보, Long task를 기록한다.
- [ ] 상품카드 클릭부터 모달 껍데기 표시까지 시간을 기록한다.
- [ ] 여행기간 선택 가능 시점과 전역 스크롤 잠금 종료 시점을 기록한다.
- [ ] trace를 raw 폴더에 저장한다.
- [ ] PC 비로그인·로그인 각각 3회 반복한다.
- [ ] MO 비로그인·로그인 각각 3회 반복한다.

## 8. MD PICK·취향맞춤 이미지 확인

- [ ] Network에서 `Img` 필터를 선택한다.
- [ ] MD PICK 상품 이미지 URL이 새로고침 직후 요청되는지 확인한다.
- [ ] `Initiator`가 어떤 JavaScript 또는 `<img>`인지 기록한다.
- [ ] 대표이미지의 Start Time, Duration, Size를 기록한다.
- [ ] MD PICK으로 스크롤하기 전과 후 요청 수 차이를 기록한다.
- [ ] 로그인에서 나의 모임 때문에 MD PICK 시작 위치가 더 내려가는지 확인한다.
- [ ] `loading="lazy"` 이미지가 화면 근처에 오기 전까지 요청되지 않는지 확인한다.

## 9. HAR 개인정보 제거

raw HAR에는 Cookie, 회원키, 이메일, 휴대폰, API 응답 본문이 포함될 수 있다. 다음 명령은 민감 쿼리·헤더·쿠키·요청 본문·응답 본문을 제거하고 시간 정보만 남긴다.

```powershell
node docs/home-optimization/measurement/sanitize-har.js `
  docs/home-optimization/measurement/hars/raw/20260805_pc_login_cold_run01.har `
  docs/home-optimization/measurement/hars/sanitized/20260805_pc_login_cold_run01.sanitized.json
```

- [ ] 입력 파일과 출력 파일을 다르게 지정한다.
- [ ] 출력 로그에서 처리한 entry 수를 확인한다.
- [ ] sanitized 파일에 `Cookie`, 이메일, 휴대폰이 남지 않았는지 검색한다.
- [ ] 분석에는 sanitized 파일만 사용한다.

## 10. 결과 기록표

| 환경 | 캐시 | 실행 | requests | transferred | Finish | LCP | CLS | long task 합계 | 상세 사용 가능 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| PC 비로그인 | cold | 1 | 122 | 5,997,156 bytes | 19,053ms | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 비로그인 | cold | 2 | 122 | 5,444,429 bytes | 21,473ms | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 비로그인 | cold | 3 | 125 | 6,006,963 bytes | 20,949ms | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 비로그인 | warm | 1 공식 | 121 | 523,660 bytes | 35,479ms* | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 비로그인 | warm | 2 공식 | 129 | 523,736 bytes | 23,908ms* | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 비로그인 | warm | 3 공식 | 121 | 523,674 bytes | 22,979ms* | 미측정 | 미측정 | 미측정 | 미측정 |
| MO 비로그인 | cold | 1 | 116 | 5,861,623 bytes | 30,306ms* | 미측정 | 미측정 | 미측정 | 미측정 |
| MO 비로그인 | cold | 2 | 117 | 6,126,694 bytes | 24,106ms* | 미측정 | 미측정 | 미측정 | 미측정 |
| MO 비로그인 | cold | 3 | 119 | 6,028,228 bytes | 21,569ms* | 미측정 | 미측정 | 미측정 | 미측정 |
| MO 비로그인 | warm | 1 | 113 | 522,714 bytes | 23,684ms* | 미측정 | 미측정 | 미측정 | 미측정 |
| MO 비로그인 | warm | 2 | 111 | 522,804 bytes | 17,530ms | 미측정 | 미측정 | 미측정 | 미측정 |
| MO 비로그인 | warm | 3 | 114 | 522,782 bytes | 23,735ms* | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 로그인 | cold | 1 | 121 | 5,388,106 bytes | 16,642ms | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 로그인 | cold | 2 | 123 | 5,524,351 bytes | 33,746ms | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 로그인 | cold | 3 | 121 | 5,622,678 bytes | 19,016ms | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 로그인 | warm | 1 | 117 | 956,189 bytes | 14,086ms* | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 로그인 | warm | 2 진단* | 119 | 1,038,654 bytes | 18,526ms** | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 로그인 | warm | 2 공식 | 116 | 548,015 bytes | 19,413ms | 미측정 | 미측정 | 미측정 | 미측정 |
| PC 로그인 | warm | 3 진단* | 120 | 555,614 bytes | 27,451ms | 미측정 | 미측정 | 미측정 | 미측정 |
| MO 로그인 | cold | 1 (`CFD15...` 참고) | trace 기준 |  |  | 1,295.655ms | 0.205466 | 17,093.711ms | 상세 열기 59.242ms, 내예약 650.730ms |
| MO 로그인 | cold | 1 (`8A853...` 공식) | trace 기준 |  |  | 1,303.790ms | 0.209722 | 22,362.720ms | 상세 열기 54.267ms, 내예약 769.319ms |
| MO 로그인 | cold | 2 (`8A853...` 공식) | trace 기준 |  |  | 1,372.751ms | 0.205466 | 21,657.233ms | 상세 열기 48.526ms, 내예약 607.656ms |

\* run02 진단은 회원 캐시 60초 만료와 홈 revision 변경, run03 진단은 회원 API 6개 재실행으로 동일 조건 통계에서 제외한다.

\** 원본 HAR 전체 Finish는 run01 42,179ms, run02 89,031ms지만 저장 과정의 `/mypage/member` 세션 확인을 제외한 페이지 자체 Finish는 각각 14,086ms, 18,526ms다.

PC 비로그인 Warm의 `Finish*`는 페이지 핵심 로딩 뒤 추적·후속 요청을 포함해 편차가 크다. 공식 비교에는 상대 범위 1.0%인 Load와 상품이미지 요청 시점을 사용한다.

## 11. 0단계 완료 판정

- [ ] 모든 필수 조합의 HAR이 3회씩 있다.
- [ ] 로그인 HAR은 개인정보 제거본이 만들어져 있다.
- [ ] PC·MO의 LCP, CLS, long task, 상세 오픈 값이 3회씩 있다.
- [x] MD PICK 이미지 지연이 요청 지연인지 다운로드 지연인지 구분됐다. — PC 로그인 콜드 3회에서 요청은 14.62~17.00초에 시작했지만 다운로드는 18~42ms였다.
- [ ] 모든 필수 측정 조합별 주요 지표의 3회 편차가 기록됐다. — PC 로그인 콜드 조합은 완료했으며 다른 조합이 남아 있다.
- [ ] 모든 필수 측정 조합의 결과가 `BASELINE.md`에 반영됐다. — PC 로그인 콜드 조합은 반영 완료다.

## 12. 실행 현황

- [x] PC 로그인 콜드 run01 저장
- [x] run01 개인정보 제거 및 잔존 검사
- [x] run01 요청·전송량·API·이미지 분석
- [x] run01 결과를 `BASELINE.md`에 반영
- [x] PC 로그인 콜드 run02 저장·개인정보 제거·분석
- [x] PC 로그인 콜드 run03 저장·개인정보 제거·분석
- [x] PC 로그인 콜드 3회 편차와 중앙값 계산
- [x] `:path` 헤더까지 포함한 개인정보 제거 도구 보강
- [x] run01·run02·run03 제거본 전체 재생성 및 잔존 검사 0건 확인
- [x] PC 로그인 웜 run01 저장·개인정보 제거·분석
- [x] 웜 run01을 PC 로그인 콜드 중앙값과 비교
- [x] PC 로그인 웜 run02 저장·분석 — 앱 캐시 만료·홈 revision 변경 진단 표본
- [x] run02가 동일 조건 표본이 아님을 확인하고 통계 제외 근거 기록
- [x] 측정 중 발생한 로컬 기능 소스 동시 변경을 감지하고 별도 기록
- [x] PC 로그인 웜 대체 run02를 명시적 예열 직후 60초 안에 저장·분석
- [x] 대체 run02의 HTTP·앱 캐시 조건을 검증하고 공식 run02로 채택
- [x] PC 로그인 웜 run03 저장·분석 — HTTP 캐시 웜·앱 캐시 미사용 진단 표본
- [x] 고정 15초 예열의 한계를 확인하고 `home_stats` 완료 확인 방식으로 절차 수정
- [x] PC 로그인 웜 대체 공식 run03 저장·개인정보 제거·분석
- [x] 공식 run03의 Cloud Function 3개·홈 카드 및 대표이미지 재전송 0 bytes 확인
- [x] PC 로그인 웜 3회 편차와 중앙값 계산
- [x] 알림톡 딥링크 HTML 배포 후 로그인 HTTP 콜드 run01 저장·분석 — 앱 캐시 웜 혼합 진단 표본
- [x] 배포 후 로그인 대체 콜드 run01 저장·분석 — 공식 배포 후 run01 채택
- [x] 이전 알림톡 배포 버전의 콜드 run02·run03 추가 측정 중단 — 상세 모달 스크롤 HTML 재배포로 운영 코드 변경
- [x] 현재 스크롤 수정 버전 로그인 콜드 run01 저장·개인정보 제거·분석
- [x] 현재 스크롤 수정 버전 로그인 콜드 run02 저장·개인정보 제거·분석
- [x] 현재 스크롤 수정 버전 로그인 콜드 run03 저장·개인정보 제거·분석
- [x] 현재 스크롤 수정 버전 로그인 콜드 3회 중앙값과 회귀 판정
- [x] 로그인 PC Performance trace run01 저장·안전 분석본 생성·개인정보 잔존 검사
- [x] trace 분석기와 테스트를 추가하고 모바일 URL·LCP·CLS 세션 윈도우·INP 후보 계산까지 보강
- [x] HAR 제거·분석 및 trace 분석 측정 도구 전체 테스트 8/8 통과
- [x] 일정 응답 후 처리 구간과 메인 스레드 long task를 분리 분석 — 응답 완료 후 다음 API까지는 55.7ms, 반복 홈·MD PICK 렌더 6회가 약 8.90초 점유
- [x] 같은 조건 Performance trace run02 저장·분석 — 전체 홈 렌더 2회 약 4.73초, MD PICK 렌더 2회 약 0.94초로 동일 병목 재현
- [x] 같은 조건 Performance trace run03 저장·분석 — 전체 홈 렌더 3회 약 3.70초, MD PICK 렌더 2회 약 0.91초로 동일 병목 재현
- [x] Performance trace 3회 중앙값과 반복 병목 확정 — long task 중앙값 약 9.38초, 반복 렌더 중앙값 약 5.67초
- [ ] Performance trace 주요 렌더 시간 편차 20% 이내 — 병목은 같지만 데이터 도착 순서에 따른 상대 범위 29.4~84.6%로 미통과
- [x] PC 1,440px에서 골프조인 영역 가로 넘침 0건 확인
- [x] PC 상세 모달 열기·배경 잠금·닫기 후 실제 좌표 복원 검증
- [x] 로그인 상태 나의 모임 딥링크의 대상 탐색·단일 모달·좌표 복원 검증
- [x] 모바일 상세 모달과 나의 모임 카드 위치 검증 — 모바일 기기 모드에서 열기 전 1,241px, 열린 동안 `top: -1241px`, 닫은 뒤 1,241px 복원 및 두 섹션 첫 카드 x=25px 일치
- [ ] 정식 LCP·INP·CLS 수집 — 현재 자동화 범위에서 `window.performance` 직접 접근 불가
- [x] Performance trace에서 LCP 후보, CLS 세션 윈도우, interactionId 기반 INP 후보를 일관되게 추출하는 도구 준비
- [x] `CFD15...` 모바일 로그인 콜드 Web Vitals run01 저장·분석 — CLS·INP 원인 진단 참고 표본, 새 버전 공식 통계에서는 제외
- [x] `09BB...` 공식 측정은 run01 저장 전 UI 재배포로 중단 — 서로 다른 UI 버전을 섞지 않음
- [x] `8A853...` 모바일 로그인 콜드 Web Vitals run01 저장·분석 — LCP 1,303.790ms, CLS 0.209722, 내예약 INP 후보 769.319ms, 초기 long task 22,362.720ms
- [x] run01의 `home_bootstrap_light` 2회 호출 분리 — 최초 초기화와 snapshot fallback 보조 갱신 경로
- [x] `8A853...` 모바일 로그인 콜드 Web Vitals run02 저장·분석 — LCP 1,372.751ms, CLS 0.205466, 내예약 INP 후보 607.656ms, 초기 long task 21,657.233ms
- [x] run02에서 `home_bootstrap_light` 1회 확인 — snapshot 재호출 없이도 초기 long task 병목 반복
- [x] `8A853...` 모바일 로그인 콜드 Web Vitals run03 저장·분석 — LCP 1,306.743ms, CLS 0.205466, 내예약 INP 후보 602.240ms, 초기 long task 22,412.318ms
- [x] `8A853...` 모바일 로그인 콜드 Web Vitals 3회 중앙값·편차 판정 — LCP 1,306.743ms, CLS 0.205466, 내예약 INP 607.656ms, 초기 long task 합계 22,362.720ms
- [ ] 모바일 로그인 3회 기준 Phase 0 통과 — INP 27.5%, 전체 long task 35.0% 편차와 절대 지연으로 미통과
- [x] `8A853...` 모바일 로그인 콜드 HAR run01 저장·개인정보 제거·분석 — 요청 130개·6.01MiB, 홈 카드 완료 뒤 대표이미지 요청까지 9.08초, 일정 API 뒤 참여 API까지 4.00초
- [x] `8A853...` 모바일 로그인 콜드 HAR run02 저장·분석 — 요청 138개·6.22MiB, 대표이미지 요청 지연 8.89초, 일정→참여 API 공백 3.66초, 이미지 중복 반복
- [x] `8A853...` 모바일 로그인 콜드 HAR run03 저장·분석 — 요청 122개·5.68MiB, 대표이미지 지연 7.81초, 일정→참여 API 공백 57ms
- [x] `8A853...` 모바일 로그인 콜드 HAR 3회 중앙값·편차 판정 — 대표이미지 요청 지연 8.89초·상대 범위 14.2%, 일정→참여 API 공백 상대 범위 107.7%
- [x] 모바일 로그인 웜 run01 진단 — 앱 캐시는 웜이지만 108/109 요청이 `no-cache`여서 공식 통계에서 제외
- [x] 모바일 로그인 웜 대체 공식 run01 — 예열 뒤 `Ctrl+L` → `Enter` 주소 이동으로 HTTP·앱 캐시 동시 검증, 홈 카드·대표이미지 0 bytes와 로그인 API 3개 확인
- [x] 모바일 로그인 웜 공식 run02 — 최초 필터 저장본 제외 후 전체 119개 요청 재측정, 홈 카드·대표이미지 0 bytes와 로그인 API 3개 반복 확인
- [x] 모바일 로그인 웜 공식 run03 — 요청 118개·548,650 bytes, 대표이미지 0 bytes와 로그인 API 3개 확인
- [x] 모바일 로그인 웜 3회 중앙값·편차 판정 — 요청 118개·548,650 bytes·Load 4,337ms, Cold 대비 전송량 91.3% 감소
- [x] PC 비로그인 Cold run01 — 요청 122개·5,997,156 bytes, 대표이미지 첫 요청 7.07초 지연과 비회원 API 2개 확인
- [x] PC 비로그인 Cold run02 — 요청 122개·5,444,429 bytes, 대표이미지 네 단계 분할과 통계 API 공백 반복 확인
- [x] PC 비로그인 Cold run03 — 요청 125개·6,006,963 bytes, 대표이미지 네 단계 분할과 통계 API 공백 세 번째 확인
- [x] PC 비로그인 Cold 3회 중앙값·편차 판정 — Load 10,012ms, 홈 카드→첫 이미지 7,535ms, 첫→마지막 이미지 10,035ms
- [x] PC 비로그인 Warm run01 1차 저장본 진단 — 앱 캐시는 웜이나 121/122 요청이 `no-cache`, 전송량 6,035,843 bytes여서 공식 표본에서 제외
- [x] PC 비로그인 Warm 공식 run01 재측정 — 121개 중 108개·상품이미지 14개가 0 bytes, 전송량 523,660 bytes로 정상 캐시 확인
- [x] PC 비로그인 Warm 공식 run02 측정 — 전송량 523,736 bytes·상품이미지 14개 0 bytes·Load 8,384ms로 핵심 지표 반복
- [x] PC 비로그인 Warm 공식 run03 — 전송량 523,674 bytes·상품이미지 14개 0 bytes·Load 8,472ms로 세 번째 반복
- [x] PC 비로그인 Warm 3회 기준선 — 전송량 523,674 bytes·Load 8,426ms·마지막 이미지 15,910ms, 주요 상대 범위 12% 이내
- [x] MO 비로그인 Cold run01 — 요청 116개·5,861,623 bytes, 홈 카드→첫 이미지 8,382ms·bootstrap→통계 8,457ms 공백 확인
- [x] MO 비로그인 Cold run02 — 요청 117개·6,126,694 bytes, 상품이미지 14개 고정·마지막 이미지 8,010ms 지연 반복
- [x] MO 비로그인 Cold run03 — 요청 119개·6,028,228 bytes, 상품이미지 14개 고정·마지막 이미지 8,006ms 지연 반복
- [x] MO 비로그인 Cold 3회 기준선 — Load 11,738ms·마지막 이미지 지연 8,009ms, DCL 24.0% 편차와 조건부 이미지 차이 분리
- [x] MO 비로그인 Warm 공식 run01 — 113개 중 102개·상품이미지 14개가 0 bytes, 전송량 522,714 bytes로 정상 캐시 확인
- [x] MO 비로그인 Warm 공식 run02 — 전송량 522,804 bytes·상품이미지 14개 0 bytes·마지막 이미지 8,028ms 지연 반복
- [x] MO 비로그인 Warm 공식 run03 — 전송량 522,782 bytes·상품이미지 14개 0 bytes·마지막 이미지 8,005ms 지연 반복
- [x] MO 비로그인 Warm 3회 기준선 — Load 9,925ms·전송량 522,782 bytes·마지막 이미지 지연 8,005ms, 주요 상대 범위 20% 이내
- [ ] 운영 전환·복구 리허설 — 운영과 같은 게시판 입력 방식의 임시 대상에서 전환·복원 시간을 검증

run01 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_cold_run01.md`

run02 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_cold_run02.md`

run03 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_cold_run03.md`

3회 통합 기준선: `docs/home-optimization/measurement/reports/20260805_pc_login_cold_3run_baseline.md`

개인정보 재검증: `docs/home-optimization/measurement/SANITIZER_PRIVACY_RECHECK.md`

로그인 웜 run01 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_warm_run01.md`

로그인 웜 run02 진단 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_warm_run02.md`

로그인 웜 공식 run02 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_warm_run02_retry.md`

로그인 웜 run03 진단 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_warm_run03.md`

로그인 웜 공식 run03 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_warm_run03_retry.md`

로그인 웜 3회 통합 기준선: `docs/home-optimization/measurement/reports/20260805_pc_login_warm_3run_baseline.md`

배포 후 로그인 콜드 run01 진단 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_postdeploy_cold_run01.md`

배포 후 로그인 콜드 공식 run01 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_postdeploy_cold_run01_retry.md`

스크롤 수정 버전 로그인 콜드 run01 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_scrollfix_cold_run01.md`

스크롤 수정 버전 로그인 콜드 run02 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_scrollfix_cold_run02.md`

스크롤 수정 버전 로그인 콜드 run03 보고서: `docs/home-optimization/measurement/reports/20260805_pc_login_scrollfix_cold_run03.md`

스크롤 수정 버전 로그인 콜드 3회 기준선: `docs/home-optimization/measurement/reports/20260805_pc_login_scrollfix_cold_3run_baseline.md`

스크롤 수정 버전 로그인 Performance trace run01: `docs/home-optimization/measurement/reports/20260805_pc_login_scrollfix_performance_run01.md`

스크롤 수정 버전 로그인 Performance trace run02: `docs/home-optimization/measurement/reports/20260806_pc_login_scrollfix_performance_run02.md`

스크롤 수정 버전 로그인 Performance trace run03: `docs/home-optimization/measurement/reports/20260806_pc_login_scrollfix_performance_run03.md`

스크롤 수정 버전 로그인 Performance trace 3회 기준선: `docs/home-optimization/measurement/reports/20260806_pc_login_scrollfix_performance_3run_baseline.md`

PC 상세 모달 스크롤·로그인 딥링크 검증: `docs/home-optimization/measurement/reports/20260806_pc_scroll_deeplink_validation.md`

모바일 레이아웃·상세 모달 스크롤 검증: `docs/home-optimization/measurement/reports/20260806_mobile_scroll_layout_validation.md`

모바일 로그인 콜드 Web Vitals run01: `docs/home-optimization/measurement/reports/20260806_mo_login_modalbgfix_vitals_run01.md`

`8A853...` 모바일 로그인 콜드 Web Vitals 공식 run01: `docs/home-optimization/measurement/reports/20260806_mo_login_8a853_vitals_run01.md`

`8A853...` 모바일 로그인 콜드 Web Vitals 공식 run02: `docs/home-optimization/measurement/reports/20260806_mo_login_8a853_vitals_run02.md`

`8A853...` 모바일 로그인 콜드 Web Vitals 공식 run03: `docs/home-optimization/measurement/reports/20260806_mo_login_8a853_vitals_run03.md`

`8A853...` 모바일 로그인 콜드 Web Vitals 3회 기준선: `docs/home-optimization/measurement/reports/20260806_mo_login_8a853_vitals_3run_baseline.md`

`8A853...` 모바일 로그인 콜드 HAR run01: `docs/home-optimization/measurement/reports/20260806_mo_login_cold_run01.md`

`8A853...` 모바일 로그인 콜드 HAR run02: `docs/home-optimization/measurement/reports/20260806_mo_login_cold_run02.md`

`8A853...` 모바일 로그인 콜드 HAR run03: `docs/home-optimization/measurement/reports/20260806_mo_login_cold_run03.md`

`8A853...` 모바일 로그인 콜드 HAR 3회 기준선: `docs/home-optimization/measurement/reports/20260806_mo_login_cold_3run_baseline.md`

모바일 로그인 웜 run01 진단 표본: `docs/home-optimization/measurement/reports/20260806_mo_login_warm_run01_diagnostic.md`

`8A853...` 모바일 로그인 웜 공식 run01: `docs/home-optimization/measurement/reports/20260806_mo_login_warm_run01_retry.md`

`8A853...` 모바일 로그인 웜 공식 run02: `docs/home-optimization/measurement/reports/20260806_mo_login_warm_run02_retry.md`

`8A853...` 모바일 로그인 웜 공식 run03: `docs/home-optimization/measurement/reports/20260806_mo_login_warm_run03.md`

`8A853...` 모바일 로그인 웜 3회 기준선: `docs/home-optimization/measurement/reports/20260806_mo_login_warm_3run_baseline.md`

`8A853...` PC 비로그인 Cold run01: `docs/home-optimization/measurement/reports/20260806_pc_logout_cold_run01.md`

`8A853...` PC 비로그인 Cold run02: `docs/home-optimization/measurement/reports/20260806_pc_logout_cold_run02.md`

`8A853...` PC 비로그인 Cold run03: `docs/home-optimization/measurement/reports/20260806_pc_logout_cold_run03.md`

`8A853...` PC 비로그인 Cold 3회 기준선: `docs/home-optimization/measurement/reports/20260806_pc_logout_cold_3run_baseline.md`

`8A853...` PC 비로그인 Warm run01 1차 진단: `docs/home-optimization/measurement/reports/20260806_pc_logout_warm_run01_diagnostic.md`

`8A853...` PC 비로그인 Warm 공식 run01: `docs/home-optimization/measurement/reports/20260806_pc_logout_warm_run01_retry.md`

`8A853...` PC 비로그인 Warm 공식 run02: `docs/home-optimization/measurement/reports/20260806_pc_logout_warm_run02.md`

`8A853...` PC 비로그인 Warm 공식 run03: `docs/home-optimization/measurement/reports/20260806_pc_logout_warm_run03.md`

`8A853...` PC 비로그인 Warm 3회 기준선: `docs/home-optimization/measurement/reports/20260806_pc_logout_warm_3run_baseline.md`

`8A853...` MO 비로그인 Cold run01: `docs/home-optimization/measurement/reports/20260806_mo_logout_cold_run01.md`

`8A853...` MO 비로그인 Cold run02: `docs/home-optimization/measurement/reports/20260806_mo_logout_cold_run02.md`

`8A853...` MO 비로그인 Cold run03: `docs/home-optimization/measurement/reports/20260806_mo_logout_cold_run03.md`

`8A853...` MO 비로그인 Cold 3회 기준선: `docs/home-optimization/measurement/reports/20260806_mo_logout_cold_3run_baseline.md`

`8A853...` MO 비로그인 Warm 공식 run01: `docs/home-optimization/measurement/reports/20260806_mo_logout_warm_run01.md`

`8A853...` MO 비로그인 Warm 공식 run02: `docs/home-optimization/measurement/reports/20260806_mo_logout_warm_run02.md`

`8A853...` MO 비로그인 Warm 공식 run03: `docs/home-optimization/measurement/reports/20260806_mo_logout_warm_run03.md`

`8A853...` MO 비로그인 Warm 3회 기준선: `docs/home-optimization/measurement/reports/20260806_mo_logout_warm_3run_baseline.md`

동시 소스 변경 기록: `docs/home-optimization/baseline/2026-08-05/CONCURRENT_SOURCE_CHANGE.md`
