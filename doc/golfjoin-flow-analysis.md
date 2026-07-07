# 골프조인 전체 구조 및 버튼 플로우 분석

작성일: 2026-07-07  
대상 파일:
- `golfjoin_main.html`
- `golfjoin_admin_dashboard.html`
- `server/google-sheet-proxy-function/index.js`
- `doc/google-sheet-web-app.gs`

## 1. 전체 화면 구조

### 1.1 사용자 메인 페이지

`golfjoin_main.html`은 단일 HTML 안에 홈, 상세, 신청, 새 모임 만들기, 마이페이지, 로그인/회원가입, 지역검색, 캘린더, 공유, 전화, 대기신청 모달까지 모두 포함한다.

주요 레이어:
- 홈 본문: 히어로, 모바일 검색, 섹션 네비게이션, MD PICK, 마감임박, 곧출발, 맞춤형 조인, 해외 BEST, 상담/외부 링크.
- 상세 모달: 상품/조인 상세, 이미지 슬라이더, 일정표, 항공/포함/불포함/시설/후기, 참여자 정보, 찜, 공유, 날짜 변경, 참여 신청.
- 신청 모달: 기존 조인 일정 참여 신청, 참여자 정보, 동반자, 예약 대행/직접 예약, 객실, 개인정보 동의, 완료 화면.
- 새 모임 만들기 모달: 날짜 선택, 지역 선택, 추천 상품 선택, 참여자 정보, 신청 완료.
- 마이 레이어: 마이 드로어, 최근 본 상품/조인, 찜, 모집중/참여중/완료 일정, 프로필 관리.
- 회원 레이어: 로그인, 카카오 로그인, 이메일 로그인, 아이디/비밀번호 찾기, 회원가입, 필수 프로필 입력.
- 탐색 레이어: 지역 검색, 전체 지역 패널, 캘린더 시트, 빈 날짜 새 모임 유도.
- 공통 레이어: 전화 모달, 개인정보 약관 모달, 대기신청 모달, 공유 모달, 로딩 오버레이.

초기화 흐름:
1. `initializeGolfJoinHome()`
2. 더미 데이터 제거, 로컬 캐시 복원, 히어로/하단 네비 초기화
3. `hydrateHomeBootstrapLightFromLocalCache()`로 캐시 즉시 적용
4. `renderJoins()`로 홈을 먼저 렌더
5. `hydrateHomeBootstrapLightFromGoogleSheet()`, `hydrateJoinWishesFromGoogleSheet()`, `hydrateHomeStatsFromGoogleSheet()`는 백그라운드 갱신
6. 상품 JSON은 idle 시점에 `ensureExternalGolfJoinProductsLoaded()`로 로드

### 1.2 관리자 대시보드

`golfjoin_admin_dashboard.html`은 로그인 후 단일 앱 화면으로 동작한다.

주요 메뉴:
- 일정 관리: 모집 일정, 참여자, 결제/견적/취소 상태 관리, 상품 상세 보기.
- 추천 일정: 외부 상품 데이터 기반 추천 일정 등록/숨김/월례회 설정.
- 고객 관리: 회원 프로필과 고객별 여행 이력 조회.

관리자 데이터 흐름:
1. 로그인: `loginAdmin()`
2. 부트스트랩 조회: `fetchAdminBootstrap()`
3. 화면별 렌더: `renderMetrics()`, `renderTable()`
4. 상태 변경: `saveParticipantStatus()`, `saveQuoteComplete()`, `submitProductDisplayRule()`
5. 데이터 재조회: `loadDashboard()`

### 1.3 서버/시트 계층

Cloud Function `golfjoin-sheet-api`가 클라이언트와 Google Apps Script 사이의 프록시/캐시/검증 계층이다.

주요 역할:
- 공개 홈 데이터 조회: `home_bootstrap_light`, `home_bootstrap`, `home_stats`
- 회원 프로필/찜 조회: `member_profile_lookup`, `join_wishes_lookup`
- 신청/프로필/후기/찜/추천일정 쓰기: `source` 값별 validation 후 Apps Script로 전달
- 관리자 로그인/조회/상태 변경
- 상품 상세/항공 스케줄 프록시
- 공유용 OG HTML 생성
- 홈 부트스트랩 light 캐시: hit/stale/miss 처리

Google Apps Script `doc/google-sheet-web-app.gs`는 실제 시트 행 읽기/쓰기와 요약 생성 계층이다.

