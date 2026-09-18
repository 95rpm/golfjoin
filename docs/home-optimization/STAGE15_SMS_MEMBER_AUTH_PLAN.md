# 15단계 SMS 회원 인증 계획

> 현재 상태 안내(2026-08-21): 일반회원 SMS 인증은 카카오 공식 access token 서버 검증 경로와 통합됐고, `off → report → enforce` 전환과 복구 왕복을 완료했다. 현재 운영은 `golfjoin-sheet-api-00231-yuz`, Gate `enforce`이며 즉시 Report 복구는 `golfjoin-sheet-api-00230-qid`다. 아래의 초기 `Gate off` 설명은 당시의 안전한 선배포 기록으로 읽는다.

## 목적

Secret Tour 백엔드에 회원 토큰 엔드포인트를 추가할 수 없는 현재 제약에서, 일반 아이디 로그인 회원이 ERP에 등록된 휴대폰으로 받은 인증번호를 입력한 경우에만 GolfJoin 회원 토큰을 발급한다.

쉬운 설명: 브라우저가 “나는 30000000번 회원이다”라고 말하는 것만 믿지 않는다. 서버가 회원 원장에 등록된 번호로 문자를 보내고, 그 문자를 실제로 받은 사람이 인증번호를 맞혀야 회원 전용 기능을 사용할 수 있게 한다.

## 전체 체크리스트

- [x] 알리고 계정·발신번호·잔액 확인
- [x] 고정 IP를 사용하는 비공개 알리고 서비스 확인
- [x] 테스트 모드 SMS 발송 확인
- [x] 실제 SMS 1건 발송·수신 확인
- [x] Secret Tour 일반 로그인 성공 응답에서 `custSeq`, `custId`, 이름, 등록 휴대폰을 얻을 수 있는지 확인
- [x] GolfJoin 서버의 ERP 이름+휴대폰 정확 일치 조회 경로 확인
- [x] 비공개 인증 상태 저장 코드 구현
- [x] 인증번호 발급 API 구현
- [x] 인증번호 검증 API 구현
- [x] 5분 회원 액세스 토큰과 회전형 세션 갱신 토큰 구현
- [x] 발송·검증 횟수 제한과 재전송 대기시간 구현
- [x] 일반 로그인 성공 뒤 인증번호 UI 연결
- [x] 신규 일반회원 가입의 휴대폰 인증 API·UI 연결
- [x] 가입 인증번호 3분 제한·70:30 입력 UI·인증완료 배지 구현
- [x] 가입 완료 뒤 같은 인증으로 24시간 회원 세션 연결
- [x] 회원 개인 API에 `off / report / enforce` Gate 연결
- [x] 자동 테스트 구현 및 전체 회귀검사 통과
- [x] 비공개 GCS 버킷과 운영 환경변수 생성
- [x] 배포·복구 파일 생성
- [x] 개선된 인증 UI의 PC·모바일 로컬 검증
- [x] 신규가입 인증 UI의 PC·모바일 로컬 모의 검증
- [x] 일반회원·카카오회원·비로그인 PC·모바일 운영 검증
- [x] 로그인 인증번호가 숫자 6자리일 때만 버튼이 활성화되는 UI와 5회 오입력 잠금·복구 운영 검증
- [x] 신규가입 인증 완료 후 휴대폰 번호 입력창 잠금과 PC·모바일 동작 검증
- [x] Gate OFF와 직전 리비전 복구 시험 — Gate `off`·함수 `ACTIVE`를 확인하고 eventPlanSeq 28에서 `9FA1AF4C` 복구 후 `1AD8D64C` 원복을 완료했다.
- [x] HMAC Report 운영 관찰 — 13건 중 일반회원 `match` 7건, 카카오·초기 요청 `missing` 6건, `mismatch`·`invalid` 0건과 개인정보 원문 0건을 확인했다.
- [x] Report 종료 후 Gate OFF 복구 — `golfjoin-sheet-api-00217-quw`, `ACTIVE`, 인증 `Y`, Gate `off`를 확인했다.
- [x] `enforce` 전환 — 카카오 회원용 공식 access token 교환과 기존 일반회원 프로필 alias 보완 후 Report의 `missing`·`invalid`·`mismatch`를 0건으로 만들고 운영 `golfjoin-sheet-api-00231-yuz`에 적용했다.

## 채택 구조

