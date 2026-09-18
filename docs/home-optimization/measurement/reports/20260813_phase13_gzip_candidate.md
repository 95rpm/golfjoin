# 13단계 gzip 전송 후보 결과

## 현재 단계

- [x] 운영 CSS·JavaScript 사용량 측정
- [x] 위험이 낮은 전송 압축 우선 전략 확정
- [x] gzip 빌드·무결성 계약 구현
- [x] 실제 HTTP gzip PC·MO 검증
- [x] 기존 무압축 경로 회귀검사
- [x] 배포·복구 패키지 생성
- [x] GCS에 gzip 객체 업로드
- [x] PC·MO 원격 MIME·CORS·Content-Encoding·원본 해시 검증
- [x] 실제 Chromium PC·MO에서 원격 gzip SRI·핵심 함수 실행·장애 복구 검증
- [x] 운영 HTML 전환 및 로그인·비로그인 최종 검증

## 초보자용 설명

현재 브라우저는 CSS 853KB와 JavaScript 1.76MB를 압축하지 않은 상태로 받는다. 이번 후보는 코드 내용이나 실행 순서를 바꾸지 않고, 택배 상자를 작게 압축해서 보내고 브라우저가 받은 뒤 원래 내용으로 푸는 방식이다. 따라서 기능 분리보다 위험이 낮으면서 첫 방문 전송량을 크게 줄일 수 있다.

## 운영 실측

| 항목 | PC | MO |
|---|---:|---:|
| 초기 CSS 사용 비율 | 15.3% | 18.3% |
| 초기 JavaScript 실행 비율 | 18.4% | 18.6% |
| 현재 CSS 응답 | identity, 853,185 bytes | identity, 853,185 bytes |
| 현재 JavaScript 응답 | identity, 1,757,171 bytes | identity, 1,757,171 bytes |
| 콘솔 오류 | 0건 | 0건 |

CSS와 JavaScript 모두 초기 진입에서 실제 사용하는 비율은 약 20% 이하이다. 다만 지금 즉시 파일을 기능별로 나누면 전역 함수, 딥링크, 로그인 복귀, 내예약 초기화 순서가 바뀔 수 있으므로 gzip 전송을 먼저 적용한다.

## gzip 후보 결과

| 자산 | 기존 전송 대상 | gzip 전송 대상 | 감소율 |
|---|---:|---:|---:|
| CSS | 853,185 bytes | 101,380 bytes | 88.1% |
| JavaScript | 1,757,171 bytes | 336,600 bytes | 80.8% |
| 합계 | 2,610,356 bytes | 437,980 bytes | 83.2% |

- asset revision: `gha_fa7df4e8e602419ba81a56ed`
- 배포 HTML: `DEPLOY_golfjoin_main_gzip_36B1DC68.html`
- 복구 HTML: `ROLLBACK_golfjoin_main_legacy_AB80599C.html`
- CSS 업로드 파일: `UPLOAD_golfjoin-main_7E985F53.css.gz`
- JavaScript 업로드 파일: `UPLOAD_golfjoin-main_64FD255C.js.gz`

## 안전장치

- [x] gzip 압축을 해제한 CSS 해시가 현재 운영 CSS 해시와 일치한다.
- [x] gzip 압축을 해제한 JavaScript 해시가 현재 운영 JavaScript 해시와 일치한다.
- [x] 브라우저 SRI는 압축 해제된 원본 내용을 검증하도록 기존 값을 유지한다.
- [x] gzip 업로드 바이트의 해시는 GCS 업로드 파일 검증용으로 별도 기록한다.
- [x] gzip 자산은 기존 revision과 다른 불변 URL을 사용한다.
- [x] 외부 자산 실패 안내와 스크롤 잠금 해제 경로를 유지한다.
- [x] 문제가 생기면 `AB80599C` 단일 HTML로 5분 내 복구할 수 있다.

## 검증 결과

```text
전체 단위시험                         108/108 통과
실제 HTTP gzip PC·MO                 2/2 통과
기존 identity 정상·실패 PC·MO        4/4 통과
gzip 패키지 로컬 무결성 검사          통과
GCS 원격 PC·MO Origin 검사             4/4 통과
원격 gzip Chromium 실행·장애 복구       4/4 통과
소스 조립본과 golfjoin_main.html       일치
```

실제 HTTP 시험에서는 브라우저가 CSS 101,380 bytes와 JavaScript 336,600 bytes를 gzip으로 받은 뒤 각각 853,185 bytes와 1,757,171 bytes의 원본으로 정확히 복원했으며 원본 SHA-256도 일치했다.

## 다음 관문

gzip 파일을 신규 불변 경로에 업로드하고 `36B1DC68` HTML을 운영에 적용했다. 원격 HTTP PC·MO Origin 검사 4/4, 배포 전 Chromium 실행·장애 복구 4/4, 배포 후 PC·MO gzip·스크롤·상세·캐시 3/3을 통과했다. 로그인 화면에서도 나의 모임·내 예약·참여중 상세·참여자 표시와 모달 잠금 해제가 정상이며 외부 자산 오류와 잔류 로딩은 0건이다.

critical CSS와 JavaScript 지연 로딩은 gzip 운영 안정화 후 진행한다. 이 순서로 작업하면 압축 효과와 코드 분리 효과를 각각 구분해 검증할 수 있다.
