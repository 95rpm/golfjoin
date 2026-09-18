# 골프조인 메인 최적화·회원 보안 최종 인수 보고서

작성일: 2026-08-21  
상태: 필수 개발·운영 전환 완료

## 1. 결론

- [x] 최종 계획의 0~15단계를 모두 완료했다.
- [x] 비로그인 Release V2와 Product Discovery를 운영 주 경로로 사용한다.
- [x] 전체 CSS·JavaScript를 압축된 불변 GCS 자산으로 분리했다.
- [x] HOME 일반회원 SMS 인증과 신규가입 휴대폰 인증을 운영 적용했다.
- [x] 카카오 공식 access token을 서버에서 검증해 GolfJoin 회원 세션으로 교환한다.
- [x] 회원 인증 Gate를 `off → report → enforce` 순서로 운영 전환했다.
- [x] 생성·참여·찜 등 쓰기 후 정합성과 참여자 아이콘·배지·인원 합계를 반복 검증했다.
- [x] 운영 서버 작업공간의 임시 배포 파일과 과거 작업 폴더를 정리했다.

쉬운 설명: 공개 상품은 빠른 공개 데이터에서 읽고, 개인 일정은 로그인한 회원만 볼 수 있는 토큰으로 보호한다. 일반회원은 본인 휴대폰 문자, 카카오 회원은 카카오가 발급한 로그인 토큰을 서버가 확인한다. 브라우저가 회원번호만 바꿔 보내서는 다른 회원 데이터를 읽을 수 없다.

## 2. 현재 운영 기준

| 구분 | 현재 값 | 의미 |
|---|---|---|
| 운영 HTML | `57A4BEC1` | Secret Tour 운영 이벤트 페이지에 저장된 메인 HTML |
| GCS 자산 revision | `gha_3075b235e554d023f9db2336` | gzip CSS와 Brotli JavaScript의 불변 경로 |
| 화면 복구 HTML | `7502BFEA` | 화면 또는 자산 회귀 시 즉시 되돌릴 HTML |
| Enforce 서버 | `golfjoin-sheet-api-00231-yuz` | 개인 조회·쓰기에 회원 토큰을 강제하는 현재 서버 |
| Report 복구 서버 | `golfjoin-sheet-api-00230-qid` | 요청을 차단하지 않고 가명 비교만 수행하는 즉시 복구 서버 |
| 회원 인증 스위치 | `GOLFJOIN_MEMBER_AUTH_ENABLED=Y` | 일반회원·카카오 회원 세션 발급 사용 |
| 회원 보호 수준 | `GOLFJOIN_MEMBER_AUTH_GATE=enforce` | 보호 API에서 검증 토큰 필수 |
| 카카오 인증 | `GOLFJOIN_KAKAO_AUTH_ENABLED=Y` | Kakao access token 서버 검증 사용 |
| 허용 Kakao app ID | `906676` | 허용된 카카오 애플리케이션 |

비밀키·토큰·휴대폰·이메일·인증번호 원문은 이 문서와 운영 로그에 기록하지 않는다.

## 3. 회원 인증 최종 구조

### HOME 일반회원

- [x] Secret Tour 아이디·비밀번호 성공 후 ERP 등록 휴대폰을 다시 확인한다.
- [x] 등록 휴대폰으로만 6자리 인증번호를 발송한다.
- [x] 인증번호는 3분 동안 유효하고 최대 5회 입력을 허용한다.
- [x] 성공 시 5분 access token과 최대 24시간 회전형 세션을 발급한다.
- [x] 새로고침은 24시간 세션을 사용하므로 추가 문자를 보내지 않는다.
- [x] 신규가입은 휴대폰 인증을 완료해야 다음 단계로 진행한다.

### 카카오 회원

- [x] 기존 Secret Tour 카카오 로그인 흐름을 유지한다.
- [x] Kakao access token을 GolfJoin 서버가 Kakao 사용자 API로 검증한다.
- [x] 검증된 Kakao 사용자 ID와 Secret Tour 외부회원 ID가 일치할 때만 회원 세션을 발급한다.
- [x] 카카오 회원에게 SMS 인증 화면과 문자를 보내지 않는다.

### 개인 API

- [x] `Authorization: Bearer`의 GolfJoin access token을 검증한다.
- [x] 브라우저가 보낸 memberSeq·memberId·휴대폰보다 검증 토큰 회원을 우선한다.
- [x] 인증 실패 시 과거 무인증 경로로 fallback하지 않는다.
- [x] 허용된 운영 Origin의 무토큰 `member_profile_lookup`은 HTTP 401 `member_token_required`다.
- [x] 개인 응답은 `private, no-store`, 공개 홈 응답은 공개 캐시 정책을 유지한다.

## 4. 운영 회귀 결과

- [x] PC·모바일 비로그인 메인, 상품상세, 스크롤과 위치 복원 정상
- [x] 일반회원 OTP, 새로고침 세션 유지, 기존 프로필, 나의 모임과 내예약 정상
- [x] 카카오 `member_kakao_auth_exchange` 200, SMS 요청 0건, 개인 화면 정상
- [x] 상품상세 참여자 아이콘, 모임장·나 배지, 인원·성별 구성 정상
- [x] 동일 회원의 생성자·동반인 그룹 연결과 내예약 중복 제거 반복 회귀 정상
- [x] 찜 추가·삭제 tombstone 반영과 상품군 상세 정상
- [x] 모달 배경 스크롤 고정·복원과 섹션 내비게이션 상태 정상
- [x] 브라우저 콘솔 신규 Errors·Warnings 0건
- [x] 서버 Stage30c 배포 전 전체 자동검사 357건 중 실패 0건
- [x] Cloud Shell 정리 후 canonical 서버 검사 202건 중 통과 191, 실패 0, 조건부 제외 11

