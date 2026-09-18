# 13단계 외부 CSS/JS 사전검사 및 후보 빌드 결과

## 현재 결론

- 운영 HTML은 아직 변경하지 않았다.
- 현재 배포본 `EC5C6E23...`과 분할 소스가 바이트 단위로 일치한다.
- 외부 자산 후보는 큰 CSS와 JS를 각각 하나의 고정 버전 파일로 옮기되, JavaScript 실행 위치와 순서는 그대로 유지한다.
- 언제든 `golfjoin_main_legacy.html`을 다시 게시하면 현재 단일 HTML 방식으로 복구할 수 있다.

## 사전검사 체크리스트

- [x] 운영 응답에 `Content-Security-Policy` 헤더가 없음을 확인했다.
- [x] 운영 페이지에서 외부 `<script>`와 `<link rel="stylesheet">`가 이미 실행되고 있음을 확인했다.
- [x] GCS가 `https://www.secret-tour.com` Origin의 GET과 OPTIONS를 허용함을 확인했다.
- [x] 운영 응답에 `X-Content-Type-Options: nosniff`가 있으므로 정확한 CSS/JS MIME이 필수임을 확인했다.
- [x] 실제 GCS Probe 객체의 `Content-Type`, `Cache-Control`, CORS, SRI 실행을 확인한다. — PC·MO Origin에서 정확한 MIME·immutable·CORS를 확인했고, eventPlanSeq 18에서 CSS 적용과 JS `ok: true`를 확인했다.

Google Cloud 공식 문서 기준으로 `gcloud storage cp`는 `--content-type`, `--cache-control`, `--if-generation-match`를 지원한다.

- https://docs.cloud.google.com/sdk/gcloud/reference/storage/cp
- https://docs.cloud.google.com/storage/docs/metadata

## 생성 결과

| 항목 | 현재 단일 HTML | 외부 자산 후보 |
|---|---:|---:|
| HTML | 2,874,808 bytes | 267,744 bytes |
| CSS | HTML 안에 포함 | 853,185 bytes |
| JavaScript | HTML 안에 포함 | 1,756,777 bytes |
| 자산 revision | 없음 | `gha_c27406cf81e361a28044fc29` |
| 원본 복구 파일 | 별도 수동 관리 | `golfjoin_main_legacy.html` 자동 생성 |

실패 안내 안전장치를 포함한 경량 HTML은 약 90.7% 작아졌다. CSS와 JS의 총 논리 크기가 사라진 것은 아니지만, 버전 URL과 immutable 캐시를 사용하므로 재방문에서는 같은 큰 파일을 다시 받을 필요가 없어진다.

## 안전 설계

- [x] 자산 URL에 내용 기반 revision을 넣는다.
- [x] CSS와 JS에 SHA-256 SRI를 넣어 변조·손상 파일 실행을 막는다.
- [x] 새 자산을 먼저 업로드하고 검증한 뒤에만 경량 HTML을 게시한다.
- [x] 현재 단일 HTML 복구본을 같은 산출물 폴더에 둔다.
- [x] 첫 후보에서는 JavaScript를 여러 조각으로 지연 로드하지 않고 현재 순서를 보존한다.
- [x] 실제 GCS Probe를 통과한다. — 원격 SHA-256 2/2 일치, CSS/JS 태그·요청 각 1건, JS revision 일치, 일반 재진입 `transferSize: 0`을 확인했다.
- [x] 테스트 페이지에서 전체 외부 자산 후보를 검증한다. — eventPlanSeq 18의 실제 PC·MO 기능과 재방문 캐시를 통과했다.
- [ ] 운영 전환 후 웜 캐시와 원본 HTML 복구를 검증한다.

## 자동검사 결과

- [x] JavaScript 문법 검사 통과
- [x] 단위 테스트 97/97 통과
- [x] PC Playwright 후보 시험 통과
- [x] MO Playwright 후보 시험 통과
- [x] CSS/JS 요청 각 1회, MIME 일치, 자산 요청 실패 0건
- [x] 페이지 실행 오류 0건

## 남은 순서

- [x] 108-byte Probe CSS와 285-byte Probe JS를 GCS에 업로드한다.
- [x] eventPlanSeq 18 모바일 테스트 페이지에서 SRI 포함 외부 실행을 확인한다.
- [x] 전체 CSS/JS를 불변 URL에 업로드한다. — 원격 크기·SHA-256·MIME·PC/MO CORS·immutable 메타데이터를 2/2 확인했다.
- [x] 경량 HTML을 eventPlanSeq 18에서 PC/MO 검증한다.
- [x] 캐시 재진입을 시험한다. — 동일 브라우저가 페이지를 떠났다가 같은 주소로 재방문할 때 CSS·JS 캐시 사용을 CDP로 확인했다.
- [ ] 원본 HTML 복구를 실제 게시판에서 시험한다. — 사용자가 전체 HTML 제거·복구 시험은 불필요하다고 결정했으므로 자동 생성 복구본과 로컬 검증만 유지한다.
- [ ] 결과가 모두 정상일 때만 운영 페이지 전환 여부를 결정한다.

