# 골프조인 GA4 이용자 분석·대시보드 로드맵

- 최종 수정일: 2026-09-02
- GA4 속성: 골프조인 전용 속성
- 측정 ID: `G-LLY6DLP23E`
- 속성 ID: `552152254`
- 대상 페이지: `https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`
- 문서 역할: GA4 추적·검증·Data API·대시보드 구축의 단일 작업 기준

## 1. 최종 목표

골프조인 메인페이지의 주요 이용자 퍼널과 이용 흐름을 자세히 추적하고 분석한다. 수집한 데이터를 대시보드의 새 메뉴 `이용자 분석`에서 시각적으로 제공하여 다음 의사결정을 지원한다.

- 어느 섹션과 상품이 상세 열람을 만드는지 파악
- 상세 열람 후 참여 신청 시작·완료까지의 이탈 구간 파악
- 신규 모임 만들기의 시작·완료 및 단계별 이탈 파악
- 비로그인·일반회원·카카오회원의 전환 차이 파악
- 모바일·PC별 문제 구간 파악
- 검색·배너·찜·로그인 복귀가 전환에 미치는 영향 파악
- 개선 우선순위와 마케팅 집행 대상을 근거 데이터로 선정

## 2. 상태 표시 규칙

- `[x]`: 완료했고 설정 또는 코드 근거가 확인됨
- `[ ] 🔄`: 작업 중이거나 개발은 끝났지만 배포·운영 검증이 남음
- `[ ]`: 아직 시작하지 않음
- 이 문서를 기준으로 작업할 때마다 체크 상태와 변경 이력을 갱신한다.

## 3. 전체 진행 현황

| 영역 | 상태 | 현재 판정 |
|---|---|---|
| GA4 전용 속성·웹 스트림 | 완료 | 운영 수집 확인 |
| 맞춤 측정기준·측정항목 | 완료 | 중복 `login_method` 보관 처리 완료 |
| 맞춤 이벤트 | 완료 | 신청 완료와 새 모임 완료 분리 |
| 주요 이벤트 | 핵심 완료 | 불필요한 기본 항목 정리 여부 확인 필요 |
| 참여 신청 퍼널 | 완료 | 실제 수치 표시 확인 |
| 새 모임 생성 퍼널 | 완료 | 설정 완료, 표본 축적 필요 |
| 프런트 추적 코드 | v57c 배포 대기 | 기존 운영 추적 유지, 참여 신청 성공 뒤 `apply_step=complete` 명시 전송 보강 완료 |
| 운영 데이터 검증 | 일부 완료 | 실제 참여 신청 완료와 신규 이벤트 검증 필요 |
| GA4 Data API | v57a 배포 대기 | 운영 v54 응답 정상, 역전 진단·비교 가능·실행 가능 품질 플래그와 생성 CTA 제외를 로컬 검증 |
| 대시보드 `이용자 분석` | v57b 배포 대기 | 100% 초과율·비교 0건 오해 방지와 상품 섹션 필터를 PC·390px에서 검증 |

## 4. 현재 GA4 기본 설정

### 4.1 완료된 기본 설정

- [x] 골프조인 전용 GA4 속성 생성
- [x] 웹 데이터 스트림 `골프조인 웹` 생성
- [x] 측정 ID `G-LLY6DLP23E` 설치
- [x] 속성 ID `552152254` 확인
- [x] 메인페이지에서 Google 태그 요청 `200` 확인
- [x] GA 수집 요청 `204` 확인
- [x] 전용 속성으로 `page_view` 전송 확인
- [x] `send_page_view: false`로 코드가 관리하는 페이지뷰 1회 전송 구조 적용
- [x] 회원 상태 확정 후 페이지뷰 전송 및 30초 안전 폴백 적용
- [x] 개인정보 비전송 허용 목록 방식 적용

### 4.2 추가로 확인할 속성 운영 설정

- [ ] 데이터 보존 기간을 `14개월`로 설정했는지 확인
- [ ] 운영자·개발자 트래픽 제외 규칙 설계
- [ ] 내부 트래픽 필터는 테스트 상태로 먼저 적용 후 활성화
- [ ] 불필요한 추천 주요 이벤트 정리
- [ ] 웹 스트림 향상된 측정과 수동 `page_view`가 중복되지 않는지 월 1회 점검
- [ ] 개인정보 보호정책과 GA4 수집 고지 검토
- [ ] 필요 시 BigQuery 일일 내보내기 사용 여부 결정

## 5. 맞춤 정의 현황

### 5.1 맞춤 측정기준

다음 항목은 GA4 `맞춤 정의` 화면 또는 이번 작업에서 생성된 것이 확인됐다.

| 표시 이름 | 이벤트 매개변수 | 현재 범위 | 상태 | 용도 |
|---|---|---:|---|---|
| 검색 결과 수 구간 | `result_count_bucket` | 이벤트 | 완료 | 결과 없음·1~5·6~20 등 검색 품질 분석 |
| 노출 섹션 | `section_name` | 이벤트 | 완료 | 메인 섹션별 노출·선택 분석 |
| 로그인 후 복귀 기능 | `return_action` | 이벤트 | 완료 | 로그인 요구 후 원래 행동 구분 |
| 배너 식별값 | `promotion_id` | 이벤트 | 완료 | 히어로 배너별 클릭 분석 |
| 상품 일정 유형 | `item_type` | 이벤트 | 보완 필요 | 최신 코드에서는 `items` 내부로 이동함 |
| 상품 일정 유형 항목 | `item_type` | 항목 | 완료 | 상품·조인 일정 유형을 상품 단위로 분석 |
| 신청 유형 | `flow_type` | 이벤트 | 완료 | `join_apply`와 `new_schedule` 구분 |
| 오류 유형 | `error_type` | 이벤트 | 완료 | 로그인·신청·생성 실패 원인 분석 |
| 행동 발생 영역 | `source_area` | 이벤트 | 완료 | home·detail·builder·섹션 등 유입 영역 분석 |
| 회원 상태 | `member_state` | 이벤트 | 완료 | guest·homepage·kakao 비교 |
| 회원가입 단계 | `signup_step` | 이벤트 | 완료 | 추가정보·회원가입 단계 이탈 분석 |
| 로그인 완료·시도 방법 | `method` | 이벤트 | 완료 | email·kakao 로그인 시작·성공·실패 비교 |
| 로그인 시도 방법(중복) | `login_method` | 이벤트 | 보관 완료 | 코드 정규화 후 전송되지 않는 중복 정의 |
| 필터 유형 | `filter_type` | 이벤트 | 완료 | 지역·상품 유형 등 필터 구분 |
| 필터 값 | `filter_value` | 이벤트 | 완료 | 선택한 필터 값 분석 |
| 참여 신청 단계 | `apply_step` | 이벤트 | 완료 | 폼·확인·제출·완료 이탈 분석 |
| 새 모임 생성 단계 | `builder_step` | 이벤트 | 완료 | 날짜·지역·참여자·제출·완료 이탈 분석 |

### 5.2 맞춤 측정항목

| 표시 이름 | 이벤트 매개변수 | 단위 | 상태 | 용도 |
|---|---|---|---|---|
| 참여 인원 | `participant_count` | 일반 | 완료 | 신청·새 모임 생성 인원 합계 및 평균 |

### 5.3 반드시 추가하거나 수정할 맞춤 정의

- [x] `item_type`을 **항목 범위** 맞춤 측정기준으로 추가
  - 권장 표시 이름: `상품 일정 유형(항목)`
  - 항목 매개변수: `item_type`
  - 이유: `view_item`, `begin_checkout`, `generate_lead`의 상품 정보가 GA4 표준 `items` 배열로 전송됨
- [x] 로그인·가입 방법 맞춤 측정기준 추가
  - 표시 이름: `로그인 완료 가입 방법`
  - 이벤트 매개변수: `method`
- [x] 로그인 시도 방법 맞춤 측정기준 정리
  - 표시 이름: `로그인 시도 방법`
  - 이벤트 매개변수: `login_method`
  - 현재: GA4에는 등록됐지만 전송 직전 `method`로 통합되고 `login_method`는 제거됨
  - 조치 완료: 데이터 손실 없이 중복 정의만 보관 처리하고 `method` 하나로 분석
- [x] 필터 유형 맞춤 측정기준 추가
  - 표시 이름: `필터 유형`
  - 이벤트 매개변수: `filter_type`
- [x] 필터 값 맞춤 측정기준 추가
  - 표시 이름: `필터 값`
  - 이벤트 매개변수: `filter_value`
- [x] 새 모임 단계 `builder_step` 맞춤 측정기준 생성
  - 표시 이름 `새 모임 생성 단계`, 이벤트 범위 등록 완료
- [x] 참여 신청 단계 `apply_step` 맞춤 측정기준 생성
  - 표시 이름 `참여 신청 단계`, 이벤트 범위 등록 완료

> 기존 이벤트 범위 `item_type`은 바로 삭제하지 않는다. 항목 범위 데이터가 정상 수집되는 것을 확인한 뒤 정리한다.

## 6. 맞춤 이벤트 현황

### 6.1 생성 완료

#### `join_apply_complete`

```text
event_name = generate_lead
flow_type = join_apply
```

- [x] 맞춤 이벤트 생성
- [x] 소스 이벤트 매개변수 복사
- [x] 주요 이벤트로 표시
- [x] 기본 금액 설정 안 함
- [x] 계산 방법 `이벤트당 한 번`

#### `new_schedule_complete`

```text
event_name = generate_lead
flow_type = new_schedule
```

- [x] 맞춤 이벤트 생성
- [x] 소스 이벤트 매개변수 복사
- [x] 주요 이벤트로 표시하지 않음

### 6.2 주요 이벤트 현재 판정

- [x] `join_apply_complete`: 주요 이벤트
- [x] `generate_lead`: 주요 이벤트로 사용하지 않음
- [x] `new_schedule_complete`: 주요 이벤트로 사용하지 않음
- [x] `close_convert_lead`: 주요 이벤트 별표 해제
- [x] `qualify_lead`: 주요 이벤트 별표 해제
- [ ] `purchase`: GA4 웹 속성 기본 주요 이벤트이며 실제 결제 추적 사용 여부 추후 결정

> 참여 신청과 새 모임 생성이 모두 원본 `generate_lead`를 사용하므로 원본 이벤트를 주요 이벤트로 표시하면 안 된다.

## 7. 프런트 추적 구현 현황

### 7.1 공통·메인 탐색

| 실제 코드 이벤트 | GA4 이벤트 | 주요 매개변수 | 상태 |
|---|---|---|---|
| `page_view` | `page_view` | `source_area`, `member_state`, 페이지 정보 | 운영 확인 |
| `golfjoin_section_view` | 동일 | `section_name`, `source_area=home` | 운영 확인 |
| `golfjoin_section_select` | 동일 | `section_name` | 코드·수집 확인 |
| `select_promotion` | `select_promotion` | `promotion_id`, `promotion_name`, `source_area=hero` | 코드 확인 |
| `view_promotion` | `view_promotion` | `promotion_id`, `promotion_name`, `source_area=hero` | v43c 운영 Network 확인 |
| `view_item_list` | `view_item_list` | `items`, `item_list_id`, `item_list_name`, `source_area` | v43c 운영 Network 확인 |
| `select_item` | `select_item` | `items`, `item_list_id`, `item_list_name`, `source_area` | v43d 운영 Network 확인 (`home_soon`) |
| `golfjoin_filter_select` | 동일 | `filter_type`, `filter_value` | 코드 확인 |
| `golfjoin_section_detail_view` | 동일 | `section_name`, `source_area=섹션키` | 운영 확인 |