## 5. 확인된 성능 기준

Stage 14 운영 100% 전환 후 동일 조건 5회 측정 기준이다.

| 지표 | PC | 모바일 | 목표 | 판정 |
|---|---:|---:|---:|---|
| Cold LCP p75 | 1,400ms | 1,368ms | 2,500ms 이하 | 통과 |
| Warm LCP p75 | 340ms | 404ms | 2,500ms 이하 | 통과 |
| 실제 클릭 INP p75 | 64ms | 64ms | 200ms 이하 | 통과 |
| 상품군 상세 모달 표시 p75 | 7.4ms | 28.5ms | 100ms 이하 | 통과 |
| 상품군 상세 완료 p75 | 135.5ms | 175.8ms | 1,500ms 이하 | 통과 |
| 첫 기간 전환 p75 | 34.2ms | 40.4ms | 1,000ms 이하 | 통과 |
| 재선택 기간 전환 p75 | 24.6ms | 22.4ms | 250ms 이하 | 통과 |

- [x] 초기 전체 상품 로더 호출 0건
- [x] 일반 상세의 불필요한 `goods_view` 요청 0건
- [x] 모바일 가로 넘침 0px
- [x] 깨진 대표이미지와 페이지 실행 오류 0건

## 6. 장애 시 복구 순서

### 6-1. 회원 인증 문제

먼저 서버 소스 재배포 없이 Report revision으로 트래픽을 전환한다.

```bash
gcloud run services update-traffic golfjoin-sheet-api \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --to-revisions="golfjoin-sheet-api-00230-qid=100"
```

정상 확인 후 Enforce로 원복한다.

```bash
gcloud run services update-traffic golfjoin-sheet-api \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --to-revisions="golfjoin-sheet-api-00231-yuz=100"
```

Report에서도 인증 기능 자체가 문제라면 `stage30-configure-member-auth-gate.py off`로 환경파일을 변경하고 같은 검증 소스를 재배포한다.

### 6-2. 화면 또는 GCS 자산 문제

- [x] 운영 HTML을 `ROLLBACK_golfjoin_main_7502BFEA.html` 내용으로 교체한다.
- [x] 새 revision 객체를 덮어쓰지 않고 HTML이 이전 불변 revision을 가리키게 한다.
- [x] PC·모바일에서 HTTP 200, MIME, Content-Encoding, SRI와 핵심 화면을 확인한다.

### 6-3. 공개 Release 또는 Product Discovery 문제

- [x] 해당 원격 Gate만 OFF로 전환한다.
- [x] 필요하면 Release root를 `previousStableRevision`으로 rollback한다.
- [x] 전체 상품 Legacy fallback은 관측 근거 없이 물리 삭제하지 않는다.

## 7. 의도적으로 남긴 안전망과 선택 작업

- [x] Product Discovery 장애용 전체 상품 fallback 유지
- [x] 회원 딥링크 장애 fallback 유지
- [x] 이전 안정 Release와 Report 서버 revision 유지
- [ ] Secret Tour 세션 쿠키 `HttpOnly`·`Secure`·`SameSite` 보강 검토 — Secret Tour 백엔드 선택 작업
- [ ] 호환용 개인 API 요청의 휴대폰·이메일 필드를 계약에서 물리적으로 제거 — 서버는 이미 토큰 회원을 권위로 사용하므로 별도 축소 작업
- [ ] Legacy 호출 2주 0건을 중앙 관측한 뒤 물리 삭제 여부 재검토 — 사용자가 장기 관찰을 필수 범위에서 제외했으므로 현재는 삭제 금지
- [ ] iPhone Safari, 데이터 절약 모드와 오프라인 전환의 별도 실기기 확대 검사 — 현재 완료된 PC·모바일 Chrome 운영 전환을 막지 않는 추가 품질 작업

## 8. 최종 승인

- [x] 핵심 데이터 불일치 0건
- [x] 다른 회원 개인정보 노출 0건
- [x] 중복 쓰기와 이전 응답 덮어쓰기 회귀 0건
- [x] 성능 목표 악화 없음
- [x] PC·모바일 스크롤과 모든 주요 모달 닫기 정상
- [x] 화면 복구와 서버 Report↔Enforce 왕복 완료
- [x] 운영 담당자가 Gate와 revision 복구 명령을 확인함
- [x] 필수 범위 완료, 이후 항목은 선택 작업으로 분리

## 9. 관련 문서

- `GOLFJOIN_HOME_OPTIMIZATION_FINAL_PLAN.md`
- `docs/home-optimization/STAGE8_MEMBER_AUTH_HANDOFF.md`
- `docs/home-optimization/STAGE15_SMS_MEMBER_AUTH_PLAN.md`
- `docs/home-optimization/STAGE30_MEMBER_AUTH_GATE_ROLLOUT.md`
- `docs/home-optimization/measurement/reports/20260818_phase15_sms_auth_production.md`
- `deploy/stage30-member-auth-gate/legacy-profile-alias-ui-20260821-v30c/manifest.json`

이 보고서 작성은 문서 변경만 포함한다. 운영 HTML, GCS 객체와 Cloud Function을 다시 배포하지 않는다.
