# 5단계 운영 Shadow 비교 run02 — 신규 모임 생성

## 결론

- [x] A 이용자 신규 모임 생성
- [x] 신규 일정 5→6건 반영
- [x] Legacy와 V2 후보의 다섯 비교 영역 일치
- [x] 누락·추가·필드 불일치 0건
- [x] 일반 브라우저 Shadow 미실행
- [ ] 동일 일정에 B 이용자 참여 후 비교

실제 신규 모임을 생성한 다음 실행한 첫 데이터 변경 표본이 통과했다. Shadow는 비교만 수행했으며 Release V2 root를 발행하거나 교체하지 않았다.

## 실행 결과

| 항목 | 결과 |
|---|---|
| 실행 시각 | `2026-08-11T13:41:07+09:00` |
| source snapshot | `gjs_1aa0830edc235de66c425cfc` |
| static revision | `ghc_aa337bbe9d31f76b7c09effe` |
| live revision | `ghl_e06c7148cd01510b9e4c87cb` |
| family revision | `pfc_549a82879c8323031a3e7f76` |
| availability revision | `gpa_8efb6e29decc5ed8efe8d9c5` |
| valid | `true` |
| issueCount | 0 |
| browserExecuted | `false` |

| 비교 영역 | Legacy | V2 후보 | 누락 | 추가 | 필드 불일치 |
|---|---:|---:|---:|---:|---:|
| 홈 상품 | 150 | 150 | 0 | 0 | 0 |
| 전체 가용 행사 | 11,260 | 11,260 | 0 | 0 | 0 |
| 신규 일정 | 6 | 6 | 0 | 0 | 0 |
| 참여 신청 기반 공개 요약 | 5 | 5 | 0 | 0 | 0 |
| 상품군 | 28 | 28 | 0 | 0 | 0 |

## 신규 일정 6건과 참여 요약 5건의 의미

두 숫자는 같은 대상을 세지 않는다.

- `newSchedules`는 생성된 신규 모임을 센다. 이번 생성으로 5건에서 6건이 됐다.
- Shadow의 `participantSummaries`는 `home_bootstrap_light`가 참여 신청을 기준으로 만든 공개 참여 집계다. 아직 새 모임에 다른 이용자의 참여 신청이 없으므로 5건 유지가 정상이다.
- 물리적인 `schedule_participant_summary` 동기화는 신규 일정 저장 경로에서 필수 재시도 작업으로 별도 수행된다. 이 Shadow 숫자를 물리 시트의 행 개수로 해석하지 않는다.

## 다음 시험

- [ ] B 이용자로 이번 신규 모임에 참여한다.
- [ ] 상품카드와 상세 모달의 현재인원·참여자 아이콘·`나`·`모임장` 표시를 확인한다.
- [ ] Shadow를 다시 실행한다.
- [ ] 다섯 영역의 `missingCount`, `unexpectedCount`, `fieldMismatchCount`가 모두 0인지 확인한다.
