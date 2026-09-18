# 13단계 critical CSS 후보 결과

## 현재 단계

- [x] 운영 PC·MO 초기 CSS 사용 범위 재측정
- [x] 완전한 CSS 규칙 단위 추출기 구현
- [x] 30KB 성능 예산 검증
- [x] 전체 CSS 지연·합류·실패·복구 PC·MO 검사
- [x] 느린 네트워크 PC·MO 각 5회 비교
- [x] 스테이징 배포·즉시 복구 패키지 준비
- [ ] eventPlanSeq 18 실제 게시판 검증
- [ ] 운영 적용 여부 결정

## 초보자용 설명

현재 페이지는 처음 화면을 그리기 전에 전체 CSS 101KB를 모두 기다린다. 후보는 처음 화면에 실제 필요한 CSS 25KB만 HTML 안에 넣고, 나머지 전체 CSS는 뒤에서 동시에 받는다. 사용자는 기본 화면을 먼저 볼 수 있고 상세·내예약 같은 기능이 필요해질 때는 기존 전체 CSS가 이미 합류한 상태가 된다.

JavaScript 내용과 실행 순서, 상품 API, GCS 전체 CSS 주소는 변경하지 않는다.

## 후보 크기

| 항목 | 현재 gzip 운영 | critical 후보 |
|---|---:|---:|
| HTML gzip | 39,846B | 64,975B |
| 첫 화면용 CSS gzip | 전체 101,380B 대기 | 인라인 25,119B |
| 전체 CSS | 차단 stylesheet | 비차단 preload 후 stylesheet 전환 |
| JavaScript gzip | 336,600B | 336,600B, 변경 없음 |

후보 HTML은 25,129B 커지지만 첫 화면이 전체 CSS를 기다리지 않는다.

## 느린 네트워크 비교

조건: 왕복 지연 150ms, 초당 200KB, 캐시 없음, PC·MO 각 5회 중간값.

| 환경 | 현재 FCP | 후보 FCP | 개선 |
|---|---:|---:|---:|
| PC | 1,156ms | 616ms | 540ms, 46.7% |
| MO | 1,156ms | 616ms | 540ms, 46.7% |

페이지 오류는 0건이었다. HTML 증가 때문에 DOMContentLoaded는 약 115ms 늦어졌지만 사용자가 화면을 보는 시점은 약 540ms 빨라졌다.

## 안전장치

- [x] `@media`, 문자열, 주석, 중괄호, keyframes를 잘라내지 않는다.
- [x] 전체 CSS 합류 전후 주요 요소의 위치·스타일 변화가 2px 이내다.
- [x] 모바일 가로 넘침이 없다.
- [x] 전체 CSS 실패 시 빈 화면이나 스크롤 잠금 대신 복구 안내를 표시한다.
- [x] JavaScript 미지원 환경은 `noscript` 전체 stylesheet를 사용한다.
- [x] 현재 운영 `36B1DC68`을 즉시 복구본으로 함께 보관한다.
- [x] 신규 GCS 업로드가 필요하지 않다.

## 고정 파일

- 후보: `DEPLOY_golfjoin_main_critical_1C26028F.html`
- 복구: `ROLLBACK_golfjoin_main_gzip_36B1DC68.html`
- 검토용 CSS: `AUDIT_critical_94D2BB24.css`
- 패키지: `deploy/stage13-home-assets/production-critical-css-20260813`

## 다음 관문

같은 후보를 eventPlanSeq 18에 먼저 적용해 실제 게시판 PC·MO에서 첫 화면, 스크롤, 상품상세, 상품군 기간 변경, 닫기 후 위치 복원과 캐시를 검증한다. 모두 통과하기 전에는 eventPlanSeq 3 운영 HTML을 변경하지 않는다.
