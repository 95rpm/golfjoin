# 6-5 Release V2 상품별 가용일 shard 참조 복구 최종 결과

- 최종 Release: `gjr_518610be0c28e8b5057a7c2e`
- 이전 안정 Release: `gjr_ed4dfaebc393d1d5aa90a5ff`
- static: `ghc_e466becd6564730ff3e4d08f`
- availability: `gpa_fe152b4555a957ab666566f2`
- 운영 상태: 익명 고정 1% ON, 로그인 회원 제외

## 완료 체크리스트

- [x] 누락 시 Gate OFF와 PC·MO Legacy 복귀
- [x] 새 발행본에 상품별 shard 주소 강제
- [x] 과거 Release 롤백 계약 유지
- [x] 서버 전체시험 106/106
- [x] Shadow 다섯 영역 불일치 0건
- [x] Release 객체 5/5 무결성
- [x] 카드·주소·shard 실파일 150/150
- [x] shard 행사 10,458건 연결
- [x] 가상 ON 상품군 UI PC·MO 2/2
- [x] 실제 운영 분기·상세·스크롤 PC·MO 8/8
- [x] 최종 Cold/Warm 각 3회 통과

## 최종 성능

| 환경 | Cold LCP p75 | Warm LCP p75 |
|---|---:|---:|
| PC | 1,824ms | 392ms |
| MO | 1,500ms | 396ms |

Warm static·live 재다운로드, Legacy 핵심 중복, 페이지 오류, 깨진 대표이미지는 모두 0건이다. 모바일 LCP p75는 2.5초 기준을 충족한다.