주요 시트:
- `new_schedule_applications`
- `join_applications`
- `join_member_profiles`
- `join_reviews`
- `join_wishes`
- `schedule_participant_summary`
- `recommended_schedules`

## 2. 사용자 메인 버튼 플로우

### 2.1 홈 상단/탐색

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 모바일 지역 검색 입력 | `openMainMobileRegionSearch(this)` | 지역 검색 모달 열기, 최근/인기/전체 지역 선택으로 이동 |
| 히어로 캘린더 버튼 | `openCalendarSheet()` | 캘린더 시트 열기, 날짜별 일정 표시 |
| 섹션 칩: 추천여행/취향맞춤/마감임박/곧출발/맞춤조인/해외BEST | `scrollHomeJoinSection(key)` | 해당 홈 섹션으로 스크롤, 섹션 네비 active 갱신 |
| 새 모임 만들기 CTA | `openBuilderModalFromMain(this)` | 로그인/프로필 확인 후 새 모임 만들기 모달 |
| 플로팅 새 모임 버튼 | `openBuilderModalFromMain(this)` | 동일 |

개선 포인트:
- 섹션 키와 DOM id가 분산되어 있어 잘못된 키 입력 시 무반응 가능성이 있다.
- 홈 탐색은 앵커 스크롤과 렌더 상태가 섞여 있어 초기 데이터 로딩 중 클릭 UX가 불안정할 수 있다.

### 2.2 MD PICK/추천 상품

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 국가 선택: 태국/일본/중국 등 | `selectMdPickCountry(countryKey, event)` | 국가별 대표 상품 목록 교체, 이미지 preload 예약 |
| 국가 드롭다운 열기/닫기 | `toggleMdPickCountryMenu(event)` | 국가 옵션 표시 상태 변경 |
| 상품 유형: 골프팩/항공팩 | `setMdPickPackFilter(countryKey, packType)` | 국가 내 상품 필터 변경 |
| 상품 유형 안내 | `toggleMdPickPackTooltip(event, countryKey)` | 툴팁 표시 |
| MD PICK 카드 | `openMdPickProductDetail(productGroupKey, countryKey)` | 추천 상품 상세 모달 열기 |
| 취향 탭 | `setMdPickTheme(themeKey)` | 취향별 상품 리스트 교체 |
| 취향 카드 | `openMdPickProductDetail(...)` | 추천 상품 상세 모달 |

상세 내부 흐름:
1. `openMdPickProductDetail()`
2. 상품 그룹을 `externalGolfJoinProducts` 또는 fallback join에서 찾음
3. 필요 시 Secret Tour 상품 상세/항공정보 로드
4. `detailModal` 또는 builder 상품 상세 화면으로 렌더
5. 기본 CTA는 날짜변경/멤버모집/참여하기 중 상태에 따라 분기

개선 포인트:
- MD PICK은 정적 HTML 초기 카드와 동적 렌더 카드가 동시에 존재한다.
- `openMdPickProductDetail`이 상세 조회, builder 상태 세팅, 모달 렌더까지 담당한다. 도메인 로직과 UI 로직 분리가 필요하다.

### 2.3 상품/조인 카드

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 일반 조인 카드 | `openDetail(join.id)` | 상세 모달 열기 |
| 마감임박 이전/다음 | `changeQuickFeatured(delta)` | 대표 카드 변경 |
| 곧출발 월 칩 | `selectSoonMonth(monthKey)` | 해당 월 첫 날짜로 이동 |
| 곧출발 날짜 칩 | `selectSoonDate(key)` | 날짜별 패널 전환 |
| 곧출발 더보기 | `loadMoreSoonItems()` | 표시 개수 증가 후 재렌더 |
| 맞춤형 조인 테마 | `selectCustomTheme(key)` | 테마 패널 전환 |
| BEST 섹션 이전/다음 | `scrollBestJoinSection(key, direction)` | 섹션 가로 스크롤 |
| 참여자 아바타 | `handleParticipantClick(this)` | 참여자 정보 팝오버/시트 열기 |

상세 모달 공통 흐름:
1. `openDetail(id)`
2. `currentDetailJoinData` 세팅
3. `renderDetailContent(join)`
4. 이미지 슬라이더/앵커/후기/CTA 초기화
5. 최근 본 항목 저장

