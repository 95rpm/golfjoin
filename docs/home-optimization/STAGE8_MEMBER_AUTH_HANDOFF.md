# 8단계 회원 인증 연동 인계서

> 최종 상태(2026-08-21): Secret Tour same-origin 회원 토큰 엔드포인트는 추가하지 않았다. 대신 HOME 일반회원은 ERP 등록 휴대폰 SMS 본인확인, 카카오 회원은 공식 Kakao access token 서버 검증을 사용해 GolfJoin 회원 세션을 발급한다. 이 대체 경로로 Report 비교와 Enforce 운영 전환을 완료했으며, 아래의 same-origin BFF 설계는 향후 Secret Tour 세션을 직접 통합할 때 사용할 선택안으로 보존한다.

## 결론

- [x] 브라우저의 회원 캐시 분리·회원 전환 무효화·개인 응답 `no-store`는 운영 반영 완료
- [x] `CookieData(...)`와 `sessionStorage`는 화면용 로그인 상태로만 사용
- [x] 관리자 토큰·ERP 서버 세션을 일반 회원 인증에 재사용하지 않음
- [x] 운영 로그인 후 메인·마이페이지 HTML에서 세션 회원의 `userSeq`를 서버 렌더링하는 능력 확인
- [x] 기존 로그아웃이 `MCPC_TOURSOFT` 세션을 만료시키고 메인 HTML 회원값을 제거하는 것 확인
- [ ] Secret Tour 백엔드가 자기 로그인 세션을 검증해 짧은 회원용 서명 토큰 발급 — 현재 운영에는 채택하지 않은 향후 선택안
- [x] GolfJoin Cloud Function이 GolfJoin 회원 토큰을 검증하고 토큰의 회원으로만 개인 조회·쓰기를 수행 — 일반회원 SMS와 카카오 공식 토큰 교환을 공통 회원 세션으로 통합하고 Gate `enforce`를 적용했다.

현재 운영 사이트 직접 확인 결과와 백엔드 확인 절차는 `STAGE8_MEMBER_AUTH_BACKEND_CHECK.md`에 기록했습니다. 2026-08-14 기준 제안 엔드포인트는 로그인 상태에서도 404이며, 공통 프런트 JavaScript에서도 기존 회원용 JWT·Bearer 경로는 발견되지 않았습니다.

이후 Network 추가 확인에서 외부 로그인 성공 응답이 `MCPC_TOURSOFT` 도메인 세션 쿠키를 발급하고, 로그인 후 메인·마이페이지 문서가 모두 현재 회원의 `userSeq`를 `CookieData(...)`에 서버 렌더링하는 것을 확인했습니다. 따라서 Secret Tour 서버가 세션 회원번호를 읽는 능력은 확인됐고, 남은 외부 작업은 그 공통 세션 값을 사용한 토큰 엔드포인트와 서명 방식입니다.

로그아웃은 `/member/logout.json`이 같은 쿠키를 1970년 만료로 제거하며, 이후 메인 HTML의 로그인 판정이 빈 문자열로 바뀌는 것까지 확인했습니다. 새 토큰 엔드포인트도 반드시 이 기존 세션 수명주기를 그대로 따라야 하며, 로그아웃된 쿠키로는 `401 login_required`를 반환해야 합니다. 현재 `Set-Cookie`에 `HttpOnly`, `Secure`, `SameSite`가 보이지 않는 점은 별도 세션 보안 검토 항목으로 기록하되, 속성 변경은 카카오 로그인과 PC/MO 공유 회귀시험 후 진행합니다.

2026-08-14에는 Secret Tour 백엔드 담당자와 확인·구현 협의가 불가능해 서버 회원 인증을 보류했다. 이후 고객 세션 쿠키를 Cloud Function으로 보내는 우회 없이, 일반회원 SMS 본인확인과 카카오 공식 access token 검증이라는 독립적인 신원 증명 경로를 마련했다. 2026-08-21 현재 개인 캐시 분리·회원 전환 무효화·개인 응답 `no-store`와 서버 Enforce가 함께 적용된다.

대시보드의 참여자 명단 추가 기능도 함께 추적했습니다. 이 기능은 관리자 토큰으로 Cloud Function을 호출하고, Cloud Function이 ERP 직원 계정으로 로그인해 이름+휴대폰이 정확히 일치하는 고객의 `custSeq`를 찾아 참여 데이터의 `memberSeq`로 저장합니다. 회원번호 매핑과 서버 간 ERP 조회 구현은 참고할 수 있지만, 관리자 토큰·ERP 직원 세션·사용자가 입력한 이름/휴대폰은 고객 본인 인증으로 재사용하지 않습니다. Secret Tour 백엔드가 고객 세션에서 회원번호를 먼저 확정한 뒤 직접 서명하거나 내부 토큰 발급 서비스를 호출해야 합니다.

