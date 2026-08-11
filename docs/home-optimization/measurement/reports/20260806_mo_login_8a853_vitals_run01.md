# `8A853...` 모바일 로그인 콜드 Web Vitals run01

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
환경: Chrome Device Toolbar 모바일 UA, 412×915, 로그인, Disable cache, No throttling  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`  
사용자 흐름: 새로고침 → 15초 대기 → MD PICK 상세 열기/닫기 → 나의 모임 → 내예약 → 닫기

## 1. 결론

- [x] LCP는 1,303.790ms로 양호하다.
- [!] CLS는 0.209722로 개선 필요 구간이다.
- [!] INP 후보는 769.319ms로 느림 구간이다.
- [!] 초기 30초 long task는 16개, 합계 22.36초, 최대 4.31초다.
- [!] 전체 기록 long task는 28개, 합계 33.31초다.
- [!] 초기 부트스트랩에서 `home_bootstrap_light`가 두 번 호출됐다.
- [x] 실제 사용자 상호작용 5개가 정상 기록됐다.
- [x] 분석본 개인정보 0건과 raw trace Git 제외를 확인했다.
- [ ] 같은 운영 버전 run02·run03으로 반복 여부를 확인하기 전에는 최종 성능 판정을 내리지 않는다.

## 2. 핵심 수치

| 지표 | `8A853...` run01 | 권장 기준 | 판정 |
|---|---:|---:|---|
| LCP | 1,303.790ms | ≤2,500ms | 양호 |
| CLS 최대 세션 윈도우 | 0.209722265 | ≤0.1 | 개선 필요 |
| INP 후보 | 769.319ms | ≤200ms, >500ms 느림 | 느림 |
| 기록된 상호작용 | 5개 |  | 정상 수집 |
| 초기 30초 long task | 16개 | 50ms 이상 | 개선 필요 |
| 초기 30초 long task 합계 | 22,362.720ms |  | 개선 필요 |
| 초기 30초 최대 long task | 4,305.449ms |  | 개선 필요 |
| 전체 기록 long task | 28개 |  | 참고 |
| 전체 기록 long task 합계 | 33,310.927ms |  | 참고 |

## 3. 이전 참고 run01과 비교

이 비교는 회귀 확정이 아니라 원인 반복 여부를 보는 참고값이다. 두 표본의 HTML 버전이 다르므로 공식 전후 성능 통계로 합치지 않는다.

| 지표 | `CFD15...` 참고 | `8A853...` run01 | 변화 |
|---|---:|---:|---:|
| LCP | 1,295.655ms | 1,303.790ms | +0.6% |
| CLS | 0.205466 | 0.209722 | +2.1% |
| INP 후보 | 650.730ms | 769.319ms | +18.2% |
| 초기 long task 합계 | 17,093.711ms | 22,362.720ms | +30.8% |
| 초기 최대 long task | 4,008.814ms | 4,305.449ms | +7.4% |
| 전체 기록 long task 합계 | 24,352.877ms | 33,310.927ms | +36.8% |

LCP는 사실상 동일하지만 CLS·INP·long task는 개선되지 않았다. 특히 초기 long task 합계는 30% 이상 커졌으므로 run02·run03에서 부트스트랩 경로와 함께 재현 여부를 확인한다.

## 4. LCP

최종 LCP 요소는 이전 표본과 같은 골프조인 히어로 이미지다.

- 요소: `IMG`
- 표시 면적: 80,032px
- 대상: `hero_banner.webp`
- 최종 LCP: 1,303.790ms

이미지 자체보다 초기 데이터 렌더와 레이아웃 이동이 우선 병목이다.

## 5. CLS

이번 run01의 최대 CLS 세션은 페이지 시작 21,325.5ms에 발생한 단일 이동 0.209722다.

영향 요소:

- `#join-section-mdpick`
- 활성·비활성 `.chip` 버튼들

초기 1,367.7ms에도 이전과 같은 0.205466 이동이 발생했다.

- 원 홈페이지 래퍼 `.s_board_w`
- `.hero-calendar-shape`
- `#joinSectionNavSlot`
- `#join-section-mdpick`

즉 초기 골프조인 영역의 공간 미확보 문제는 그대로이며, 이번에는 약 21.3초 뒤 MD PICK·필터 칩 갱신이 조금 더 큰 별도 CLS 세션을 만들었다.

