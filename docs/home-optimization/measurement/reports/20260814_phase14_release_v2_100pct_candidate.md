# 14단계 Release V2 비로그인 100% 후보

## 결론

- [x] 현재 50% 운영본에서 적용률 한 줄만 변경
- [x] 100% 후보 HTML `9CE144E0` 생성
- [x] 현재 운영과 같은 복구 HTML `9146A817` 포함
- [x] 로컬 전체 단위검사 145/145 통과
- [x] PC·모바일 최고 유효 bucket `9999` 통과
- [x] 로그인 회원은 기존 회원 경로 유지
- [x] 원격 Gate OFF와 Legacy 복구 경로 유지
- [x] GCS 신규 불변 자산 업로드 및 PC·MO 원격검사 4/4
- [x] eventPlanSeq 22 실제 사이트 검증
- [x] 운영 100% 전환 및 재검증

쉽게 말하면 비로그인 고객의 신규 데이터 경로 적용 대상을 절반에서 전부로 넓히는 후보를 만들었습니다. 화면 기능이나 로그인 이용자의 데이터 흐름은 바꾸지 않았으며, 문제가 생기면 현재 운영본으로 즉시 돌아갈 수 있습니다.

## 변경 범위

| 항목 | 50% 운영 | 100% 후보 |
|---|---:|---:|
| 비로그인 적용 기준 | bucket 0~4999 | bucket 0~9999 |
| 로그인 회원 | 기존 회원 경로 | 기존 회원 경로 |
| 원격 중단 | Gate OFF | Gate OFF |
| Legacy fallback | 유지 | 유지 |
| Product Discovery·상품상세·가용일 코드 | 기존 | 변경 없음 |

100%에서는 유효한 익명 bucket 전체가 대상입니다. 따라서 `bucket 10000`은 실제 사용자에게 생길 수 있는 유효한 비교 대상이 아니며, 기존 50% 때 사용한 “다음 bucket은 비대상” 검사는 제거했습니다. 대신 최고값 `9999`, 로그인 회원 제외, 원격 Gate OFF를 각각 검사합니다.

## 검증 결과

| 검사 | 결과 |
|---|---|
| 소스와 단일 HTML 재조립 | 일치 |
| 적용률 외 코드 변경 | 없음 |
| 전체 단위검사 | 145/145 |
| PC bucket 9999·Gate OFF | 통과 |
| 모바일 bucket 9999·Gate OFF | 통과 |
| 로그인 회원 제외 | 통과 |
| Legacy 감사 | 8개 경로 유지·삭제 후보 0개 |
| JavaScript Brotli | 188,395B·200KiB 이하 |
| 원격 자산 PC·MO Origin | HTTP·MIME·압축·CORS·해시·immutable 4/4 |
| 22번 비로그인 PC·MO 실제 경로 | bucket 9999 2/2 통과·실패 0건 |
| 22번 상품상세 | 이미지 19/19·기간 3개·기간 전환·830px 스크롤 복원 통과 |
| 22번 로그인 회원 경로 | 나의 모임·내예약 3개 탭·참여정보 통과 |
| 외부 자산·콘솔 오류 | 로컬·22번 후보 0건 |

## 배포 파일

- 배포 HTML: `DEPLOY_golfjoin_main_home_data_v2_100pct_9CE144E0.html`
- 즉시 복구 HTML: `ROLLBACK_golfjoin_main_9146A817.html`
- CSS gzip: `UPLOAD_golfjoin-main_7E985F53.css.gz`
- JavaScript Brotli: `UPLOAD_golfjoin-main_17EFE459.js.br`
- 신규 revision: `gha_1cfaac6fd28133e1c6042aa1`

CSS 내용은 현재 운영과 같지만 신규 revision은 CSS와 JavaScript를 한 묶음으로 식별하므로 두 파일을 모두 해당 신규 경로에 업로드합니다.

## 다음 관문

- [x] GCS에 CSS gzip과 JavaScript Brotli 업로드
- [x] PC·모바일 Origin의 HTTP·MIME·압축·CORS·immutable·논리 해시 검사
- [x] eventPlanSeq 22에 후보 HTML 저장
- [x] 비로그인 bucket 9999에서 `V2_RUNNING`, 요청 3건 확인
- [x] 로그인 상태에서 기존 회원 경로와 나의 모임·내예약 확인
- [x] 상품상세 이미지·상품군 기간·스크롤 복원 확인
- [x] eventPlanSeq 3 운영 100% 전환 및 동일 검사 통과

현재 판정: **eventPlanSeq 3 운영 Release V2 비로그인 100% 전환·검증 완료**