개선 포인트:
- 카드 클릭과 내부 참여자 클릭이 `event.stopPropagation()`에 의존한다.
- `renderJoins()`가 캐시 정리, 섹션 계산, DOM 재생성, 이미지 fallback, 슬라이드, 타이머까지 수행해 변경 영향 범위가 크다.

### 2.4 상세 모달

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 닫기/뒤로 | `closeModal('detailModal')` | 상세 모달 닫기 |
| 이미지 이전/다음 | `changeDetailSlide(direction)` | 슬라이더 index 변경 |
| 이미지 dot | `setDetailSlide(index)` | 해당 이미지로 이동 |
| 상세 앵커: 상품요약/항공/포함/일정/시설/후기 | `scrollDetailSection(section)` | 상세 내부 섹션 스크롤 |
| 일정 일차 칩 | `selectDetailScheduleDay(index)` | 일정표 일차 전환 |
| 혜택 자세히 보기 | `toggleDetailBenefitAccordion(this)` | 혜택 설명 접힘/펼침 |
| 전화 문의 | `handlePhoneContact()` | 전화 모달 또는 tel 링크 |
| 카카오 문의 | `openExternalLink(kakaoUrl)` | 외부 카카오 채널 |
| 날짜변경 | `handleDetailDateChangeAction()` | builder 날짜 변경/모집 플로우로 분기 |
| 참여하기 | `openGlobalApply()` 또는 `handleDetailPrimaryAction()` | 로그인/프로필 확인 후 신청 모달 |
| 찜 | `handleDetailWish()` | 로그인 필요 시 로그인 플로우, 이후 로컬/시트/Secret Tour 찜 동기화 |
| 공유 | `handleDetailShare()` | 짧은 URL/OG URL 생성 후 공유 모달 |
| 카카오 공유 | `shareDetailToKakao()` | Kakao SDK 템플릿 공유 |
| URL 복사 | `copyDetailShareUrl()` | 클립보드 복사 |

개선 포인트:
- 상세 CTA가 상품 타입, builder 모드, 로그인 상태, 일정 충돌 상태에 따라 동적으로 바뀌는데 상태 모델이 명시적이지 않다.
- 공유 URL, Secret Tour 원본 URL, 조인 상세 URL이 섞여 있어 canonical 정책 문서화가 필요하다.

### 2.5 기존 조인 참여 신청

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 신청 모달 닫기 | `closeGlobalApply()` | 신청 모달 닫기 |
| 직업 칩 | `setApplyProfession(value)` | 신청자 직업 선택 |
| 혼자/동반 | `setGlobalApplyPeopleMode(mode)` | 동반자 입력 UI 전환 |
| 동반 남성/여성 추가 | `addCompanionGender('global', gender)` | 동반자 성별 배열 추가 |
| 인원 +/- | `changeCompanionPeople('global', delta)` | 동반자 수 변경 |
| 예약 대행/직접 예약 | `selectApplyBookingOption(this)`, `updateApplyBookingOptions('global')` | 항공/객실 옵션 표시 전환 |
| 객실 옵션 | `selectApplyBookingOption(this)` | 2인1실/1인1실 등 선택 |
| 인사말 템플릿 | `setApplyGreeting(text)` | 메시지 입력 |
| 예약 정보 접힘 | `toggleApplyReservationPart(this)` | 항공/호텔/요청사항 영역 접힘 |
| 개인정보 상세 | `openAgreementDetail(key)` | 약관 상세 모달 |
| 약관 동의 완료 | `confirmPrivacyApplyModal()` | 동의 체크 반영 |
| 참여 신청하기 | `submitGlobalApply()` | 검증 후 확인 모달 |
| 신청 확인 | `confirmApplySubmitModal()` | 실제 저장 실행 |
| 대기신청 | `confirmWaitlistApply()` | 잔여석 부족 시 대기 신청 진행 |
| 혼자갈게요 | `chooseWaitlistSolo()` | 인원 조정 후 신청 계속 |

저장 흐름:
1. `submitGlobalApply({ confirmed: true })`
2. 필수값/좌석/동의 검증
3. `postGolfJoinSheetPayload()` 호출
4. `source: "join_apply"`로 Cloud Function 전달
5. 서버 validation
6. Apps Script `join_applications` 저장
7. `schedule_participant_summary` 갱신
8. 알림톡 백그라운드 발송
9. 로컬 참여자 상태 반영 및 완료 화면

