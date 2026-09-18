# Secret Tour 회원 토큰 발급 가능 여부 확인 방법

> 상태 변경(2026-08-21): 이 문서는 Secret Tour same-origin 토큰 엔드포인트를 검토하던 당시의 확인서다. 해당 엔드포인트는 현재 운영 필수 경로로 채택하지 않았다. GolfJoin은 HOME 일반회원 SMS 본인확인과 카카오 공식 access token 서버 검증을 통해 회원 세션을 발급하고 `golfjoin-sheet-api-00231-yuz`에서 Gate `enforce`를 완료했다. 아래 항목은 향후 Secret Tour 세션을 직접 통합하거나 쿠키 보안을 보강할 때 사용하는 선택 체크리스트다.

## 현재 직접 확인한 결과

- [x] 2026-08-14 로그인된 운영 Chrome에서 회원 전용 화면이 정상 표시됨
- [x] 제안 주소 `https://www.secret-tour.com/event/web/golfjoin/member-token` 직접 접속
- [x] 현재 결과는 `요청하신 페이지를 찾을 수 없습니다`이며 엔드포인트가 아직 없음
- [x] Secret Tour 공통 JavaScript `front.js`, `com.submit.js`, `com.crypto.js`, `com.events.js`, `ui.js` 응답 확인
- [x] 위 5개 파일에서 JWT·Bearer·Authorization·회원 토큰 코드 0건
- [x] 로그인 성공 응답에서 도메인 세션 쿠키 `MCPC_TOURSOFT` 발급 확인
- [x] 로그인 후 메인 문서가 현재 회원의 `CookieData(userSeq=..., userId=..., userChnCd=...)`를 서버 렌더링하는 것 확인
- [x] 마이페이지 문서도 동일한 세션 회원의 `userSeq`를 서버 렌더링하는 것 확인
- [x] 운영 동작 기준으로 Secret Tour 서버가 세션의 `userSeq`를 읽을 수 있다고 판정
- [x] `GET /member/logout.json` 성공 시 `MCPC_TOURSOFT`를 1970년 만료로 제거하는 것 확인
- [x] 로그아웃 후 메인 문서의 로그인 판정값이 `if ('')`로 비워지는 것 확인
- [x] 로그인 세션 생성·회원번호 렌더링·로그아웃 무효화의 전체 수명주기 확인
- [ ] 백엔드 소스에서 `userSeq`가 요청값이 아니라 검증된 고객 세션에서 나온다는 최종 코드 확인 필요
- [x] 2026-08-14 현재 Secret Tour 백엔드 담당자와 확인·구현 협의가 불가능한 제약 기록

현재 브라우저가 받을 수 있는 회원용 서명 토큰 엔드포인트는 아직 없습니다. 그러나 로그인 성공 시 발급된 `MCPC_TOURSOFT` 쿠키로 다시 요청한 메인·마이페이지 문서가 모두 현재 회원의 `userSeq`를 서버 렌더링하므로, Secret Tour 서버가 고객 세션에서 GolfJoin의 `memberSeq`로 사용할 값을 읽을 수 있다는 점은 운영 동작으로 확인됐습니다. 남은 확인은 이 값을 읽는 공통 백엔드 코드 위치와 토큰 서명 또는 내부 발급 호출 가능 여부입니다.

## 백엔드 협의가 불가능한 현재 결정

Secret Tour 백엔드 담당자 확인과 엔드포인트 추가가 불가능하므로 회원용 서명 토큰 작업은 보류합니다. 이 보류는 메인페이지 성능 최적화 전체를 되돌리는 것이 아니라, 8단계의 “서버 신원 검증” 항목만 완료 처리하지 않는 결정입니다.

현재 유지할 안전장치:

- [x] 로그인 회원별 캐시를 `memberKey + sessionGeneration + dataType`으로 분리
- [x] 로그인 회원이 바뀌면 이전 회원 캐시와 진행 중 요청 무효화
- [x] 개인 응답 `Cache-Control: private, no-store` 유지
- [x] 공개 홈·상품 데이터와 개인 데이터를 분리
- [x] 서버 인증 완료 전 개인 API 통합과 캐시 범위 확대 금지
- [x] 현재 공개·로그인 UI의 기존 fallback 유지

사용하지 않을 우회 방식:

