# 상세 모달 스크롤 수정 버전 PC 로그인 Performance trace run03

## 1. 측정 파일과 안전성

| 항목 | 값 |
|---|---|
| 측정일 | 2026-08-06 |
| 측정 대상 | 현재 운영 중인 상세 모달 스크롤 고정·복원 버전 |
| 원본 trace | `traces/raw/20260806_pc_login_scrollfix_performance_run03.json.gz` |
| 원본 크기 | 10,855,425 bytes |
| 원본 SHA-256 | `ECB7DB588AB3CE6EA3D2FE5FD721D1BF202674F3DAD506456B0D7792BF0299EA` |
| 안전 분석본 | `20260806_pc_login_scrollfix_performance_run03.analysis.json` |
| 분석본 SHA-256 | `0622E2344570C01AD84BDB4CEE731513A8277FF27B9397408E22ACF26297350F` |
| trace 이벤트 | 167,841개 |
| 로컬 HTML SHA-256 | `D46F40D5F6EA800DF28AC15004179A11E92753816701FD4F1AF4155566AB2764` |

- [x] 원본 trace는 Git 제외 경로에 보관했다.
- [x] 안전 분석본에는 회원 식별 쿼리·요청 본문·응답 본문을 기록하지 않았다.
- [x] 분석본의 이메일·URL 인코딩 이메일·휴대폰·Bearer·회원 식별 쿼리는 모두 0건이었다.
- [x] 측정 도구 전체 테스트 7/7이 통과했다.
- [x] 로컬 HTML 해시는 run01·run02 측정 당시와 같다.

## 2. 결론

run03에서도 초기 부트스트랩 직후 긴 microtask, 전체 홈 렌더, MD PICK 단독 렌더가 같은 순서로 재현됐다. 전체 홈 렌더 예약은 세 번 실행됐지만 한 번은 13.5ms로 빠르게 끝났고 나머지 두 번이 각각 약 2.82초와 0.87초를 점유했다.

세 trace 모두에서 동일한 소스 위치가 오래 실행됐으므로 반복 전체 렌더가 현재 메인 스레드 병목이라는 결론은 확정할 수 있다. 다만 데이터 도착 시점과 렌더 요청 병합 여부에 따라 실행 횟수와 총시간 편차가 크므로 정확한 성능 수치는 허용 편차 20%를 충족하지 못했다.

## 3. 로그인 API 시간표

| API | 시작 | 응답 확인 | 완료 |
|---|---:|---:|---:|
| `home_bootstrap_light` | 1,376ms | 1,649ms | 1,653ms |
| 공개 `new_schedule_applications` | 8,325ms | 8,895ms | 8,901ms |
| 회원 `new_schedule_applications` | 8,325ms | 9,441ms | 9,442ms |
| 회원 `join_applications` | 9,489ms | 9,948ms | 9,949ms |
| `join_wishes_lookup` | 9,976ms | 10,615ms | 10,616ms |
| `home_stats` | 10,641ms | 11,529ms | 11,544ms |

마지막 일정 API가 끝난 뒤 `join_applications`가 시작되기까지의 간격은 **46.9ms**다. run01 55.7ms, run02 52.6ms와 함께 세 번 모두 짧았다.

## 4. long task와 렌더 함수

| 지표 | run03 |
|---|---:|
| long task 수 | 7개 |
| long task 합계 | 7,592ms |
| 가장 긴 작업 | 2,846ms |
| 부트스트랩 직후 긴 microtask | 2,846ms |
| 전체 홈 렌더 호출 | 3회 |
| 전체 홈 렌더 함수 합계 | 3,702ms |
| MD PICK 단독 렌더 호출 | 2회 |
| MD PICK 단독 렌더 함수 합계 | 912ms |
| 두 렌더 함수 합계 | 4,614ms |

run03 주요 작업은 다음과 같다.

| 시작~종료 | 길이 | 확인된 작업 |
|---|---:|---|
| 1,654~4,500ms | 2,846ms | `home_bootstrap_light` 직후 긴 microtask |
| 4,536~7,352ms | 2,816ms | `scheduleHomeRender()`가 예약한 `renderJoins()` |
| 7,360~8,096ms | 735ms | `scheduleMdPickSectionRender()`가 예약한 MD PICK 단독 렌더 |
| 별도 짧은 호출 | 13.5ms | 같은 전체 홈 렌더 예약 함수가 빠르게 종료 |
| 10,642~11,515ms | 874ms | `scheduleHomeRender()`가 예약한 `renderJoins()` |
| 11,548~11,726ms | 177ms | MD PICK 단독 렌더 |

짧은 13.5ms 호출은 캐시된 HTML 비교 또는 변경 없음 경로로 빠르게 끝났을 가능성이 있다. trace에는 `run` 바깥의 세부 함수 프레임이 충분하지 않아 정확한 조기 종료 조건은 코드 계측을 추가한 뒤 확인한다.

## 5. 3회 비교

| 지표 | run01 | run02 | run03 | 중앙값 |
|---|---:|---:|---:|---:|
| long task 합계 | 12,106ms | 9,377ms | 7,592ms | 9,377ms |
| 최대 long task | 3,157ms | 3,774ms | 2,846ms | 3,157ms |
| 전체 홈 렌더 합계 | 7,192ms | 4,728ms | 3,702ms | 4,728ms |
| MD PICK 렌더 합계 | 1,705ms | 938ms | 912ms | 938ms |
| 두 렌더 함수 합계 | 8,897ms | 5,665ms | 4,614ms | 5,665ms |
| 일정 API 완료 → 다음 API | 55.7ms | 52.6ms | 46.9ms | 52.6ms |

## 6. Web Vitals 참고값

trace 이벤트에서 근사한 LCP는 1,235ms, CLS는 0.015다. 세 trace의 LCP 후보값 편차가 매우 커 정식 LCP 기준으로 채택하지 않는다. INP는 상호작용이 없는 trace에서 계산할 수 없다.

## 7. 판정

- [x] 초기 반복 전체 홈 렌더 병목이 3회 모두 재현됐다.
- [x] MD PICK 단독 렌더 병목이 3회 모두 재현됐다.
- [x] 일정 API 완료 후 다음 API 간격은 세 번 모두 56ms 이하여서 응답 후 2초대 데이터 병합 가설을 기각한다.
- [x] 3회 중앙값을 계산했다.
- [ ] long task와 렌더 총시간의 3회 편차가 20% 안에 들어오지 않아 Phase 0 성능 편차 통과 조건은 아직 충족하지 못했다.
- [x] 추가 trace를 무작정 반복하기보다 Phase 1 계측에서 렌더 요청 원인·상태 revision·DOM 변경 여부를 직접 기록한다.

현재 단계에서는 기능 코드를 수정하지 않았다.