### 7.2 상품 상세·찜

| 실제 코드 이벤트 | GA4 이벤트 | 주요 매개변수 | 상태 |
|---|---|---|---|
| `golfjoin_detail_view` | `view_item` | `items`, `item_type`, `source_area`, `member_state` | 운영 확인 |
| `golfjoin_wish_add` | `add_to_wishlist` | `items`, `source_area` | 코드 확인 |
| `golfjoin_wish_remove` | 동일 | `source_area=detail/wish_list` | 코드 확인 |
| `golfjoin_wish_list_view` | 동일 | `source_area=my_menu` | 코드 확인 |
| `golfjoin_reservation_view` | 동일 | `source_area=my_menu` | 코드 확인 |

### 7.3 참여 신청

| 실제 코드 이벤트 | GA4 이벤트 | 주요 매개변수 | 상태 |
|---|---|---|---|
| `golfjoin_apply_start` | `begin_checkout` | `items`, `flow_type=join_apply`, `source_area=detail` | 운영 확인 |
| `golfjoin_apply_step_view` | 동일 | `apply_step`, `flow_type=join_apply`, `source_area=detail` | v47a 운영 반영, `form_view`·`review` Network 확인 |
| `golfjoin_apply_complete` | `generate_lead` | `items`, `flow_type=join_apply`, `participant_count` | 코드 시뮬레이션 완료, 실제 완료 검증 필요 |
| `golfjoin_apply_error` | 동일 | `flow_type`, `error_type`, `source_area` | 코드 확인 |

### 7.4 새 모임 만들기

| 실제 코드 이벤트 | GA4 이벤트 | 주요 매개변수 | 상태 |
|---|---|---|---|
| `golfjoin_create_start` | 동일 | `flow_type=new_schedule`, `source_area` | 이벤트 발생 확인, 표본 축적 필요 |
| `golfjoin_create_step_view` | 동일 | `builder_step`, `flow_type=new_schedule`, `source_area` | v47a 운영 반영, 날짜·여행지·참여자·확인 Network 확인 |
| `golfjoin_create_complete` | `generate_lead` | `items`, `flow_type=new_schedule`, `participant_count` | 운영 확인 |
| `golfjoin_create_error` | 동일 | `flow_type`, `error_type`, `source_area=builder` | 코드 확인 |

### 7.5 여행지 검색

| 실제 코드 이벤트 | GA4 이벤트 | 주요 매개변수 | 상태 |
|---|---|---|---|
| `golfjoin_destination_search_open` | 동일 | `source_area` | v50b 운영 Network 확인 완료 (`source_area=main`) |
| `golfjoin_destination_search_submit` | 동일 | `source_area`, `result_count_bucket` | v50b 운영 Network 확인 완료 (`main`, 결과 0 포함) |
| 검색 결과 카드 선택 | `select_item` | `items`, `item_list_id=destination_search_*`, `source_area` | v43d 운영 Network 확인 (`destination_search_main`) |
| 검색 결과 상세 열람 | `view_item` | `items`, `source_area=destination_search` | v50a 운영 Network 확인 완료 |

### 7.6 로그인·회원가입

| 실제 코드 이벤트 | GA4 이벤트 | 주요 매개변수 | 상태 |
|---|---|---|---|
| `golfjoin_login_required` | 동일 | `return_action` | v50a 운영 Network 확인, v50b 로그아웃 회원상태 보정 |
| `golfjoin_login_start` | 동일 | `method` | 코드 확인 |
| `login` | `login` | `method`, `member_state` | 코드 확인 |
| `golfjoin_login_fail` | 동일 | `method`, `error_type` | 코드 확인 |
| `golfjoin_login_return_complete` | 동일 | `return_action`, `source_area=login` | v50a 운영 Network 확인 완료 (`return_action=builder`) |
| `sign_up` | `sign_up` | `method`, `member_state` | 코드 확인 |
| `golfjoin_signup_step_view` | 동일 | `signup_step` | 코드 확인 |
| `golfjoin_signup_validation_error` | 동일 | `signup_step`, `error_type` | 코드 확인 |

### 7.7 개인정보 안전장치

- [x] 허용된 이벤트 매개변수만 전송
- [x] 회원번호·이름·휴대폰·이메일·생년월일·인증 토큰 전송 차단
- [x] 오류 문자열 정규화
- [x] `participant_count`는 1~20으로 제한
- [x] 분석 실패가 예약·신청 동작을 중단하지 않도록 예외 격리

## 8. GA4 탐색 보고서 현황

### 8.1 참여 신청 퍼널

- [x] 탭 이름: `참여 신청`
- [x] 폐쇄형 퍼널
- [x] 모든 연결 `이후 단계`
- [x] 시간 제한 없음
- [x] 기기 카테고리 분해

```text
1. 메인 방문
   page_view
   source_area = golfjoin_home

2. 상품 상세 열람
   view_item

3. 참여 신청 시작
   begin_checkout
   flow_type = join_apply

4. 참여 신청 완료
   join_apply_complete
```

초기 확인 수치:

```text
메인 방문 19명
상품 상세 열람 6명  (이전 단계 대비 31.6%)
참여 신청 시작 1명 (이전 단계 대비 16.7%)
참여 신청 완료 0명
```

> 표본이 매우 적고 완료 이벤트 생성 시점 이전 데이터는 소급되지 않으므로 이 수치로 운영 결론을 내리지 않는다.

### 8.2 새 모임 생성 퍼널

- [x] 탭 이름: `새 모임 생성`
- [x] 폐쇄형 퍼널
- [x] 모든 연결 `이후 단계`
- [x] 시간 제한 없음
- [x] 기기 카테고리 분해

```text
1. 메인 방문
   page_view
   source_area = golfjoin_home

2. 새 모임 만들기 시작
   event_name = golfjoin_create_start

3. 새 모임 생성 완료
   generate_lead
   flow_type = new_schedule
```

## 9. 현재 확인된 추적 공백

### 우선순위 P0: 대시보드 전에 반드시 완료

- [x] 섹션별 상품 상세 열람 귀속
  - 문제: 기존 `view_item`은 대부분 `source_area=home`이라 어느 섹션 카드에서 상세를 열었는지 구분하지 못함
  - 현재: `golfjoin_section_detail_view` 개발·단위 테스트·v43b 운영 반영 완료
  - [x] GCS JavaScript 업로드
  - [x] ERP 29번 HTML 교체
  - [x] Network 검증: `view_item`과 `golfjoin_section_detail_view` 배치 전송 확인
  - [x] `section_name=mdpick`, `source_area=mdpick`, `member_state=kakao` 확인
  - [x] GA4 실시간 보고서에서 이벤트 5건 수신 확인
- [x] `item_type` 항목 범위 맞춤 측정기준 추가
- [ ] 🔄 실제 참여 신청 1회로 `join_apply_complete` 운영 검증
  - 반복 테스트 신청은 하지 않고 자연스러운 실제 신청 발생 시 확인
  - 코드 시뮬레이션과 단위 테스트는 완료
- [x] `close_convert_lead`, `qualify_lead` 주요 이벤트 별표 해제

### 우선순위 P1: 정확한 개선 분석에 필요

- [x] 상품 목록 노출 `view_item_list` 추가
  - 운영 Network에서 `item_list_id=home_my`, 목록명·상품·회원상태 전송 확인
- [x] 상품카드 선택 `select_item` 추가
  - v43c 운영에서 카드 클릭 시 `view_item`만 전송되고 `select_item`·섹션 상세 이벤트가 누락됨
  - 원인: 카드 감지를 캡처 단계에서 버블 단계로 변경하면서 중간 클릭 경로의 전파 종료 영향을 받음
  - v43d: 캡처 단계 감지 복구, 실제 상세 모달이 열린 경우만 기록하고 스와이프·미오픈 클릭은 제외
  - GCS 업로드·ERP HTML 교체 완료
  - 운영 Network에서 `view_item` 다음 `select_item`과 `golfjoin_section_detail_view` 전송 확인
  - `item_list_id=home_soon`, `item_list_name=곧 출발해요!`, `section_name=soon`, `source_area=soon`, `item_type=join_schedule` 귀속 일치
- [x] 섹션 키를 `item_list_id` 또는 `item_list_name`에 기록
  - 메인 섹션은 `home_<section>`, 검색은 `destination_search_<context>` 사용
- [x] 히어로 배너 슬라이드별 `view_promotion` 추가
  - 운영 Network에서 `promotion_id=hero_secret_tour_2`, 배너명·`source_area=hero` 확인
- [x] 여행지 검색 결과 카드 선택 이벤트 추가
  - 검색 결과의 실제 상품 선택을 `select_item`으로 기록
  - 운영 Network에서 `item_list_id=destination_search_main`, `item_list_name=여행지 검색 결과`, `source_area=destination_search`, `item_type=join_schedule` 확인
- [x] 새 모임 만들기 단계 이벤트 추가
  - v47a 운영 배포 및 비저장 단계 Network 검증 완료
  - `date_selection` → `destination_selection` → `participant_info` → `review` → `submit_start` → `complete`
  - 같은 모달 안에서 동일 단계 재방문은 한 번만 집계하고 새 모달에서는 다시 집계
- [x] 참여 신청 내부 단계 이벤트 추가
  - 한 화면형 실제 UI에 맞춰 v47a 운영 배포 및 비저장 단계 Network 검증 완료
  - `form_view` → `review` → `submit_start` → `complete`
  - 폼 값·이름·연락처·생년월일은 전송하지 않음
- [x] 로그인 완료 후 원래 행동 복귀 완료 이벤트 추가
  - v50a에서 동일 페이지·리디렉션·프로필 보완 후 복귀 경로를 `golfjoin_login_return_complete`로 연결
  - 원래 행동 함수가 `false`를 반환한 실패 복귀는 완료 이벤트에서 제외
  - `return_action` 맞춤 측정기준은 기존 등록값을 그대로 사용하며 신규 맞춤 정의는 없음
  - 운영에서 `login_required → afterLogin=builder → create_start/date_selection → login_return_complete` 순서와 로그인 후 `member_state=kakao` 확인
- [ ] 찜 후 재방문·상세 열람·신청 전환 분석 정의

### 우선순위 P2: 운영 고도화

- [ ] UTM 캠페인 명명 규칙 작성
- [ ] 배너별 캠페인 링크 규칙 적용
- [ ] 주간·월간 비교 기준 확정
- [ ] 이상치 기준과 알림 정책 확정
- [x] 최소 표본 기준 설정
  - 운영 판단용 기준: 선택 기간 7일 이상, 전환율 분모 30명부터 방향성 확인, 100명부터 안정 표본
  - 통계적 유의성 보장이 아닌 과소 표본 과잉 해석 방지 기준으로 사용

## 10. 대시보드에서 제공할 핵심 지표

### 10.1 상단 KPI

