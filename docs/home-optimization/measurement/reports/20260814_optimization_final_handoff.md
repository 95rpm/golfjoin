# 골프조인 메인페이지 최적화 최종 인계서

작성일: 2026-08-14  
기준 문서: `GOLFJOIN_HOME_OPTIMIZATION_FINAL_PLAN.md` v3.26

## 1. 결론

- [x] 메인페이지 최적화의 운영 전환 범위를 완료했다.
- [x] 비로그인 사용자는 Release V2를 100% 사용한다.
- [x] 로그인 사용자의 나의 모임·내예약·참여자 정보 최적화를 운영에 반영했다.
- [x] 상품군·상품상세·여행기간·Builder·캘린더·딥링크의 정상 흐름에서 전체 상품 파일을 처음부터 읽지 않는다.
- [x] 문제가 생기면 직전 운영 HTML 또는 Gate OFF 경로로 되돌릴 수 있다.
- [ ] Secret Tour 서버 세션과 Cloud Function 조회 회원을 대조하는 서버 본인 인증은 외부 백엔드 작업이 불가능하여 보류한다.

쉽게 말하면, 사용자가 자주 이용하는 화면은 새롭고 빠른 데이터 경로로 전환됐고, 새 경로가 실패할 때만 기존 경로가 안전망으로 남아 있다. 서버 본인 인증만 Secret Tour 백엔드 수정 권한이 생기기 전에는 정확하게 구현할 수 없다.

## 2. 전체 단계 현황

- [x] 0단계 — 기준 파일 고정과 복구 준비
- [x] 1단계 — 측정 환경·데이터 계약·관측 장치
- [x] 2단계 — 저위험 체감 성능 개선
- [x] 3단계 — 테스트 구조와 빌드 기반
- [x] 4단계 — Release V2 통합 발행 구조
- [x] 5단계 — 기존 데이터와 신규 데이터의 Shadow 비교
- [x] 6단계 — 비로그인 메인 Release V2 전환
- [x] 7단계 — 중앙 Store와 필요한 영역만 다시 그리기
- [ ] 8단계 전체 완료 — 클라이언트 최적화는 완료, 서버 본인 인증만 외부 제약으로 보류
- [x] 9단계 — 생성·참여 직후 인원·아이콘 정합성
- [x] 10단계 — 상품군 전체 가용일
- [x] 11단계 — 상품상세·여행기간·항공 로딩 개선
- [x] 12단계 — 정상 흐름의 전체 상품 의존 제거
- [x] 13단계 — CSS·JavaScript 외부 자산과 경량 HTML
- [x] 14단계 — 단계별 운영 확대와 복구 검증

## 3. 현재 운영 기준과 복구 기준

| 항목 | 현재 기준 | 의미 |
|---|---|---|
| 운영 HTML | `9CE144E0` | Release V2 비로그인 100% 적용본 |
| 운영 자산 revision | `gha_1cfaac6fd28133e1c6042aa1` | 현재 CSS·JavaScript 불변 자산 묶음 |
| 즉시 복구 HTML | `9146A817` | 직전 검증 완료 비로그인 50% 운영본 |
| Release V2 장애 복구 | browser Gate OFF | 새 공개 데이터 읽기를 즉시 끄고 기존 경로 사용 |
| Product Discovery 장애 복구 | 독립 Gate OFF | Builder·캘린더 검색만 기존 전체 상품 경로로 복구 |
| 최후 복구 | Legacy fallback 유지 | 새 경로와 개별 fallback이 모두 실패할 때 사용 |

복구할 때는 한 번에 여러 구조를 바꾸지 않는다. 먼저 문제가 발생한 독립 Gate만 끄고, 해결되지 않을 때 HTML을 `9146A817`로 복구한다. Legacy 코드는 현재 성능 병목이 아니라 장애 안전망이므로 물리 삭제하지 않는다.

## 4. 최종 검증 증거