```text
일반 아이디·비밀번호 확인 성공
  → 인증 대상 회원은 Secret Tour 로그인 쿠키를 즉시 해제
  → 브라우저가 로그인 응답의 회원 식별값을 GolfJoin 인증 시작 API에 전달
  → GolfJoin 서버가 ERP에서 이름+등록 휴대폰을 정확히 재확인
  → ERP에 등록된 휴대폰으로만 6자리 인증번호 발송
  → 사용자가 3분 안에 인증번호 입력
  → 서버가 최대 시도 횟수와 만료를 확인
  → 5분 액세스 토큰 + 최대 24시간 회전형 갱신 토큰 발급
  → 메모리에만 보관한 암호화 로그인 값으로 Secret Tour 로그인을 다시 완료
  → 개인 API는 브라우저가 보낸 회원번호가 아니라 검증된 토큰의 회원번호 사용
```

인증번호를 입력하기 전에 새로고침하면 진행 중인 인증은 복원하지 않는다. 남아 있을 수 있는 Secret Tour 로그인 쿠키를 다시 지운 뒤 비로그인 상태의 메인페이지로 진입한다.

신규 일반회원은 회원정보 입력 단계에서 휴대폰 번호를 먼저 인증한다. 인증번호는 3분 동안 유효하고, 인증된 번호가 바뀌면 인증 결과도 즉시 무효가 된다. 최종 가입 직전에 서버가 인증 증명을 다시 검사하고, 가입 완료 뒤에는 같은 인증으로 24시간 GolfJoin 회원 세션을 만든다. 따라서 가입 직후 로그인 과정에서 문자를 한 번 더 보내지 않는다.

## 보안 결정

- [x] 브라우저의 `CookieData`, `memberSeq`, 휴대폰만으로 토큰을 발급하지 않는다.
- [x] 인증번호는 ERP에서 확인한 등록 휴대폰으로만 보낸다.
- [x] 인증번호 원문은 서버 저장소에 저장하지 않고 전용 비밀키 HMAC만 저장한다.
- [x] 인증 상태는 공개 `golfjoin-bucket`이 아니라 별도 비공개 버킷에 저장한다.
- [x] 로그인·신규가입 인증번호 유효시간은 모두 3분, 입력은 최대 5회로 제한한다.
- [x] 신규가입 인증번호는 3분으로 별도 제한하고 가입 증명은 휴대폰 해시와 결합한다.
- [x] 같은 회원·클라이언트의 연속 발송과 시간당 발송 횟수를 제한한다.
- [x] 회원 토큰 서명키는 관리자·쓰기·알리고 내부 토큰과 분리한다.
- [x] 토큰과 인증번호, 전체 휴대폰 번호를 응답·로그에 남기지 않는다.
- [x] 인증 실패 후 기존 무인증 개인 조회로 자동 우회하지 않는다.
- [x] 공개 홈·상품·공개 일정 API는 기존 동작을 유지한다.

## 환경변수

| 이름 | 역할 | 기본/조건 |
|---|---|---|
| `GOLFJOIN_MEMBER_AUTH_ENABLED` | SMS 인증 API 전체 스위치 | 초기 `N` |
| `GOLFJOIN_MEMBER_AUTH_GATE` | 개인 API 적용 수준 | `off`, `report`, `enforce`; 초기 `off` |
| `GOLFJOIN_MEMBER_AUTH_SECRET` | OTP HMAC·회원 토큰 전용 비밀 | 32바이트 이상, 다른 키 재사용 금지 |
| `GOLFJOIN_MEMBER_AUTH_BUCKET` | 인증 상태 전용 비공개 GCS 버킷 | 필수 |
| `GOLFJOIN_MEMBER_AUTH_PREFIX` | 비공개 객체 경로 | 기본 `member-auth/v1` |
| `GOLFJOIN_MEMBER_OTP_TTL_SECONDS` | 로그인 인증번호 유효시간 | 기본 180초 |
| `GOLFJOIN_MEMBER_ACCESS_TTL_SECONDS` | 액세스 토큰 유효시간 | 기본 300초 |
| `GOLFJOIN_MEMBER_SESSION_TTL_SECONDS` | 인증 세션 최대시간 | 24시간(86400초) |
| `GOLFJOIN_MEMBER_SIGNUP_OTP_TTL_SECONDS` | 신규가입 인증번호 유효시간 | 180초 |

## 비공개 버킷 조건

- [x] Uniform bucket-level access를 사용한다. — 운영 버킷 `golfjoin-member-auth-499602`에서 확인했다.
- [x] `allUsers`, `allAuthenticatedUsers` 읽기 권한이 없어야 한다. — 운영 IAM에 공개 주체가 없음을 확인했다.
- [x] GolfJoin Cloud Function 실행 서비스 계정만 객체 읽기·쓰기 권한을 가진다. — 실행 계정에 `roles/storage.objectAdmin`을 부여했다.
- [x] CORS를 설정하지 않는다. — `--clear-cors` 적용 후 운영 설정을 확인했다.
- [x] 인증 객체는 `Cache-Control: no-store`로 저장한다. — 저장 구현과 자동시험에서 확인했다.
- [x] 수명주기로 만료 객체를 자동 삭제한다. — 2일 경과 객체 삭제 규칙을 운영 버킷에 적용했다.

