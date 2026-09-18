# 골프조인 API 분리 배포 및 알림톡 설정 안내

이 문서는 골프조인 서버를 다음 세 서비스로 분리하고, 참여신청·새 모임 생성 알림톡을 Cloud Tasks에서 비동기로 처리하는 운영 절차를 설명합니다.

| 서비스 | 공개 여부 | 주요 역할 | 네트워크 |
| --- | --- | --- | --- |
| `golfjoin-sheet-api` | 공개 | 메인 조회·저장, Cloud Tasks 등록 | 일반 인터넷 연결 |
| `golfjoin-aligo-api` | 비공개 | 알리고 알림톡 전송과 재시도 | 기존 VPC Connector·Cloud NAT |
| `golfjoin-quote-api` | 공개 | 견적 확정 및 PDF 생성 | 일반 인터넷 연결 |

알림톡 처리 흐름은 다음과 같습니다.

1. 이용자의 참여신청 또는 새 모임 생성 정보를 `golfjoin-sheet-api`가 먼저 저장합니다.
2. 저장이 완료되면 메인 API가 Cloud Tasks에 알림 작업을 등록하고 이용자 요청에는 바로 응답합니다.
3. Cloud Tasks가 비공개 `golfjoin-aligo-api`를 OIDC 인증으로 호출합니다.
4. 알림톡 API가 알리고에 1회 요청하며 각 요청 제한시간은 15초입니다.
5. 타임아웃·네트워크 오류·HTTP 5xx에만 5초, 20초, 60초 간격으로 최대 3회 재시도합니다.
6. 알리고의 명확한 거절 응답은 재시도하지 않습니다.
7. 전송 결과는 `alimtalk_delivery_log` 시트에 저장합니다.
8. 동일 신청·알림 유형·수신자 조합은 중복 발송하지 않습니다.

> 최대 3회 재시도는 최초 요청 1회와 재시도 3회를 합쳐 최대 4번의 알리고 요청을 의미합니다.

## 1. 배포 전에 확인할 사항

Cloud Shell에서 다음 경로에 서버 소스 전체가 있어야 합니다.

```bash
/home/llno95ll/google-sheet-proxy-function
```

다음 파일도 서버 소스에 반드시 포함되어야 합니다.

```text
index.js
alimtalk.js
package.json
package-lock.json
```

`gcloud functions deploy --source=.` 명령은 현재 폴더 전체를 업로드하므로 `alimtalk.js`를 별도로 업로드하는 명령은 필요하지 않습니다.

배포 전 검사 명령:

```bash
cd /home/llno95ll/google-sheet-proxy-function
node --check index.js
node --check alimtalk.js
npm test
```

## 2. 공통 변수 설정

먼저 확정된 값만 설정합니다. 아래 네 줄은 그대로 복사해서 실행할 수 있습니다.

```bash
export PROJECT_ID="golfjoin-499602"
export REGION="asia-northeast3"
export TASK_QUEUE="golfjoin-aligo"
export TASK_INVOKER_SA="golfjoin-tasks-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
export VPC_CONNECTOR="golfjoin-vpc-connector"
export NETWORK="default"
```

2026년 7월 31일 확인된 현재 운영 환경은 다음과 같습니다.

```text
VPC Connector: golfjoin-vpc-connector
VPC Network: default
Connector IP 범위: 10.8.0.0/28
Connector 상태: READY
Cloud Router: golfjoin-nat-router
Cloud NAT: golfjoin-nat
고정 IP 리소스: golfjoin-aligo-nat-ip
고정 외부 IP: 34.64.177.32
고정 IP 상태: IN_USE
```

현재 Connector는 별도 Compute Engine 서브넷 이름 대신 Connector 전용 CIDR 범위 `10.8.0.0/28`을 사용합니다. 따라서 이번 배포에서는 `SUBNET`을 설정하지 않고 기존 `golfjoin-vpc-connector`를 그대로 연결합니다.

