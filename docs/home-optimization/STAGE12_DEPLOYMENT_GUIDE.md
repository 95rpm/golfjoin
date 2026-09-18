# 12단계 product-discovery 배포·검증 가이드

이 문서는 개발자가 아닌 운영 담당자도 순서대로 실행할 수 있도록 작성했다. 체크박스를 위에서 아래로 하나씩 완료한다.

## 현재 검증된 결과

- [x] 최종 HTML: `51C943266F25A430514DD87D875AB887B596278B4D927B64B9F87A6E894CE9A8`
- [x] 최종 HTML 크기: `2,874,285 bytes`
- [x] 프런트 단위 테스트: `93/93`
- [x] 서버 원본 테스트: `147/147`
- [x] PC·MO 브라우저 테스트: `12/12`
- [x] 업로드 패키지 14개와 서버 원본의 정규화 SHA-256 일치

## 1. Cloud Shell에 업로드

- [ ] 로컬의 `deploy/stage12-google-sheet-proxy-function` 폴더에 있는 `stage12-*` 파일 14개를 `/home/llno95ll/google-sheet-proxy-function`에 업로드한다.
- [ ] 아래 명령으로 해당 폴더에 14개가 보이는지 확인한다.

```bash
cd /home/llno95ll/google-sheet-proxy-function
ls -1 stage12-*
```

## 2. 업로드 해시 확인과 실제 파일 교체

아래 블록 전체를 한 번에 실행한다. `정상:`이 14개 출력된 뒤에만 실제 파일을 교체한다.

```bash
cd /home/llno95ll/google-sheet-proxy-function

check_hash() {
  actual="$(tr -d '\r' < "$1" | sha256sum | awk '{print $1}')"
  if [ "$actual" != "$2" ]; then
    echo "해시 불일치: $1"
    return 1
  fi
  echo "정상: $1"
}

check_hash stage12-index.js 13ceb6d6f56dd682d10e01bfefdcb063333ed670877ef1ace032591ad39bf5a8 &&
check_hash stage12-data-contracts.js 83ff7e75bf5562cc5b056df30c40e88130e526cd6cb32542b23332a5ba85baae &&
check_hash stage12-product-discovery.js b49306acdf446493dc0d2d5fb9b2fa6b0c517278147ffd510995e5818594df59 &&
check_hash stage12-product-discovery-publication.js 6e184209d6624c14bd9fdc10f9f5e85f78b32a2a8b22230252509ba909fccc89 &&
check_hash stage12-product-discovery-admin-cli.js a5c2e6248da8c75b8d25d2c1dd56e52869d53e3ae46ca57ef9785a093169de56 &&
check_hash stage12-data-contracts.test.js a91103a97ded196838df6bf7258f85939157fe0abe77c2dc7f037dc9d8ecd404 &&
check_hash stage12-product-discovery.test.js 5ad21cc4e0683c08f0b9aae5cf52f9672c19b25988603e5566ac14369997565e &&
check_hash stage12-product-discovery-publication.test.js 242b38754a44206e52f0b1160b7feb82be7be757f67bd5ea4aa0be1147cc26a0 &&
check_hash stage12-product-discovery-admin-cli.test.js 1a4c9866765e8a93514b1d0b5ae072cf8dbcc3737d892cb4e296b7d1d6ce9ebe &&
check_hash stage12-product-discovery-integration.test.js dd4c071cc3d8c781ea2ee313634e55ad5dddc11cdce4d937c5dfe19cde101501 &&
check_hash stage12-product-discovery-manifest-v1.schema.json 320d97f1a8b5bf011e1b71d6785ad7f51de844ece73cc11e95a16581490065c6 &&
check_hash stage12-product-discovery-index-v1.schema.json 1f8a60c8cec6e4d3a5611ffe3e7f1809f4db3d87637eb9a7fa93fd10420e12cd &&
check_hash stage12-product-discovery-lookup-v1.schema.json 987f28368790a825b09bfbb9df41dca591159ad827d56359c21fec4ed385f40e &&
check_hash stage12-product-discovery-month-v1.schema.json f7504aa186f2145adb02ce2c00ff8690484beea1d7308df949ea717cf0b59c8a &&

mkdir -p contracts &&

cp -f stage12-index.js index.js &&
cp -f stage12-data-contracts.js data-contracts.js &&
cp -f stage12-product-discovery.js product-discovery.js &&
cp -f stage12-product-discovery-publication.js product-discovery-publication.js &&
cp -f stage12-product-discovery-admin-cli.js product-discovery-admin-cli.js &&
cp -f stage12-data-contracts.test.js data-contracts.test.js &&
cp -f stage12-product-discovery.test.js product-discovery.test.js &&
cp -f stage12-product-discovery-publication.test.js product-discovery-publication.test.js &&
cp -f stage12-product-discovery-admin-cli.test.js product-discovery-admin-cli.test.js &&
cp -f stage12-product-discovery-integration.test.js product-discovery-integration.test.js &&
cp -f stage12-product-discovery-manifest-v1.schema.json contracts/product-discovery-manifest-v1.schema.json &&
cp -f stage12-product-discovery-index-v1.schema.json contracts/product-discovery-index-v1.schema.json &&
cp -f stage12-product-discovery-lookup-v1.schema.json contracts/product-discovery-lookup-v1.schema.json &&
cp -f stage12-product-discovery-month-v1.schema.json contracts/product-discovery-month-v1.schema.json &&

echo "12단계 서버 파일 교체 완료"
```

## 3. 문법·계약·전체 테스트 후 함수 배포

업로드용 테스트 복사본도 같은 폴더에 있으므로 `npm test`의 통과 건수는 원본 147건보다 많게 보일 수 있다. 실패가 0건인지 확인하는 것이 기준이다.

