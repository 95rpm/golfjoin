# 13단계 JavaScript 축소·Brotli 후보 보고서

## 한눈에 보는 결론

- [x] 현재 운영 `03A74294`는 변경하지 않았다.
- [x] JavaScript의 기존 파일 결합 순서와 최상위 전역 함수 구조를 유지했다.
- [x] `terser@5.50.0`으로 축소한 뒤 Brotli quality 11로 전송한다.
- [x] JavaScript 전송량은 336,658B에서 185,837B로 150,821B 감소했다.
- [x] 200KiB 예산 204,800B보다 18,963B 작다.
- [x] 기존 Critical CSS와 전체 CSS 논리 내용은 변경하지 않았다.
- [x] 복구 HTML은 현재 운영 `03A74294`와 바이트 단위로 동일하다.
- [x] 단위 시험 127/127과 PC·MO 브라우저 시험 4/4를 통과했다.
- [x] 실제 GCS 응답 헤더와 원격 SRI를 확인했다.
- [ ] eventPlanSeq 18에서 로그인·비로그인 핵심 기능을 확인한다.
- [ ] 모든 검증이 끝난 뒤에만 운영 전환 여부를 결정한다.

## 왜 코드 분할보다 이 방법을 먼저 선택했나

가장 큰 JavaScript 파일은 첫 화면, 상품상세, Builder, 캘린더, 딥링크, 전역 함수를 함께 포함한다. 이 파일을 억지로 나누면 함수가 준비되는 시점과 기존 전역 이름이 바뀌어 로그인 복귀, 알림톡 딥링크, 상품상세처럼 서로 연결된 기능이 깨질 위험이 있다.

이번 후보는 코드가 실행되는 순서를 바꾸지 않는다. 사람이 읽기 위한 공백과 긴 내부 변수 표현을 줄이고, 브라우저가 내려받는 전송 파일만 Brotli로 더 작게 만든다. 따라서 목표를 달성하면서도 변경 범위를 최소화한다.

## 측정값

| 항목 | 현재 운영 | 신규 후보 | 차이 |
|---|---:|---:|---:|
| JavaScript 논리 크기 | 1,757,282B | 1,143,145B | -614,137B (-34.9%) |
| JavaScript 전송 크기 | gzip 336,658B | Brotli 185,837B | -150,821B (-44.8%) |
| JavaScript 예산 | 204,800B | 185,837B | 18,963B 여유 |
| 전체 CSS 전송 | gzip 101,380B | gzip 101,380B | 변경 없음 |
| HTML 전송 추정 | gzip 64,977B | gzip 64,977B | 변경 없음 |
| HTML+CSS+JS 합계 | 503,015B | 352,194B | -150,821B (-30.0%) |

## 고정된 산출물

- 자산 revision: `gha_ee9976b2141ade743ceb62b3`
- 18번 배포 후보: `DEPLOY_golfjoin_main_brotli_1E8050D8.html`
- 즉시 복구본: `ROLLBACK_golfjoin_main_critical_03A74294.html`
- CSS 업로드: `UPLOAD_golfjoin-main_7E985F53.css.gz`
- JavaScript 업로드: `UPLOAD_golfjoin-main_9798FA8E.js.br`
- 감사용 논리 JavaScript: `AUDIT_golfjoin-main_E6DD2682.min.js`

## 자동 검증 결과

- [x] 현재 소스 조립본과 `golfjoin_main.html` 일치
- [x] 원본 JavaScript 문법 검사
- [x] 축소 JavaScript 문법 검사
- [x] Brotli 압축 후 논리 JavaScript 100% 복원
- [x] HTML의 새 URL과 SRI 일치
- [x] 기존 Critical CSS 블록 완전 일치
- [x] 복구 HTML과 운영 `03A74294` 완전 일치
- [x] 전체 단위 시험 127/127
- [x] 데스크톱 Chrome 정상 로드
- [x] 모바일 Chrome 정상 로드 및 가로 넘침 없음
- [x] CSS `Content-Encoding: gzip`, JS `Content-Encoding: br` 모의 응답
- [x] JavaScript 503 강제 실패 시 로딩·스크롤 잠금 해제와 복구 안내
- [x] GCS PC·MO Origin HTTP·MIME·CORS·immutable 4/4
- [x] CSS gzip 101,380B와 JS Brotli 185,837B 원격 압축 해시 일치
- [x] 원격 압축 해제 후 CSS·JS 논리 SHA-256 일치
- [x] 실제 GCS 자산을 사용하는 데스크톱·모바일 Chromium SRI·실행 2/2

## 남은 위험과 통제 방법

1. GCS의 Brotli 객체는 항상 `Content-Encoding: br`로 응답한다. 실제 secret-tour 페이지의 PC·모바일 브라우저에서 원격 응답을 반드시 확인한다.
2. 축소 도구가 코드를 변환하므로 로컬 문법 검사만으로 모든 사용자 동작을 증명할 수 없다. eventPlanSeq 18에서 메인, 나의 모임, 내예약, 상품상세, 기간 변경, 딥링크와 스크롤 복원을 다시 확인한다.
3. 문제가 하나라도 있으면 운영 전환하지 않는다. 이미 검증된 `03A74294` 복구본을 사용하며 GCS 객체는 삭제하지 않는다.

## 다음 관문

- [x] 신규 revision에 CSS gzip과 JavaScript Brotli 파일을 선업로드했다.
- [x] HTTP 200, MIME, CORS, immutable, Content-Encoding, 논리 SHA-256을 확인했다.
- [ ] eventPlanSeq 18에 `1E8050D8`을 적용한다.
- [ ] PC 비로그인과 모바일 로그인 핵심 회귀를 확인한다.
- [ ] 첫 진입과 일반 재진입 캐시를 확인한다.
- [ ] 통과 시에만 13-17 완료와 운영 전환 후보 승격을 기록한다.