### 2.1 현재 메인 API의 네트워크 방식 확인

현재 알림톡을 보내던 `golfjoin-sheet-api` 설정을 먼저 확인하는 것이 가장 정확합니다.

```bash
gcloud functions describe golfjoin-sheet-api \
  --gen2 \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="yaml(serviceConfig.vpcConnector,serviceConfig.vpcConnectorEgressSettings)"
```

다음처럼 `vpcConnector`가 표시되면 기존 VPC Connector 방식입니다.

```yaml
serviceConfig:
  vpcConnector: projects/golfjoin-499602/locations/asia-northeast3/connectors/golfjoin-vpc-connector
  vpcConnectorEgressSettings: ALL_TRAFFIC
```

이 경우 마지막 `/` 뒤의 `golfjoin-vpc-connector`가 Connector 이름입니다. Connector가 사용하는 VPC를 확인합니다.

```bash
export VPC_CONNECTOR="golfjoin-vpc-connector"

gcloud compute networks vpc-access connectors describe "${VPC_CONNECTOR}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="yaml(name,network,subnet,ipCidrRange,state)"
```

현재 실제 출력은 다음과 같습니다.

```yaml
ipCidrRange: 10.8.0.0/28
name: projects/golfjoin-499602/locations/asia-northeast3/connectors/golfjoin-vpc-connector
network: default
state: READY
```

따라서 실제 설정값은 다음과 같습니다.

```bash
export VPC_CONNECTOR="golfjoin-vpc-connector"
export NETWORK="default"
```

`subnet`이 출력되지 않은 것은 오류가 아닙니다. Connector 방식 배포에서는 `VPC_CONNECTOR`만 사용하며 `NETWORK`와 `SUBNET`을 배포 명령에 전달하지 않습니다.

### 2.2 Direct VPC 사용 여부 확인

> 현재 운영 환경에서는 실행하지 않습니다. `golfjoin-vpc-connector`와 `ALL_TRAFFIC` 사용이 확인됐기 때문입니다. 이 단계는 2.1 결과에서 `vpcConnector`가 비어 있는 다른 환경에서만 실행합니다.

앞 명령에서 `vpcConnector`가 비어 있다면 기반 Cloud Run 서비스의 Direct VPC 설정을 확인합니다.

```bash
gcloud run services describe golfjoin-sheet-api \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="yaml(spec.template.metadata.annotations)"
```

결과에서 `run.googleapis.com/network-interfaces` 또는 그 안의 `network`, `subnetwork` 값을 찾습니다. 예를 들어 다음과 같다면:

```text
network: golfjoin-vpc
subnetwork: golfjoin-subnet
```

설정값은 다음과 같습니다.

```bash
export NETWORK="golfjoin-vpc"
export SUBNET="golfjoin-subnet"
```

### 2.3 프로젝트의 VPC와 서브넷 목록 확인

> 현재 운영 환경에서는 다시 실행할 필요가 없습니다. Connector의 VPC가 `default`로 확인됐습니다. 이 단계는 Connector 정보를 찾지 못했을 때만 사용합니다.

앞 단계에서 이름을 찾지 못했으면 프로젝트 목록을 확인합니다.

```bash
gcloud compute networks list --project="${PROJECT_ID}"

gcloud compute networks subnets list \
  --regions="${REGION}" \
  --project="${PROJECT_ID}"
```

출력 예시:

```text
NAME              SUBNET_MODE
default           AUTO
golfjoin-vpc      CUSTOM

NAME              REGION           NETWORK         RANGE
golfjoin-subnet   asia-northeast3  golfjoin-vpc    10.10.0.0/24
```

위 예시에서는 같은 행의 `NETWORK`와 `NAME`을 사용합니다.

```bash
export NETWORK="golfjoin-vpc"
export SUBNET="golfjoin-subnet"
```

