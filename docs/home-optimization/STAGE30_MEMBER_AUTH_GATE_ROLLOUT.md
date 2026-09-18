# 30단계 — 회원 인증 Gate 최종 전환

목적: HOME 일반회원 SMS 인증과 카카오 액세스 토큰 교환으로 발급된 GolfJoin 회원 토큰을 개인 조회·쓰기에 실제 적용한다.

## 진행 현황

- [x] 일반회원 SMS 인증 세션이 24시간 회전형 세션을 발급한다.
- [x] 카카오 회원이 홈 데이터 로딩 전에 GolfJoin 회원 세션으로 교환한다.
- [x] 개인 조회와 회원 쓰기 공통 경로가 Bearer 토큰을 첨부한다.
- [x] `report`는 요청을 차단하지 않고 가명값만 기록한다.
- [x] `off`, `report`, `enforce`를 안전하게 전환하는 도구를 준비했다.
- [x] `report` 운영에서 일반회원 읽기 요청이 모두 `match`다. — 2026-08-21 최신 Report에서 프로필·찜·생성 일정·참여 일정 조회가 모두 일치했다.
- [x] `report` 운영에서 카카오 회원 읽기 요청이 모두 `match`다. — 카카오 교환 200 이후 서로 다른 가명 회원값의 프로필·찜·생성 일정·참여 일정 조회가 모두 일치했다.
- [x] 토큰 없음·불일치 원인을 확인하고 0건으로 만든다. — 최신 읽기와 일반회원·카카오회원 `write:join_wish` 감사에서 `missing`·`invalid`·`mismatch`가 모두 0건이었다.
- [x] `enforce` 테스트 페이지에서 일반회원·카카오 회귀검사를 통과한다. — eventPlanSeq 29에서 기존 일반회원 프로필, 카카오 교환, 비로그인, 나의 모임, 내예약, 찜과 콘솔 오류 0건을 확인했다.
- [x] `enforce` 운영 반영과 Report 복구·원복 시험을 통과한다. — 최종 Enforce `golfjoin-sheet-api-00231-yuz`, Report 복구 `golfjoin-sheet-api-00230-qid`의 100% 트래픽 왕복과 운영 정상 상태를 확인했다.

## 전환 원칙

1. `off → report → enforce` 순서를 건너뛰지 않는다.
2. `report`는 차단하지 않으므로 기존 사용자 기능은 그대로 동작한다.
3. `missing`, `invalid`, `mismatch`가 있으면 `enforce`로 넘어가지 않는다.
4. 장애가 발생하면 환경값을 `off`로 바꾸고 같은 소스로 재배포한다.
5. 로그에는 회원번호·휴대폰·이메일·토큰 원문을 남기지 않는다.

## Report 통과 시 실제 화면 검사

- [x] 일반회원 재로그인 후 OTP 인증, 메인, 나의 모임, 내예약, 찜이 정상이다. — 일정 생성·참여 쓰기 Gate 검사는 별도 항목으로 유지한다.
- [x] 카카오 재로그인 후 OTP 없이 메인, 나의 모임, 내예약, 찜이 정상이다. — 일정 생성·참여 쓰기 Gate 검사는 별도 항목으로 유지한다.
- [x] 새로고침 후 추가 SMS 없이 각 회원 세션이 유지된다.
- [x] A회원 로그아웃 후 B회원 로그인 시 A회원 데이터가 남지 않는다. — 일반회원 찜 감사 후 로그아웃하고 카카오회원으로 전환해 서로 다른 가명 회원값과 화면 분리를 확인했다.
- [x] 콘솔 Errors·Warnings가 없다.

## 현재 작업 — 쓰기 Report 최소 감사

- [x] 감사 시작 UTC를 Cloud Shell에 기록한다.
- [x] 일반회원이 상품 하나를 찜하고 바로 삭제한다.
- [x] 카카오회원이 상품 하나를 찜하고 바로 삭제한다.
- [x] 두 회원 모두 `write:join_wish = match`인지 확인한다.
- [x] 같은 감사 구간에 `missing`, `invalid`, `mismatch`가 0건인지 확인한다.
- [x] 통과 후 `enforce` 전환·복구 명령과 테스트 순서를 확정한다.