- [x] `MCPC_TOURSOFT` 쿠키 원문을 JavaScript로 읽어 Cloud Function에 전송하지 않음
- [x] Cloud Function이 전달받은 고객 세션 쿠키로 Secret Tour 페이지를 대신 호출하지 않음
- [x] 브라우저의 `CookieData`·`memberSeq`를 서명 없이 인증값으로 승격하지 않음
- [x] 이름·휴대폰의 ERP 존재 확인만으로 회원 토큰을 발급하지 않음
- [x] 관리자 토큰·쓰기 토큰·알림톡 내부 토큰을 회원 인증에 재사용하지 않음

재개 조건은 다음 중 하나입니다.

- [ ] Secret Tour 백엔드 담당자가 기존 고객 세션을 읽는 same-origin 엔드포인트 추가
- [ ] Secret Tour 인프라 담당자가 세션을 검증할 수 있는 안전한 BFF 제공
- [ ] Secret Tour와 별개로 공식 카카오 OAuth를 GolfJoin 서버에 연동하고 회원 매핑 승인

위 조건이 생기기 전에는 현재 클라이언트 식별을 “인증 완료”라고 부르지 않습니다.

## 로그인·마이페이지 Network 증거

확인한 로그인 요청:

```text
POST /member/getMemberExternalLoginCheck.json
→ HTTP 200
→ Set-Cookie: MCPC_TOURSOFT=<redacted>; Domain=secret-tour.com; Path=/
```

로그인 요청에는 외부 로그인 식별자·프로필과 카카오 연동 토큰이 포함되고, Secret Tour 서버가 검증 후 도메인 세션 쿠키를 발급합니다. 토큰 원문과 개인정보 값은 기록하지 않습니다.

그 후 메인 문서와 마이페이지 문서가 모두 다음 형식의 스크립트를 서버 응답 HTML에 포함했습니다.

```text
CookieData(userSeq=<current-member-seq>, userId=<external-member-id>, userNm=<name>, userChnCd=KAKAO)
```

이 값은 브라우저가 마이페이지 요청의 query/body로 다시 보내서 화면에 넣은 값이 아니라, 세션 쿠키가 포함된 문서 요청에 대해 Secret Tour 서버가 응답 HTML을 만들면서 넣은 값입니다. 따라서 다음 매핑을 토큰 계약에 사용합니다.

```text
Secret Tour session userSeq → JWT sub → GolfJoin memberSeq
GolfJoin memberKey          → seq:<sub>
```

`userId`, 이름, 이메일, 휴대폰은 토큰에 넣지 않습니다.

로그아웃 요청도 다음과 같이 확인했습니다.

```text
GET /member/logout.json
→ HTTP 200 application/json
→ Set-Cookie: MCPC_TOURSOFT=""; Domain=secret-tour.com; Expires=Thu, 01-Jan-1970 ...; Path=/
```

로그아웃 후 메인 문서에서는 로그인 판정값이 `if ('')`로 바뀌어 `userSeq`가 더 이상 렌더링되지 않았습니다. 로그인 전환과 로그아웃 무효화가 같은 세션 쿠키를 기준으로 동작한다는 것이 확인됐습니다.

### 함께 발견한 세션 쿠키 보안 확인 항목

제공된 로그인·로그아웃 `Set-Cookie` 헤더에는 `HttpOnly`, `Secure`, `SameSite`가 표시되지 않았습니다. 실제 운영 응답 전체에서도 빠져 있다면 다음을 별도 보안 작업으로 검토합니다.

- [ ] `HttpOnly` 적용 가능 여부 확인 — 브라우저 JavaScript가 세션 쿠키를 읽을 필요가 없다면 적용
- [ ] `Secure` 적용 — HTTPS에서만 쿠키 전송
- [ ] `SameSite=Lax` 우선 검토 — 카카오 로그인·PC/MO 전환 회귀시험 후 확정
- [ ] `www.secret-tour.com`과 `m.secret-tour.com` 로그인 공유가 유지되는지 확인

이 보강은 회원 토큰 기능의 선행 조건은 아니지만, 세션 쿠키가 탈취될 경우 짧은 회원 토큰도 발급받을 수 있으므로 함께 관리해야 합니다. 속성을 한 번에 운영 변경하지 말고 카카오 로그인·로그아웃·PC/MO 전환을 테스트 환경에서 먼저 확인합니다.

## 대시보드 참여자 명단의 회원 확인 방식 조사 결과

- [x] 대시보드가 `admin_erp_member_lookup`에 이름과 휴대폰을 전송하는 경로 확인
- [x] 이 요청이 `X-Golfjoin-Admin-Token`을 요구하는 관리자 전용 요청임을 확인
- [x] Cloud Function이 고객 세션이 아니라 별도 ERP 직원 계정으로 ERP 세션을 만드는 구조 확인
- [x] ERP에서 이름과 휴대폰이 모두 일치하는 한 건만 회원으로 인정하는 로직 확인
- [x] ERP의 `custSeq`가 참여 데이터의 `memberSeq`, `custId`가 `memberId`로 저장되는 경로 확인