단순히 목록에 있다는 이유로 임의의 VPC를 선택하면 안 됩니다. 해당 VPC가 알리고에 등록된 고정 외부 IP를 내보내는 Cloud NAT와 연결되어 있어야 합니다.

### 2.4 Cloud NAT와 고정 IP 연결 확인

> 현재 운영 환경은 확인 완료 상태입니다. Router `golfjoin-nat-router`, NAT `golfjoin-nat`, 고정 IP `34.64.177.32`가 확인됐으므로 배포 때마다 다시 실행할 필요가 없습니다.

현재 리전의 Cloud Router를 확인합니다.

```bash
gcloud compute routers list \
  --filter="region~${REGION}" \
  --project="${PROJECT_ID}" \
  --format="table(name,network,region)"
```

알리고용 VPC와 같은 `network`를 사용하는 Router 이름을 선택합니다.

```bash
export ROUTER="golfjoin-nat-router"

gcloud compute routers nats list \
  --router="${ROUTER}" \
  --router-region="${REGION}" \
  --project="${PROJECT_ID}"
```

NAT 이름을 확인한 뒤 상세 정보를 봅니다.

```bash
export NAT_NAME="golfjoin-nat"

gcloud compute routers nats describe "${NAT_NAME}" \
  --router="${ROUTER}" \
  --router-region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="yaml(name,natIps,sourceSubnetworkIpRangesToNat,subnetworks)"
```

- `natIps`: 고정 외부 IP 리소스입니다.
- `sourceSubnetworkIpRangesToNat`: 모든 서브넷을 사용하는지 특정 서브넷만 사용하는지 표시합니다.
- `subnetworks`: 특정 서브넷만 사용하는 경우 실제 대상 서브넷이 표시됩니다.

고정 IP 주소 자체는 다음 명령으로 확인합니다.

```bash
gcloud compute addresses list \
  --filter="region~${REGION}" \
  --project="${PROJECT_ID}" \
  --format="table(name,address,status,region)"
```

현재 확인된 고정 외부 IP는 `34.64.177.32`이며 리소스 이름은 `golfjoin-aligo-nat-ip`, 상태는 `IN_USE`입니다. 이 주소가 알리고에 등록된 허용 IP와 일치해야 합니다.

아무 Router·NAT·고정 IP도 없다면 현재 프로젝트에는 알리고 고정 IP 구성이 없는 것입니다. 이 경우 임의의 `NETWORK`와 `SUBNET`을 입력하지 말고 VPC·Cloud NAT·고정 IP를 먼저 구성해야 합니다.

확인이 어려우면 다음 네 명령의 출력만 전달하면 정확한 값을 판별할 수 있습니다.

```bash
gcloud functions describe golfjoin-sheet-api --gen2 --region="${REGION}" --project="${PROJECT_ID}" --format="yaml(serviceConfig.vpcConnector,serviceConfig.vpcConnectorEgressSettings)"
gcloud compute networks list --project="${PROJECT_ID}"
gcloud compute networks subnets list --regions="${REGION}" --project="${PROJECT_ID}"
gcloud compute routers list --filter="region~${REGION}" --project="${PROJECT_ID}" --format="table(name,network,region)"
```

마지막으로 실제 배포에 사용할 Connector가 설정됐는지 확인합니다.

```bash
echo "VPC_CONNECTOR=${VPC_CONNECTOR}"
```

결과가 `VPC_CONNECTOR=golfjoin-vpc-connector`인지 확인합니다. 비어 있다면 알림톡 API 배포를 진행하지 않습니다.

내부 호출 토큰은 최소 32바이트 이상의 무작위 값으로 한 번 생성합니다.

```bash
openssl rand -hex 32
```

출력된 토큰은 다음 두 파일의 `GOLFJOIN_INTERNAL_SERVICE_TOKEN`에 동일하게 입력합니다.

