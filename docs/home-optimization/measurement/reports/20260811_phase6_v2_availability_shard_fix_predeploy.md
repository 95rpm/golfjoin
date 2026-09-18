# 6-5 Release V2 상품별 가용일 shard 참조 복구

## 발견 내용

- 운영 Release: `gjr_ed4dfaebc393d1d5aa90a5ff`
- `home-static` 상품 카드: 150개
- `availabilityObjectName` 포함 카드: 0개
- 카드 내부 전체 행사 배열: 0개
- 기존 상품별 GCS shard: 150/150 HTTP 200

카드 기본 표시와 대표 행사 상세는 동작하지만, Release V2 카드가 상품별 전체 출발 가능일 shard의 위치를 알 수 없어 상품군 전체 일정 선택에서 Legacy 우회 또는 일부 대표 일정만 사용할 가능성이 있다.

## 안전 조치

- [x] 운영 익명 1% Gate OFF와 PC·MO Legacy 복귀 2/2 확인
- [x] 새 Release 생성 시 `web/product-availability/{availabilityRevision}/{goodSeq}.json` 주소 생성
- [x] 주소 목록을 `home-static` 리비전 계산에 포함
- [x] 새 Release에 주소가 없거나 리비전·상품코드가 다르면 발행 전에 실패
- [x] 과거 Release의 공용 계약은 강화하지 않아 기존 status·rollback 호환성 유지
- [x] GCS 상품별 shard 150/150 존재 확인
- [x] 서버 전체시험 106/106 통과
- [x] Cloud Function 배포와 Gate OFF PC·MO·공개 홈 API 확인
- [x] Shadow 다섯 영역 불일치 0건과 새 static 리비전 확인
- [x] 새 Release `gjr_518610be0c28e8b5057a7c2e` Gate OFF 발행
- [x] 공개 home-static 참조·실파일 150/150 및 PC·MO 상품군 전체 출발일 검증
- [x] 익명 1% 재활성화와 PC·MO 회귀·성능시험

## 변경 파일

- `server/google-sheet-proxy-function/release-sources.js`
- `server/google-sheet-proxy-function/release-sources.test.js`

HTML, 상품 원본, 상품군 원본은 변경하지 않는다. 상품업데이트와 상품군 업데이트도 다시 실행할 필요가 없다.

## Gate OFF 결과

- root generation: `1786438564179750`
- 활성 Release: `gjr_ed4dfaebc393d1d5aa90a5ff`
- browser gate: `false`
- Release 객체: 5개 유지
- PC·MO: 2/2 `LEGACY_READY`
- V2 객체 요청: 0건

## 서버 배포 후 확인

- 공개 root: `gjr_ed4dfaebc393d1d5aa90a5ff`, Gate OFF, 객체 5개
- PC·MO Legacy: 2/2 통과
- 공개 홈 bootstrap API: HTTP 200
- 신규 일정: 7건
- 참여 요약: 6건
- API warnings: 0건

## Shadow 결과

- comparedAt: `2026-08-11T18:03:11+09:00`
- source snapshot: `gjs_ca51a957cec6f28cba0e9ff9`
- static: `ghc_e466becd6564730ff3e4d08f`
- live: `ghl_a2b92c16322828ce33d28591`
- availability: `gpa_fe152b4555a957ab666566f2`
- 상품 150·가용 행사 10,458·신규 일정 7·참여 요약 6·상품군 28
- 다섯 영역 누락·추가·필드 불일치: 모두 0건
- browserExecuted: `false`

## 새 Release와 공개 객체 검증

- release: `gjr_518610be0c28e8b5057a7c2e`
- previous stable: `gjr_ed4dfaebc393d1d5aa90a5ff`
- root generation: `1786439105547012`
- browser gate: `false`
- Release 객체: 5/5 HTTP 200·bytes·SHA-256 일치
- home-static 카드: 150개
- shard 주소: 150개, 고유 150개, 잘못된 주소 0개
- 카드 내부 전체 행사 배열: 0개
- shard 실파일: 150/150 유효
- shard 전체 행사: 10,458건

## Gate OFF 가상 ON 기능시험

- PC·MO 자동시험: 2/2 통과
- 상품군 shard 전체 로드와 goodSeq 연결: 정상
- 여러 출발일: 정상
- 상세 모달 여행기간 선택 버튼: 2개 이상
- 서로 다른 상품코드: 2개 이상
- 선택 상태: 정확히 1개
- 페이지 오류·Legacy 핵심 중복 요청: 0건

## 실제 익명 1% 최종 결과

- 활성 Release: `gjr_518610be0c28e8b5057a7c2e`
- root generation: `1786439345959990`
- browser gate: `true`
- PC·MO 99% 비대상: Release 요청 0건
- PC·MO 익명 1%: 초기 Release 요청 3건, Legacy 핵심 요청 0건
- PC·MO 로그인 회원: Release 요청 0건
- 상품군 shard 요청·여행기간 선택 UI: 정상
- 대표이미지·상세·스크롤·확정 V2 렌더: 정상
- 실제 운영 기능시험: 8/8 통과

## 최종 Cold/Warm 성능

| 환경 | Cold LCP p75 | Warm LCP p75 | Warm static·live 재다운로드 |
|---|---:|---:|---:|
| PC | 1,824ms | 392ms | 0건 |
| MO | 1,500ms | 396ms | 0건 |

- 각 환경 Cold/Warm 3회 모두 Release 핵심 요청 3건
- Cold Release 전송량: 약 401,932 bytes
- Warm Release 전송량: root 13 bytes, static·live 0 bytes
- Legacy 핵심 중복·페이지 오류·깨진 대표이미지: 모두 0건
- 전 회차 스크롤 가능

## 결론

상품별 가용일 주소 누락을 고객 1%에서 차단한 뒤, 과거 Release 롤백 호환성을 유지하면서 새 발행본에만 필수검사를 적용했다. 수정 Release는 전체 출발일 정확성, 초기 요청 수, 캐시 재사용, LCP와 복구 조건을 모두 통과했으므로 6-5와 6단계를 완료한다.
