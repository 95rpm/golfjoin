# 9단계 9-1 쓰기 후 정합성 서버 후보

## 진행 체크리스트

- [x] 일정 생성 응답에 최신 공개 일정·참여자 요약 추가
- [x] 참여 신청 응답에 canonical 일정 ID와 최신 공개 참여자 요약 추가
- [x] 관리자 상태변경 응답도 동일한 요약 계약 사용
- [x] 모든 응답 요약을 기존 공개 마스킹 경로로 정제
- [x] 변경 식별용 `mutationRevision` 추가
- [x] 행 저장 후 참여자 요약 실패 시 `writeCommitted` 오류 반환
- [x] 이미 저장된 요청을 Apps Script fallback으로 다시 저장하지 않도록 차단
- [x] 전용 회귀검사 3건 및 서버 전체 112/112 통과
- [ ] Cloud Function 운영 배포
- [ ] 운영 생성·참여 응답 계약 확인

## 초보자용 설명

기존에는 모임 생성이나 참여 신청이 저장되어도 브라우저가 서버의 최신 참여자 집계를 바로 받지 못했습니다. 그래서 브라우저가 자신이 전송한 값으로 화면을 임시 구성한 다음, 늦게 도착한 과거 조회 결과에 다시 덮일 수 있었습니다.

이번 후보는 저장 직후 서버가 다음 값을 함께 돌려주도록 준비합니다.

- 어떤 모임이 바뀌었는지 알려주는 일정 ID
- 현재 몇 명인지와 몇 자리 남았는지
- 화면에 표시할 공개 참여자 아이콘 정보
- 이 값이 언제 갱신됐는지를 나타내는 변경 시각
- `schedule_participant_summary` 동기화 성공 여부

참여자의 전화번호·회원키 같은 원본 개인정보는 반환하지 않습니다. 이미 운영 중인 공개 데이터 마스킹 함수를 통과한 값만 응답에 포함합니다.

## 실패 처리

Google Sheet의 신청 행은 저장됐지만 참여자 요약 갱신이 실패한 경우, 기존 코드는 Apps Script 저장 경로로 넘어갈 수 있었습니다. 같은 요청이 다른 저장 경로에서 다시 처리되면 중복 위험이 생깁니다.

후보에서는 이 상태를 `participant_summary_sync_failed`와 `writeCommitted: true`로 명시하고 fallback 재저장을 중단합니다. 다음 9-2·9-3 작업에서 브라우저가 같은 application ID로 안전하게 재시도하고, 완료되지 않은 동기화를 성공으로 표시하지 않도록 연결합니다.

## 변경 파일

- `server/google-sheet-proxy-function/index.js`
- `server/google-sheet-proxy-function/write-consistency.test.js`

## 검증 결과

- `node --check index.js`: 통과
- `npm test`: 112 passed, 0 failed