- [x] Release 통합시험 4/4
- [x] 서버 전체 회귀시험 147/147
- [x] 프런트 전체 단위시험 147/147
- [x] 소스 조립 검사 `match: true`
- [x] Stage 12 Legacy 감사 `valid: true`
- [x] 정상 초기 진입 전체 상품 로더 호출 0건
- [x] Product Discovery 장애 fallback 위치 3곳 확인
- [x] 회원 딥링크 장애 fallback 위치 2곳 확인
- [x] 즉시 삭제 가능한 Legacy 후보 0개
- [x] PC·MO 비로그인 최고 bucket 9999 신규 경로 통과
- [x] 로그인 나의 모임·내예약 3개 탭·참여자·성별·지난 일정 분류 통과
- [x] 상품상세 이미지·여행기간 변경·닫기 후 스크롤 복원 통과
- [x] 운영 핵심 경로의 깨진 이미지·페이지 실행 오류·Legacy 핵심 요청 0건

최종 종료 검증의 기계 판독값:

```text
source bundle match: true
current/source SHA-256: AEDCE6DCB2DAED257F52DB47F1FA0D2DFE478590738C47083D0C195596A4988D
Release V2 rollout: anonymous 100%
initial full-product calls: 0
fallback calls: 5
Legacy paths: 8
immediate deletion candidates: 0
Stage 14 audit failures: 0
```

성능 p75 기준:

| 측정 | PC | 모바일 |
|---|---:|---:|
| cold LCP | 1,400ms | 1,368ms |
| warm LCP | 340ms | 404ms |
| 상품상세 완료 | 135.5ms | 175.8ms |
| 실제 클릭 INP | 64ms | 64ms |

## 5. 의도적으로 남긴 안전장치

- [x] Product Discovery Gate OFF fallback을 유지한다.
- [x] 상품별 조회가 실패할 때 전체 상품 fallback을 유지한다.
- [x] 로그인 복귀 딥링크가 대상 일정을 찾지 못할 때 회원 fallback을 유지한다.
- [x] ERP 원문 해석이 필요한 최후 복구 경로를 유지한다.
- [x] Release V2와 Product Discovery의 Gate를 서로 독립적으로 유지한다.

이 코드는 사용자의 정상 동작에서 실행되지 않는다. 삭제 효과를 증명할 중앙 관측 자료가 없으므로, 삭제보다 장애 복구 가능성을 보존하는 편이 안전하다.

## 6. 외부 권한이 생겼을 때만 재개할 작업

- [ ] Secret Tour same-origin 회원 토큰 엔드포인트 또는 BFF를 구현한다.
- [ ] 토큰의 `sub`를 요청 파라미터가 아니라 서버 세션의 `userSeq`로 발급한다.
- [ ] Cloud Function이 서명·만료·발급자·대상을 검증하고 조회 `memberSeq`와 일치시킨다.
- [ ] 로그아웃 후 토큰 발급 401과 기존 토큰 만료를 확인한다.
- [ ] A 토큰으로 B의 데이터를 요청하는 공격 시험이 401 또는 403인지 확인한다.
- [ ] `MCPC_TOURSOFT`의 `HttpOnly`·`Secure`·`SameSite`는 카카오 로그인 및 PC·MO 회귀환경에서 별도 검토한다.

권한이 없을 때 금지하는 우회 방식:

- [x] Secret Tour 세션 쿠키를 브라우저에서 Cloud Function으로 전달하지 않는다.
- [x] 브라우저가 자기 `memberSeq`를 서명하거나 인증값처럼 보내지 않는다.
- [x] ERP에 회원이 존재한다는 사실만으로 본인 인증하지 않는다.
- [x] 관리자·알림톡·쓰기용 비밀키를 회원 인증에 재사용하지 않는다.

상세 계약은 `docs/home-optimization/STAGE8_MEMBER_AUTH_HANDOFF.md`와 `docs/home-optimization/STAGE8_MEMBER_AUTH_BACKEND_CHECK.md`에 있다.

## 7. 배포 여부

- [x] 이번 최종 정리는 시험 1개와 문서만 변경했다.
- [x] 운영 HTML·Cloud Function 실행 코드·GCS 자산은 변경하지 않았다.
- [x] 따라서 이번 변경 때문에 다시 배포할 파일은 없다.

## 8. 종료 판정

현재 권한과 합의된 범위에서 메인페이지 성능 최적화 작업은 종료할 수 있다. 8단계 서버 인증은 실패나 미완성 구현이 아니라, 안전하지 않은 추측 구현을 막기 위해 외부 연동 전까지 명시적으로 보류한 별도 보안 과제다. 새로운 장애 증거 또는 Secret Tour 백엔드 수정 권한이 생길 때만 해당 과제를 재개한다.