개선 포인트:
- `submitGlobalApply()`가 검증, 확인 모달, 저장, 로컬 반영, 완료 UI까지 담당한다.
- 동반자/예약 옵션은 builder 신청과 중복 로직이 많다.

### 2.6 새 모임 만들기

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 새 모임 만들기 | `openBuilderModalFromMain(this)` | 로그인/프로필 확인 후 builder 열기 |
| 이전 | `prevBuilderStep()` | 이전 단계 |
| 다음/신청하기 | `nextBuilderStep()` | 단계 검증 후 다음 단계 또는 저장 |
| 진행 단계 클릭 | `goBuilderProgressStep(step)` | 가능한 단계로 이동 |
| 월 이전/다음 | `changeBuilderMonth(delta)` | 달력 월 변경 |
| 날짜 초기화 | `resetBuilderDates()` | 출발/도착 날짜 초기화 |
| 날짜 칸 | `openBuilderDatePopover(type, this)` | 출발/도착 날짜 선택 팝오버 |
| 이날만/여유롭게 | `setBuilderPopoverMode(mode)` | 날짜 유연성 UI 전환 |
| 전/후 +/- | `changeBuilderPopoverFlex(side, delta)` | 유연 날짜 범위 조정 |
| 선택완료 | `confirmBuilderPopoverFlex()` | 유연 날짜 확정 |
| 지역 검색 지우기 | `clearBuilderRegionSearchInput()` | 지역 검색어 초기화 |
| 지역 필터 | `showBuilderRegionSelector()` | 지역 선택 UI 표시 |
| 지역/국가/도시 선택 | `selectBuilderEmbeddedRegion(value)` | builder 지역 상태 반영 |
| 직업 칩 | `setBuilderApplyProfession(value)` | 신청자 직업 선택 |
| 혼자/동반 | `setBuilderApplyPeopleMode(mode)` | 동반자 UI 전환 |
| 동반 남성/여성 추가 | `addCompanionGender('builder', gender)` | 동반자 추가 |
| 예약/객실 옵션 | `selectApplyBookingOption(this)`, `updateApplyBookingOptions('builder')` | 예약 조건 반영 |
| 인사말 템플릿 | `setBuilderApplyGreeting(text)` | 인사말 입력 |
| 완료 후 카카오/밴드 | `openExternalLink(...)` | 외부 링크 |
| 완료 공유 | `handleCompletionShare('builder')` | 공유 모달 |
| 완료 확인 | `closeAllJoinModals()` | 전체 모달 닫기 |

저장 흐름:
1. `nextBuilderStep()`에서 마지막 단계 진입
2. builder 상태와 신청자 정보를 payload로 구성
3. `saveBuilderApplyToGoogleSheet()`
4. `source: "new_schedule_builder"`로 Cloud Function 전달
5. Apps Script `new_schedule_applications` 저장
6. `schedule_participant_summary` 갱신
7. 홈/마이 일정에 새 일정 반영

개선 포인트:
- builder는 날짜/지역/상품/참여자/예약/완료 UI가 하나의 거대한 상태 객체와 DOM에 결합되어 있다.
- 날짜 유연성 상태와 실제 상품 매칭 조건이 분리되어 있지 않아 테스트하기 어렵다.

### 2.7 지역 검색/캘린더

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 지역 검색 닫기 | `closeRegionSearchModal()` | 모달 닫기 |
| 검색어 지우기 | `clearRegionSearchInput()` | 검색 초기화 |
| 전체 지역 열기 | `openRegionAllPanel()` | 전체 지역 패널 |
| 최근/인기 지역 | `selectDesktopRegion(value)` | 지역 선택, 결과 표시 |
| 최근 삭제 | `removeRegionRecent(index)` | 최근 지역 삭제 |
| 전체삭제 | `clearRegionRecent()`/`clearRegionSelected()` | 기록/선택 초기화 |
| 카테고리/국가 | `selectRegionCategory(index)`, `selectRegionCountry(index)` | 지역 트리 탐색 |
| 도시 선택 | `selectRegionResult(value)` | 지역 검색 결과 반영 |
| 선택 완료 | `confirmRegionSelection()` | 지역 확정 |
| 결과 없음 새 모임 | `openBuilderFromRegionSearch()` | builder로 전환 |
| 캘린더 닫기 | `closeCalendarSheet()` | 캘린더 시트 닫기 |
| 월 이전/다음 | `changeCalendarMonth(delta)` | 캘린더 월 변경 |
| 날짜 선택 | `toggleCalendarDay(weekKey, dateKey)` | 해당 날짜 일정 목록 표시 |
| 빈 날짜 새 모임 | `openBuilderFromCalendarEmptyDate()` | 선택 날짜로 builder 열기 |
| 캘린더 정렬 | `setCalendarMobileSelectionSort(...)` | 지역순/가격순 전환 |