현재 동작 순서는 다음과 같습니다.

```text
대시보드 관리자 로그인
  → 이름+휴대폰 입력
  → X-Golfjoin-Admin-Token을 포함해 Cloud Function 호출
  → Cloud Function이 ERP 직원 계정으로 ERP 로그인
  → ERP 고객 목록에서 이름+휴대폰 정확 일치 조회
  → custSeq·custId 반환
  → 참여 데이터의 memberSeq·memberId에 연결
```

관련 코드 위치:

- `golfjoin_admin_dashboard.html`: `postAdminAction()`, `lookupRosterMember()`
- `server/google-sheet-proxy-function/index.js`: `proxyAdminErpMemberLookup()`, `lookupErpMemberExact()`
- `server/google-sheet-proxy-function/index.js`: `buildAdminRosterApplicationPayload()`
- `server/google-sheet-proxy-function/erp-client.js`: ERP 직원 계정 로그인과 서버 세션 관리

### 회원 토큰에 참고할 수 있는 부분

- ERP 조회 결과의 `custSeq`를 Secret Tour의 영구 회원번호 후보로 사용하는 매핑
- 서버가 외부 ERP에 로그인하고 세션 만료 시 한 번 재로그인하는 방식
- 서버에서 짧은 HMAC 서명 토큰을 만들고 만료를 검사하는 관리자 토큰 구현 방식
- `X-Golfjoin-Internal-Token`과 OIDC를 함께 사용하는 Cloud Tasks 서버 간 호출 방식
- 이름과 휴대폰이 모두 정확히 일치할 때만 한 명으로 확정하는 보조 교차검증

### 그대로 재사용하면 안 되는 부분

- 관리자 토큰은 관리 권한 증명이지 고객 본인 증명이 아님
- ERP `JSESSIONID`·`MTBS_COOKIE`는 직원용 조회 세션이지 고객 로그인 세션이 아님
- 브라우저가 보낸 이름과 휴대폰은 다른 사람의 값을 입력할 수 있으므로 본인 인증 증거가 아님
- 관리자 토큰 서명키를 회원 토큰 서명키로 함께 사용하면 권한 경계가 무너짐
- 알림톡 전송용 `GOLFJOIN_INTERNAL_SERVICE_TOKEN`을 회원 발급 API에 그대로 확대하면 한 키의 피해 범위가 커짐
- 현재 관리자 명단의 `memberKey`는 `profile:<profileId>`이므로 회원 토큰의 정규 키 `seq:<memberSeq>`와 목적이 다름

따라서 이 구현은 “회원번호를 ERP에서 어떻게 정확히 찾는가”에는 재사용할 수 있지만, “현재 브라우저 사용자가 누구인가”는 반드시 Secret Tour 고객 로그인 세션이 증명해야 합니다.

## 대시보드 구현을 활용한 현실적인 발급 구조

### 1안: Secret Tour 백엔드가 직접 발급 — 최우선 권장

```text
Secret Tour 고객 로그인 세션
  → 서버가 세션의 userSeq/memberSeq를 직접 읽음
  → 필요할 때만 ERP custSeq와 교차검증
  → 회원 전용 키로 5분 토큰 서명
  → 브라우저에 반환
```

세션에 이미 신뢰할 수 있는 `userSeq/memberSeq`가 있으면 매 토큰 발급 때 ERP를 다시 조회하지 않습니다. ERP 지연이나 장애가 고객 로그인 전체로 번지는 것을 막기 위해서입니다.

### 2안: Secret Tour 백엔드가 내부 발급 서비스를 호출 — 직접 서명이 어려울 때

```text
Secret Tour 고객 로그인 세션
  → 서버가 세션에서 memberSeq를 읽음
  → 브라우저에 공개되지 않은 내부 서비스 인증으로 Cloud Function 호출
  → Cloud Function이 전용 회원 키로 5분 토큰 발급
  → Secret Tour 백엔드가 브라우저에 반환
```

이때 내부 발급 API는 브라우저에서 직접 호출할 수 없어야 하고, 요청의 `memberSeq`는 Secret Tour 서버가 로그인 세션에서 읽은 값이어야 합니다. 기존 관리자 토큰이나 쓰기 토큰을 사용하지 않고 별도 내부 발급 자격증명과 별도 회원 서명키를 사용합니다.

