# 4단계 Release manifest V2 배포 전 보고서

## 현재 결론

- [x] 로컬 설계·구현·자동시험 완료
- [x] 기존 고객 화면과 자동 발행 경로 분리 완료
- [ ] Cloud Function 배포
- [ ] 운영 GCS 최초 발행·검증
- [ ] 두 번째 발행과 실제 원격 롤백 검증
- [ ] 4단계 최종 완료

쉽게 말하면 새 데이터 배달 상자와 안전한 교체 장치는 완성했지만, 아직 실제 창고인 운영 GCS에 시험 상자를 놓지는 않은 상태다. 현재 메인페이지는 이 새 상자를 읽지 않으므로 서버를 배포하고 V2를 발행해도 고객 화면 데이터는 기존 경로를 그대로 사용한다.

## 구현한 안전장치

1. 홈 카드, 실시간 모임, 상품군, 가용일, 상품상세 준비 상태를 각각 다른 리비전으로 기록한다.
2. 다섯 객체에 같은 release ID와 원본 snapshot watermark를 넣는다.
3. 객체명에 실제 JSON 내용의 SHA-256을 넣어 내용과 주소가 어긋나지 않게 한다.
4. 버전 객체를 먼저 올리고 원격 bytes·hash·JSON·공통 stamp·Content-Type·Content-Encoding을 모두 다시 읽어 확인한다.
5. 검증된 불변 archive manifest를 올린 뒤 root manifest를 마지막에 바꾼다.
6. root는 GCS generation 조건이 맞을 때만 바뀐다. 동시에 두 발행이 시작되어도 한 건만 성공한다.
7. 롤백도 대상 archive와 다섯 객체를 다시 검증한 뒤 generation 조건으로 전환한다.
8. 계약은 `browserReadEnabled: false`만 허용한다.

## 현재 상세 데이터의 정직한 표시

상품상세 전체 사전 저장은 아직 11단계 작업이다. 4단계 manifest가 이미 상세 스냅샷을 갖춘 것처럼 오해하지 않도록 `detailRevision`과 함께 `legacy-on-demand` 상태의 빈 인덱스를 발행한다. 이는 “상세는 아직 기존 요청 방식”이라는 뜻이지, 상세 정보가 없다는 뜻이 아니다.

## 자동시험 결과

| 검사 | 결과 |
|---|---:|
| Cloud Function 서버 전체 | 88/88 |
| 메인페이지 단위검사 | 44/44 |
| 메인 소스 동일성 | B6D09D1A hash 일치 |
| 동시 두 발행 | 1건 성공·1건 generation 충돌 |
| 누락 객체 | root 교체 전 차단 |
| gzip 메타데이터 | JSON Content-Type·gzip Encoding 통과 |
| 직전 리비전 롤백 | 대상 검증 후 전환 통과 |
| 기존 자동 발행 분리 | 상품업데이트·백그라운드 갱신에서 호출 0건 |
| 현재 브라우저 사용 | V2 URL·관리자 action 참조 0건 |

## 서버에 반영해야 하는 실행 파일

- `index.js`
- `data-contracts.js`
- `release-publisher.js`
- `release-sources.js`
- `contracts/release-manifest-v2.schema.json`
- `contracts/product-availability-index-v1.schema.json`
- `contracts/product-detail-index-v1.schema.json`

테스트 파일과 README는 Cloud Function 실행에 필수는 아니지만, 서버에서 `npm test`를 그대로 실행하려면 함께 두는 편이 안전하다.

## 배포 후 시험 순서

- [ ] 1. 배포 직후 기존 공개 API와 메인페이지를 먼저 확인한다.
- [ ] 2. 관리자 인증으로 `admin_release_v2_status`를 호출해 최초에는 `exists: false`이거나 기존 정상 root인지 확인한다.
- [ ] 3. `admin_release_v2_publish`를 한 번만 호출한다.
- [ ] 4. status를 다시 호출해 `objectCount: 5`, `browserReadEnabled: false`를 확인한다.
- [ ] 5. 메인페이지 네트워크 요청에 `release-manifest-v2.json`이 추가되지 않았는지 확인한다.
- [ ] 6. 원본 live 갱신 뒤 두 번째 publish를 실행해 `previousStableRevision`이 첫 release인지 확인한다.
- [ ] 7. 첫 release로 rollback하고 활성 release·previous·rollbackFrom을 확인한다.
- [ ] 8. 두 번째 release로 다시 rollback해 원래 최신 상태로 복원한다.

4단계 체크박스는 위 원격 시험까지 끝난 뒤에만 완료 처리한다.
