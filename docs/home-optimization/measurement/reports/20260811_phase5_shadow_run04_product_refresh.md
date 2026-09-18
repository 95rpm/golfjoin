# 5단계 운영 Shadow 비교 run04 — 상품업데이트

## 결론

- [x] 대시보드 `추천일정 > 상품업데이트` 실행
- [x] 홈 상품·가용일·상품군 리비전 갱신
- [x] Legacy와 V2 후보의 다섯 비교 영역 일치
- [x] 누락·추가·필드 불일치 0건
- [x] 가용 행사 802건 감소 원인 검증
- [x] 미래 출발 행사 손실 0건
- [x] Shadow 강제 최종 발행
- [x] root·archive·객체 5개 독립 검증
- [x] 공개 API와 PC·MO 미연결 검증
- [x] 5단계 완료

상품업데이트와 상품군 자동 재조정의 실제 변경 표본을 통과했다. 이전보다 줄어든 가용 행사는 모두 새 데이터 생성일 전에 이미 출발한 행사로 확인됐다.

## Shadow 결과

| 항목 | 결과 |
|---|---|
| 실행 시각 | `2026-08-11T13:57:41+09:00` |
| source snapshot | `gjs_7aa260a3fb034e8446df0483` |
| static revision | `ghc_ab265282ab36ec606a95cb3d` |
| live revision | `ghl_f643af2560b2293966b2f920` |
| family revision | `pfc_119bbc9d42644e23f020b520` |
| availability revision | `gpa_fe152b4555a957ab666566f2` |
| valid | `true` |
| issueCount | 0 |
| browserExecuted | `false` |

| 비교 영역 | Legacy | V2 후보 | 누락 | 추가 | 필드 불일치 |
|---|---:|---:|---:|---:|---:|
| 홈 상품 | 150 | 150 | 0 | 0 | 0 |
| 전체 가용 행사 | 10,458 | 10,458 | 0 | 0 | 0 |
| 신규 일정 | 7 | 7 | 0 | 0 | 0 |
| 참여 신청 기반 공개 요약 | 6 | 6 | 0 | 0 | 0 |
| 상품군 | 28 | 28 | 0 | 0 | 0 |

## 가용 행사 감소 독립 검증

상품업데이트 직전 리비전 `gpa_8efb6e29decc5ed8efe8d9c5`와 직후 리비전 `gpa_fe152b4555a957ab666566f2`의 공개 상품별 객체 150개를 대조했다.

| 항목 | 결과 |
|---|---:|
| 이전 행사 | 11,260 |
| 현재 행사 | 10,458 |
| 감소 | 802 |
| 감소 상품 | 142 |
| 건수 유지 상품 | 8 |
| 증가 상품 | 0 |
| 객체 읽기 오류 | 0 |
| 8월 11일 이전 출발 제거 | 802 |
| 8월 11~17일 출발 제거 | 0 |
| 8월 18일 이후 출발 제거 | 0 |
| 새로 추가된 이상 행사 | 0 |

이전 데이터는 8월 4일 생성본이고 새 데이터는 8월 11일 생성본이다. 제거된 날짜 범위도 정확히 8월 4~10일이므로 주간 경과에 따른 과거 일정 정리로 판정한다.

## 최종 발행

| 항목 | 결과 |
|---|---|
| publish 실행 시각 | `2026-08-11T14:06:23+09:00` |
| Shadow valid / issueCount | `true` / `0` |
| 활성 릴리스 | `gjr_fe607f38e58f04129d6a3494` |
| 직전 정상 릴리스 | `gjr_209a10b317ab35d3fc7062aa` |
| root generation | `1786424793351858` |
| rootUpdatedLast | `true` |
| browserReadEnabled | `false` |
| 객체 수 | 5 |

## 독립 발행 검증

- [x] root HTTP 200
- [x] archive HTTP 200 및 root 내용 완전 일치
- [x] 객체 5개 HTTP 200
- [x] 논리 bytes 5/5 일치
- [x] SHA-256 5/5 일치
- [x] release ID 불일치 0건
- [x] snapshot watermark 불일치 0건
- [x] 가용일 객체 GCS 저장 `Content-Encoding: gzip`
- [x] 가용일 논리 9,980,162 bytes, 압축 저장 204,575 bytes
- [x] `home_bootstrap_light` POST 200, 오류 없음
- [x] `home_stats` POST 200, 오류 없음
- [x] PC 운영 페이지 HTTP 200, V2·관리자 Release·Shadow 참조 0건
- [x] MO 운영 페이지 HTTP 200, V2·관리자 Release·Shadow 참조 0건

5단계는 실제 원본 변경을 포함한 반복 Shadow와 최종 발행 검증을 모두 통과했다. 다음 작업은 브라우저 전체 전환이 아니라 6단계의 비로그인 사용자 제한 전환 설계와 안전장치 확인이다.