브라우저가 전달하는 `memberSeq`, `memberId`, 휴대폰은 여전히 인증 근거가 아니다. 서버는 일반회원 SMS 또는 카카오 공식 토큰 교환으로 발급한 GolfJoin access token의 회원을 최종 권위로 사용한다. 요청 식별자와 토큰 회원이 다르거나 토큰이 없으면 Enforce에서 요청을 거부하며, 인증 실패를 과거 무인증 경로로 fallback하지 않는다.

## 현재 운영 인증 구조

```text
HOME 일반회원
  → Secret Tour 아이디·비밀번호 확인
  → ERP 등록 휴대폰으로 SMS 인증번호 발송
  → 3분 이내 인증번호 검증
  → GolfJoin 5분 access token + 최대 24시간 회전형 세션

카카오 회원
  → Secret Tour의 기존 Kakao 로그인
  → 브라우저가 받은 Kakao access token을 GolfJoin 서버에 전달
  → 서버가 Kakao 사용자 API로 토큰과 사용자 ID 검증
  → Secret Tour 외부회원 ID와 일치할 때 GolfJoin 회원 세션 발급

개인 조회·쓰기
  → Authorization: Bearer <GolfJoin access token>
  → 서버가 검증 토큰 회원만 최종 권위로 사용
  → 무토큰 401, 회원 불일치 거부, 인증 실패 fallback 없음
```

- [x] `off → report → enforce` 순서로 전환
- [x] Report에서 원문 개인정보 없이 HMAC 가명 비교
- [x] 일반회원·카카오회원 `match`, 최신 감사의 `missing`·`invalid`·`mismatch` 0건
- [x] 허용 Origin 무토큰 보호 요청 HTTP 401 `member_token_required`
- [x] 운영 Enforce `golfjoin-sheet-api-00231-yuz`
- [x] 즉시 Report 복구 `golfjoin-sheet-api-00230-qid`
- [x] 일반회원·카카오회원·비로그인, 나의 모임·내예약·찜·상세 운영 회귀 정상
- [ ] Secret Tour 세션 쿠키의 `HttpOnly`·`Secure`·`SameSite` 보강 — Secret Tour 백엔드 선택 작업이며 현재 GolfJoin Enforce 완료를 막지 않는다.

## 현재 코드에서 확인한 경계

| 현재 값 | 실제 용도 | 회원 인증에 사용할 수 없는 이유 |
|---|---|---|
| HTML `CookieData(userSeq=..., userId=...)` | 로그인 화면 구성 | 서명·만료·서버 검증 증거가 없음 |
| `sessionStorage` 회원 객체 | 같은 탭의 UI 상태 유지 | 브라우저에서 수정 가능 |
| `x-golfjoin-admin-token` | 대시보드 관리자 읽기 | 일반 회원과 권한·수명·주체가 다름 |
| ERP `JSESSIONID`·`MTBS_COOKIE` | Cloud Function의 ERP 조회 세션 | 고객 개인 로그인 세션이 아님 |
| 대시보드 ERP 이름+휴대폰 조회 | 관리자 명단의 회원번호 연결 | 회원 존재 확인일 뿐 현재 브라우저 사용자의 본인 증명이 아님 |
| CORS 허용 출처 | 다른 사이트의 브라우저 호출 제한 | 허용 사이트 안에서 회원 식별자를 바꾸는 공격은 막지 못함 |

## 향후 선택 구조: Secret Tour same-origin 직접 연동

```text
사용자 브라우저
  1. Secret Tour same-origin 회원 토큰 엔드포인트 호출
  2. 짧은 서명 토큰 수신
  3. Authorization: Bearer <token>으로 GolfJoin 개인 API 호출

Secret Tour 백엔드
  - 기존 고객 로그인 세션을 직접 확인
  - 로그인된 회원의 최소 식별자만 5분 이내 토큰으로 서명

GolfJoin Cloud Function
  - 서명·발급자·대상·만료를 검증
  - 요청 쿼리의 회원번호를 신뢰하지 않고 토큰의 회원번호 사용
  - 쓰기 payload의 회원과 토큰 회원이 다르면 403
```

쉬운 설명: 비밀번호나 카카오 세션을 GolfJoin으로 옮기지 않습니다. Secret Tour 서버가 “이 요청은 회원 30002047이 맞다”는 짧은 확인증만 만들어 주고, GolfJoin 서버는 그 확인증을 검사합니다.

## Secret Tour 백엔드에서 필요한 작업 — 현재 운영 필수 아님

- [ ] same-origin 엔드포인트를 만든다. 예: `GET /event/web/golfjoin/member-token`
- [ ] 기존 Secret Tour 고객 로그인 세션이 없으면 `401`을 반환한다.
- [ ] 로그인 세션의 회원번호를 서버에서 직접 읽고 클라이언트 쿼리값은 받지 않는다.
- [ ] 토큰은 5분 이내로 만료하고 `Cache-Control: private, no-store`를 적용한다.
- [ ] 로그아웃·탈퇴·정지 회원은 새 토큰을 받을 수 없게 한다.
- [ ] 공개키 검증 방식이면 검증 공개키 또는 JWKS 주소를 GolfJoin 운영 환경에 제공한다.
- [ ] 공유 비밀 방식이 불가피하면 관리자·쓰기 토큰과 완전히 다른 전용 비밀을 Secret Manager로 전달한다.

