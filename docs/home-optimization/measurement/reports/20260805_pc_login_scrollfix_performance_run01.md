# 상세 모달 스크롤 수정 버전 PC 로그인 Performance trace run01

## 1. 측정 파일과 안전성

| 항목 | 값 |
|---|---|
| 측정 대상 | 현재 운영 중인 상세 모달 스크롤 고정·복원 버전 |
| 원본 trace | `traces/raw/20260805_pc_login_scrollfix_performance_run01.json.gz` |
| 원본 크기 | 13,520,908 bytes |
| 원본 SHA-256 | `1FE9639A3EB3207310B9F3F1F2A7D324D3D91811117D1376B84709C0988FAEA6` |
| 안전 분석본 | `20260805_pc_login_scrollfix_performance_run01.analysis.json` |
| 분석본 SHA-256 | `8F6A2B015E2D25B164B9E1B5B972F7BA67E9912323826153222D8970C2A9F28F` |
| trace 이벤트 | 182,357개 |
| 로컬 HTML SHA-256 | `D46F40D5F6EA800DF28AC15004179A11E92753816701FD4F1AF4155566AB2764` |

- [x] 원본 trace는 개인정보와 전체 URL을 포함할 수 있어 Git 제외 경로에 보관했다.
- [x] 분석본에는 회원 식별 쿼리를 제거한 API 라벨, 상대 시간, 작업 종류와 소스 위치만 기록했다.
- [x] 분석본에서 일반 이메일·URL 인코딩 이메일·휴대폰·Bearer·회원 식별 쿼리를 다시 검색했고 모두 0건이었다.
- [x] trace 분석기 단위 테스트 3/3이 통과했다.

## 2. 초보자를 위한 결론

브라우저의 메인 스레드는 화면을 만들고 스크롤·클릭을 처리하는 한 명의 작업자와 같다. 이 작업자가 한 번에 수 초 동안 상품카드 HTML을 다시 만들면 서버 응답이 와도 다음 JavaScript 처리와 사용자의 스크롤이 기다려야 한다.

이번 trace에서는 메인 화면 전체 렌더와 MD PICK 렌더가 초기 진입 중 각각 세 번 실행됐다. 이 여섯 작업만 약 8.90초를 점유했다. 따라서 현재 가장 큰 병목 후보는 서버 응답 그 자체가 아니라 **같은 초기 화면을 여러 번 크게 다시 그리는 구조**다.

## 3. 로그인 API 시간표

| API | 시작 | 응답 확인 | 완료 |
|---|---:|---:|---:|
| `home_bootstrap_light` | 475ms | 693ms | 705ms |
| 공개 `new_schedule_applications` | 8,025ms | 11,159ms | 11,163ms |
| 회원 `new_schedule_applications` | 8,025ms | 11,159ms | 11,164ms |
| 회원 `join_applications` | 11,219ms | 11,936ms | 11,937ms |
| `join_wishes_lookup` | 11,968ms | 12,468ms | 12,468ms |
| `home_stats` | 12,493ms | 13,459ms | 13,464ms |

두 `new_schedule_applications` 요청이 끝난 뒤 `join_applications`가 시작되기까지 trace에서 확인된 간격은 **55.7ms**다. 이 중 약 52.1ms가 Promise 등의 후속 코드를 처리하는 microtask였다.

따라서 HAR에서 반복 관찰된 2.17~2.62초 구간을 “응답을 받은 뒤 Builder 행 병합·upsert만 2초 이상 실행됐다”고 해석하면 정확하지 않다. 이번 trace에서는 일정 요청이 진행되는 동안 3.08초짜리 전체 홈 렌더가 메인 스레드를 선점했고, 일정 응답 완료 뒤에는 다음 API가 비교적 빠르게 시작됐다.

## 4. long task 결과

Chrome에서 50ms를 넘는 메인 스레드 작업을 long task로 분류해 집계했다.