- `/home/llno95ll/golfjoin-sheet-api.env.yaml`
- `/home/llno95ll/golfjoin-aligo-api.env.yaml`

토큰과 알리고 인증정보는 Git에 커밋하지 않습니다.

## 3. Google Cloud API 활성화

최초 한 번만 실행합니다.

```bash
gcloud services enable \
  cloudtasks.googleapis.com \
  run.googleapis.com \
  cloudfunctions.googleapis.com \
  iamcredentials.googleapis.com \
  compute.googleapis.com \
  --project="${PROJECT_ID}"
```

## 4. Cloud Tasks 큐와 호출용 서비스 계정 생성

큐가 이미 존재하는지 먼저 확인합니다.

```bash
gcloud tasks queues describe "${TASK_QUEUE}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}"
```

`NOT_FOUND`가 표시될 때만 생성합니다.

```bash
gcloud tasks queues create "${TASK_QUEUE}" \
  --location="${REGION}" \
  --max-concurrent-dispatches=5 \
  --max-dispatches-per-second=5 \
  --max-attempts=4 \
  --min-backoff=5s \
  --max-backoff=60s \
  --log-sampling-ratio=1.0 \
  --project="${PROJECT_ID}"
```

이미 기본값으로 큐를 생성해 `maxAttempts: 100`이 표시된다면 다음 명령으로 운영값을 적용합니다.

```bash
gcloud tasks queues update "${TASK_QUEUE}" \
  --location="${REGION}" \
  --max-concurrent-dispatches=5 \
  --max-dispatches-per-second=5 \
  --max-attempts=4 \
  --min-backoff=5s \
  --max-backoff=60s \
  --log-sampling-ratio=1.0 \
  --project="${PROJECT_ID}"
```

Cloud Tasks의 `maxAttempts=4`는 비공개 알림톡 처리 API 호출의 최초 1회와 재시도 3회를 의미합니다. 알리고 서버 요청 자체의 5초·20초·60초 재시도는 `golfjoin-aligo-api` 내부에서 별도로 실행됩니다.

서비스 계정이 이미 존재하는지 확인합니다.

```bash
gcloud iam service-accounts describe "${TASK_INVOKER_SA}" \
  --project="${PROJECT_ID}"
```

존재하지 않을 때만 생성합니다.

```bash
gcloud iam service-accounts create golfjoin-tasks-invoker \
  --display-name="Golfjoin Cloud Tasks invoker" \
  --project="${PROJECT_ID}"
```

## 5. 알림톡 전용 환경변수 파일 작성

새 파일 `/home/llno95ll/golfjoin-aligo-api.env.yaml`을 만듭니다.

```bash
nano /home/llno95ll/golfjoin-aligo-api.env.yaml
```

```yaml
GOLFJOIN_SERVICE_ROLE: "aligo"
GOOGLE_SHEET_ID: "1IGqlOY1hPOoakNqnF5w1hxoBcDSffKmgwU88scLcDQE"
SHEET_WEB_APP_URL: "기존 golfjoin-sheet-api.env.yaml의 동일 값"
GOLFJOIN_INTERNAL_SERVICE_TOKEN: "2단계에서 생성한 내부 토큰"

ALIGO_ENABLED: "Y"
ALIGO_USERID: "기존 알리고 사용자 ID"
ALIGO_APIKEY: "기존 알리고 API 키"
ALIGO_SENDERKEY: "기존 알림톡 발신 프로필 키"
ALIGO_SENDER: "0234461119"
ALIGO_TESTMODE: "N"

ALIGO_REQUEST_TIMEOUT_MS: "15000"
ALIGO_RETRY_DELAYS_MS: "5000,20000,60000"
```

`ALIGO_REQUEST_TIMEOUT_MS`와 `ALIGO_RETRY_DELAYS_MS`는 코드 기본값과 같으므로 생략해도 작동합니다. 운영 설정을 파일에서 바로 확인할 수 있도록 명시하는 것을 권장합니다.