개선 포인트:
- 지역 검색은 desktop/mobile/builder용 함수가 비슷하지만 별도로 존재한다.
- 지역 데이터/검색 인덱스/최근 기록/결과 렌더를 하나의 모듈로 분리하는 편이 좋다.

### 2.8 마이/로그인/회원가입

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 하단 마이 | `handleJoinMyButtonClick()` | 로그인 상태 확인 후 마이 드로어 |
| 프로필 관리 | `openJoinProfileManageModal()` | 프로필 편집 모달 |
| 나의 여행/모집중/참여중/완료 | `handleJoinMyTripClick()`, `switchJoinMyTab(key)` | 마이 일정 탭 |
| 최근 본 항목 | `handleJoinMyRecentClick()` | 최근 상품/조인 탭 |
| 찜 | `handleJoinMyWishClick()` | 시트 찜 조회 후 탭 |
| 로그아웃 | `handleJoinMyLogout()` | 세션 정리 및 로그아웃 URL 이동 |
| 카카오 로그인 | `continueJoinMemberLogin('kakao')` | Kakao SDK 또는 redirect |
| 이메일 로그인 | `openJoinMemberEmailForm()`, `submitJoinMemberEmailLogin()` | ERP 로그인 후 프로필 확인 |
| 아이디 찾기 | `submitJoinMemberFindId()` | ERP 찾기 플로우 |
| 비밀번호 찾기/변경 | `submitJoinMemberFindPw()`, `submitJoinMemberResetPassword()` | ERP 찾기/변경 |
| 회원가입 | `openJoinMemberSignupIntro()`, `openJoinMemberSignupForm()` | 단계형 회원가입 |
| 회원가입 단계 이전/다음 | `goJoinMemberSignupStep(delta)` | 단계 검증 후 이동 |
| 회원가입 완료 | `submitJoinMemberSignup()` | ERP 회원가입 + 프로필 저장 |
| 필수 프로필 저장 | `submitJoinMemberProfileOnly()` | `join_member_profiles` 저장 |

프로필 데이터 흐름:
1. ERP/렌더 쿠키/세션에서 기본 회원 확인
2. `member_profile_lookup`으로 조인 프로필 조회
3. 누락 필드가 있으면 필수 프로필 모달 표시
4. 프로필 저장은 `source: "join_member_profile"`
5. 로컬 캐시와 세션 member 병합

개선 포인트:
- ERP 로그인, Kakao 로그인, 로컬 개발용 로그인, 필수 프로필 입력이 한 파일에서 얽혀 있다.
- 로그인 후 복귀 action(`afterLogin`)이 여러 함수에서 해석되어 일관성 검증이 어렵다.

### 2.9 외부 링크/상담/공통

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 카카오 상담 | `openExternalLink(kakaoUrl)` | 새 창/현재 창 외부 이동 |
| 전화 문의 | `handlePhoneContact()` | 전화 모달 또는 `tel:` |
| 밴드 가입 | `openExternalLink(bandUrl)` | 외부 이동 |
| 여행 스타일 테스트 | `openExternalLink(mbtiUrl)` | 외부 이동 |
| 전화걸기 | `location.href='tel:02-3446-1119'` | 전화 앱 |
| 로딩 오버레이 | `openJoinActionLoading()`, `closeJoinActionLoading()` | async 액션 중 전역 로딩 |
| 전체 모달 닫기 | `closeAllJoinModals()` | 열린 조인 모달 정리 |

## 3. 관리자 버튼 플로우

### 3.1 로그인/공통

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 로그인 submit | `loginAdmin(loginId, loginPassword)` | Cloud Function 관리자 세션 발급 후 `loadDashboard()` |
| 로그아웃 | `clearAdminAuth()`, `showLogin()` | 토큰 삭제, 로그인 화면 |
| 새로고침 | `loadDashboard()` | 관리자 bootstrap 재조회 |
| 검색 | `renderTable()` | 현재 메뉴 테이블 필터 |
| 상태 필터 | `renderMetrics()`, `renderTable()` | 일정 상태별 테이블 갱신 |