권장 토큰 필드는 다음과 같습니다.

| 필드 | 예시 | 설명 |
|---|---|---|
| `iss` | `secret-tour-member-auth` | 누가 발급했는지 |
| `aud` | `golfjoin-sheet-api` | 어느 서버가 받을 토큰인지 |
| `sub` | `30002047` | Secret Tour 세션의 `userSeq`, GolfJoin의 `memberSeq` |
| `memberKey` | `seq:30002047` | GolfJoin의 정규 회원키 |
| `iat` | Unix 초 | 발급 시각 |
| `exp` | Unix 초 | 만료 시각, `iat` 이후 최대 5분 |
| `jti` | 임의의 고유값 | 같은 토큰의 추적·폐기용 식별자 |

휴대폰·이메일·생년·성별은 토큰에 넣지 않습니다. 필요한 프로필은 인증된 회원번호로 서버가 조회합니다.

## GolfJoin Cloud Function 점검 결과

- [x] `Authorization: Bearer` 회원 토큰 파서를 관리자 인증과 별도 모듈로 만든다.
- [x] 토큰 서명·audience·만료와 최대 5분 access token 수명을 검증한다.
- [x] 개인 조회·쓰기는 검증된 토큰 회원을 최종 권위로 사용한다.
- [x] 쓰기 payload 회원과 검증 회원이 다르면 요청을 거부한다.
- [x] 토큰 없음·만료·서명 오류를 인증 오류로 구분한다.
- [x] 인증 실패 시 기존의 무인증 개인 조회로 fallback하지 않는다.
- [x] 공개 홈·상품·공개 일정 API는 기존 동작을 유지한다.
- [x] 응답과 로그에 토큰·휴대폰·이메일 원문을 남기지 않는다.
- [x] 회원용 키는 관리자·쓰기·내부 서비스 키와 분리한다.

## 안전한 전환 결과

- [x] 1. Secret Tour 백엔드 토큰 대신 일반회원 SMS와 카카오 공식 토큰 검증 경로를 준비한다.
- [x] 2. Cloud Function에 `off / report / enforce` 세 단계 회원 인증 Gate를 추가한다.
- [x] 3. `report`에서 토큰 회원과 기존 식별자의 일치 여부만 비교하고 개인정보는 기록하지 않는다.
- [x] 4. 내부 테스트 회원으로 PC·모바일 조회와 쓰기를 검증한다.
- [x] 5. 개인 읽기와 생성·참여·찜 쓰기에 `enforce`를 적용한다.
- [ ] 6. 호환용 요청 필드에서 휴대폰·이메일 식별값을 물리적으로 제거한다. — 서버 권위는 이미 토큰 회원이며, 이 항목은 계약 축소 후속 작업이다.
- [x] 7. Report revision 복구와 Enforce 원복을 각각 검증한다.

## 필수 테스트

- [ ] A 토큰으로 A의 나의 모임·내예약만 조회된다.
- [ ] A 토큰과 B의 `memberSeq`를 함께 보내도 B 정보는 나오지 않고 `403`이다.
- [ ] 만료·변조·다른 `aud` 토큰은 `401`이다.
- [ ] 로그아웃 브라우저는 개인 API를 호출하지 않거나 `401`을 정상 처리한다.
- [ ] 회원 A→B 전환 시 A 캐시와 진행 중 요청이 즉시 폐기된다.
- [ ] A 생성 2명+B 참여 1명 일정의 3/4명·아이콘·모임장/나·성별구성이 유지된다.
- [ ] 같은 참여 쓰기 재시도는 기존 idempotency ID를 재사용해 중복 행을 만들지 않는다.
- [ ] 비로그인 메인·상품상세·Builder·캘린더에는 회귀가 없다.
- [ ] 개인 응답은 계속 `private, no-store`, 공개 응답은 개인 캐시 헤더가 없다.

## 외부 협의가 필요한 결정

- [ ] Secret Tour 백엔드 담당자와 토큰 엔드포인트 담당 범위를 정한다.
- [ ] 회원의 영구 식별자는 `memberSeq`로 확정한다.
- [ ] 공개키 서명 방식과 키 교체 절차를 확정한다.
- [ ] 정지·탈퇴·강제 로그아웃 시 최대 5분 토큰을 즉시 폐기할 필요가 있는지 결정한다.

이 네 가지가 정해지기 전에는 Cloud Function에 임의의 회원 토큰을 추가하지 않습니다. 형식만 비슷한 토큰을 클라이언트가 스스로 만들게 하면 현재보다 안전해지지 않기 때문입니다.