알림톡 전용 서비스가 전송 결과를 Google Sheets에 저장하므로, 런타임 서비스 계정에도 해당 시트 접근 권한이 있어야 합니다. 현재 메인 API와 같은 런타임 서비스 계정을 사용하면 기존 권한을 그대로 이용할 수 있습니다.

## 6. `golfjoin-aligo-api` 최초 배포

알리고가 허용한 고정 IP를 계속 사용해야 하므로 알림톡 전용 서비스에 현재 사용 중인 `golfjoin-vpc-connector`와 전체 트래픽 egress를 적용합니다.

```bash
cd /home/llno95ll/google-sheet-proxy-function

gcloud functions deploy golfjoin-aligo-api \
  --gen2 \
  --runtime=nodejs22 \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --timeout=300s \
  --cpu=1 \
  --memory=1GiB \
  --min-instances=0 \
  --max-instances=3 \
  --concurrency=5 \
  --no-allow-unauthenticated \
  --vpc-connector="${VPC_CONNECTOR}" \
  --egress-settings=all \
  --env-vars-file=/home/llno95ll/golfjoin-aligo-api.env.yaml
```

배포 후 Cloud Run 기본 URL을 가져옵니다. Cloud Tasks 대상에는 `cloudfunctions.net` 주소가 아니라 이 `run.app` 기본 URL을 사용합니다.

```bash
export ALIGO_RUN_URL="$(gcloud run services describe golfjoin-aligo-api \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(status.url)')"

echo "${ALIGO_RUN_URL}"
```

`ALIGO_RUN_URL`은 다음과 비슷한 형식입니다.

```text
https://golfjoin-aligo-api-xxxxxxxxxx-du.a.run.app
```

주소의 임의 문자열은 Google Cloud가 서비스별로 생성하는 정상적인 식별자입니다.

VPC Connector와 Cloud NAT가 기존 알리고 고정 IP를 사용하는지는 배포 전에 반드시 확인합니다. 다른 Connector를 지정하면 알리고가 IP를 거절할 수 있습니다.

## 7. Cloud Tasks 호출 권한 설정

Cloud Tasks 호출용 서비스 계정에 알림톡 서비스 호출 권한을 부여합니다.

```bash
gcloud run services add-iam-policy-binding golfjoin-aligo-api \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${TASK_INVOKER_SA}" \
  --role="roles/run.invoker"
```

메인 API 런타임 서비스 계정을 확인합니다.

```bash
export MAIN_SERVICE_ACCOUNT="$(gcloud functions describe golfjoin-sheet-api \
  --gen2 \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(serviceConfig.serviceAccountEmail)')"

echo "${MAIN_SERVICE_ACCOUNT}"
```

메인 API가 작업을 생성할 수 있도록 권한을 부여합니다.

```bash
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${MAIN_SERVICE_ACCOUNT}" \
  --role="roles/cloudtasks.enqueuer"
```

메인 API가 작업의 OIDC 서비스 계정을 지정할 수 있도록 `actAs` 권한을 부여합니다.

```bash
gcloud iam service-accounts add-iam-policy-binding "${TASK_INVOKER_SA}" \
  --member="serviceAccount:${MAIN_SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountUser" \
  --project="${PROJECT_ID}"
```

Cloud Tasks 서비스 에이전트도 OIDC 토큰을 만들 수 있도록 권한을 부여합니다.

```bash
export PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
export CLOUD_TASKS_SERVICE_AGENT="service-${PROJECT_NUMBER}@gcp-sa-cloudtasks.iam.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding "${TASK_INVOKER_SA}" \
  --member="serviceAccount:${CLOUD_TASKS_SERVICE_AGENT}" \
  --role="roles/iam.serviceAccountUser" \
  --project="${PROJECT_ID}"
```

## 8. 메인 API 환경변수 파일 수정