## 실제 GCS Probe 결과

- 측정 페이지: `https://m.secret-tour.com/event/event_view?eventPlanSeq=18&page=0`
- 자산 revision: `gha_c27406cf81e361a28044fc29`
- CSS: `text/css; charset=utf-8`, 108 bytes, SHA-256 일치
- JavaScript: `application/javascript; charset=utf-8`, 285 bytes, SHA-256 일치
- 캐시: `public, max-age=31536000, immutable`
- CORS: `www.secret-tour.com`과 `m.secret-tour.com` Origin 모두 허용
- 브라우저 결과: CSS revision 실제 적용, JS `{ ok: true }`, 태그·요청 각 1개
- 일반 재진입: CSS·JS 모두 `transferSize: 0`, JS 재실행 정상
- 페이지 영향: 문서 높이 943px, viewport 720px, `bodyOverflow: auto scroll`, 스크롤 가능

## 전체 외부 자산 원격 검증 결과

- [x] CSS 853,185 bytes, SHA-256 `1499dbdb...44c83cb` 일치
- [x] JavaScript 1,756,777 bytes, SHA-256 `12184e1a...3b51a11e` 일치
- [x] CSS `text/css; charset=utf-8`
- [x] JavaScript `application/javascript; charset=utf-8`
- [x] PC·MO Origin CORS 허용
- [x] 두 객체 모두 `public, max-age=31536000, immutable`
- [x] 실제 GCS 자산 정상 실행 PC·MO 2/2
- [x] JavaScript 503 강제 실패 시 안내 표시·오버레이 제거·스크롤 잠금 해제 PC·MO 2/2
- [x] 정상·강제 실패를 합친 브라우저 시험 4/4와 단위 시험 97/97 통과

강제 실패 안전장치는 외부 자산을 즉시 복구할 수 있다는 뜻이 아니다. 빈 화면과 영구 스크롤 잠금을 막고 사용자에게 새로고침을 안내하며, 운영자는 보관된 `golfjoin_main_legacy.html`을 게시해 기존 단일 HTML 방식으로 복구한다.

## eventPlanSeq 18 전체 후보 검증 결과

- [x] 정상 로드에서 실패 안내는 `hidden`, `aria-hidden=true`, `display:none`으로 클릭을 막지 않는다.
- [x] PC와 모바일에서 MD PICK 첫 상품카드가 상품상세 모달을 연다.
- [x] 상품군 여행기간 3개가 표시되고 `3박 5일`에서 `10박 12일`로 변경된다.
- [x] 변경 후 상품명·가격·여행일정·12일 일정표가 함께 갱신된다.
- [x] PC 상세 모달에서 이미지 19개가 렌더링되고 포함·불포함·참고사항·상세일정·시설정보가 표시된다.
- [x] PC는 닫기, 모바일은 뒤로가기로 모달을 닫고 기존 스크롤 위치를 복원한다.
- [x] 같은 브라우저의 실제 재방문에서 외부 CSS·JS가 브라우저 캐시로 제공된다.
- [x] 실제 페이지 최종 자동검사 결과: PC 핵심 동작·PC 재방문 캐시·MO 핵심 동작 3개 통과, MO 중복 캐시 검사는 대표 PC 검사로 생략했다.

검증 중 발견한 문제는 정상 상태의 실패 안내 요소에 인라인 `display:flex`가 있어 HTML `hidden` 속성을 무시하고 전체 화면을 덮던 것이었다. 생성 도구에서 기본값을 `display:none`으로 바꾸고 자산 오류 콜백에서만 `display:flex`로 전환하도록 수정했으며, 이를 단위시험에 고정했다.

## 운영 전환 준비 결과

- [x] 날짜·해시 고정 운영 패키지 `deploy/stage13-home-assets/production-cutover-20260813`을 생성했다.
- [x] 배포 HTML, 복구 HTML, CSS·JS 재업로드 원본, source publication, manifest, 실행서, 사전검사 결과를 한 폴더에 보관했다.
- [x] 복구 HTML `EC5C6E23...`이 현재 정상 `golfjoin_main.html`과 bytes·SHA-256 모두 동일하다.
- [x] 자동검사 `home:assets:verify-production`이 파일 변조, URL·SRI 누락, 실패 안내 노출, 현재 정상본 불일치를 차단한다.
- [x] 원격 포함 검사에서 CSS·JS를 PC·MO Origin으로 각각 다시 받아 HTTP 200, bytes·SHA-256·MIME·CORS·immutable 4/4를 통과했다.
- [x] 전체 단위시험 98/98을 통과했다.
- [x] 운영 전환과 장애 판정, 5분 HTML 단독 복구 절차를 `STAGE13_PRODUCTION_CUTOVER_RUNBOOK.md`에 고정했다.
- [ ] 고객용 eventPlanSeq 3 운영 HTML은 아직 경량 후보로 교체하지 않았다.
