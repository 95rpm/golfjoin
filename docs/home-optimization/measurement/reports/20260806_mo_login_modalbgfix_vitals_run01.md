# 모바일 로그인 콜드 Web Vitals run01

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
환경: Chrome Device Toolbar 모바일 UA, 412×915, 로그인, Disable cache  
운영 소스 경계: 사용자가 운영 배포를 확인한 `CFD15EAB98F445B0E6A182E0560F7B890BA939076E68C3749D98DE6154A1D5E8` HTML  
사용자 흐름: 새로고침 → 15초 대기 → MD PICK 상세 열기/닫기 → 나의 모임 → 내예약

## 1. 결론

- [x] LCP는 1,295.7ms로 양호하다.
- [!] CLS는 0.2055로 개선 필요 구간이다.
- [!] INP 후보는 650.7ms로 느림 구간이다.
- [!] 초기 30초 long task는 15개, 합계 17.09초, 최대 4.01초다.
- [x] 실제 사용자 상호작용 4개가 trace에 기록됐다.
- [x] 분석본에 회원키·이메일·휴대폰·쿠키가 남지 않았다.
- [ ] 한 번의 실험실 측정으로 운영 p75 합격을 판정하지 않고 같은 조건 3회 결과를 사용한다.

Google의 현재 권장 기준은 LCP 2,500ms 이하, INP 200ms 이하, CLS 0.1 이하이며 운영 합격은 모바일·데스크톱을 나눠 실제 방문의 75번째 백분위로 판단한다. 단일 Performance trace는 개선 전 실험실 기준선으로 사용한다. 참고: [web.dev Core Web Vitals 기준](https://web.dev/articles/defining-core-web-vitals-thresholds)

## 2. 핵심 수치

| 지표 | run01 | 권장 기준 | 판정 |
|---|---:|---:|---|
| LCP | 1,295.655ms | ≤2,500ms | 양호 |
| CLS 최대 세션 윈도우 | 0.205465993 | ≤0.1 | 개선 필요 |
| INP 후보 | 650.730ms | ≤200ms, >500ms 느림 | 느림 |
| 기록된 상호작용 | 4개 |  | 정상 수집 |
| 초기 30초 long task | 15개 | 50ms 이상이 long task | 개선 필요 |
| 초기 30초 long task 합계 | 17,093.711ms |  | 개선 필요 |
| 초기 30초 최대 long task | 4,008.814ms |  | 개선 필요 |
| 전체 기록 long task | 25개 |  | 참고 |
| 전체 기록 long task 합계 | 24,352.877ms |  | 참고 |

## 3. LCP 분석

최종 LCP 요소는 골프조인 히어로 이미지다.

- URL: `https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/hero_banner.webp`
- 요소: `IMG`
- 표시 면적: 80,032px
- 이미지 발견: 약 240ms
- 이미지 로드 시작: 약 470.4ms
- 이미지 로드 완료: 약 477ms
- 최종 LCP: 약 1,295.7ms

이미지 다운로드 자체는 빠르고 LCP 기준도 통과한다. 현재 1순위 문제는 이미지 전송보다 이후의 레이아웃 이동과 반복 렌더다.

## 4. CLS 원인

가장 큰 레이아웃 이동은 페이지 시작 1,380.9ms에 한 번 발생했고 이 한 번의 점수가 0.205466이다. 최종 LCP 약 85ms 뒤에 화면의 큰 영역이 이동했다.

영향 요소:

- 원 홈페이지 래퍼 `.s_board_w`
- 골프조인 히어로 장식 `.hero-calendar-shape`
- 섹션 네비게이션 `#joinSectionNavSlot`
- MD PICK `#join-section-mdpick`

14,066ms의 칩·MD PICK 이동은 0.06349였지만 앞 이동과 1초 이상 떨어진 별도 세션이므로 Web Vitals CLS는 더 큰 첫 세션 0.205466을 채택한다.

가장 가능성 높은 원인은 골프조인 초기 영역의 최종 높이와 위치가 첫 페인트 전에 확보되지 않고, 초기 데이터·CSS 적용 뒤 원 홈페이지와 하위 섹션이 함께 재배치되는 것이다.

## 5. INP 원인

| 사용자 상호작용 | 시작 | 지연 |
|---|---:|---:|
| MD PICK 상품상세 열기 | 22,935ms | 59.242ms |
| 상품상세 닫기 | 37,988ms | 42.698ms |
| 나의 모임 열기 | 45,953ms | 92.761ms |
| 내예약 열기 | 48,180ms | 650.730ms |

가장 느린 상호작용은 `나의 모임 → 내예약`이다.

- 클릭 직후 main-thread task: 592.088ms
- click 이벤트 처리: 582.159ms
- 운영 HTML inline `onclick`: 560.057ms
- 클릭 뒤 레이아웃: 5.702ms
- 뒤이어 회원 일정 API가 완료되는 동안 877.683ms, 336.495ms, 180.622ms, 115.057ms task가 추가 발생

행동 순서와 소스 연결상 `handleJoinMyTripClick()` → `openJoinMyMenu()` → 첫 `renderJoinMyMenu(member)` 동기 실행이 초기 560ms 점유의 가장 강한 원인이다. 이후 일정 API 완료와 회원 새로고침에서도 `renderJoinMyMenu()`가 반복된다.

현재 로컬 참고 위치:

- `golfjoin_main.html:37437` — `handleJoinMyTripClick()`
- `golfjoin_main.html:41652` — `openJoinMyMenu()`
- `golfjoin_main.html:41692` — 모달을 연 직후 동기 `renderJoinMyMenu(member)`
- `golfjoin_main.html:41702` — 일정 API 완료 뒤 재렌더

이 원인 연결은 trace의 사용자 흐름·클릭 task·소스 실행 순서를 함께 사용한 추론이다. 제품 코드는 아직 수정하지 않았다.

## 6. 개선 후보와 적용 단계

- [ ] 1단계: CLS 회귀 테스트와 내예약 열기 시간 계측을 추가한다.
- [ ] 2단계: 첫 페인트 전에 히어로·네비·MD PICK 영역의 최종 공간을 확보한다.
- [ ] 3단계: 내예약 클릭 시 모달 껍데기와 공통 로딩을 먼저 한 프레임 표시한 뒤 카드 렌더를 나눈다.
- [ ] 3단계: 일정 API·회원 갱신이 각각 호출하는 `renderJoinMyMenu()`를 한 번으로 합친다.
- [ ] 3단계: 보이지 않는 탭 카드 전체 HTML 생성을 첫 클릭의 동기 작업에서 제외한다.

## 7. 파일 무결성·개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw trace | 16,414,210 bytes | `9D96B27EBA2E42DDEB4DE6EB068A5AD186CC1B1AB3F3B93ACEE4324FDEBCA930` |
| 안전 분석본 | 112,808 bytes | `4732AAD9F7B4F69D8920D8E4D49288B6394CCABB4836610DD76AD3046263629C` |

- [x] raw trace는 `.gitignore` 대상이다.
- [x] 분석본의 회원 필드명 0건, 이메일 0건, 휴대폰 0건, 쿠키 0건을 확인했다.
- [x] 측정·분석 과정에서 제품 HTML을 수정하지 않았다.
- [x] run01 저장 뒤 10:38 KST에 생긴 새 로컬 HTML 변경은 이 표본과 분리했다.

## 8. 다음 측정

- [ ] 같은 모바일 UA·로그인·Disable cache·사용자 흐름으로 run02를 저장한다.
- [ ] 같은 조건 run03을 저장한다.
- [ ] LCP·CLS·INP 후보·long task의 중앙값과 상대 범위를 계산한다.
- [ ] CLS와 INP가 세 번 모두 같은 원인인지 확인한 뒤 0단계 판정을 확정한다.