| 지표 | 정의 |
|---|---|
| 방문자 | 골프조인 `page_view`의 활성 사용자 |
| 상세 열람률 | 메인 방문 사용자 중 순서상 `view_item`에 도달한 비율 |
| 신청 시작률 | 상세 열람 사용자 중 `begin_checkout + flow_type=join_apply` 도달 비율 |
| 신청 완료율 | 신청 시작 사용자 중 `join_apply_complete` 도달 비율 |

### 10.2 필수 퍼널

- 메인 방문 → 상세 열람 → 참여 신청 시작 → 참여 신청 완료
- 메인 방문 → 새 모임 만들기 시작 → 새 모임 생성 완료
- 로그인 필요 → 로그인 시작 → 로그인 완료 → 원래 행동 복귀
- 검색 열기 → 검색 실행 → 결과 있음 → 결과 선택 → 상세 열람

### 10.3 섹션 성과

- 섹션 노출 사용자
- 섹션 내 상세 열람 사용자
- 섹션 노출 대비 상세 열람률
- 상세 열람 대비 신청 시작률
- 신청 시작 대비 완료율
- 모바일·PC 차이
- 비회원·일반회원·카카오회원 차이

### 10.4 개선 우선순위 카드

대시보드에서 임의의 AI 문구를 만들지 않고 다음 구조로 표시한다.

```text
발견한 문제
→ 수치 근거
→ 비교 기준
→ 운영자가 확인할 행동
```

예:

```text
모바일 신청 완료율 저하
→ PC 대비 -3.7%p
→ 최근 7일 vs 이전 7일
→ 모바일 신청 단계별 오류·이탈 확인
```

## 11. 대시보드 데이터 연동 구조

브라우저에서 GA4를 직접 호출하거나 인증정보를 노출하지 않는다.

```text
GA4 속성 552152254
→ Google Analytics Data API
→ golfjoin-sheet-api의 관리자 전용 분석 action
→ 10~30분 서버 캐시
→ 관리자 대시보드 이용자 분석 메뉴
```

### 11.1 Data API 작업

- [x] Google Analytics Data API 활성화
- [x] Cloud Function 실행 서비스 계정 확인
  - `583406426382-compute@developer.gserviceaccount.com`
- [x] GA4 속성에 해당 서비스 계정 `뷰어` 권한 부여
- [x] 최소 권한 서버 인증 구현
  - v44a 운영 확인: 런타임 서비스 계정 메타데이터 토큰과 기존 관리자 세션 토큰 재사용
- [x] 관리자 전용 API action 1차 설계
  - v44a 운영 확인: `admin_ga4_overview`, 최근 1~90일·직접 기간, 방문→상세→신청·새 모임 요약
- [x] 날짜·비교기간·기기·회원상태·유입경로 필터 지원
  - v44a: 최근 1~90일과 직접 선택 기간 지원
  - v44b: 기기·회원상태·유입경로별 집계 응답 구현
  - v44c 로컬 후보: 현재 기간과 겹치지 않는 동일 길이의 이전 기간, 최대 90일 직접 기간, 기기·회원상태·유입경로 AND 필터를 동일 응답에 적용
  - v44c 호환성: 기존 `golfjoin-ga4-admin-dashboard-v1`을 유지하고 `filters`, `comparison`만 선택 필드로 추가
  - 운영 확인: HTTP 200, 모바일 필터, 현재 `6daysAgo~today`, 비교 `13daysAgo~7daysAgo`, 캐시 hit, 경고 없음
- [x] 10~30분 캐시 및 실패 시 마지막 정상 데이터 반환
  - v44a 운영 확인: 15분 캐시 `hit`, 24시간 이내 마지막 정상 데이터 대체 계약 테스트 통과
- [ ] GA API 할당량·오류 로깅
- [x] 개인정보나 사용자 단위 식별값을 반환하지 않도록 검증
  - 이벤트명·활성 사용자 수·이벤트 수의 허용 목록만 반환하는 단위 테스트 통과

### 11.2 권장 관리자 API 응답 묶음

- [x] `summary`: 방문자·상세 열람률·신청 시작률·신청 완료율
- `applyFunnel`: 참여 신청 퍼널
- `createFunnel`: 새 모임 생성 퍼널
- [x] `sections`: 섹션별 노출·상품 선택·상세 열람 성과
- [x] `devices`: 모바일·PC별 방문→상세→신청 집계
- [x] `members`: guest·homepage·kakao별 방문→상세→신청 집계
- [x] `trend`: 일별 방문→상세→신청 집계
- [x] `acquisition`: source·medium·campaign
- [x] `internalFunnels`: 참여 신청·새 모임 단계별 진입 사용자·다음 단계 이탈·이전 기간 비교
  - v49a는 `apply_step`, `builder_step` 맞춤 측정기준을 각각 별도 보고서로 집계
  - GA4 배치 최대 5개 제한을 지키도록 7개 보고서를 `5+2`로 분할
- [x] `journeyFunnels`: 검색 5단계·로그인 복귀 4단계 활성 사용자 흐름
  - v51a 운영 반영 완료, 기존 7개와 신규 3개를 합친 10개 보고서를 `5+5` 두 배치로 집계
  - 검색 후속 행동은 `source_area=destination_search`, 검색 열기·실행은 `source_area=main`으로 한정
- [x] `loginReturnActions`: `return_action`별 로그인 요구·복귀 완료 사용자와 완료율
  - 운영 응답 배열 4개 확인, 현재 기간·이전 동일 기간을 함께 반환하며 개인정보·회원 식별자는 요청하지 않음
- [x] ✅ `completionValidation`: 참여 신청·새 모임의 제출 시작·단계 완료·비즈니스 완료 이벤트 교차 검증
  - v53a 로컬 후보는 기존 10개 보고서만 재사용하여 Data API 호출·할당량을 늘리지 않음
  - 운영 API `200 / ok=true / warnings 없음` 확인, 초기 7일 응답은 `overallStatus=needs_review`이므로 흐름별 누락 신호 확인 중
  - `verified`, `collecting`, `needs_review`, `waiting`으로 실제 자연 발생 여부와 신호 누락을 구분
- [x] ✅ `analysisReadiness`: 기간·활성 데이터 일수와 네 전환율의 분자·분모·표본 상태
  - 기존 10개 보고서를 재사용해 Data API 호출·할당량 증가 없음
  - 7일·30명·100명 기준과 `waiting`, `collecting`, `directional`, `stable` 상태 반환
- `errors`: 익명화된 오류 유형
- `insights`: 서버가 계산한 규칙 기반 개선 후보

## 12. 관리자 대시보드 `이용자 분석` 작업

### 12.1 UI

- [x] 사이드바에 `이용자 분석` 메뉴 추가
- [x] 현재 대시보드의 흰 패널·쿨그레이 배경·파랑 강조색 유지
- [x] 기간 선택: 최근 7일·30일·90일·직접 선택
  - v46a 로컬 후보: 직접 시작일·종료일과 최대 90일 검증 완료
  - v46a Firebase Hosting 배포 및 운영 확인 완료
- [x] 비교기간 선택
  - v46a 로컬 후보: 이전 동일 기간 체크박스와 KPI 증감률·퍼센트포인트 표시 완료
  - 운영 실제 비교 응답 및 체크 해제 동작 확인 완료
- [x] 기기·회원상태·유입경로 필터
  - v46a 운영 화면에서 필터와 활성 필터 칩 갱신 확인 완료
- [ ] 여행지·상품유형 필터
  - 실제 운영 분석 필요성을 데이터 축적 후 결정
- [x] KPI 카드 4개
- [x] 참여 신청 퍼널
- [x] 개선 기회 TOP 3
- [x] 섹션별 성과 표
- [x] 기기별 비교
- [x] 최근 7일 추이
- [x] 상세 드로어
  - v49b에서 참여 신청·새 모임 퍼널별 `단계 상세` 버튼과 단계별 진입·이탈·이전 기간·증감 표 구현
  - 분석 상세만 860px 서랍을 사용해 핵심 열을 한 화면에 표시
- [x] 데이터 부족·연동 실패·마지막 갱신 상태
- [ ] 🔄 이용자 흐름과 다음 행동 카드
  - v54a 운영 API 확인: HTTP 정상 응답, `ok=true`, 속성 `552152254`, `quality.partial=false`, `analysisReadiness.metrics` 4개 확인
  - 최근 7일 중 실제 데이터 수집일은 3일이라 전체 상태 `collecting`; 상세 열람·신청 시작은 `stable`, 신청 완료·새 모임 완료는 `collecting`
  - v54b 로컬 후보: 방문→상세→신청 시작→신청 완료와 새 모임 시작→완료를 쉬운 문장으로 설명
  - 내부 표본 판정은 유지하되 화면에는 `비교 분석 가능`·`경향 참고 가능`·`데이터 더 필요`·`아직 데이터 없음`으로 표시
  - 참고 가능한 흐름 중 이동 비율이 가장 낮은 구간을 우선 개선 후보로 안내
  - 충분히 수집된 홈 섹션 반응과 가장 큰 유입경로를 운영·마케팅 힌트로 표시하고, 광고 확대 전 신청 완료 확인 필요성을 명시
  - 중복 활성 필터 영역과 분석 준비 하단 주석을 제거하고, 다음 점검 내용을 전용 설명 영역으로 분리
  - 분석 준비·완료 검증 카드의 제목·상태·수치·설명 타이포를 초보자 가독성 기준으로 조정
  - 데스크톱 4열·태블릿 2열·모바일 1열, 7일→30일 재조회와 가로 넘침 없음 확인
  - 이용자 분석 최초 진입을 다른 관리자 메뉴와 같은 공용 스피너 로딩으로 통일
  - 네 흐름 카드의 비율 설명·구분선·다음 점검·상세 문구 높이를 가장 긴 내용을 기준으로 동기화
  - 서버·관리자 회귀 `59/59`, 배포 계약 `16/16`, 브라우저 후보 관련 콘솔 오류 0건 확인
  - 배포 패키지: `deploy/stage54-ga4-dashboard/ga4-analysis-readiness-api-20260901-v54a`, `deploy/stage54-ga4-dashboard/ga4-analysis-readiness-admin-20260901-v54b`

### 12.2 UI 판정 원칙

- 숫자를 임의로 채우지 않는다.
- 표본이 부족하면 `판단하기 위한 데이터가 부족합니다`를 표시한다.
- 기간과 비교 기준을 모든 카드에 동일하게 적용한다.
- 계산용 사용자 수는 내부 응답에 보존하고 화면에는 `54명 중 18명이 신청 시작`처럼 쉬운 문장으로 설명한다.
- 마케팅 제안은 방문 규모만으로 예산 확대를 권하지 않고 상품 상세·신청 완료까지 함께 확인하도록 안내한다.
- GA4 처리 지연과 대시보드 마지막 갱신 시각을 표시한다.
- 운영 행동으로 연결되지 않는 장식용 차트는 만들지 않는다.

## 13. 단계별 작업 체크리스트

### Phase A. GA4 기본 구축

- [x] 전용 속성 생성
- [x] 웹 스트림 생성
- [x] 태그 설치
- [x] 전용 페이지뷰 확인
- [x] 맞춤 측정기준 10개 생성
- [x] 참여 인원 맞춤 측정항목 생성
- [x] 신청 완료 맞춤 이벤트 생성
- [x] 새 모임 완료 맞춤 이벤트 생성
- [x] 신청 완료만 주요 이벤트로 지정
- [x] 항목 범위 `item_type` 추가
- [x] `method`, `filter_type`, `filter_value` 추가
- [x] 전송되지 않는 중복 맞춤 측정기준 `login_method` 보관 처리
- [ ] 속성 운영 설정 점검