### 3.2 메뉴

| 버튼/영역 | 다음 흐름 |
|---|---|
| 일정 관리 | `state.currentMenu = "schedules"` 후 일정/상담 테이블 렌더 |
| 추천 일정 | `state.currentMenu = "recommended-schedules"` 후 상품/추천 규칙 렌더 |
| 고객 관리 | `state.currentMenu = "participant-management"` 후 회원 프로필 테이블 렌더 |

### 3.3 일정 관리

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 멤버보기/멤버닫기 | row `data-action="participants"` | 참여자 accordion 토글 |
| 상품보기 | `openProductDrawer(schedule)` | 상품 상세 drawer, 필요 시 Secret Tour 상세 proxy |
| 견적완료 | `saveQuoteComplete(button)` | `applicationStatus`/견적 상태 업데이트 |
| 참여자 상태 badge/action | `saveParticipantStatus(button)` | 입금/잔금/취소/환불/견적 상태 변경 |
| 일정 row 클릭 | expanded participant 토글 | 멤버보기와 동일 |

상태 저장 흐름:
1. 버튼에서 row/applicationId/status field 추출
2. 확인 다이얼로그
3. Cloud Function에 관리자 토큰 포함 요청
4. Apps Script가 해당 행 업데이트
5. 대시보드 재조회/렌더

### 3.4 추천 일정

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 상품업데이트 | `refreshRecommendationProductsFromHomepage()` | 홈 JSON/원격 상품 데이터 재조회 |
| 추천등록 | `confirmAndSaveRecommendationSchedule(button)` | 추천 일정 규칙 저장 |
| 상품보기 | `openRecommendationCandidateProduct(button)` | 상품 drawer |
| 숨김 | `hideRecommendationSchedule(button)` | 추천 규칙 `isVisible=false` 저장 |
| 달력 열기 | `recommendation-calendar-toggle` | 추천 표시 날짜 선택 UI |
| 달력 이전/다음 | `recommendation-calendar-prev/next` | 월 변경 |
| 날짜 선택 | `data-recommendation-date-key` | 추천 표시 시작일 반영 |
| 월례회 토글 | `data-recommendation-monthly` | 정원 기본 40명 보정 |

저장 흐름:
1. 상품 row에서 goodSeq/eventSeq/날짜/정원/월례회 여부 수집
2. `submitProductDisplayRule()`
3. `source: "recommended_schedule"` 또는 `product_display_rule`
4. `recommended_schedules` 시트 저장
5. 홈 `home_bootstrap_light`의 `displayRules`로 노출

### 3.5 고객 관리

| 버튼/영역 | 핸들러 | 다음 흐름 |
|---|---|---|
| 고객 여행 보기/닫기 | `data-action="customer-travels"` | 회원별 모집/참여/완료 이력 accordion |

고객 관리 데이터는 `join_member_profiles`, `new_schedule_applications`, `join_applications`를 조합해 구성한다.

## 4. API/저장소 매핑

### 4.1 공개 조회

| 클라이언트 호출 | 서버/시트 action | 목적 |
|---|---|---|
| `hydrateHomeBootstrapLightFromGoogleSheet()` | `home_bootstrap_light` | 홈 표시용 신규 일정, 참여자 요약, 추천 규칙 |
| `hydrateHomeBootstrapFromGoogleSheet()` | `home_bootstrap` | 더 무거운 전체 홈 bootstrap |
| `hydrateHomeStatsFromGoogleSheet()` | `home_stats` | 방문자/활성 사용자 수 |
| `fetchJoinMemberProfileFromGoogleSheet()` | `member_profile_lookup` | 로그인 회원 프로필 조회 |
| `hydrateJoinWishesFromGoogleSheet()` | `join_wishes_lookup` | 회원 찜 목록 조회 |
| `fetchGolfJoinSheetRows()` | sheet/action query | fallback sheet row 조회 |

### 4.2 쓰기

| source/action | 저장 시트 | 생성/수정 주체 |
|---|---|---|
| `new_schedule_builder` | `new_schedule_applications` | 사용자 새 모임 만들기 |
| `join_apply` | `join_applications` | 기존 조인 참여 신청 |
| `join_member_profile` | `join_member_profiles` | 회원 필수/관리 프로필 |
| `join_review` | `join_reviews` | 여행 후기 |
| `join_wish` | `join_wishes` | 찜 |
| `recommended_schedule` / `product_display_rule` | `recommended_schedules` | 관리자 추천 일정 |
| admin status update | `new_schedule_applications` / `join_applications` | 관리자 입금/잔금/견적/취소 상태 |

