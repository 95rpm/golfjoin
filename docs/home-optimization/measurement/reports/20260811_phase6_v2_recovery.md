# 6-4f Release V2 긴급복구 시험

## 진행 체크리스트

- [x] 시작 Release `gjr_ed4dfaebc393d1d5aa90a5ff`, 익명 1% ON
- [x] `gate-off` 실행
- [x] root `browserReadEnabled=false`, 객체 5개 유지
- [x] PC·MO 버킷 0에서 매니페스트 1건·V2 객체 0건
- [x] PC·MO `LEGACY_READY`, 기존 화면·스크롤 정상
- [x] 직전 Release `gjr_ce2d61076362dd3e8f26c053` rollback
- [x] rollback root·공개 객체·Legacy 화면 확인
- [x] 최신 Release `gjr_ed4dfaebc393d1d5aa90a5ff` 재복원
- [x] 최신 Release 익명 1% ON 재복원

## 원격 OFF 결과

| 항목 | 결과 |
|---|---|
| 명령 | `gate-off` |
| root generation | `1786436872274578` |
| 활성 Release | `gjr_ed4dfaebc393d1d5aa90a5ff` |
| browser gate | `false` |
| PC·MO 검사 | 2/2 통과 |
| 1% 후보 Release 요청 | 매니페스트 1건 |
| V2 객체 요청 | 0건 |
| 최종 상태 | `LEGACY_READY` |

HTML과 Release 객체는 수정하지 않고 root의 원격 gate만 바꿔 즉시 복귀했다.

## 직전 Release rollback 결과

| 항목 | 결과 |
|---|---|
| 명령 | `rollback --target=gjr_ce2d61076362dd3e8f26c053` |
| root generation | `1786437131364466` |
| 활성 Release | `gjr_ce2d61076362dd3e8f26c053` |
| previous stable | `gjr_ed4dfaebc393d1d5aa90a5ff` |
| browser gate | `false` |
| 공개 root | HTTP 200, 활성·직전 리비전 일치 |
| 공개 객체 | 5/5 HTTP 200, bytes·SHA-256 일치 |
| PC·MO 검사 | 2/2 통과 |
| 최종 상태 | `LEGACY_READY` |

root가 가리키는 직전 Release 객체 전체의 무결성과 실제 PC·MO Legacy 복귀를 함께 확인했다. 검사 도중 첫 진단 스크립트가 `objects`를 배열로 잘못 가정해 중단됐으나, 실제 계약 형태인 이름 기반 객체로 교정해 5/5 검사를 완료했다. 운영 데이터나 root에는 영향을 주지 않았다.

## 최신 Release 재복원 결과

| 항목 | 결과 |
|---|---|
| 명령 | `rollback --target=gjr_ed4dfaebc393d1d5aa90a5ff` |
| root generation | `1786437698196280` |
| 활성 Release | `gjr_ed4dfaebc393d1d5aa90a5ff` |
| previous stable | `gjr_ce2d61076362dd3e8f26c053` |
| rollback from | `gjr_ce2d61076362dd3e8f26c053` |
| browser gate | `false` |
| 공개 root 객체 수 | 5개 |
| PC·MO 검사 | 2/2 통과 |
| 최종 상태 | `LEGACY_READY` |

최신 Release로 돌아온 뒤에도 Gate OFF를 유지해 고객 트래픽은 계속 Legacy로 처리됐다. 이제 정확한 최신 리비전에 대해서만 익명 1% Gate를 재적용한다.

## 익명 1% Gate ON 재복원 결과

| 항목 | 결과 |
|---|---|
| 명령 | `gate-on --target=gjr_ed4dfaebc393d1d5aa90a5ff` |
| root generation | `1786437783754399` |
| 활성 Release | `gjr_ed4dfaebc393d1d5aa90a5ff` |
| previous stable | `gjr_ce2d61076362dd3e8f26c053` |
| browser gate | `true` |
| 공개 root 객체 수 | 5개 |
| PC·MO 99% 비대상 | Release 요청 0건 |
| PC·MO 익명 1% | Release 요청 3건, Legacy 핵심 요청 0건 |
| PC·MO 로그인 회원 | Release 요청 0건 |
| 대표이미지·상세·스크롤 | 정상 |
| 확정 V2 전체 렌더 | 1회 |
| 최종 자동검사 | 8/8 통과 |

Gate OFF→직전 Release rollback→최신 Release 재복원→익명 1% Gate ON의 전체 복구 왕복을 실제 운영 root에서 완료했다. HTML과 Cloud Function을 재배포하지 않고도 고객 경로를 즉시 Legacy로 돌리고 다시 제한 V2로 복원할 수 있다.