```bash
cd /home/llno95ll/google-sheet-proxy-function && \
node --check index.js && \
node --check alimtalk.js && \
node --check data-contracts.js && \
node --check product-discovery.js && \
node --check product-discovery-publication.js && \
node --check product-discovery-admin-cli.js && \
node --check release-publisher.js && \
node --check release-sources.js && \
node --check release-admin-cli.js && \
node -e "const fs=require('node:fs'); ['manifest','index','lookup','month'].forEach((name)=>JSON.parse(fs.readFileSync('contracts/product-discovery-'+name+'-v1.schema.json','utf8'))); console.log('product-discovery JSON Schema 검사 완료');" && \
npm test && \
gcloud functions deploy golfjoin-sheet-api \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --timeout=540s \
  --memory=1GiB \
  --allow-unauthenticated \
  --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
```

- [x] `fail 0`을 확인한다.
- [x] Cloud Function 배포 완료를 확인한다.

## 4. 최초 Gate OFF 발행

새 서버 배포 직후에는 아직 discovery root가 없을 수 있다. 대시보드의 `추천일정 > 상품업데이트`를 한 번 실행하면 새 분할 파일을 만들고 root를 OFF 상태로 마지막에 저장한다.

- [ ] 대시보드 `추천일정 > 상품업데이트`를 실행한다.
- [ ] 상품업데이트 성공 알림을 확인한다.
- [ ] 아래 status 명령을 실행한다.

```bash
cd /home/llno95ll/google-sheet-proxy-function
node product-discovery-admin-cli.js status --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
```

정상 기준:

- `exists: true`
- `discoveryRevision: gpd_...`
- `browserReadEnabled: false`
- `eventCount > 0`
- `monthCount > 0`
- `objectCount = monthCount + 2`

## 5. 쓰기 없는 서버 Shadow 확인

```bash
cd /home/llno95ll/google-sheet-proxy-function
node product-discovery-admin-cli.js shadow --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
```

정상 기준:

- `browserExecuted: false`
- `valid: true`
- `issueCount: 0`
- `candidateRevision`과 `rootRevision`이 같음

## 6. 기존 Release V2 동기화

상품업데이트는 Release V2를 자동 발행하지 않는다. 기존 익명 1% 데이터도 최신 상품으로 맞추려면 기존 절차를 그대로 실행한다.

```bash
cd /home/llno95ll/google-sheet-proxy-function
node release-admin-cli.js shadow --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
node release-admin-cli.js publish --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
```

- [ ] Shadow가 `valid: true`, `issueCount: 0`인지 확인한다.
- [ ] Publish 결과의 새 `releaseRevision`을 기록한다.
- [ ] 새 Release는 OFF로 발행되므로 검증 후 기존 `release-admin-cli.js gate-on --target=새_gjr_리비전 ...` 절차로 익명 1%를 다시 켠다.

## 7. HTML 배포

- [ ] 로컬 `golfjoin_main.html`을 이벤트 페이지에 배포한다.
- [ ] 배포 식별자는 SHA-256 앞 8자리인 `51C94326`으로 기록한다.
- [ ] 이 시점까지 product-discovery는 OFF이므로 사용자는 기존 전체 로더로 안전하게 동작한다.

## 8. product-discovery Gate ON

4단계 status에서 받은 정확한 `gpd_...` 값을 `--target`에 넣는다.

```bash
cd /home/llno95ll/google-sheet-proxy-function
node product-discovery-admin-cli.js gate-on \
  --target=gpd_여기에_status의_현재_리비전 \
  --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
```

정상 기준:

- `browserReadEnabled: true`
- `rootUpdatedLast: true`
- `objectCount = monthCount + 2`

## 9. 브라우저 정상 경로 시험

- [ ] 새 탭을 열고 개발자도구 Network의 요청 목록을 지운다.
- [ ] 메인페이지를 일반 새로고침한다. 이때 `product-discovery` 요청은 0건이어야 한다.
- [ ] 요청 목록을 다시 지운 뒤 Builder 또는 출발일 캘린더를 연다.
- [ ] `product-discovery/manifest.json`, `index.json`, 필요한 `months/YYYY-MM.json`만 요청되는지 확인한다.
- [ ] 같은 화면에서 같은 달을 다시 열 때 동일 월 요청이 중복되지 않는지 확인한다.
- [ ] 캘린더 날짜, 상품, 상품상세가 정상인지 확인한다.
- [ ] 동작 시작 후 `golfjoin_local_data.json` 전체 파일 요청이 없는지 확인한다.

## 10. 실전 OFF 복구 후 ON 복원

OFF 시험은 기능이 깨졌을 때 즉시 기존 경로로 돌아갈 수 있는지 확인하는 절차다.

```bash
cd /home/llno95ll/google-sheet-proxy-function
node product-discovery-admin-cli.js gate-off --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
```

- [ ] 새 탭에서 메인페이지를 열고 Builder 또는 캘린더를 연다.
- [ ] discovery root 확인 후 기존 전체 로더로 복구되며 화면 기능이 정상인지 확인한다.
- [ ] 확인 후 같은 `gpd_...` 리비전으로 8단계 `gate-on` 명령을 다시 실행한다.
- [ ] 마지막 status에서 `browserReadEnabled: true`를 확인한다.

## 완료 판정

- [x] 서버 배포 성공
- [ ] 상품업데이트 성공
- [ ] product-discovery Shadow 불일치 0건
- [ ] HTML `51C94326` 배포 성공
- [ ] Gate ON 정상 경로 성공
- [ ] Gate OFF 기존 경로 복구 성공
- [ ] Gate ON 재복원 성공
- [ ] 기존 Release V2 익명 1%도 ON 상태로 복원