### 4.3 서버 부가 기능

| 기능 | 역할 |
|---|---|
| 홈 light cache | Cloud Function 메모리 캐시로 공개 홈 부트스트랩 응답을 빠르게 반환 |
| Secret Tour 상품 proxy | CORS/HTML 파싱 우회, 상품 상세/항공정보 조회 |
| 알림톡 | 새 모임/참여/견적 완료 알림 |
| 공유 OG | 카카오/메신저 공유용 HTML 생성 |
| 이미지 업로드 sign | 리뷰/프로필 이미지 GCS 업로드 서명 |

## 5. 현재 구조의 핵심 문제

1. 단일 HTML에 화면/상태/API/렌더/검증이 모두 있다.
   - 메인 파일이 2MB 이상이고 함수가 수백 개다.
   - 버튼 하나의 영향을 추적하려면 렌더 함수, 전역 상태, API 함수, 모달 함수를 동시에 봐야 한다.

2. 버튼 흐름이 inline `onclick` 중심이다.
   - HTML 마크업이 실행 로직을 직접 호출한다.
   - 동적 렌더 문자열 안에도 `onclick`이 많아 검색/타입검사/리팩토링이 어렵다.

3. 같은 도메인 로직이 scope만 다르게 반복된다.
   - 신청자 정보: global apply와 builder apply 중복.
   - 지역 선택: 메인 검색, builder 검색, 캘린더/빈 결과 추천 로직 중복.
   - 예약 옵션/동반자/직업/스타일 칩 로직 중복.

4. 상태 모델이 명시적이지 않다.
   - `currentDetailMode`, `builderState`, `joinMyMenuState`, `homeBootstrapLoading`, `externalGolfJoinProductsLoading` 등 전역 flag가 많다.
   - 어떤 CTA가 어떤 조건에서 어떤 플로우로 가는지 상태표가 코드에 없다.

5. 데이터 계층 경계가 흐리다.
   - 홈 렌더가 로컬 fallback, 외부 상품 JSON, Google Sheet, Secret Tour 상세를 동시에 다룬다.
   - 같은 상품 식별자가 `id`, `goodSeq`, `eventSeq`, `erpProductId`, `productGroupKey`로 혼재한다.

6. 관리자와 사용자 화면의 상태 명칭이 일부 다르다.
   - 사용자: schedule/application/participant summary 중심.
   - 관리자: row/applicationId/status field 중심.
   - 같은 상태를 다르게 해석할 위험이 있다.

7. 초기 성능 병목이 구조적으로 재발 가능하다.
   - 거대한 JSON/HTML을 나중으로 미루는 응급 처치는 했지만, 홈/상세/builder 데이터가 아직 같은 상품 데이터 덩어리에 묶여 있다.

## 6. 개선 방향 재검토

### 6.1 1순위: 플로우 레지스트리 도입

목표는 버튼을 먼저 바꾸는 것이 아니라 “어떤 버튼이 어떤 플로우를 실행하는지”를 코드에 명시하는 것이다.

권장 구조:
- `data-flow="open-detail"`
- `data-flow="open-builder"`
- `data-flow="submit-join-apply"`
- `data-flow="switch-mdpick-country"`
- `data-flow="admin-save-status"`

중앙 dispatcher:
- 클릭 이벤트를 한 곳에서 받음
- `data-flow`와 `data-*`를 읽음
- flow registry에서 handler 실행
- 로딩/에러/로그/분석 이벤트를 공통 처리

효과:
- inline `onclick` 제거 가능
- 버튼-핸들러 매핑을 자동 문서화 가능
- 사용자/관리자 주요 액션 로그 수집 가능

### 6.2 2순위: 도메인 상태 모델 분리

먼저 분리할 상태:
- `authState`: 로그인/회원/프로필/afterLogin
- `homeState`: 홈 섹션, bootstrap, external products
- `detailState`: 현재 상세 상품, mode, CTA state
- `applyState`: 신청자, 동반자, 예약 옵션, 동의
- `builderState`: 날짜, 지역, 상품, 참여자
- `myState`: 최근/찜/일정 탭
- `adminState`: 메뉴, 필터, expanded row

