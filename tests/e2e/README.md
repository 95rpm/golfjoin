# 골프조인 브라우저 E2E

이 테스트는 운영 Cloud Function과 분리된 개발 전용 검사다. 새 브라우저 컨텍스트로 실행되므로 기본 smoke 테스트에는 로그인 쿠키가 없다.

## 현재 검사 범위

- PC Chrome과 모바일 Chrome 화면 크기
- 로그아웃 메인 진입
- 나의 모임 섹션 미노출
- 세로 스크롤 가능
- MD PICK 카드와 대표 이미지 표시
- 상품상세 모달 열기
- 모달 뒤 메인 영역 유지
- 모바일 카드 클릭 좌표와 fixed body 잠금 좌표 일치
- 모달 닫기와 기존 스크롤 위치 복원
- 상품상세 GET 5초 지연 중 닫기와 늦은 응답 후 상태 유지
- 이전 상품 응답 전에 다른 상품을 열었을 때 최신 상품 유지
- 상품군 여행기간 연속 선택 시 마지막 선택·단일 활성 상태 유지

현재 PC smoke와 모바일 강화 smoke 3회 연속 검사는 모두 통과한다. 모바일 간헐 실패는 카드 클릭 후 비동기 상품군 조회가 끝난 뒤 페이지 좌표를 저장하던 순서가 원인이었으며, 클릭 즉시 좌표를 저장하도록 수정·배포했다. 상세 근거는 `docs/home-optimization/measurement/reports/20260806_e2e_mobile_scroll_restore_instability.md`에 기록했다.

상세 비동기 응답 경합 검사는 PC와 모바일에서 통과했다. 실행 시 운영 GET 응답만 지연하며 쓰기 요청은 만들지 않는다. 결과는 `docs/home-optimization/measurement/reports/20260806_e2e_detail_response_race.md`에 기록했다.

기본·지연 닫기·이전 응답 경합·기간 연속 선택의 전체 회귀 묶음은 PC 4/4와 모바일 4/4, 총 8/8을 통과했다.

공개 메인 장애 fallback은 별도 명령으로 실행한다. 상품군 manifest 실패, bootstrap 500·3초 지연, manifest 참조 누락, 잘못된 홈 카드 JSON을 PC/MO에서 검사하며 총 10/10을 통과했다.

```powershell
npm.cmd run test:e2e:fallback
```

회원 상태 격리 테스트는 실제 계정 대신 합성 `CookieData`와 합성 API 응답만 사용한다.
운영 구글시트 쓰기 요청은 테스트 라우터에서 차단한다.

검사 범위는 raw CookieData, 세션 우선순위, 프로필 미완성, A 로그아웃 후 B 로그인,
2.5초 지연된 로그인 복귀 딥링크의 단일 실행, 내예약 첫 진입·재진입 API와 회원별 캐시 비교다.
PC 6개와 모바일 6개, 총 12개가 통과해야 한다. 상세 결과는
`docs/home-optimization/measurement/reports/20260806_e2e_member_auth_deeplink_cache.md`에 기록한다.

```powershell
npm.cmd run test:e2e:member
```

A 생성자·B 참여자 생명주기 검사는 실제 회원이나 운영 시트 쓰기 없이 합성 응답으로 실행한다.
A 2명 생성, B 1명 참여 3/4, 모집완료 4/4, B 취소와 재로그인을 PC·모바일에서 확인한다.
상품카드·상세·내예약의 참여자 아이콘, 현재인원, 성별 구성, `나`·`모임장`, 모집완료 우선 필터가 검사 대상이다.
PC 4개와 모바일 4개, 총 8개가 통과해야 한다. 상세 결과는
`docs/home-optimization/measurement/reports/20260806_e2e_participant_lifecycle.md`에 기록한다.

```powershell
npm.cmd run test:e2e:participant
```

`test:e2e:member`는 위 참여자 8개를 포함해 인증·딥링크·캐시 전체 20개를 실행한다.

성능 관측 장치 검사는 로컬 최신 HTML을 브라우저 메모리에 넣어 실행하므로 운영 배포 전에 사용할 수 있다.
비로그인에서는 부팅·첫 이미지·상품상세·항공편 mark를, 합성 로그인 회원에서는 개인 데이터 mark와 로그 마스킹을 검사한다.
실제 회원정보나 운영 쓰기 요청은 사용하지 않으며 PC 2개·모바일 2개, 총 4개가 통과해야 한다.

```powershell
npm.cmd run test:e2e:diagnostics
```

완료 기록은 `docs/home-optimization/measurement/reports/20260807_performance_diagnostics_privacy.md`에 남긴다.

## 실행 방법

```powershell
cd D:\secrettour_join\260521\golfjoin
npm.cmd install
npm.cmd run test:e2e:smoke
```

모바일 복원 안정성을 3회 반복하려면 다음과 같이 실행한다.

```powershell
npm.cmd run test:e2e:smoke -- --project=mobile-chrome --repeat-each=3
```

MD PICK 클릭 좌표 전달의 로컬 단위 테스트와 숫자 전용 진단은 다음과 같이 실행한다.

```powershell
npm.cmd run test:unit
npm.cmd run diagnose:e2e:mobile-scroll
```

화면을 직접 보면서 실행하려면 다음 명령을 사용한다.

```powershell
npm.cmd run test:e2e:smoke:headed
```

다른 검증 페이지를 사용할 때만 환경변수를 지정한다.

```powershell
$env:GOLFJOIN_E2E_URL = "https://www.secret-tour.com/event/event_view?eventPlanSeq=16&page=1"
npm.cmd run test:e2e:smoke
Remove-Item Env:GOLFJOIN_E2E_URL
```

로그인 상태 파일은 `tests/e2e/.auth/` 아래에만 두며 Git에서 제외한다. 비밀번호, 인증번호, 쿠키 또는 storage state를 소스와 테스트 결과에 기록하지 않는다.
