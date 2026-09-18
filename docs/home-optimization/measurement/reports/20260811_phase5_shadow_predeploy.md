# 5단계 Shadow 데이터 비교 배포 전 보고서

## 현재 결론

- [x] 서버 전용 비교 엔진 구현
- [x] 관리자 전용 Shadow 실행 명령 구현
- [x] publish 전 강제 비교·차단 구현
- [x] 개인정보 없는 보고서 검증
- [x] 로컬 서버 테스트 99/99
- [x] Cloud Function 배포
- [x] 운영 데이터 첫 Shadow 비교
- [x] 반복 비교 안정성 관찰
  - [x] 실제 신규 모임 생성 후 비교
  - [x] 다른 이용자의 참여 신청 후 비교
  - [x] 상품업데이트와 상품군 자동 재조정 후 비교
- [x] 5단계 최종 완료

쉽게 말하면 고객 화면은 계속 기존 데이터를 사용하고, 서버 안에서만 기존 방식과 새 방식의 계산 결과를 나란히 대조한다. 하나라도 다르면 새 발행을 시작하지 않는다.

## 비교 범위

| 영역 | 비교 내용 |
|---|---|
| 홈 상품 | 상품·행사 식별, 가격, 출발일, 귀국일, 상태 |
| 출발 가능일 | 모든 상품의 모든 행사별 가격·날짜·상태 |
| 신규 일정 | 일정 ID, ERP 상품·행사, 현재인원, 남은 자리, 상태, 참여자 공개 프로필 |
| 참여 요약 | 일정 또는 신청 ID, 현재인원, 남은 자리, 참여자 공개 프로필 |
| 상품군 | 상품군, 대표상품, 구성 상품, 대표 행사, 최저가, 최초 출발일, 기간 |

상품상세 전체 데이터는 아직 `legacy-on-demand` 상태이므로 11단계에서 실제 상세 스냅샷이 생긴 뒤 비교한다.

## 안전장치

1. 같은 요청 안에서 한 번 읽은 원본으로 legacy 결과와 V2 후보를 함께 만든다.
2. Shadow 보고서는 원본 ID 대신 16자리 SHA-256 hash만 기록한다.
3. 휴대폰, 이메일, 회원키, 회원번호, 일정 원문 ID, 참여자 표시명은 보고서에 넣지 않는다.
4. 일반 브라우저에는 Shadow 코드와 요청을 추가하지 않는다.
5. publish는 Shadow 결과가 `valid: true`, `issueCount: 0`일 때만 객체 발행 함수를 호출한다.
6. 실패 시 root manifest는 기존 정상 리비전을 유지한다.

## 관리자 명령

데이터를 발행하지 않고 비교만 실행한다.

```bash
node release-admin-cli.js shadow --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
```

정상 기준:

```text
shadow.valid = true
shadow.issueCount = 0
shadow.browserExecuted = false
```

## 서버 업로드 파일

실행 필수:

- `index.js`
- `data-contract-comparison.js`
- `release-shadow.js`
- `release-admin-cli.js`

서버 테스트 권장:

- `data-contract-comparison.test.js`
- `release-shadow.test.js`
- `release-admin-cli.test.js`
- `release-integration.test.js`

문서 동기화 선택:

- `README.md`

## 배포 후 시험 순서

- [x] 1. Cloud Shell에서 문법 검사와 `npm test`를 통과한다.
- [x] 2. Cloud Function을 배포한다.
- [x] 3. 기존 `home_bootstrap_light`, `home_stats` POST가 200인지 확인한다.
- [x] 4. `status`로 현재 활성 리비전이 바뀌지 않았는지 확인한다.
- [x] 5. `shadow`를 실행하고 다섯 비교 영역의 불일치·누락이 0건인지 확인한다.
- [x] 6. Shadow 실행 전후 root generation과 활성 리비전이 같은지 확인한다.
- [x] 7. Shadow가 포함된 publish를 한 번 실행해 root 마지막 교체와 비교 통과 결과를 확인한다.
- [x] 8. 일반 PC·MO HTML의 V2·Shadow 참조가 계속 0건인지 확인한다.
- [x] 9. 충분한 발행 횟수 또는 최소 7일 동안 같은 검사를 반복한다. — 실제 생성·참여·상품 갱신과 최종 발행 표본을 연속 통과했다.
  - [x] 신규 모임 생성 표본: 신규 일정 5→6건, 전체 비교 오류 0건.
  - [x] 동일 모임에 다른 이용자가 참여한 뒤 다시 비교한다. — 참여 요약 5→6건, 2/4명, B 화면 UI 정상.
  - [x] 상품업데이트 뒤 상품·가용일·상품군을 다시 비교한다. — 지난 출발 행사 802건만 정리, 미래 행사 손실 0건.

5단계 완료 체크박스는 운영 비교 안정성 조건까지 충족한 뒤에만 완료 처리한다.