기존 `/home/llno95ll/golfjoin-sheet-api.env.yaml`의 모든 내용을 유지하고 다음 항목을 추가하거나 교체합니다.

수정 전에 현재 파일을 백업합니다.

```bash
cp /home/llno95ll/golfjoin-sheet-api.env.yaml \
  /home/llno95ll/golfjoin-sheet-api.env.yaml.backup-$(date +%Y%m%d-%H%M%S)

nano /home/llno95ll/golfjoin-sheet-api.env.yaml
```

```yaml
GOLFJOIN_SERVICE_ROLE: "main"
GCP_PROJECT: "golfjoin-499602"
GOLFJOIN_ALIGO_SERVICE_URL: "6단계에서 확인한 ALIGO_RUN_URL"
GOLFJOIN_ALIGO_TASK_QUEUE: "golfjoin-aligo"
GOLFJOIN_ALIGO_TASK_LOCATION: "asia-northeast3"
GOLFJOIN_TASKS_SERVICE_ACCOUNT: "golfjoin-tasks-invoker@golfjoin-499602.iam.gserviceaccount.com"
GOLFJOIN_INTERNAL_SERVICE_TOKEN: "알림톡 API 환경파일과 동일한 내부 토큰"
ALIGO_TASK_DISPATCH_DEADLINE_SECONDS: "300"
```

예시:

```yaml
GOLFJOIN_ALIGO_SERVICE_URL: "https://golfjoin-aligo-api-xxxxxxxxxx-du.a.run.app"
```

> 중요: `--env-vars-file`은 기존 함수의 일반 환경변수를 모두 해당 YAML 내용으로 교체합니다. 위 항목만 들어 있는 새 파일로 배포하면 기존 ERP·시트·관리자·버킷 설정이 사라집니다. 반드시 현재 `golfjoin-sheet-api.env.yaml` 전체 설정에 위 항목을 추가해야 합니다.

메인 API에는 알리고의 `ALIGO_USERID`, `ALIGO_APIKEY`, `ALIGO_SENDERKEY`가 더 이상 필요하지 않습니다. 다만 배포 안정화를 위해 첫 검증이 끝날 때까지 기존 값을 바로 삭제하지 않고 유지해도 됩니다. 실제 전송은 `GOLFJOIN_SERVICE_ROLE=main`에서 실행되지 않습니다.

## 9. `golfjoin-sheet-api` 재배포

```bash
cd /home/llno95ll/google-sheet-proxy-function

node --check index.js && \
node --check alimtalk.js && \
npm test && \
gcloud functions deploy golfjoin-sheet-api \
  --gen2 \
  --runtime=nodejs22 \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --timeout=540s \
  --memory=1GiB \
  --allow-unauthenticated \
  --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
```

메인 API의 VPC 연결을 제거하려면 다른 기능에서 고정 IP를 사용하지 않는지 먼저 확인한 뒤 배포 명령에 `--clear-vpc-connector`를 추가합니다. 확인 없이 제거하지 않습니다.

이번 변경은 서버 기능이므로 Firebase Hosting 재배포는 필수가 아닙니다. 관리자 화면이나 메인 HTML 변경도 함께 배포할 때만 기존 Hosting 배포 명령을 이어서 실행합니다.

```bash
cd /home/llno95ll/golfjoin-admin-hosting
firebase deploy --only hosting
```

## 10. 이후 서버 코드를 한 번에 재배포하는 명령

최초 설정과 IAM 구성이 끝난 뒤 서버 코드를 갱신할 때는 알림톡 API와 메인 API를 같은 소스로 차례대로 배포합니다.