### Phase B. 핵심 추적 코드

- [x] 페이지뷰·회원상태
- [x] 섹션 노출·섹션 이동
- [x] 상품 상세
- [x] 찜 추가·삭제·목록
- [x] 참여 신청 시작·완료·실패
- [x] 새 모임 시작·완료·실패
- [x] 여행지 검색 열기·실행·결과 수
- [x] 로그인·회원가입·실패·단계
- [x] 섹션별 상세 열람 귀속 배포·운영 확인
- [x] 상품 목록 노출·카드 선택 v43d 운영 Network 확인
- [x] 배너 슬라이드별 노출 v43c 배포·운영 Network 확인
- [x] 검색 결과 선택 v43d 운영 Network 확인
- [x] 신청·새 모임 내부 단계
  - v47a 운영 코드와 `apply_step`·`builder_step` 맞춤 측정기준 등록 완료
  - 새 모임 `date_selection`·`destination_selection`·`participant_info`·`review` 운영 확인
  - 참여 신청 `form_view`·`review` 운영 확인
  - 실제 저장이 필요한 `submit_start`·`complete`는 코드 시뮬레이션 및 기존 완료 이벤트로 검증하고 자연 발생 시 추가 확인
- [x] 로그인 후 원래 행동 복귀 완료
  - v50a 운영에서 `login_required → afterLogin=builder → create_start/date_selection → login_return_complete` 순서와 `return_action=builder` 확인
  - v50b에서 로그인 전 `member_state=guest`, 로그인 후 `member_state=kakao` 전환까지 확인

### Phase C. GA4 검증·탐색

- [x] `page_view` Network 확인
- [x] `golfjoin_section_view` Network 확인
- [x] `view_item` 확인
- [x] `begin_checkout` 확인
- [x] 새 모임 `generate_lead` 확인
- [x] 참여 신청 퍼널 생성
- [x] 새 모임 생성 퍼널 생성
- [ ] 실제 `join_apply_complete` 확인
- [x] 신규 `golfjoin_section_detail_view` 확인
  - [x] 브라우저 Network 수집 확인
  - [x] GA4 실시간 보고서 이벤트 수신 확인
- [x] 검색 퍼널 생성
  - v50a 운영 Network에서 `search_open → search_submit → view_item_list → select_item → view_item` 흐름 확인
  - `item_list_id=destination_search_main`, 목록명·상품·회원상태가 선택까지 유지되고 상세도 `source_area=destination_search` 확인
  - v50b 운영에서 `search_open`·`search_submit` 모두 `source_area=main`, 비로그인 `member_state=guest`, 결과 없음 `result_count_bucket=0` 확인 완료
  - v51a Data API 5단계와 v51b 운영 카드·이전 기간·필터 연동 정상 확인
- [x] 로그인 복귀 퍼널 생성
  - v50a 운영에서 `golfjoin_login_return_complete`, `return_action=builder`, `source_area=login`, `member_state=kakao` 확인 완료
  - 로그인 전 `login_required`가 잔존 세션 때문에 `member_state=kakao`로 분류된 문제를 v50b에서 `guest` 우선 판정으로 보정하고 운영 확인 완료
  - v51a Data API 4단계·`return_action`별 완료율과 v51b 관리자 카드·비교 표 운영 확인 완료
- [ ] 섹션 성과 자유 형식 탐색 생성
- [ ] 7일 표본 검토
- [ ] 30일 기준선 확정

### Phase D. Data API

- [x] API 활성화
- [x] 권한 연결
- [x] 서버 집계 action 1차 구현
  - v44a `admin_ga4_overview` 리비전 `golfjoin-sheet-api-00243-yim` 운영 HTTP 200 확인
- [x] 캐시 구현
  - 운영 응답 `cache.status=hit`, `propertyId=552152254` 확인
- [x] 단위·통합 테스트
  - GA4 대상 `6/6` 통과, 서버 전체 `238/239` 통과
  - 실패 1개는 외부 자산형 메인 HTML에서 제거된 과거 인라인 rollout 상수를 찾는 기존 Release V2 테스트
- [x] 운영 응답 검증
  - 최근 7일 응답: 방문자 109명, 상세 열람 38명, 상세 열람률 34.9%, 신청 시작 2명, 상세 대비 5.3%
  - 품질: `dataLossFromOtherRow=false`, `thresholdingApplied=false`, 이벤트 행 13개
- [x] 상세 집계 action 배포·운영 검증
  - v44b `admin_ga4_dashboard` 리비전 `golfjoin-sheet-api-00244-moq` 운영 반영 완료
  - 섹션·기기·회원상태·일별 추이·유입경로를 5개 배치 보고서로 집계
  - 배치 실패 시 개별 보고서 재시도, 일부 실패 영역만 `quality.partial=true` 처리
  - 개인정보·사용자 단위 식별자 요청 금지 계약 포함
  - GA4 대상 `10/10` 통과, 서버 전체 `242/243` 통과
  - 운영 HTTP 200, `schema=golfjoin-ga4-admin-dashboard-v1`, `propertyId=552152254` 확인
  - 운영 응답: 섹션 6·기기 3·회원상태 4·일별 2·유입경로 4개, `quality.partial=false`, 경고 없음
- [x] 비교기간·직접 기간·선택 필터 배포
  - v44c 로컬 대상 테스트와 GA4 추적 회귀 `54/54` 통과
  - 필터별 캐시 분리, 비교 영역 실패 격리, 직접 기간 최대 90일 제한
  - 배포 패키지: `deploy/stage44-ga4-data-api/ga4-comparison-filters-20260901-v44c`
  - 운영 리비전: `golfjoin-sheet-api-00245-nit`, ACTIVE·Ready·트래픽 100%
  - 운영 응답: HTTP 200, `comparison.summary`, `filters.device=mobile`, 캐시 hit, 경고 없음

### Phase E. 대시보드

- [x] `이용자 분석` 메뉴·레이아웃
  - v45a Firebase Hosting 운영 반영 및 공개 HTML 확인 완료
- [x] KPI
- [x] 퍼널
- [x] 개선 기회
- [x] 섹션 성과
- [x] 기기·회원·유입 비교
- [x] 일별 추이
- [x] 이전 기간 KPI 비교·직접 기간·기기/회원/유입 필터
  - v46a 로컬 브라우저 흐름 8회 요청, 콘솔·런타임 오류 0건
  - 직접 기간 `2026-08-25~2026-08-31`, 모바일·카카오회원·`google / organic` 동시 적용 확인
  - 배포 패키지: `deploy/stage46-ga4-admin-dashboard/golfjoin-ga4-comparison-filters-20260901-v46a`
  - Firebase Hosting 운영 배포 및 사용자 화면 확인 완료
- [x] 내부 단계 상세 드로어 구현
  - v49b 로컬 후보: 참여 신청 4단계, 새 모임 6단계의 진입·이탈·이전 기간 증감 표시
  - 로컬 브라우저에서 두 상세 버튼·넓은 서랍·전체 열·개선 기회 연결 확인
  - v49c에서 제목·기간·요약 수치·비율 셀을 `analytics-internal-detail` 아래로 한정해 조정하고 다른 공용 서랍 스타일 유지
  - 배포 패키지: `deploy/stage49-ga4-dashboard/ga4-internal-funnel-admin-typography-20260901-v49c`
  - Firebase Hosting 운영 배포 완료, 두 퍼널의 단계 상세·전용 CSS·콘솔 정상 확인
- [x] 검색·로그인 복귀 퍼널 카드와 행동별 성과 표
  - v51b 로컬 후보: 검색 5단계, 로그인 복귀 4단계, 원래 행동별 요구·완료·완료율·이전 기간 비교
  - 관련 기능·회귀 `38/38`, 서버·관리자 배포 계약 `12/12` 통과
  - 로컬 브라우저 로그인 화면 PC·모바일 렌더와 콘솔 오류 0건 확인
  - v51b Firebase Hosting 배포 및 운영 `이용자 분석` 화면 정상 확인 완료
- [x] ✅ 완료 이벤트 수집 상태 카드
  - v53b 로컬 후보: 참여 신청·새 모임별 제출 시작·단계 완료·완료 이벤트의 사용자·이벤트 수 표시
  - Cloud Shell 업로드 파일 SHA-256 일치 및 배포 계약 테스트 `6/6` 통과, 운영 HTML 교체·Firebase Hosting 배포 및 화면 QA 완료
  - 데스크톱 2열·모바일 1열, 긴 이벤트명 줄바꿈, 상태별 운영 안내 구현
  - 기능·회귀 `49/49`, 서버·관리자 배포 계약 `13/13`, 브라우저 PC·390px 및 단계 상세 상호작용·콘솔 오류 0건 확인
  - 배포 패키지: `deploy/stage53-ga4-dashboard/ga4-completion-validation-api-20260901-v53a`, `deploy/stage53-ga4-dashboard/ga4-completion-validation-admin-20260901-v53b`
- [x] 빈 상태·오류 상태
- [x] PC·모바일 운영 QA
  - PC 로컬 브라우저 렌더·기간 변경·콘솔 오류 0건 확인
  - PC 운영 관리자 로그인 후 실제 GA4 수치·7/30/90일 전환·새로고침 정상 확인
  - v52a 로컬 390×844 검증: 페이지 전체 가로 넘침 없음, KPI·필터·퍼널 단일 열, 단계 상세 열림/닫힘, 콘솔 오류 0건
  - 긴 로그인 복귀 행동명은 3줄로 줄바꿈되고 숫자 열은 표 내부 가로 스크롤 `242→680px`로 격리
  - 배포 패키지: `deploy/stage52-ga4-dashboard/ga4-admin-mobile-layout-20260901-v52a`
  - v52a Firebase Hosting 운영 배포 완료, 공개 390×844 로그인 화면 `clientWidth=scrollWidth=390`, v52 반응형 규칙 포함 및 콘솔 오류 0건 확인
  - 관리자 로그인 후 모바일 운영 `이용자 분석` 단일 열·긴 행동명·표 내부 스크롤·단계 상세 정상 확인 완료

### Phase F. 운영·개선

- [ ] 주간 리포트 기준 확정
- [ ] 월간 개선 회의 기준 확정
- [ ] 개선 전후 기간 비교 템플릿
- [ ] 캠페인 UTM 규칙
- [ ] 데이터 품질 월간 점검
- [ ] 이벤트 추가·변경 이력 관리

## 14. 지금 바로 이어서 할 작업

상세 기획: `docs/home-optimization/measurement/GOLFJOIN_GA4_INSIGHT_DASHBOARD_V55_PLAN.md`

1. `[P0]` 공용 초기 로딩이 포함된 최신 v54b 관리자 HTML을 교체·배포한다.
2. `[P0]` v55a에서 참여 신청 완료 단계 신호와 검색·로그인 역전 상태 표시를 보강한다.
3. `[P1]` v55b에서 메인 상세 유입과 빌더 상세를 분리하고 유입경로별 신청 시작·완료를 집계한다.
4. `[P1]` v55c에서 중복·기술 카드를 정리하고 근거·수정 후보·확인 지표 중심 화면으로 재구성한다.
5. `[P2]` 최소 7일 데이터를 축적한 뒤 순차 퍼널 후보와 현재 독립 집계를 비교한다.