현재 코드에는 알림톡 Cloud Tasks를 위한 서버 간 인증 선례가 이미 있습니다. 따라서 “서버에서만 보관하는 자격증명으로 다른 서비스를 호출한다”는 기술 패턴은 검증된 상태입니다. 다만 기존 알림톡용 `GOLFJOIN_INTERNAL_SERVICE_TOKEN`을 재사용하지 말고 회원 토큰 발급 전용 자격증명으로 분리합니다.

### 금지안

```text
브라우저가 이름·휴대폰·memberSeq 전송
  → ERP에서 존재만 확인
  → 그 회원의 토큰 발급
```

ERP에 존재한다는 사실은 현재 요청자가 본인이라는 뜻이 아니므로 이 구조는 사용하지 않습니다.

## 백엔드 담당자에게 확인할 남은 질문

- [x] 로그인된 요청에서 서버가 현재 회원의 `userSeq`를 세션 기반 문서에 렌더링할 수 있습니까? — 운영 Network로 확인
- [x] 로그아웃 시 같은 세션을 무효화하고 회원번호 렌더링을 중단합니까? — 운영 Network와 메인 HTML로 확인
- [ ] 백엔드 코드에서도 `userSeq`가 요청값이 아니라 검증된 고객 세션에서 직접 나온다고 확인했습니까?
- [ ] 클라이언트가 보낸 `memberSeq` 없이도 로그인 회원번호를 얻을 수 있습니까?
- [ ] JSON을 반환하는 same-origin GET 엔드포인트를 하나 추가할 수 있습니까?
- [ ] 서버 또는 내부 토큰 발급 서비스에서 5분 이내 서명 토큰을 만들 수 있습니까?
- [ ] Secret Tour가 직접 서명하기 어렵다면, 고객 세션에서 읽은 `memberSeq`로 내부 발급 서비스를 서버 대 서버로 호출할 수 있습니까?

운영 Network 기준으로 첫 번째 능력은 확인됐습니다. 나머지 코드 확인과 발급 방식 질문이 모두 “예”라면 직접 발급할 수 있습니다. Secret Tour가 직접 서명하기 어려워도 내부 발급 서비스 호출이 가능하면 진행할 수 있습니다.

- 로그인 세션을 읽을 수 없는 경우: Secret Tour 로그인 모듈 담당자 연동
- JSON 엔드포인트를 추가할 수 없는 경우: 기존 ASP 애플리케이션의 API 라우트 추가 권한
- 서명 라이브러리가 없는 경우: 공개키 JWT 라이브러리 설치 또는 내부 토큰 발급 서비스 호출
- 서버를 수정할 수 없는 경우: 같은 도메인의 BFF를 두고 기존 세션을 BFF가 검증하는 구조

## 가장 빠른 서버 소스 확인 방법

Secret Tour 서버 소스에서 다음 순서로 찾습니다.

1. 상단의 `로그아웃` 링크를 결정하는 공통 헤더 또는 로그인 판정 파일을 찾습니다.
2. 화면에 `CookieData(userSeq=..., userId=...)`를 출력하는 코드를 찾습니다.
3. `userSeq`가 요청 쿼리나 폼이 아니라 서버 세션에서 온 값인지 확인합니다.
4. 같은 코드 위치에서 `memberSeq`만 읽어 JSON으로 반환하는 테스트 엔드포인트를 만들 수 있는지 확인합니다.
5. 테스트 엔드포인트가 브라우저가 보낸 회원번호를 받지 않는지 코드 리뷰합니다.

검색어 예시:

```text
CookieData(
userSeq
Session(
memberSeq
로그아웃
/member/logout
```

합격 예시는 서버 세션에서 회원번호를 읽는 형태입니다.

```text
memberSeq = serverSession.currentMember.memberSeq
```

다음 형태는 불합격입니다.

```text
memberSeq = request.query["memberSeq"]
memberSeq = request.form["memberSeq"]
```

## 백엔드 1차 구현 결과 형식

권장 주소는 PC·모바일에서 모두 상대경로로 호출합니다.

```text
GET /event/web/golfjoin/member-token
```

`MCPC_TOURSOFT`가 `Domain=secret-tour.com`으로 발급되더라도 `www.secret-tour.com`과 `m.secret-tour.com`은 브라우저 origin이 서로 다릅니다. 따라서 HTML에서는 절대 URL을 고정하지 않고 `fetch('/event/web/golfjoin/member-token')`처럼 현재 origin의 상대경로를 사용하고, 두 호스트 모두 같은 엔드포인트를 제공해야 합니다.

