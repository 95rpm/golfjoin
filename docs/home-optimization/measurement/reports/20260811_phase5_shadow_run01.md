# 5단계 운영 Shadow 비교 run01

## 결론

- [x] Shadow 단독 비교 통과
- [x] Shadow 실행 전후 root 불변
- [x] Shadow 강제 발행 통과
- [x] 새 root·archive·객체 5개 검증
- [x] 기존 공개 API와 PC·MO 미연결 확인
- [ ] 반복 안정성 조건 충족

첫 운영 표본은 모든 비교 영역에서 누락·추가·필드 불일치 0건을 기록했다. 일반 사용자 브라우저는 Shadow 데이터를 요청하지 않았다.

## Shadow 단독 비교

| 항목 | 결과 |
|---|---:|
| 실행 시각 | `2026-08-11T13:27:05+09:00` |
| source snapshot | `gjs_500ffb785a3427ff308f9996` |
| valid | `true` |
| issueCount | 0 |
| browserExecuted | `false` |

| 비교 영역 | legacy | V2 후보 | 누락 | 추가 | 필드 불일치 |
|---|---:|---:|---:|---:|---:|
| 홈 상품 | 150 | 150 | 0 | 0 | 0 |
| 전체 가용 행사 | 11,260 | 11,260 | 0 | 0 | 0 |
| 신규 일정 | 5 | 5 | 0 | 0 | 0 |
| 참여 요약 | 5 | 5 | 0 | 0 | 0 |
| 상품군 | 28 | 28 | 0 | 0 | 0 |

Shadow 실행 전후 상태:

- root generation: `1786420908109365` 유지
- 활성 리비전: `gjr_d8aea4db552acdda711baaea` 유지
- 직전 정상 리비전: `gjr_fb3ac1f36868bee34415667c` 유지

## Shadow 강제 발행

| 항목 | 결과 |
|---|---|
| 실행 시각 | `2026-08-11T13:29:38+09:00` |
| Shadow valid | `true` |
| Shadow issueCount | 0 |
| 새 활성 리비전 | `gjr_209a10b317ab35d3fc7062aa` |
| 직전 정상 리비전 | `gjr_d8aea4db552acdda711baaea` |
| 새 root generation | `1786422588550358` |
| rootUpdatedLast | `true` |
| 객체 수 | 5 |
| browserReadEnabled | `false` |

발행 Shadow도 홈 상품 150, 전체 가용 행사 11,260, 신규 일정 5, 참여 요약 5, 상품군 28건에서 불일치 0건을 기록했다.

## 발행 후 독립 검증

- [x] root HTTP 200
- [x] 불변 archive HTTP 200 및 root와 일치
- [x] 객체 5개 HTTP 200
- [x] release ID·snapshot watermark 불일치 0건
- [x] `home_bootstrap_light` POST 200
- [x] `home_stats` POST 200
- [x] PC 운영 HTML Release 참조 0건, Shadow 참조 0건
- [x] MO 운영 HTML Release 참조 0건, Shadow 참조 0건

## 다음 표본 조건

같은 데이터를 몇 분 간격으로 반복 호출한 결과만으로 5단계를 완료하지 않는다. 다음 중 하나를 충족할 때 후속 표본을 채택한다.

- [ ] 신규 일정 생성·참여·상품군 변경·상품 업데이트 등 실제 원본 데이터 변화 후 Shadow 비교
- [ ] 실제 데이터 변화가 없다면 최소 7일 동안 정기 비교

후속 표본에서도 핵심 필드·누락·추가·Schema 오류가 모두 0건이어야 5단계 완료를 검토한다.