| 지표 | run01 |
|---|---:|
| long task 수 | 10개 |
| long task 합계 | 12,106ms |
| 가장 긴 작업 | 3,157ms |
| `renderJoins()` 예약 렌더 3회 | 약 7,192ms |
| MD PICK 단독 예약 렌더 3회 | 약 1,707ms |
| 두 렌더 경로 합계 | 약 8,899ms, 전체 long task의 73.5% |

주요 실행 순서는 다음과 같다.

| 시작~종료 | 길이 | 확인된 작업 |
|---|---:|---|
| 707~3,697ms | 2,989ms | `home_bootstrap_light` 직후 긴 microtask. trace에 내부 함수 프레임이 없어 세부 함수는 아직 확정하지 않음 |
| 3,734~6,891ms | 3,157ms | `scheduleHomeRender()`가 예약한 `renderJoins()` |
| 6,925~7,765ms | 840ms | `scheduleMdPickSectionRender()`가 예약한 MD PICK 단독 렌더 |
| 8,046~11,129ms | 3,083ms | `scheduleHomeRender()`가 예약한 `renderJoins()` |
| 11,246~11,913ms | 667ms | MD PICK 단독 렌더 |
| 12,495~13,448ms | 952ms | `scheduleHomeRender()`가 예약한 `renderJoins()` |
| 13,480~13,679ms | 199ms | MD PICK 단독 렌더 |

## 5. 소스 위치 확인

운영 trace의 줄 번호와 현재 로컬 HTML의 대응 위치를 함께 기록한다. 운영 게시판이 HTML 앞부분을 합성하므로 두 줄 번호는 다를 수 있다.

| trace 위치 | 확인된 기능 | 현재 로컬 대응 위치 |
|---|---|---|
| 운영 `plan_view` 61,225줄 | `scheduleHomeRender()`의 `run` → `renderJoins(pendingOptions)` | `golfjoin_main.html` 60,477줄, 호출 60,494줄 |
| 운영 `plan_view` 61,266줄 | `scheduleMdPickSectionRender()`의 `run` → `renderMdPickSectionOnly()` | `golfjoin_main.html` 60,527줄, 호출 60,533줄 |

- [x] `requestIdleCallback`을 사용해도 실행이 시작된 뒤 작업을 자동으로 나눠 주지는 않는다는 점을 확인했다.
- [x] `renderJoins()`가 한 번 시작되면 최대 약 3.16초 동안 메인 스레드를 점유했다.
- [x] MD PICK 렌더도 최대 약 840ms로, 사용자 입력을 막을 수 있는 크기였다.

## 6. Web Vitals 참고값

분석기가 trace 이벤트에서 근사한 값은 LCP 326.5ms, CLS 0.020이다. 다만 이 trace는 초기 메인 스레드 원인 분석을 목적으로 저장됐고 실제 사용자 상호작용도 없으므로 다음 제한이 있다.

- LCP는 trace에 남은 후보 이벤트만 이용한 근사값이므로 정식 3회 LCP 기준값으로 채택하지 않는다.
- INP는 실제 클릭·터치가 없는 trace에서 계산할 수 없다.
- CLS 0.020은 참고값으로만 보존하고 2·3회 및 별도 계측에서 반복 확인한다.

## 7. 판정과 다음 작업

- [x] HAR의 2초대 공백을 단순한 서버 지연 또는 응답 후 행 병합 비용으로 확정하지 않는다.
- [x] 초기 진입의 반복 `renderJoins()`와 MD PICK 단독 렌더를 1순위 병목 후보로 확정했다.
- [x] 기능 수정 전에 같은 조건 Performance trace run02·run03에서 호출 횟수와 점유 시간이 반복되는지 확인한다.
- [ ] run02를 저장하고 같은 두 렌더 경로의 횟수·합계를 비교한다.
- [ ] run03을 저장하고 3회 중앙값·편차를 확정한다.
- [ ] 3회에서 반복되면 Phase 2 수정안에 렌더 요청 합치기, 변경된 섹션만 갱신하기, 긴 작업 분할을 포함한다.

현재 단계에서는 기능 코드를 수정하지 않았다. 이 보고서는 원인과 다음 검증 순서를 고정하기 위한 측정 결과다.