## 15. 현재 로컬 후보 상태

- 변경 내용: 표준 `view_item_list`·`select_item`·`view_promotion`과 검색 결과 선택 귀속 추가
- 섹션 목록은 실제 노출 카드만 수집하고 동일 목록·상품 지문은 화면 수명 동안 중복 제거
- 카드 선택은 실제 상세 모달이 열린 경우만 집계하며 스와이프 또는 상세 미오픈 클릭은 제외
- 히어로 배너 노출은 활성 배너별 1회, 실제 클릭은 `select_promotion`으로 기록
- 허용된 `items` 필드만 전송하여 개인정보·폼 값은 제외
- GA4 관련 핵심·패키지 테스트: `25/25` 통과
- 소스 빌드: 통과 (`8331BC93208FF3B4A52D025C1C5BDB0E89F02D816DF699B8D95E556048187D12`)
- 전체 단위 묶음: `454`개 중 `412` 통과, `39` 실패, `3` 건너뜀
  - 실패 39개는 현재 외부 자산형 루트 HTML에서 과거 테스트가 인라인 함수 선언을 직접 찾는 기존 회귀 부채이며 이번 GA4 대상 테스트는 전부 통과
- 배포 패키지: `deploy/stage43-ga4/golfjoin-ga4-list-promotion-attribution-20260831-v43c`
- 업로드 파일: `UPLOAD_golfjoin-main_0224EF09.js.br`
- 업로드 파일 SHA-256: `0224ef092e547f8ace99777abd0f85a4603c78472b69240e714c1957ed347499`
- 배포 자산 계약 테스트: `stage43c-ga4-list-promotion-attribution.test.js` 통과
- Asset revision: `gha_dd7d9cd68ae5dccec4d9563a`
- GCS 업로드: 완료 (`HTTP/2 200`, `content-encoding: br`, `210142` bytes)
- Cloud Shell SHA-256·패키지 테스트: 일치, `1/1` 통과
- ERP 교체 HTML: `DEPLOY_golfjoin_main_ga4_list_promotion_attribution_14B69FC6.html`
- ERP HTML 교체: 완료
- 복구 HTML: `ROLLBACK_golfjoin_main_DA6E99D0.html` (현재 운영 v43b)
- 로컬 기본 화면: 렌더·레이아웃 확인, 운영 API 도메인 제약에 따른 상품·배너 이미지/데이터 공백 존재
- 운영 배포 후 Network와 GA4 실시간 검증 필요
- 운영 Network 1차 확인: `view_promotion`, `view_item_list`, `home_my`, `member_state=kakao` 정상
- v43c 운영 문제: 실제 카드 클릭에서 `view_item`은 정상이나 `select_item`·`golfjoin_section_detail_view` 누락
- v43d 수정: 카드 감지 캡처 단계 복구, 히어로 스와이프의 취소된 클릭은 `defaultPrevented`로 제외
- v43d GA4 핵심·패키지 테스트: `26/26` 통과
- v43d 소스 빌드: 통과 (`19E4F815CED8D27494B74C118063FB3548E26D72C1C67810F32305875B563E57`)
- v43d 배포 패키지: `deploy/stage43-ga4/golfjoin-ga4-card-selection-hotfix-20260831-v43d`
- v43d 업로드 파일: `UPLOAD_golfjoin-main_77BB1949.js.br`
- v43d 업로드 SHA-256: `77bb1949c4cb7e934edd6eb9d72bd1345518e6348f8220d00ee44d91a7b2c86b`
- v43d Asset revision: `gha_c81cc707ec85731038b59e63`
- v43d ERP 교체 HTML: `DEPLOY_golfjoin_main_ga4_card_selection_hotfix_49DC9398.html`
- v43d 복구 HTML: `ROLLBACK_golfjoin_main_14B69FC6.html` (현재 운영 v43c)
- v43d GCS 업로드·ERP HTML 교체: 완료
- v43d 운영 상태: 일반 상품카드의 `select_item`·`golfjoin_section_detail_view` Network 검증 완료
- 검증 표본: 비로그인(`member_state=guest`) 상태의 `곧 출발해요!` 첫 카드
- 확인 귀속: `item_list_id=home_soon`, `source_area=soon`, `section_name=soon`, `item_type=join_schedule`
- v44a 운영 상태: `admin_ga4_overview&days=7` HTTP 200·속성 ID·캐시·품질·요약 수치 확인 완료
- v44b 로컬 후보: `admin_ga4_dashboard`와 섹션·기기·회원상태·일별·유입경로 집계 구현 완료
- v44b 보안·복구: 관리자 인증, `private, no-store`, 15분 캐시, 24시간 마지막 정상 데이터, 부분 보고서 실패 격리
- v44b GA4 대상 테스트: `10/10` 통과
- v44b 서버 전체 테스트: `243`개 중 `242` 통과, 기존 Release V2 인라인 상수 테스트 1개 실패
- v44b 배포 패키지: `deploy/stage44-ga4-data-api/ga4-dashboard-breakdowns-20260901-v44b`
- v44b 배포 대상: 서버 `index.js`, `ga4-admin-analytics.js`만 교체하며 HTML 교체 없음
- v44b 운영 리비전: `golfjoin-sheet-api-00244-moq`, ACTIVE·Ready·트래픽 100%
- v44b 운영 응답: HTTP 200, 캐시 hit, 섹션 6·기기 3·회원 4·추이 2·유입 4, `partial=false`, 경고 없음
- v45a 로컬 후보: 관리자 사이드바 `이용자 분석`, 7·30·90일 기간, KPI·신청/새 모임 퍼널·개선 기회·섹션·기기·회원·유입·일별 추이 구현
- v45a 상태 처리: 로딩·빈 데이터·부분 데이터·API 실패·재시도·캐시·마지막 갱신 시각 표시
- v45a 콘솔 보완: 인라인 SVG 파비콘으로 `admin.secret-tour.com/favicon.ico` 404 요청 제거
- v45a 테스트·QA: 관리자 UI 및 기존 대시보드 회귀 `28/28` 통과, PC 브라우저 30일 변경 정상·콘솔 경고/오류 0건
- v45a 배포 패키지: `deploy/stage45-ga4-admin-dashboard/golfjoin-ga4-admin-dashboard-20260901-v45a`
- v45a 관리자 HTML: `DEPLOY_golfjoin_admin_dashboard_8087D2FB.html` (`8087d2fbffe61362147204439963e12166e19c65300b16a36fc27e9f3243f45e`)
- v45a 복구 HTML: `ROLLBACK_golfjoin_admin_dashboard_597D4850.html` (직전 운영 v37n)
- v45a 패키지 계약 테스트: `5/5` 통과
- v45a Firebase Hosting: `dashboad-golfjoin-secrettour` 배포 완료
- v45a 공개 운영 검증: `https://admin.secret-tour.com/`에서 이용자 분석 메뉴·인라인 파비콘 확인, 콘솔 경고/오류 0건
- v45b 로컬 후보: KPI·퍼널·개선 기회·분석 표·비교 값의 타이포 규격 보완, `분석기간` 문구 통일
- v45b 화면 정리: 참여 신청·새 모임 퍼널 하단 비율 장식 제거, GA4 집계/캐시/기간/갱신시각을 상단 `last-updated`로 통합
- v45b 테스트·QA: UI 및 기존 관리자 회귀 `29/29`, 패키지 계약 `6/6`, 30일 전환·콘솔 오류 0건 확인
- v45b 배포 패키지: `deploy/stage45-ga4-admin-dashboard/golfjoin-ga4-admin-dashboard-typography-20260901-v45b`
- v45b 관리자 HTML: `DEPLOY_golfjoin_admin_dashboard_A9EAC6C7.html` (`a9eac6c70c3cc0f4b2fdf2551e07912dec7c64d58b8697aef3a3433d9713235b`)
- v45b 복구 HTML: `ROLLBACK_golfjoin_admin_dashboard_8087D2FB.html` (현재 운영 v45a)
- v45b 운영 상태: Firebase Hosting 배포 완료, 공개 HTML에서 타이포 규격·상태 바 제거·퍼널 장식 제거·이용자 분석 메뉴 확인
- v45b 공개 콘솔: 경고·오류 0건
- v44c 로컬 후보: 이전 동일 기간 비교, 최대 90일 직접 기간, 기기·회원상태·유입경로 AND 필터, 필터별 캐시 분리 구현
- v44c 테스트: 서버 대상 `14/14`, 전체 GA4 추적·관리자 회귀 묶음 `54/54` 통과
- v44c 배포 패키지: `deploy/stage44-ga4-data-api/ga4-comparison-filters-20260901-v44c`
- v46a 로컬 후보: 직접 기간 입력, 이전 기간 비교 체크, KPI 증감 배지, 기기·회원상태·유입경로 선택과 활성 필터 칩 구현
- v46a 브라우저 QA: 30일→모바일→카카오회원→Google Organic→직접 기간 흐름 8회 요청, 런타임 오류 0건
- v46a 관리자 HTML: `DEPLOY_golfjoin_admin_dashboard_1E83D49D.html` (`1e83d49d7cbb4a2df441baeb3d7e67f5990b73ab79a9a8bab47742bbf566ddcb`)
- v46a 복구 HTML: `ROLLBACK_golfjoin_admin_dashboard_A9EAC6C7.html` (현재 운영 v45b)
- v46a 배포 패키지: `deploy/stage46-ga4-admin-dashboard/golfjoin-ga4-comparison-filters-20260901-v46a`
- v44c 운영 리비전: `golfjoin-sheet-api-00245-nit`, ACTIVE·Ready·트래픽 100%
- v44c 운영 검증: HTTP 200, 모바일 필터, 이전 동일 기간, 캐시 hit, 경고 없음
- v46a 운영 상태: Firebase Hosting 배포 완료, 직접 기간·이전 기간 비교·기기·회원상태·유입경로 필터 화면 확인 완료
- v47a 로컬 후보: 참여 신청 `form_view/review/submit_start/complete`, 새 모임 `date_selection/destination_selection/participant_info/review/submit_start/complete` 단계 추적 구현
- v47a 중복 방지: 같은 모달 내 동일 단계는 1회, 모달을 새로 열면 다시 집계
- v47a 개인정보: 기존 허용 목록에 `apply_step`, `builder_step`만 추가하고 폼 값은 계속 차단
- v47a 테스트: GA4 회귀 `30/30`, 배포 자산 계약 `3/3`, 로컬 브라우저 인증 게이트 열기·닫기 및 콘솔 오류 0건
- v47a 배포 패키지: `deploy/stage47-ga4/golfjoin-ga4-internal-funnel-steps-20260901-v47a`
- v47a 업로드 파일: `UPLOAD_golfjoin-main_69053ACD.js.br` (`69053acdf267799f24af8d76bd44d62c40fb1eaa6ae3818e43f9683fb188f826`)
- v47a Asset revision: `gha_35fb7929a77ea151578113a5`
- v47a ERP 교체 HTML: `DEPLOY_golfjoin_main_ga4_internal_funnel_3EE35546.html`
- v47a 복구 HTML: `ROLLBACK_golfjoin_main_49DC9398.html` (현재 운영 v43d)
- v47a GCS 업로드: 완료 (`HTTP/2 200`, `content-encoding: br`, `210546` bytes), ERP HTML 교체 대기
- v47a 운영 Network 1차: `golfjoin_create_start`와 `golfjoin_create_step_view` 확인, `source_area=hero`, `flow_type=new_schedule`, `builder_step=date_selection`, `member_state=kakao` 정상
- v47a 운영 Network 2차: 날짜 선택 후 `builder_step=destination_selection` 확인, `source_area=hero`, `flow_type=new_schedule`, `member_state=kakao` 유지
- v47a 운영 Network 3차: 상품 선택 후 `builder_step=participant_info` 확인, 선택 상품 ID·이름·지역과 `source_area=hero`, `member_state=kakao` 정상
- v47a 운영 Network 4차: 유효한 참여자 정보 입력 후 최종 확인창 진입에서 `builder_step=review`와 상품·hero·kakao 귀속 확인
- 새 모임 `submit_start`는 실제 저장을 발생시키므로 인위적 테스트 생성을 생략하고 코드 시뮬레이션 및 기존 생성 완료 운영 이벤트로 검증
- v47a 참여 신청 운영 Network 1차: `view_item` → `begin_checkout` → `golfjoin_apply_step_view` 순서 확인, `apply_step=form_view`, 상품·detail·join_apply·kakao 귀속 정상
- v47a 참여 신청 운영 Network 2차: 유효한 신청 정보 입력 후 확인창 진입에서 `apply_step=review`와 상품·detail·join_apply·kakao 귀속 확인
- v47a 운영 판정: 비저장 단계 Network 검증 완료, 실제 저장 단계는 인위적 데이터 생성을 피하고 자연 신청·생성 시 확인
- v48a 중요 핫픽스 후보: 일본 상품 참고사항의 `8,000엔` 싱글차지가 `8,000원`으로 표시되던 통화 오인 수정
- v48a 외화 안전 처리: 엔·달러·위안·바트·동·유로는 원화 숫자 합계에서 제외하고 참고사항 통화 단위를 그대로 표시
- v48a 테스트: 통화 파서·표시·GA4·외부 자산 회귀 `39/39`, Cloud Shell·배포 자산 계약 `6/6`, 로컬 브라우저 로드·일본 탭 상호작용·콘솔 오류 0건
- v48a 배포 패키지: `deploy/stage48-hotfix/single-room-surcharge-currency-20260901-v48a` (GCS 업로드·ERP HTML 교체 완료)
- v49a 내부 단계 API: `apply_step` 4단계와 `builder_step` 6단계를 활성 사용자·이벤트 수·이전 단계 대비·다음 단계 이탈로 집계
- v49a 안전성: 7개 보고서를 최대 5개 단위로 분할하고, 맞춤 측정기준 미반영·부분 실패 시 기존 대시보드를 유지
- v49b 관리자 UI: 두 퍼널의 `단계 상세`, 넓은 분석 서랍, 이전 기간 사용자·증감, 내부 최대 이탈 개선 기회 구현
- v49 로컬 검증: 기능·회귀 `29/29`, 배포 계약 `10/10`, 로컬 브라우저 두 상세 흐름·전체 열·콘솔 신규 오류 0건
- v49a 운영 확인: HTTP 200, `ok=true`, `warnings` 없음, 참여 신청 단계 구조 정상, 새 모임 `startUsers=1` 집계 확인
- v49c 단계 상세 전용 CSS: 제목 `22px/700`, 기간 `16px/600`, 요약 레이블 `16px/700`, 요약값 `22px/600`, 비율 `700` 적용
- v49c 로컬 검증: 관련 회귀 `15/15`, 배포 계약 `6/6`, 계산된 CSS·상태 클래스 제거·콘솔 오류 0건 확인
- v49 배포 패키지: `deploy/stage49-ga4-dashboard/ga4-internal-funnel-api-20260901-v49a`, `deploy/stage49-ga4-dashboard/ga4-internal-funnel-admin-typography-20260901-v49c` (서버·관리자 배포와 운영 UI 확인 완료)
- v50a 검색 귀속 수정: 일반 일정·빈 결과 추천·MD PICK 검색 결과의 상세 열람까지 `source_area=destination_search` 유지
- v50a 로그인 복귀 추적: 동일 페이지·리디렉션·프로필 보완·페이지 재진입 경로에서 실제 복귀 성공 시 `golfjoin_login_return_complete`와 `return_action` 전송
- v50a 안전성: 실패 반환은 완료 집계에서 제외하고 기존 GA4 허용 목록만 사용하여 회원번호·연락처·이메일·생년월일·토큰 미전송
- v50a 검증: 검색·로그인·기존 퍼널·싱글차지 회귀 `36/36`, 배포 계약 `4/4`, 전체 소스 조립·축소 JavaScript 문법 통과
- v50a 브라우저 QA: 로컬 페이지·검색 모달·검색 실행·빈 결과 상태 정상, 콘솔 오류 0건; 운영 API 원본 제약에 따른 로컬 데이터 경고만 확인
- v50a 배포 패키지: `deploy/stage50-ga4/golfjoin-ga4-search-login-return-20260901-v50a`
- v50a 업로드 파일: `UPLOAD_golfjoin-main_46363895.js.br` (`4636389538779015ff3caf79d0042d5e6417575b4f91cab5753898f3065ed2a7`)
- v50a Asset revision: `gha_ae9c8538cd0a3eb27e71e707`
- v50a ERP 교체 HTML: `DEPLOY_golfjoin_main_ga4_search_login_return_66B3EF50.html`
- v50a 복구 HTML: `ROLLBACK_golfjoin_main_0925170A.html` (현재 운영 v48a)
- v50a 운영 배포: JavaScript GCS 업로드와 ERP 29번 HTML 교체 완료, 검색·로그인 복귀 Network 검증 단계 진입
- v50a 검색 운영 검증: `search_open → search_submit → view_item_list → select_item → view_item` 확인, `destination_search_main` 목록과 상세 `source_area=destination_search`, `member_state=kakao` 정상
- v50a 검색 후속 보완: 메인 검색의 실행 이벤트만 `source_area=default`로 기록되는 명명 불일치 확인, `main` 정규화 예정
- v50a 로그인 복귀 운영 검증: 로그아웃 진입부터 `login_required → afterLogin=builder → create_start/date_selection → login_return_complete` 순서와 복귀 완료의 `member_state=kakao` 확인
- v50b 보정: 명시적 비로그인 판정을 남은 세션 회원 캐시보다 우선하여 `guest`로 분류하고, 메인 여행지 검색 열기·실행의 `source_area=main` 통일
- v50b 검증: 관련 GA4 회귀 `32/32`, 배포 계약 `4/4`, 전체 소스 조립·축소 JavaScript 문법 통과; 전체 저장소의 기존 분리 소스 미반영 테스트 실패는 배포 판정에서 분리
- v50b 배포 패키지: `deploy/stage50-ga4/golfjoin-ga4-attribution-normalization-20260901-v50b`
- v50b 업로드 파일: `UPLOAD_golfjoin-main_9499CA6C.js.br` (`9499ca6c6ac15431e69c660495755d7649e2a0c6e72cf9d823657873186aaa0a`)
- v50b Asset revision: `gha_8e1f3ce8ea75504188908c7d`
- v50b ERP 교체 HTML: `DEPLOY_golfjoin_main_ga4_attribution_normalization_549DCF74.html`, 복구 HTML: `ROLLBACK_golfjoin_main_66B3EF50.html`
- v50b 운영 배포: JavaScript GCS 업로드와 ERP 29번 HTML 교체 완료, 두 정규화 항목 Network 재검증 대기
- v50b 운영 재검증 1차: 로그아웃 `golfjoin_login_required`의 `return_action=builder`, `member_state=guest`와 검색 열기 `source_area=main`, `member_state=guest` 확인; 검색 실행 이벤트만 확인 대기
- v50b 운영 재검증 완료: 검색 실행도 `source_area=main`, `result_count_bucket=0`, `member_state=guest`로 정상 수집되어 회원상태·검색 출처 보정 종료
- v51a 로컬 후보: 검색 5단계·로그인 복귀 4단계·`return_action`별 요구/완료/완료율을 현재·이전 기간으로 집계하고 10개 보고서를 `5+5` 두 배치로 유지
- v51b 로컬 후보: 여행지 검색 퍼널, 로그인 복귀 퍼널, 원래 행동별 성과 표, 규칙 기반 개선 기회와 모바일 로그인 최소 폭 보정 구현
- v51 검증: 기능·회귀 `38/38`, 서버·관리자 배포 계약 `12/12`, 로컬 로그인 화면 PC·모바일 렌더와 콘솔 오류 0건 확인
- v51 배포 패키지: `deploy/stage51-ga4-dashboard/ga4-journey-funnels-api-20260901-v51a`, `deploy/stage51-ga4-dashboard/ga4-journey-funnels-admin-20260901-v51b` (서버 운영 응답 확인 후 관리자 배포)
- v51a 운영 확인: HTTP 200, `ok=true`, `warnings` 없음, 검색 `9→0명/5단계/관측 3단계`, 로그인 복귀 `15→0명/4단계/관측 3단계`, 행동별 집계 4개 확인
- v51b Firebase Hosting 배포 완료, 운영 검색·로그인 복귀 카드와 행동별 성과 표 정상 확인
- v52a 분석 전용 모바일 레이아웃: 다른 관리자 메뉴의 1180px 최소 폭은 유지하고 `user-analytics` 활성 시에만 64/52px 사이드바·2/1열 필터·KPI·퍼널 적용
- v52a 긴 행동명 안전성: 첫 열 줄바꿈과 표 내부 터치 가로 스크롤을 적용하여 문서 전체 가로 넘침 방지
- v52a 검증: 관련 회귀 `26/26`, 배포 계약 `6/6`, 데스크톱·390×844 렌더·단계 상세 상호작용·콘솔 오류 0건 확인
- v52a 배포 패키지: `deploy/stage52-ga4-dashboard/ga4-admin-mobile-layout-20260901-v52a`, 배포 SHA-256 `2d4fecfc193c5295f9b758251becf8de22020051d459aa3129fa85da6f03eeb3`
- v53a 완료 검증 API: 기존 개요 이벤트와 내부 단계 응답을 결합해 두 흐름의 세 완료 신호를 판정하며 추가 GA4 보고서 없음
- v53b 완료 검증 카드: 상태별 안내·사용자/이벤트 수·PC 2열·모바일 1열을 제공하고 기존 필터·퍼널·단계 상세 유지
- v53 검증: 기능·회귀 `49/49`, 배포 계약 `13/13`, 로컬 PC·390×844 렌더·단계 상세 열기/닫기·콘솔 오류 0건 확인
- v53 배포 패키지: `deploy/stage53-ga4-dashboard/ga4-completion-validation-api-20260901-v53a`, `deploy/stage53-ga4-dashboard/ga4-completion-validation-admin-20260901-v53b`
- v53a Cloud Shell 업로드·배포 계약 `7/7`, 서버 단위·통합 테스트 `18/18` 통과, Cloud Function 리비전 `golfjoin-sheet-api-00248-mer` Ready·트래픽 100%, 운영 응답 확인 대기
- v54a 분석 준비 API: 기간 7일·분모 30명 방향성·100명 안정 기준, 네 전환율 분자·분모·표본 상태를 기존 보고서만으로 계산
- v54b 분석 준비 카드: 선택 기간·방문 데이터 일수·표본 기준·네 전환율 상태를 쉬운 문장과 다음 점검 행동으로 표시하고 데스크톱 4열·태블릿 2열·모바일 1열 제공
- v54b 가독성 보완: 분석 준비·완료 검증 카드 타이포 조정, 다음 점검 설명 분리, 중복 활성 필터 영역과 분석 준비 하단 주석 제거
- v54 검증: 서버·관리자 회귀 `59/59`, 배포 계약 `16/16`, 공용 최초 로딩·네 흐름 카드 내부 정렬·7일→30일 재조회·PC/390×844 렌더·가로 넘침 없음·관련 콘솔 오류 0건
- v54 배포 패키지: `deploy/stage54-ga4-dashboard/ga4-analysis-readiness-api-20260901-v54a`, `deploy/stage54-ga4-dashboard/ga4-analysis-readiness-admin-20260901-v54b`
- v57a API 후보: 검색·로그인 독립 이벤트 도달 사용자가 역전되면 해당 순차 비율·이탈률을 `null` 처리하고 `nonMonotonic`, `actionable`, 진단 코드를 반환
- v57a 비교·섹션 안전성: 이전 기간 방문자 0명은 `comparisonAvailable=false`, `new_schedule`은 상품 섹션 집계에서 제외
- v57b 관리자 후보: 역전 단계에 `순차 비교 불가`와 원인 안내를 표시하고 자동 개선 후보에서 제외; 비교 불가 시 KPI 증감·행동 표 비교 열·상세 서랍 비교 열을 숨김
- v57c 메인 추적 후보: 참여 신청 저장 성공 직후 `golfjoin_apply_step_view · apply_step=complete`를 비즈니스 완료 이벤트보다 먼저 전송
- v57 검증: GA4 관련 회귀 `108/108`, 배포 계약 `32/32`, 소스 조립, 데스크톱·390×844 렌더와 진단·비교 열 숨김을 확인
- v57 배포 패키지: `deploy/stage57-ga4-insights/ga4-insight-reliability-api-20260902-v57a`, `deploy/stage57-ga4-insights/ga4-insight-reliability-admin-20260902-v57b`, `deploy/stage57-ga4-insights/ga4-apply-complete-tracking-20260902-v57c`