## Enforce 전환 순서

- [x] 현재 `report` 리비전 이름을 기록한다. — Cloud Shell의 `/home/llno95ll/stage30-report-revision.txt`에 저장했다.
- [x] 별도 Cloud Shell 탭에 직전 리비전 100% 즉시 복구 명령을 준비한다. — 저장한 Report 리비전을 대상으로 한 Cloud Run 트래픽 복구 명령을 별도 탭에 대기시켰다.
- [x] 환경파일 Gate만 `enforce`로 변경한다. — 서버 배포 전 환경파일에서 `report → enforce` 전환을 확인했다.
- [x] 전체 문법·자동 테스트를 통과한 같은 서버 소스를 배포한다. — 자동검사 339건 중 실패 0건을 확인한 소스를 `golfjoin-sheet-api-00228-nes`로 배포하고 `ACTIVE`, Gate `enforce`를 확인했다.
- [x] 일반회원 로그인·조회·찜 추가/삭제를 검사한다. — OTP, 새로고침 인증 유지, 프로필 조회, 나의 모임·내예약과 찜 tombstone 반영이 정상이다.
- [x] 카카오 로그인·조회·찜 추가/삭제를 검사한다. — `member_kakao_auth_exchange` 200, SMS 요청 0건, 프로필·나의 모임·내예약과 찜 동작이 정상이다.
- [x] 토큰 없는 보호 요청이 401로 거부되는지 확인한다. — 허용된 운영 Origin에서 `member_profile_lookup` 무토큰 요청이 `401 member_token_required`로 거부됐다. 허용되지 않은 Origin은 그보다 먼저 403으로 차단됐다.
- [x] `report` 리비전으로 트래픽을 복구하고 화면이 정상인지 확인한다. — `golfjoin-sheet-api-00230-qid=100`으로 복구 후 일반회원·카카오회원 화면이 정상이고 무토큰 Report 요청이 차단되지 않는 것을 확인했다.
- [x] 다시 `enforce` 리비전으로 전환해 최종 운영 상태를 확정한다. — `golfjoin-sheet-api-00231-yuz=100`, `GOLFJOIN_MEMBER_AUTH_ENABLED=Y`, `GOLFJOIN_MEMBER_AUTH_GATE=enforce`, 함수 `ACTIVE`를 최종 확인했다.

## 최종 운영 기준

- [x] 운영 HTML: `57A4BEC1`
- [x] 운영 GCS 자산 revision: `gha_3075b235e554d023f9db2336`
- [x] 화면 즉시 복구 HTML: `7502BFEA`
- [x] Enforce 서버 revision: `golfjoin-sheet-api-00231-yuz`
- [x] Report 즉시 복구 revision: `golfjoin-sheet-api-00230-qid`
- [x] 허용된 운영 Origin의 무토큰 `member_profile_lookup`: HTTP 401 `member_token_required`
- [x] 일반회원·카카오회원 인증 요청: HTTP 200, 다른 회원 정보 노출·콘솔 오류 0건
- [x] Cloud Shell 임시 배포 파일·과거 작업 폴더 정리 후 서버 전체 테스트: 202개 중 통과 191, 실패 0, 조건부 제외 11

## 즉시 복구

가장 빠른 복구는 검증된 Report revision으로 트래픽을 전환하는 것이다. 소스 재배포가 필요 없고 현재 회원 요청을 차단하지 않으면서 가명 비교 로그를 유지한다.

```bash
gcloud run services update-traffic golfjoin-sheet-api \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --to-revisions="golfjoin-sheet-api-00230-qid=100"
```

문제가 해소되면 검증된 Enforce revision으로 원복한다.

```bash
gcloud run services update-traffic golfjoin-sheet-api \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --to-revisions="golfjoin-sheet-api-00231-yuz=100"
```

Report에서도 인증 기능 자체가 문제를 일으키는 경우에만 Gate OFF를 사용한다.

```bash
cd /home/llno95ll/google-sheet-proxy-function
python3 stage30-configure-member-auth-gate.py off
```

그다음 현재 검증된 서버 소스와 환경파일로 `golfjoin-sheet-api`를 재배포한다.