## 6. INP

| 사용자 상호작용 | 시작 | 지연 |
|---|---:|---:|
| MD PICK 상품상세 열기 | 26,950ms | 54.267ms |
| 상품상세 닫기 | 43,711ms | 33.968ms |
| 나의 모임 열기 | 49,435ms | 60.821ms |
| 내예약 열기 | 51,893ms | 769.319ms |
| 내예약 닫기 | 60,150ms | 47.703ms |

가장 느린 상호작용은 다시 `나의모임 → 내예약`이다.

- 클릭 직후 main-thread task: 714.320ms
- click 이벤트 처리: 706.598ms
- 운영 HTML inline `onclick`: 684.453ms
- 클릭 뒤 레이아웃: 4.401ms

이전 참고 표본과 동일하게 `handleJoinMyTripClick()` → `openJoinMyMenu()` → 첫 `renderJoinMyMenu(member)` 동기 렌더 경로가 가장 강한 원인이다. 이후 회원 일정 API 완료 뒤에도 992ms, 473ms, 201ms task가 추가됐다.

## 7. 초기 부트스트랩 중복 경로

초기 `home_bootstrap_light`가 두 번 실행됐다.

| 실행 | 시작 | 종료 | 호출 경로 |
|---|---:|---:|---|
| 1차 | 1,478.0ms | 5,589.0ms | `initializeGolfJoinHome()` → `hydrateHomeBootstrapLightFromGoogleSheet()` |
| 2차 | 10,210.3ms | 14,052.7ms | `hydrateHomeSecondaryData()` → `hydrateHomeBootstrapLightFromGoogleSheet()` |

현재 코드상 두 번째 호출은 `homeBootstrapSnapshotNeedsRefresh`가 참일 때만 발생한다. 따라서 trace 호출 스택과 분기 조건을 함께 보면 첫 응답이 snapshot fallback으로 판정돼 보조 데이터 단계에서 즉시 새로고침된 것으로 추론된다.

그 뒤 회원 API는 약 17.86초부터 시작하고 `home_stats`는 21.34초에 끝났다. 최대 CLS가 21.33초에 발생한 것과 시점이 거의 같다. run02·run03에서는 snapshot 갱신 경로가 반복되는지 반드시 구분한다.

## 8. 현재 판단과 단계 연결

- [ ] 1단계: 부트스트랩 호출 횟수·CLS·내예약 INP를 자동 회귀 지표로 추가한다.
- [ ] 2단계: 히어로·네비·MD PICK·칩의 최종 공간을 첫 페인트 전에 확보한다.
- [ ] 2단계: snapshot fallback을 사용자에게 먼저 표시하되 즉시 전체 교체로 레이아웃이 이동하지 않도록 한다.
- [ ] 3단계: 내예약 모달 껍데기와 공통 로딩을 먼저 한 프레임 표시한다.
- [ ] 3단계: 첫 클릭의 전체 탭·카드 동기 HTML 생성과 반복 `renderJoinMyMenu()`를 분할·통합한다.

제품 코드는 아직 수정하지 않았다.

## 9. 파일 무결성·개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw trace | 16,579,533 bytes | `58A871ACEA3B7D9D8613E3DA69699DB0C4031CBD8D3EE9BABC33B75A349549E2` |
| 안전 분석본 | 116,217 bytes | `3052A3422BD500BDAC39AF9793CA5DCBE7168087AF0E4C40F51A23470C0B03B0` |

- [x] raw trace는 `.gitignore` 대상이다.
- [x] 분석본 회원 필드명·이메일·휴대폰·쿠키는 모두 0건이다.
- [x] 분석 종료 시 로컬 HTML 해시는 `8A853...`으로 유지됐다.
- [x] 측정·분석 과정에서 제품 HTML을 수정하지 않았다.

## 10. 다음 측정

- [ ] 같은 모바일 UA·로그인·Disable cache·No throttling·사용자 흐름으로 run02를 저장한다.
- [ ] run02 시작 전 65초 동안 앱 캐시 만료를 보장한다.
- [ ] `home_bootstrap_light`가 한 번인지 snapshot 갱신으로 두 번인지 기록한다.
- [ ] 같은 조건 run03 뒤 중앙값과 상대 범위를 계산한다.