## 단계별 배포

### A. 서버 기반 배포

- [x] 인증 API 코드를 배포하고 `GOLFJOIN_MEMBER_AUTH_ENABLED=Y`, Gate `off`를 유지한다. — 최초 계획의 `N` 선배포는 실제 운영 순서에서 자동시험·테스트 이벤트 검증을 거쳐 `Y`로 바로 전환한 것으로 기록한다.
- [x] 기존 메인·상품·일정·로그인 동작이 동일한지 확인한다. — 비로그인, 카카오, 일반회원, 나의 모임, 내예약, 상품상세 회귀를 통과했다.

### B. 일반회원 인증 UI 검증

- [x] 모든 HOME 일반 로그인 회원에게 인증 UI를 노출하고 카카오 회원은 제외한다.
- [x] 올바른 번호 수신, 잘못된 번호, 만료, 5회 실패, 재전송 대기를 검증한다. — eventPlanSeq 28에서 5회 잠금과 제한시간 경과 후 새 인증번호 로그인까지 통과했다.
- [x] 신규가입에서 발송·인증완료 배지·가입 완료·재로그인을 검증한다. — eventPlanSeq 28에서 번호 변경 즉시 기존 인증 무효화와 원번호 복원 시 자동복원 방지까지 확인했다.
- [x] 토큰 원문과 개인정보가 Console·Network URL에 남지 않고 신규 콘솔 오류가 없음을 확인한다.

### C. Report

- [x] 기존 브라우저 회원과 토큰 회원의 일치 여부만 익명 해시로 집계한다. — 회원번호·휴대폰·이메일·토큰 원문 없이 HMAC 가명값만 기록했다.
- [x] 불일치가 있어도 화면은 기존 방식으로 유지하며 원인만 수정한다. — 초기 `missing` 원인을 카카오 토큰 교환과 기존 일반회원 profile alias로 보완한 후 Enforce로 전환했다.

### D. Enforce

- [x] 카카오 로그인 회원도 신뢰할 수 있는 회원 토큰을 발급받는 경로를 먼저 마련한다. — Kakao access token을 서버에서 사용자 정보로 검증하고 Secret Tour 외부회원 ID와 일치할 때만 GolfJoin 세션으로 교환한다.
- [x] 개인 읽기부터 토큰 회원만 허용한다. — 무토큰 허용 Origin 요청이 401 `member_token_required`로 거부되는 것을 확인했다.
- [x] 생성·참여·찜 쓰기로 확대한다. — 일반회원·카카오회원의 나의 모임·내예약·찜 쓰기와 생성·참여 관련 운영 회귀를 통과했다.
- [ ] 쿼리에서 휴대폰·이메일 식별값을 제거한다.

현재 주의: 개인 API의 최종 권위는 검증 토큰의 회원이며 브라우저가 보낸 회원 식별값으로 fallback하면 안 된다. 카카오 토큰 교환이 실패하면 해당 개인 요청을 인증 없이 진행하지 않는다. 초기 배포의 `Gate off` 조건은 Stage 30 완료로 대체됐다.

한계: Secret Tour 백엔드를 수정할 수 없으므로 GolfJoin 화면에서는 인증 전 가입을 차단하지만, Secret Tour의 원본 회원가입 API 자체를 외부에서 직접 호출하는 행위까지 강제로 막을 수는 없다. 원본 API 수준의 완전한 강제는 Secret Tour 백엔드가 GolfJoin 인증 증명을 검증하도록 연동해야 한다.

## 복구

- [x] 즉시 복구는 우선 검증된 Report revision으로 트래픽을 전환하고, 인증 기능 자체 장애일 때만 `GOLFJOIN_MEMBER_AUTH_GATE=off`로 수행하도록 고정했다. — 현재 운영은 Enforce `golfjoin-sheet-api-00231-yuz`, Report 복구는 `golfjoin-sheet-api-00230-qid`다.
- [x] 인증 API 자체 문제는 `GOLFJOIN_MEMBER_AUTH_ENABLED=N`으로 중지하도록 고정했다.
- [x] 기존 공개 데이터는 인증 저장소 장애와 무관하게 유지되도록 분리했다.
- [x] 운영 전환 직전 Cloud Function 리비전과 화면 복구 파일을 기록했다. — 현재 인증 서버 `golfjoin-sheet-api-00231-yuz`, Report 복구 `golfjoin-sheet-api-00230-qid`, 화면 복구본 `ROLLBACK_golfjoin_main_7502BFEA.html`.

실제 운영 배포 결과와 부정 경로·복구 전환 시험 결과는 `measurement/reports/20260818_phase15_sms_auth_production.md`에서 관리한다.