로그인 상태의 성공 응답:

```json
{
  "token": "서명된 토큰 원문",
  "expiresIn": 300
}
```

필수 응답 조건:

- [ ] 로그인 상태만 HTTP `200`
- [ ] 로그아웃 상태는 HTTP `401`
- [ ] `Content-Type: application/json`
- [ ] `Cache-Control: private, no-store`
- [ ] 토큰의 `sub`는 서버 세션에서 읽은 숫자형 `memberSeq`
- [ ] `memberKey`는 `seq:<memberSeq>`
- [ ] `iss=secret-tour-member-auth`
- [ ] `aud=golfjoin-sheet-api`
- [ ] `exp - iat`는 최대 300초
- [ ] 휴대폰·이메일·이름·생년·성별은 토큰에 포함하지 않음

로그아웃 응답은 토큰 없이 다음처럼 반환합니다.

```json
{
  "error": "login_required"
}
```

## 초보자용 브라우저 확인 방법

백엔드 담당자가 엔드포인트를 만들었다고 알려준 뒤 아래 순서로 확인합니다.

### 1. 로그인 상태 확인

- [ ] Chrome에서 Secret Tour에 로그인합니다.
- [ ] 주소창에 `https://www.secret-tour.com/event/web/golfjoin/member-token`을 입력합니다.
- [ ] 404 화면이 아니라 JSON이 보이는지 확인합니다.
- [ ] 토큰 원문을 채팅·메신저·문서에 복사하지 않습니다.

### 2. 자동 점검 스크립트 실행

- [ ] Secret Tour 페이지에서 `F12`를 누릅니다.
- [ ] 상단의 `Console` 탭을 엽니다.
- [ ] 아래 파일 전체 내용을 복사해 Console에 붙여넣고 Enter를 누릅니다.

```text
tools/golfjoin-main/check-secret-tour-member-token.browser.js
```

- [ ] 표의 모든 항목이 `통과`인지 확인합니다.
- [ ] 결과의 `ok`가 `true`인지 확인합니다.
- [ ] 이 스크립트는 토큰 원문을 출력하지 않습니다.

Chrome이 Console 붙여넣기를 막으면 안내문에 따라 `allow pasting`을 직접 입력한 후 다시 붙여넣습니다. 출처를 모르는 코드는 붙여넣지 말고, 반드시 저장소의 위 파일과 내용이 같은지 확인합니다.

### 3. 로그아웃 상태 확인

- [ ] Secret Tour에서 로그아웃합니다.
- [ ] 같은 토큰 주소를 다시 엽니다.
- [ ] HTTP `401` 또는 `login_required`가 나오는지 확인합니다.
- [ ] 새 토큰이 발급되지 않는지 확인합니다.

### 4. Network 헤더 확인

- [ ] `F12` → `Network`를 엽니다.
- [ ] 요청 목록을 지우고 토큰 주소를 새로고침합니다.
- [ ] `member-token` 요청을 선택합니다.
- [ ] `Headers`에서 `Content-Type: application/json`을 확인합니다.
- [ ] `Cache-Control`에 `private`와 `no-store`가 모두 있는지 확인합니다.
- [ ] 로그인 상태는 200, 로그아웃 상태는 401인지 확인합니다.

## 선택 경로: Secret Tour same-origin 토큰을 추가할 조건

- [ ] 로그인 성공 응답 자동 검사 `ok: true`
- [ ] 로그아웃 요청 HTTP 401
- [x] 운영 HTML에서 세션 회원의 `userSeq`가 현재 내부 테스트 회원의 `memberSeq`와 일치
- [x] 기존 Secret Tour 로그아웃이 세션 쿠키를 만료시키고 메인 HTML의 회원값을 제거
- [ ] Secret Tour 담당자가 `sub`가 세션의 `userSeq`임을 백엔드 코드로 확인
- [ ] 서명 공개키/JWKS 주소 또는 전용 검증 비밀 전달 방식 확정
- [ ] 키 교체 방법 확정

이 항목들은 향후 Secret Tour가 same-origin 회원 토큰 엔드포인트를 별도로 제공할 때만 사용하는 선택 체크리스트입니다. 해당 엔드포인트는 현재도 404이므로 이 경로의 코드는 배포하지 않습니다. 현재 운영 회원 인증은 HOME 일반회원 SMS와 카카오 공식 access token 검증으로 대체 구현했으며, GolfJoin Cloud Function Gate는 이미 `off → report → enforce` 전환을 완료했습니다.
