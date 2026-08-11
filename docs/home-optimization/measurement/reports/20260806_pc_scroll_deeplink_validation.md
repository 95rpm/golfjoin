# PC 상세 모달 스크롤·로그인 딥링크 운영 검증

## 1. 검증 범위

| 항목 | 조건 |
|---|---|
| 검증일 | 2026-08-06 |
| 운영 URL | `https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1` |
| 로그인 | 로그인 상태 확인 |
| PC 기준 viewport | 1,440×900 |
| 상세 대상 | MD PICK 태국 우돈타니 로얄크릭 상품 |
| 딥링크 대상 | 현재 나의 모임 모집완료 일정 |
| 기능 코드 변경 | 없음 |

- [x] 기존 Chrome 로그인 세션에서 실제 운영 페이지를 검증했다.
- [x] 신청·찜·삭제·프로필 수정 등 데이터 변경 작업은 수행하지 않았다.
- [x] 테스트 후 모달을 닫고 사용자 탭을 최상단으로 복원했다.
- [x] 임시 딥링크 탭을 닫고 viewport override를 해제했다.

## 2. PC 레이아웃과 이미지

1,440px PC 기준으로 골프조인 요소만 별도 검사했다.

| 검사 | 결과 |
|---|---:|
| 골프조인 영역의 오른쪽 viewport 초과 요소 | 0개 |
| 완료된 이미지 중 `naturalWidth=0` | 0개 |
| 검사 시점 전체 이미지 | 81개 |
| 완료 이미지 | 49개 |
| 미완료 이미지 | 32개 |

미완료 32개는 화면 아래의 lazy 이미지로 분류한다. 완료된 이미지 중 깨진 이미지는 없었다.

문서 전체에서는 처음에 약 100px의 오른쪽 넘침이 관찰됐지만 원인은 원 홈페이지의 `.quick_item` 우측 퀵메뉴였다. 골프조인 `#secret-golf-join` 내부에는 오른쪽 넘침 요소가 없었고 페이지를 아래로 이동한 뒤 문서 넘침도 0px가 됐다.

초기 로딩 박스는 DOM에 남아 있었지만 부모 오버레이 상태가 다음과 같아 실제 화면과 클릭을 막지 않았다.

- `opacity: 0`
- `pointer-events: none`
- 골프조인 콘텐츠와 카드가 정상 렌더됨

## 3. PC 상품상세 스크롤 잠금·복원

MD PICK 카드를 화면 안에 둔 뒤 상세 모달을 열고 배경 스크롤을 시도한 다음 닫았다.

| 시점 | `scrollY` | body 상태 | 저장 좌표 |
|---|---:|---|---:|
| 카드 클릭 직전 | 1,200px | `position: static` | 없음 |
| 실제 상세 열기 이벤트 | 0px | `position: fixed`, `overflow: hidden` | `top: -1287px` |
| 열린 상태에서 스크롤 시도 후 | 0px | fixed 유지 | `top: -1287px` |
| 상세 닫기 후 | 1,287px | static 복원, 인라인 top·left·width 제거 | 없음 |

자동화 클릭이 카드를 화면 중앙으로 맞추며 클릭 직전 좌표를 1,200px에서 1,287px로 조정했고, 애플리케이션은 실제 클릭 이벤트 시점의 1,287px를 저장했다. 닫은 뒤 정확히 같은 1,287px로 복원됐으므로 기능은 정상이다.

- [x] 모달은 viewport 전체 1,440×900을 덮었다.
- [x] 열린 동안 배경 스크롤 좌표가 바뀌지 않았다.
- [x] 닫은 뒤 `detail-modal-page-scroll-locked`, `modal-open`, `join-fullscreen-modal-open` 클래스가 제거됐다.
- [x] 닫은 뒤 가로 넘침은 0px였다.

## 4. 로그인 상태 알림톡 딥링크

다음 구조의 운영 딥링크를 별도 임시 탭에서 실행했다.

```text
golfjoinOpen=my-section
scheduleId=<현재 모집완료 일정>
golfjoinTab=complete
```

