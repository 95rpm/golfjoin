# v79 상담대기 선택 기간 및 견적 상세 수정

## 기준 파일

- 수정 전 기준: `stage78-integrated-participant-periods/20260918-v78/DEPLOY_golfjoin_admin_dashboard_43D7F2B1.html`
- 수정 후 루트: `golfjoin_admin_dashboard.html`
- 수정 후 배포본: `DEPLOY_golfjoin_admin_dashboard_BA892377.html`
- 복구본: `ROLLBACK_golfjoin_admin_dashboard_43D7F2B1.html`

수정 전 기준본과 stage78 배포본의 Git blob이 일치하는 것을 확인한 뒤 v79를 만들었습니다.

## 업로드 파일

`/home/llno95ll/golfjoin-admin-hosting`에 아래 3개만 업로드합니다.

- `DEPLOY_golfjoin_admin_dashboard_BA892377.html`
- `ROLLBACK_golfjoin_admin_dashboard_43D7F2B1.html`
- `stage79-consultation-selected-period-quote.test.js`

Cloud Functions 서버 파일, 메인페이지 HTML, CSS/JS, GCS 자산은 이번 배포에 필요하지 않습니다.

## 대시보드 검증·배포

```bash
cd /home/llno95ll/golfjoin-admin-hosting
set -euo pipefail

sha256sum \
  DEPLOY_golfjoin_admin_dashboard_BA892377.html \
  ROLLBACK_golfjoin_admin_dashboard_43D7F2B1.html \
  stage79-consultation-selected-period-quote.test.js

node --test stage79-consultation-selected-period-quote.test.js

cp -f public/index.html BACKUP_pre_stage79_admin_dashboard.html
cp -f DEPLOY_golfjoin_admin_dashboard_BA892377.html public/index.html

sha256sum \
  public/index.html \
  BACKUP_pre_stage79_admin_dashboard.html

firebase deploy \
  --only hosting \
  --project dashboad-golfjoin-secrettour

curl -fsSI https://admin.secret-tour.com/ \
  | grep -iE '^(cache-control|etag|last-modified):'
curl -fsSI https://dashboad-golfjoin-secrettour.web.app/ \
  | grep -iE '^(cache-control|etag|last-modified):'
```

## 운영 확인

1. 상담대기에서 1월 월례회 신청자의 기간 열에 신청한 기간 하나만 표시되는지 확인합니다.
2. 같은 행의 상품명·출발일·도착일이 선택한 ERP 상품과 일치하는지 확인합니다.
3. `견적생성`을 열어 상품명과 도착일이 선택 기간 기준인지 확인합니다.
4. 견적 미리보기에 항공정보, 포함사항, 불포함사항, 참고사항, 일정표가 표시되는지 확인합니다.
5. 다른 기간 신청자와 일반 단일 상품 신청자의 표시가 바뀌지 않았는지 확인합니다.

## 복구

```bash
cd /home/llno95ll/golfjoin-admin-hosting
set -euo pipefail

cp -f ROLLBACK_golfjoin_admin_dashboard_43D7F2B1.html public/index.html

firebase deploy \
  --only hosting \
  --project dashboad-golfjoin-secrettour
```