```bash
cd /home/llno95ll/google-sheet-proxy-function && \
node --check index.js && \
node --check alimtalk.js && \
npm test && \
gcloud functions deploy golfjoin-aligo-api \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --timeout=300s \
  --cpu=1 \
  --memory=1GiB \
  --min-instances=0 \
  --max-instances=3 \
  --concurrency=5 \
  --no-allow-unauthenticated \
  --vpc-connector="${VPC_CONNECTOR}" \
  --egress-settings=all \
  --env-vars-file=/home/llno95ll/golfjoin-aligo-api.env.yaml && \
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

Cloud Shell을 새로 열면 `VPC_CONNECTOR` 환경변수가 초기화됩니다. 위 명령 전에 `export VPC_CONNECTOR="golfjoin-vpc-connector"`를 다시 실행하거나 실제 이름을 명령에 직접 입력해야 합니다.

## 11. 배포 후 확인 절차

### 11.1 함수 상태 확인

```bash
gcloud functions describe golfjoin-sheet-api \
  --gen2 \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --format="yaml(state,updateTime,serviceConfig.uri)"

gcloud functions describe golfjoin-aligo-api \
  --gen2 \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --format="yaml(state,updateTime,serviceConfig.uri)"
```

두 함수 모두 `state: ACTIVE`여야 합니다.

### 11.2 큐 상태 확인

```bash
gcloud tasks queues describe golfjoin-aligo \
  --location=asia-northeast3 \
  --project=golfjoin-499602
```

큐 상태가 `RUNNING`이어야 합니다.

### 11.3 실제 참여신청 또는 새 모임 생성 확인

테스트 계정으로 한 번만 신청합니다.

메인 API 응답의 `notifications`에 다음 형태가 있으면 Cloud Tasks 등록이 완료된 것입니다.

```json
[
  {
    "queued": true,
    "reason": "notification_queued"
  }
]
```

같은 신청 ID로 작업이 이미 만들어진 경우 다음처럼 표시될 수 있으며 정상적인 중복 차단입니다.

```json
[
  {
    "queued": true,
    "duplicate": true,
    "reason": "notification_already_queued"
  }
]
```

### 11.4 알림톡 함수 로그 확인

```bash
gcloud functions logs read golfjoin-aligo-api \
  --gen2 \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --limit=100