| 검사 | 결과 |
|---|---|
| 회원별 나의 모임 데이터 로딩 | 모집완료 섹션 카드 4개 확인 |
| 대상 일정 탐색 | 성공 |
| 딥링크 쿼리 정리 | 성공, canonical URL만 유지 |
| 열린 `#detailModal` | 1개 |
| 열린 골프조인 portal overlay | 1개 |
| 딥링크 기준 잠금 좌표 | 605px |
| 열린 동안 body | `position: fixed`, `top: -605px` |
| 닫은 후 복원 좌표 | 605px |
| 닫은 후 나의 모임 섹션 viewport 위치 | 상단 265px |
| 닫은 후 모달 | 0개 open |

- [x] 로그인 상태에서 회원 데이터 로딩 후 대상 일정을 찾았다.
- [x] 나의 모임 섹션 위치를 기준으로 상세 모달이 열렸다.
- [x] DOM에는 상세 모달이 하나만 열렸다.
- [x] 소스의 `joinExternalDeepLinkResumePromise` 단일 실행 가드가 유지돼 있다.
- [x] 닫은 뒤 URL·body 클래스·인라인 스타일·스크롤 좌표가 정상 복원됐다.
- [ ] 로그아웃→로그인 복귀 경로는 실제 인증이 필요해 이번 자동 검증에 포함하지 않았다.
- [ ] 회원 데이터가 의도적으로 지연되는 장애 시나리오는 별도 계측·mock 환경이 필요하다.

## 5. 모바일 자동 검증 제한

Chrome viewport를 390×844로 변경한 뒤 `m.secret-tour.com/event/plan_view`를 열었지만 현재 Chrome의 데스크톱 User-Agent 때문에 `www.secret-tour.com`으로 리디렉션됐다. 원 홈페이지의 데스크톱 1,200px 래퍼가 유지되므로 이 결과를 모바일 CSS 결함으로 판정하면 안 된다.

후속 작업에서 Device Toolbar의 모바일 기기 모드와 모바일 UA로 다시 측정해 아래 세 항목을 완료했다. 상세 수치는 `docs/home-optimization/measurement/reports/20260806_mobile_scroll_layout_validation.md`에 분리했다.

- [x] viewport만 축소한 데스크톱 페이지는 모바일 공식 표본에서 제외했다.
- [x] 모바일 URL이 데스크톱 UA에서 `www`로 리디렉션되는 것을 확인했다.
- [x] 실제 모바일 기기 또는 User-Agent까지 모바일로 전환한 DevTools에서 다시 검증한다.
- [x] 모바일에서 상세 열기 전·열린 동안·닫은 후 좌표와 가로 스크롤을 기록한다.
- [x] 모바일 나의 모임 첫 카드 위치를 해외조인 BEST와 비교한다.

## 6. Web Vitals 제한

현재 Chrome 자동화의 읽기 전용 페이지 범위에는 `window.performance`가 노출되지 않아 정식 LCP·INP·CLS를 직접 추출할 수 없었다.

- [x] Performance trace 3회에서 long task 기준선은 확보했다.
- [x] trace 기반 LCP·CLS 근사값은 정식 Web Vitals로 채택하지 않았다.
- [ ] DevTools 또는 페이지 내 `PerformanceObserver` 계측으로 LCP·CLS를 3회 기록한다.
- [ ] 실제 카드 클릭·스크롤 상호작용을 포함해 INP를 3회 기록한다.

## 7. 판정

- [x] PC 상세 모달 스크롤 잠금·복원: 통과
- [x] PC 골프조인 영역 가로 넘침: 통과
- [x] 로그인 상태 나의 모임 딥링크·단일 모달·좌표 복원: 통과
- [x] 모바일 UA 환경: 레이아웃·상세 스크롤 검증 통과
- [ ] 로그아웃→로그인 딥링크: 미검증
- [ ] 정식 LCP·INP·CLS: 미측정

이 검증에서는 기능 코드를 수정하지 않았다.