각 상태마다 가능한 이벤트를 명시한다:
- `OPEN_DETAIL`
- `REQUEST_LOGIN`
- `PROFILE_REQUIRED`
- `APPLY_VALIDATE`
- `APPLY_SUBMIT`
- `BUILDER_NEXT_STEP`
- `ADMIN_STATUS_UPDATE`

### 6.3 3순위: 데이터 식별자 표준화

표준 키 제안:
- 상품 원본: `{ goodSeq, eventSeq }`
- 상품 그룹: `good:${goodSeq}`
- 조인 일정: `scheduleId`
- 참여 신청: `applicationId`
- 추천 일정: `displayRuleId` 또는 `recommendedScheduleId`
- 회원: `memberSeq || memberId || normalizedMobile`
- 찜 대상: `{ targetType, targetKey }`

모든 저장/조회/URL/최근/찜/공유에서 이 키를 일관되게 사용해야 한다.

### 6.4 4순위: 홈 데이터 분리

현재 상품 데이터는 홈 첫 화면에는 너무 크다.

권장 분리:
- `home_summary.json`: 홈 카드에 필요한 50~100개 요약만 포함
- `product_index.json`: 검색/지역/날짜 필터용 경량 인덱스
- `product_detail/{goodSeq}-{eventSeq}.json`: 상세/신청 진입 시 로드
- `builder_availability.json`: builder 날짜/지역 선택에 필요한 최소 데이터

효과:
- 첫 진입 네트워크/파싱 비용 감소
- 상세 진입 전까지 무거운 일정/포함/이미지 데이터 로드 안 함
- 캐시 무효화 단위가 작아짐

### 6.5 5순위: 신청/동반자/예약 옵션 컴포넌트화

`global apply`와 `builder apply`는 같은 UI/검증이 많다.

공통화 후보:
- 전화번호 포맷/검증
- 직업 선택
- 동반자 성별/인원
- 예약 방식
- 객실 타입
- 싱글룸 추가금
- 인사말 템플릿
- 약관 동의
- payload builder

### 6.6 6순위: 관리자 상태 변경을 명령형으로 정리

현재 관리자 버튼은 `data-action` 기반이라 메인보다 낫지만, 상태 업데이트 field/value가 UI에 흩어져 있다.

권장:
- `AdminCommand.UPDATE_PARTICIPANT_STATUS`
- `AdminCommand.COMPLETE_QUOTE`
- `AdminCommand.HIDE_RECOMMENDATION`
- `AdminCommand.REGISTER_RECOMMENDATION`

각 command마다:
- 입력값
- 확인 메시지
- 서버 payload
- 성공 후 갱신 범위
- 실패 메시지

## 7. 권장 작업 순서

1. 이 문서를 기준으로 주요 플로우 이름을 확정한다.
2. 신규 코드에는 inline `onclick`을 금지하고 `data-flow`를 사용한다.
3. 기존 버튼 중 위험도가 낮은 외부 링크/섹션 스크롤/모달 닫기부터 dispatcher로 이전한다.
4. 신청/새 모임/상세 CTA 같은 고위험 플로우는 테스트 가능한 순수 함수부터 분리한다.
5. 홈 데이터는 summary/detail/index로 쪼개고, Cloud Function이 summary를 생성하도록 바꾼다.
6. 관리자 status command를 표준화하고 사용자 홈 summary와 같은 상태 해석을 쓰게 한다.

## 8. 바로 적용 가능한 개선 후보

단기:
- 홈 첫 화면용 `home_summary.json` 생성.
- `renderJoins()`를 `computeHomeSections()`와 `paintHomeSections()`로 분리.
- `openDetail()`의 데이터 조회와 모달 렌더 분리.
- `submitGlobalApply()`와 builder submit의 payload builder 공통화.
- `data-action`/`data-flow` 클릭 dispatcher를 메인에도 도입.

중기:
- 회원/프로필/afterLogin 플로우를 auth module로 분리.
- 지역 검색을 공통 region module로 분리.
- 상품 식별자 normalization 함수를 서버/클라이언트에서 공유 가능한 형태로 정리.
- 관리자 추천 일정 저장과 홈 노출 규칙을 같은 schema로 정리.

장기:
- 단일 HTML을 build 가능한 앱 구조로 전환.
- 홈/상세/builder/admin을 route 단위로 lazy load.
- API 응답 schema를 TypeScript 또는 JSON Schema로 고정.
- 주요 사용자 플로우에 Playwright E2E 테스트 추가.