## 16. 완료 기준

다음 조건을 모두 충족하면 1차 목표를 완료한 것으로 본다.

- [ ] 핵심 이벤트가 7일 이상 안정적으로 수집됨
- [x] 참여 신청·새 모임·검색·로그인 복귀 퍼널이 작동함
- [ ] 섹션별 노출→상세→신청 전환을 계산할 수 있음
- [x] 모바일·PC·회원상태·유입경로 비교가 가능함
- [x] GA4 Data API 핵심 집계가 관리자 서버를 통해 안전하게 제공됨
- [x] 대시보드 `이용자 분석`에서 주요 KPI와 개선 후보를 확인할 수 있음
- [x] 개인정보가 GA4 및 관리자 응답에 포함되지 않음
- [x] 데이터 부족·처리 지연·API 실패 상태가 명확히 표시됨
- [ ] 운영자가 이 문서만 보고 다음 작업과 현재 상태를 판단할 수 있음

## 17. 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-31 | GA4 전용 속성·맞춤 정의·맞춤 이벤트·주요 이벤트 현황 정리 |
| 2026-08-31 | 참여 신청·새 모임 생성 퍼널 설정 완료 반영 |
| 2026-08-31 | 섹션별 상세 열람 귀속 공백 발견 및 로컬 후보 개발·테스트 상태 반영 |
| 2026-08-31 | 섹션별 상세 열람 귀속 v43b 패키징 완료, 운영 반영 대기 상태로 변경 |
| 2026-08-31 | v43b GCS 업로드 및 ERP HTML 교체 완료, 운영 이벤트 검증 대기 |
| 2026-08-31 | 상품카드 클릭 시 `view_item`·`golfjoin_section_detail_view` 배치 전송 및 `mdpick/kakao` 귀속 확인 |
| 2026-08-31 | GA4 실시간 보고서에서 `golfjoin_section_detail_view` 5건 확인, 섹션별 상세 열람 귀속 완료 처리 |
| 2026-08-31 | `item_type` 항목 범위 맞춤 측정기준 추가 완료, 로그인 추적의 `method`·`login_method` 분리 상태 문서 반영 |
| 2026-08-31 | `method` 이벤트 범위 맞춤 측정기준 `로그인 완료 가입 방법` 등록 완료 |
| 2026-08-31 | `login_method` 이벤트 범위 맞춤 측정기준 `로그인 시도 방법` 등록 완료 |
| 2026-08-31 | `filter_type` 이벤트 범위 맞춤 측정기준 `필터 유형` 등록 완료 |
| 2026-08-31 | `filter_value` 이벤트 범위 맞춤 측정기준 `필터 값` 등록 완료, 필수 맞춤 정의 묶음 완료 |
| 2026-08-31 | `close_convert_lead`, `qualify_lead` 주요 이벤트 별표 해제 완료 |
| 2026-08-31 | `login_method`가 전송 전 `method`로 통합되는 코드 확인, 중복 맞춤 정의 보관 처리 작업으로 수정 |
| 2026-08-31 | `view_item_list`·`select_item`·`view_promotion`·검색 결과 선택 v43c 로컬 구현 및 25개 핵심·패키지 테스트 완료 |
| 2026-08-31 | v43c 불변 JavaScript·ERP HTML·v43b 복구본 패키징 및 자산 계약 테스트 완료 |
| 2026-08-31 | v43c JavaScript GCS 업로드, 원격 헤더·SHA-256·Cloud Shell 패키지 테스트 확인 완료 |
| 2026-08-31 | ERP 29번 HTML을 v43c 배포본으로 교체 완료, 운영 Network·GA4 실시간 검증 단계 진입 |
| 2026-08-31 | 운영 Network에서 히어로 `view_promotion`과 `home_my` `view_item_list`의 목록·상품·회원상태 귀속 확인 |
| 2026-08-31 | v43c 운영 카드 클릭에서 `view_item`만 확인되고 `select_item`·섹션 상세 귀속 누락 재현 |
| 2026-08-31 | 카드 캡처 단계 복구·배너 스와이프 제외 v43d 핫픽스 구현, 26개 테스트·빌드·패키징 완료 |
| 2026-08-31 | v43d JavaScript GCS 업로드 및 ERP 29번 HTML 교체 완료, 카드 선택 운영 재검증 단계 진입 |
| 2026-09-01 | v43d 운영 Network에서 `view_item` → `select_item` → `golfjoin_section_detail_view` 확인, `home_soon` 목록·섹션·상품유형·회원상태 귀속 검증 완료 |
| 2026-09-01 | 여행지 검색 결과 상품 선택에서 `select_item`, `destination_search_main`, `source_area=destination_search`, `item_type=join_schedule` 운영 Network 검증 완료 |
| 2026-09-01 | 전송되지 않는 중복 맞춤 측정기준 `login_method` 보관 처리 완료, 로그인 방식 분석 기준을 `method`로 통일 |
| 2026-09-01 | Analytics Data API 활성화, Cloud Function 실행 서비스 계정 확인 및 GA4 속성 `552152254` 뷰어 권한 연결 완료 |
| 2026-09-01 | v44a 관리자 전용 `admin_ga4_overview`·15분 캐시·마지막 정상 데이터 대체·개인정보 허용 목록 로컬 구현, GA4 대상 6개 테스트 및 배포 패키징 완료 |
| 2026-09-01 | v44a 서버 리비전 `golfjoin-sheet-api-00243-yim` ACTIVE·Ready·트래픽 100% 운영 배포 완료, 관리자 GA4 실제 응답 검증 단계 진입 |
| 2026-09-01 | `admin_ga4_overview&days=7` 운영 HTTP 200, 속성 `552152254`, 캐시 hit, 방문자 109·상세 38·신청 시작 2 및 무손실·무임계처리 응답 확인 |
| 2026-09-01 | v44b `admin_ga4_dashboard` 섹션·기기·회원상태·일별·유입경로 집계, 배치 실패 개별 복구, 캐시·개인정보 계약 구현 및 10개 대상 테스트 완료 |
| 2026-09-01 | v44b 서버 전체 `242/243` 확인 및 v44a 양파일 복구본을 포함한 Cloud Shell 배포 패키지 생성 |
| 2026-09-01 | v44b 리비전 `golfjoin-sheet-api-00244-moq` ACTIVE·Ready·트래픽 100% 배포, 상세 API HTTP 200·5개 집계·`partial=false` 운영 검증 완료 |
| 2026-09-01 | v45a 관리자 `이용자 분석` UI·KPI·퍼널·개선 기회·섹션/기기/회원/유입/추이·상태 화면 구현, 인라인 파비콘으로 콘솔 404 제거 |
| 2026-09-01 | v45a UI 및 기존 관리자 회귀 테스트 `28/28`, 로컬 PC 브라우저 기간 변경·렌더링·콘솔 오류 0건 확인 |
| 2026-09-01 | v45a 관리자 배포·복구 HTML과 Cloud Shell 계약 테스트 패키징 완료, Firebase Hosting 교체 대기 |
| 2026-09-01 | v45a Firebase Hosting 배포 완료, `admin.secret-tour.com` 공개 HTML에서 이용자 분석 메뉴·인라인 파비콘·콘솔 오류 0건 확인 |
| 2026-09-01 | 운영 관리자 로그인 후 실제 GA4 수치·7/30/90일 기간 전환·새로고침 정상 확인, v45a PC 운영 QA 완료 |
| 2026-09-01 | v45b 이용자 분석 타이포·퍼널 장식·상단 상태 표시 보완, 로컬 브라우저 및 35개 테스트 통과, Firebase Hosting 배포 대기 |
| 2026-09-01 | v45b Firebase Hosting 운영 배포 완료, `admin.secret-tour.com` 공개 HTML 규격과 콘솔 오류 0건 확인 |
| 2026-09-01 | v44c 비교기간·직접 기간·기기/회원/유입경로 필터 서버 후보와 v46a 관리자 비교 KPI·필터 UI 구현, 54개 회귀 테스트·8회 브라우저 흐름·오류 0건 확인, 배포 패키징 완료 |
| 2026-09-01 | v44c 리비전 `golfjoin-sheet-api-00245-nit` 운영 배포·비교/모바일 필터 응답 확인, v46a Firebase Hosting 배포 및 직접 기간·비교·3개 필터 운영 확인 완료 |
| 2026-09-01 | v47a 참여 신청·새 모임 실제 UI 단계 추적, 모달 단위 중복 방지·개인정보 허용 목록·완료 이벤트 연결 구현, GA4 회귀 30개·패키지 3개·로컬 브라우저 QA 완료 및 불변 자산 패키징 |
| 2026-09-01 | v47a JavaScript GCS 업로드 완료, 원격 `HTTP 200`·Brotli 인코딩·`210546`바이트 확인, ERP 29번 HTML 교체 단계 진입 |
| 2026-09-01 | v47a ERP 29번 HTML 교체 및 이벤트 범위 맞춤 측정기준 `apply_step` 등록 완료 |
| 2026-09-01 | 이벤트 범위 맞춤 측정기준 `builder_step` 등록 완료, v47a 내부 단계 운영 Network 검증 단계 진입 |
| 2026-09-01 | v47a 새 모임 진입 운영 Network에서 `golfjoin_create_start`와 `builder_step=date_selection` 및 hero·kakao 귀속 확인 |
| 2026-09-01 | v47a 새 모임 날짜 선택 다음 단계에서 `builder_step=destination_selection` 운영 Network 확인 |
| 2026-09-01 | v47a 새 모임 상품 선택 후 `builder_step=participant_info`와 상품 ID·이름·지역 귀속 운영 Network 확인 |
| 2026-09-01 | v47a 새 모임 최종 확인창에서 `builder_step=review` 운영 Network 확인, 실제 저장이 필요한 submit 단계는 자연 생성 시 확인하도록 분리 |
| 2026-09-01 | v47a 참여 신청서 진입에서 `begin_checkout`과 `apply_step=form_view` 및 상품·detail·join_apply·kakao 귀속 운영 Network 확인 |
| 2026-09-01 | v47a 참여 신청 최종 확인창에서 `apply_step=review` 운영 Network 확인, 내부 단계 추적 운영 완료 처리 및 실제 저장 단계는 자연 발생 검증으로 분리 |
| 2026-09-01 | v48a 일본 상품 싱글차지 `8,000엔`의 원화 오인 수정, 외화 원화합계 제외·통화 단위 보존 및 45개 대상/패키지 테스트 완료, GCS·ERP HTML 운영 반영 완료 |
| 2026-09-01 | v49a 참여 신청·새 모임 내부 단계 GA4 Data API 집계와 5개 단위 배치 분할, v49b 단계별 진입·이탈·이전 기간 상세 서랍·개선 기회 구현, 기능/계약 39개 및 로컬 브라우저 QA 완료, 서버→관리자 배포 패키징 |
| 2026-09-01 | v49a 운영 응답 HTTP 200·`ok=true`·경고 없음 확인, `internalFunnels.apply/builder` 구조와 새 모임 시작 사용자 1명 집계 검증 완료, v49b 관리자 배포 단계 진입 |
| 2026-09-01 | v49c 단계 상세에만 제목·기간·요약 수치·비율 타이포그래피를 범위 제한 적용, 공용 서랍 보존 및 회귀 15/15·계약 6/6·브라우저 계산값·콘솔 오류 0건 확인, v49b 후보 대체 패키징 |
| 2026-09-01 | v49c 관리자 Firebase Hosting 운영 배포 완료, 참여 신청·새 모임 단계 상세 UI와 콘솔 최종 확인 단계 진입 |
| 2026-09-01 | v49c 참여 신청·새 모임 단계 상세, 전용 CSS, 공용 서랍 비영향, 콘솔 오류 없음 운영 확인 완료 및 대시보드 고도화 완료 처리 |
| 2026-09-01 | 검색 결과 선택 뒤 상세 `view_item`이 `source_area=home`으로 초기화되는 귀속 단절과 로그인 완료 뒤 원래 행동 복귀 완료 이벤트 누락 원인 확정 |
| 2026-09-01 | v50a 일반·추천·MD PICK 검색 상세 출처 유지, 성공한 로그인 복귀만 기록하는 `golfjoin_login_return_complete` 구현, 회귀 36/36·패키지 4/4·로컬 브라우저 오류 0건 확인 및 배포 패키징 |
| 2026-09-01 | v50a JavaScript GCS 업로드와 ERP 29번 HTML 교체 완료, 검색 상세 귀속·로그인 원래 행동 복귀 운영 Network 검증 단계 진입 |
| 2026-09-01 | v50a 운영 검색에서 목록 노출·선택·상세의 `destination_search_main`/`destination_search` 귀속 확인, 검색 열기 `main` 대비 실행 `default` 명명 불일치 발견 및 후속 보정 등록 |
| 2026-09-01 | v50a 운영 로그인 복귀에서 `login_required → afterLogin=builder → create_start/date_selection → login_return_complete` 전체 순서와 성공 복귀 속성 확인, 비로그인 단계의 잔존 카카오 세션 오분류 발견 |
| 2026-09-01 | v50b 비로그인 회원상태를 `guest`로 우선 판정하고 메인 검색 열기·실행을 `source_area=main`으로 통일, 관련 회귀 32/32·패키지 4/4·소스 빌드 통과 및 배포 패키징 |
| 2026-09-01 | v50b JavaScript GCS 업로드와 ERP 29번 HTML 교체 완료, 비로그인 회원상태·메인 검색 출처 운영 재검증 단계 진입 |
| 2026-09-01 | v50b 운영에서 비로그인 로그인 요구가 `member_state=guest`로 정상화되고 메인 여행지 검색 열기가 `source_area=main`으로 기록되는 것 확인, 검색 실행 재검증만 남음 |
| 2026-09-01 | v50b 메인 여행지 검색 실행에서 `source_area=main`, `result_count_bucket=0`, `member_state=guest` 확인, 회원상태·검색 출처 운영 보정 검증 완료 |
| 2026-09-01 | v51a 검색 5단계·로그인 복귀 4단계·원래 행동별 완료율 Data API와 v51b 관리자 시각화 구현, 회귀 38/38·패키지 12/12·로컬 PC/모바일 로그인 QA 완료 및 서버→관리자 배포 패키징 |
| 2026-09-01 | v51a Cloud Function 운영 응답 HTTP 200·`ok=true`·경고 없음, 검색 5단계·로그인 복귀 4단계·행동별 집계 4개 확인 완료 및 v51b 관리자 배포 단계 진입 |
| 2026-09-01 | v51b 관리자 HTML Firebase Hosting 배포 완료, 검색·로그인 복귀·행동별 성과 카드의 운영 화면 최종 확인 단계 진입 |
| 2026-09-01 | v51b 운영 `이용자 분석`에서 여행지 검색 5단계·로그인 복귀 4단계·행동별 성과 표 정상 확인, v51 검색·로그인 퍼널 연결 완료 처리 |
| 2026-09-01 | v52a 이용자 분석 전용 모바일 최소 폭·필터/KPI/퍼널 단일 열·긴 행동명 줄바꿈·표 내부 터치 스크롤 구현, 회귀 26/26·계약 6/6·PC/390px 브라우저 QA 완료 및 관리자 배포 패키징 |
| 2026-09-01 | v52a 관리자 HTML Firebase Hosting 배포 완료, 공개 390×844 로그인 화면 가로 넘침 없음·v52 반응형 규칙 포함·콘솔 오류 0건 확인, 관리자 로그인 후 모바일 운영 화면 최종 QA 단계 진입 |
| 2026-09-01 | v52a 모바일 운영 `이용자 분석` 단일 열·긴 행동명·표 내부 스크롤·단계 상세 정상 확인, PC·모바일 운영 QA 완료 처리 |
| 2026-09-01 | v53a 완료 이벤트 3신호 교차 검증 API와 v53b 상태 카드 구현, 추가 GA4 호출 없이 네 상태 판정·PC/390px 렌더·단계 상세·콘솔 정상, 회귀 49/49·계약 13/13 통과 및 서버→관리자 배포 패키징 |
| 2026-09-01 | v53a API 파일 Cloud Shell 업로드 및 배포 계약 테스트 7/7 통과, 운영 서버 파일 교체 전 검증 단계 진입 |
| 2026-09-01 | v53a 서버 파일 교체 후 GA4 단위·통합 테스트 18/18 통과, Cloud Function 운영 배포 단계 진입 |
| 2026-09-01 | v53a Cloud Function 배포 완료, 새 리비전 Ready·트래픽 및 completionValidation 운영 응답 확인 단계 진입 |
| 2026-09-01 | v53a 리비전 `golfjoin-sheet-api-00248-mer` ACTIVE·Ready 및 트래픽 100% 확인 |
| 2026-09-01 | v53a 운영 API에서 `completionValidation` 응답·경고 없음 확인, 초기 7일 전체 상태 `needs_review`의 흐름별 신호 점검 단계 진입 |
| 2026-09-01 | 오늘 데이터 상세 판정: 참여 신청은 기존 완료 이벤트 1건만 존재해 `completion_signal_mismatch`·`submit_start_missing`, 새 모임 생성은 세 신호 모두 0건으로 `waiting`; API 판정 로직 정상 확인 후 v53b 배포 단계 진입 |
| 2026-09-01 | v53b 관리자 파일 3종 SHA-256 일치 및 배포 계약 테스트 6/6 통과, 운영 HTML 교체·Firebase Hosting 배포 단계 진입 |
| 2026-09-01 | v53b 관리자 HTML 교체 및 Firebase Hosting 운영 배포 완료, 완료 이벤트 수집 상태 카드 화면 QA 단계 진입 |
| 2026-09-01 | v53b 운영 화면에서 완료 이벤트 수집 상태 카드·현재 판정·모바일 표시 정상 확인, v53 완료 처리 및 자연 완료 데이터 장기 관찰 전환 |
| 2026-09-01 | v54 분석 준비 상태 API·관리자 카드 구현, 기간 7일·분모 30/100명 기준과 네 전환율 분자·분모·표본 상태 추가, 회귀 56/56·계약 13/13·PC/390px·30일 재조회 QA 완료 및 서버→관리자 배포 패키징 |
| 2026-09-01 | 사용자 피드백에 따라 v54 관리자 카드를 초보자용 `이용자 흐름과 다음 행동`으로 재구성, 계산 용어를 숨기고 개선 우선 구간·홈 섹션 운영 힌트·마케팅 유입 힌트·흐름별 다음 점검 행동을 추가, 회귀 56/56·PC/390px·30일 재조회·콘솔 오류 0건 확인 |
| 2026-09-02 | v54a 운영 `admin_ga4_dashboard` 응답 확인: `ok=true`, 속성 ID 일치, `quality.partial=false`, `analysisReadiness` 4개 지표 정상; 7일 중 수집일 3일로 전체 `collecting`, 상세 105/267·신청 시작 2/105는 `stable`, 신청 완료 1/2·새 모임 완료 0/4는 `collecting` |
| 2026-09-02 | v54b 가독성·정렬 보완: 요청 타이포, 공용 최초 로딩, 네 흐름 카드의 비율 설명·구분선·다음 점검·상세 문구를 가장 긴 내용 기준으로 동기화; 회귀 59/59·배포 계약 16/16·PC/390px·30일 재조회·가로 넘침 없음·관련 콘솔 오류 0건 확인, 관리자 배포본 `161061C3` 생성 |
| 2026-09-02 | 이용자 분석 전수 감사: API·품질 정상이나 검색 250%·로그인 복귀 200% 등 독립 이벤트 집계 한계, 이전 기간 0일, 상품이 아닌 새 모임 CTA의 섹션 순위 포함, 유입경로의 신청 전환 부재, 참여 신청 완료 단계 신호 누락을 확인; v55 인사이트 대시보드 기획 작성 및 초기 로딩 공용화 |
| 2026-09-02 | v57 GA4 신뢰도 P0 후보: 검색·로그인 역전 비율 진단, 이전 기간 0명 비교 숨김, `new_schedule` 상품 성과 제외, 참여 신청 `apply_step=complete` 명시 전송을 구현했다. GA4 회귀 108/108·배포 계약 32/32·PC/390px 렌더를 통과했으며 서버→관리자→메인 순서의 복구 포함 패키지를 생성했다. |