```

정상 처리 시 `golfjoin alimtalk completed` 로그가 표시됩니다.

재시도 시 `Retrying Alimtalk delivery` 로그에 다음 시도 번호와 지연시간이 기록됩니다.

### 11.5 Google Sheets 기록 확인

첫 알림 처리 시 `alimtalk_delivery_log` 시트가 자동 생성됩니다.

주요 상태:

| 상태 | 의미 |
| --- | --- |
| `processing` | 현재 전송 처리 중 |
| `sent` | 정상 전송 완료 |
| `rejected` | 알리고의 명확한 거절로 재시도 없이 종료 |
| `failed` | 네트워크·타임아웃·5xx 재시도를 모두 소진했거나 큐 설정 실패 |
| `skipped` | 수신번호 없음 또는 알리고 설정 없음 |

주요 확인 열:

- `notificationId`: 동일 신청 중복 발송 방지 키
- `applicationId`: 신청 식별자
- `notificationType`: 생성·참여·모집완료 등 알림 유형
- `receiverMasked`: 마스킹된 수신번호
- `attemptCount`: 최초 요청을 포함한 전체 요청 횟수
- `retryCount`: 재시도 횟수
- `lastError`: 최종 실패 사유
- `providerCode`, `providerMessage`: 알리고 응답 코드와 메시지
- `sentAt`, `failedAt`: 최종 처리 시각

예상 결과:

- 첫 요청 성공: `attemptCount=1`, `retryCount=0`, `status=sent`
- 명확한 거절: `attemptCount=1`, `retryCount=0`, `status=rejected`
- 세 번 재시도 후 실패: `attemptCount=4`, `retryCount=3`, `status=failed`
- 이미 전송 완료된 동일 알림: 새 행을 추가하지 않고 기존 `notificationId`를 기준으로 발송 차단

## 12. 자주 발생하는 오류

### `aligo Cloud Tasks service URL is not configured`

메인 환경변수의 `GOLFJOIN_ALIGO_SERVICE_URL`이 없거나 잘못된 상태입니다. `golfjoin-aligo-api`의 `run.app` 기본 URL을 입력하고 메인 API를 재배포합니다.

### `Cloud Tasks notification queue is not fully configured`

다음 값 중 하나가 누락된 상태입니다.

```text
GOLFJOIN_ALIGO_TASK_QUEUE
GOLFJOIN_TASKS_SERVICE_ACCOUNT
Google Cloud 자동 프로젝트 ID
```

### Cloud Tasks 등록 시 `403 PERMISSION_DENIED`

다음을 확인합니다.

- 메인 런타임 서비스 계정의 `roles/cloudtasks.enqueuer`
- 메인 런타임 서비스 계정이 `TASK_INVOKER_SA`에 가진 `roles/iam.serviceAccountUser`
- Cloud Tasks 서비스 에이전트가 `TASK_INVOKER_SA`에 가진 `roles/iam.serviceAccountUser`

### 알림톡 서비스 호출 시 `401` 또는 `403`

다음을 확인합니다.

- `TASK_INVOKER_SA`에 `golfjoin-aligo-api`의 `roles/run.invoker` 권한 존재
- 두 환경파일의 `GOLFJOIN_INTERNAL_SERVICE_TOKEN` 값 일치
- `GOLFJOIN_ALIGO_SERVICE_URL`이 Cloud Run 기본 `run.app` URL인지 확인

### 알리고가 발신 IP를 거절함

`golfjoin-aligo-api`가 기존 알리고 허용 IP를 사용하는 VPC·서브넷·Cloud NAT에 연결됐는지 확인합니다. 메인 API IP가 아니라 알림톡 전용 API의 실제 외부 발신 IP가 알리고에 등록되어야 합니다.

### `alimtalk_delivery_log`가 생성되지 않음

알림톡 전용 함수의 런타임 서비스 계정에 Google Sheet 접근 권한이 있는지, `GOOGLE_SHEET_ID`가 정확한지 확인합니다.

## 13. 견적 API 참고

견적 PDF 부하 분리를 유지하는 경우 `golfjoin-quote-api`는 기존 방식대로 별도 배포합니다. 이번 알림톡 변경 때문에 견적 API 환경변수를 수정하거나 재배포할 필요는 없습니다.

```bash
cd /home/llno95ll/google-sheet-proxy-function

gcloud functions deploy golfjoin-quote-api \
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
  --env-vars-file=/home/llno95ll/golfjoin-quote-api.env.yaml
```

## 14. 롤백

알림톡 전용 서비스에 문제가 발생한 경우 이전 `golfjoin-aligo-api` 리비전으로 트래픽을 되돌립니다. 메인 API에서 동기 전송이나 로컬 백그라운드 전송으로 자동 우회하지 않으므로, 실패한 작업은 `alimtalk_delivery_log`에서 확인한 뒤 원인 해결 후 관리자가 다시 처리해야 합니다.

Cloud Tasks 구성을 완전히 중단하려면 메인 API에서 관련 환경변수를 삭제하기 전에 알림톡 발송이 중단된다는 점을 확인해야 합니다. 설정 누락 상태에서는 이용자 신청 저장은 완료되지만 알림톡은 발송되지 않고 실패 기록만 남습니다.

## 공식 참고 문서

- [Cloud Tasks HTTP 대상과 OIDC 인증](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks)
- [Cloud Tasks 작업 생성과 중복 제거](https://docs.cloud.google.com/tasks/docs/create-tasks)
- [Cloud Run 비동기 작업 호출](https://docs.cloud.google.com/run/docs/triggering/using-tasks)
- [Cloud Functions Gen2 배포 명령](https://docs.cloud.google.com/sdk/gcloud/reference/functions/deploy)
