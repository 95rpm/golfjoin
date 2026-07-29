# Golfjoin API split deployment

This deployment keeps the public main API warm, isolates Aligo fixed-IP traffic, and generates quote PDFs only when a user downloads one.

## Target services

| Service | CPU / memory | Instances | Concurrency | Network | Role |
| --- | --- | --- | --- | --- | --- |
| `golfjoin-sheet-api` | 1 vCPU / 512MiB | min 1, max 5 | 5 | no VPC | main reads, writes, quote HTML view |
| `golfjoin-quote-api` | 1 vCPU / 512MiB | min 0, max 1 | 5 | no VPC | quote confirmation and on-demand PDF |
| `golfjoin-aligo-api` | 1 vCPU / 512MiB | min 0, max 3 | 5 | Direct VPC, all traffic | Aligo only |

The quote service has one maximum instance. Its in-process PDF queue also runs one renderer at a time, so no more than one PDF is rendered concurrently across the service. HTML confirmation requests can still share the same instance.

New quote confirmations store encrypted HTML and encrypted quote JSON. They do not create or store a PDF object. `PDF 다운로드` decrypts the JSON, renders one PDF in memory, and returns it as an attachment. Existing stored PDFs remain readable for backward compatibility.

## 1. Variables

Run from `server/google-sheet-proxy-function` in Cloud Shell. Replace every `REPLACE_*` value.

```bash
export PROJECT_ID="golfjoin-499602"
export REGION="asia-northeast3"
export NETWORK="REPLACE_WITH_VPC_NETWORK"
export SUBNET="REPLACE_WITH_DIRECT_VPC_SUBNET"
export MAIN_FUNCTION_URL="https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api"
export QUOTE_FUNCTION_URL="https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-quote-api"
export TASK_QUEUE="golfjoin-aligo"
export TASK_INVOKER_SA="golfjoin-tasks-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
export INTERNAL_TOKEN="REPLACE_WITH_AT_LEAST_32_RANDOM_BYTES"
```

Keep `INTERNAL_TOKEN` in Secret Manager in production. The same value must be configured on the main and Aligo services.

## 2. Cloud Tasks queue

Cloud Tasks prevents a Direct VPC + Cloud NAT cold start from delaying the customer's application request.

```bash
gcloud services enable cloudtasks.googleapis.com compute.googleapis.com --project="${PROJECT_ID}"

gcloud tasks queues create "${TASK_QUEUE}" \
  --location="${REGION}" \
  --max-concurrent-dispatches=5 \
  --max-dispatches-per-second=5 \
  --project="${PROJECT_ID}"

gcloud iam service-accounts create golfjoin-tasks-invoker \
  --display-name="Golfjoin Cloud Tasks invoker" \
  --project="${PROJECT_ID}"
```

If the queue or service account already exists, keep it and continue.

## 3. Deploy the Aligo service

The Aligo service is private. It is the only service connected to Direct VPC and Cloud NAT.

```bash
gcloud functions deploy golfjoin-aligo-api \
  --gen2 \
  --runtime=nodejs22 \
  --region="${REGION}" \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --timeout=180s \
  --cpu=1 \
  --memory=512MiB \
  --min-instances=0 \
  --max-instances=3 \
  --concurrency=5 \
  --no-allow-unauthenticated \
  --network="${NETWORK}" \
  --subnet="${SUBNET}" \
  --direct-vpc-egress=all \
  '--set-env-vars=^|^GOLFJOIN_SERVICE_ROLE=aligo|GOOGLE_SHEET_ID=REPLACE_WITH_SPREADSHEET_ID|SHEET_WEB_APP_URL=REPLACE_WITH_APPS_SCRIPT_URL|GOLFJOIN_INTERNAL_SERVICE_TOKEN=REPLACE_WITH_INTERNAL_TOKEN|ALIGO_ENABLED=Y|ALIGO_USERID=REPLACE_WITH_ALIGO_USERID|ALIGO_APIKEY=REPLACE_WITH_ALIGO_APIKEY|ALIGO_SENDERKEY=REPLACE_WITH_ALIGO_SENDERKEY|ALIGO_SENDER=0234461119|ALIGO_TESTMODE=N' \
  --project="${PROJECT_ID}"
```

Confirm that the selected subnet is included in the existing Cloud NAT configuration and that the NAT uses the existing reserved Aligo IP.

Read the private service's canonical Cloud Run URL. Use this URL as both the Cloud Tasks target and OIDC audience:

```bash
export ALIGO_RUN_URL="$(gcloud run services describe golfjoin-aligo-api --region="${REGION}" --format='value(status.url)' --project="${PROJECT_ID}")"
```

## 4. Permit Cloud Tasks to invoke Aligo

```bash
gcloud run services add-iam-policy-binding golfjoin-aligo-api \
  --region="${REGION}" \
  --member="serviceAccount:${TASK_INVOKER_SA}" \
  --role="roles/run.invoker" \
  --project="${PROJECT_ID}"

export PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"

gcloud iam service-accounts add-iam-policy-binding "${TASK_INVOKER_SA}" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudtasks.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project="${PROJECT_ID}"
```

## 5. Deploy the quote service

The quote service is public because protected quote links contain their own high-entropy token. Admin quote confirmation still requires the admin session token.

```bash
gcloud functions deploy golfjoin-quote-api \
  --gen2 \
  --runtime=nodejs22 \
  --region="${REGION}" \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --timeout=540s \
  --cpu=1 \
  --memory=512MiB \
  --min-instances=0 \
  --max-instances=1 \
  --concurrency=5 \
  --allow-unauthenticated \
  '--set-env-vars=^|^GOLFJOIN_SERVICE_ROLE=quote|GOOGLE_SHEET_ID=REPLACE_WITH_SPREADSHEET_ID|SHEET_WEB_APP_URL=REPLACE_WITH_APPS_SCRIPT_URL|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com|ADMIN_READ_TOKEN=REPLACE_WITH_ADMIN_TOKEN|ADMIN_LOGIN_ID=REPLACE_WITH_ADMIN_ID|ADMIN_LOGIN_PASSWORD_SHA256=REPLACE_WITH_PASSWORD_SHA256|GOLFJOIN_PRODUCTS_BUCKET=golfjoin-bucket|GOLFJOIN_QUOTES_PREFIX=quotes|GOLFJOIN_QUOTE_VIEW_BASE_URL=https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api|GOLFJOIN_QUOTE_PDF_BASE_URL=https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-quote-api|GOLFJOIN_QUOTE_PDF_MAX_QUEUE=5' \
  --project="${PROJECT_ID}"
```

## 6. Deploy the main API without VPC

First retrieve the main function's runtime service account:

```bash
export MAIN_SERVICE_ACCOUNT="$(gcloud functions describe golfjoin-sheet-api --gen2 --region="${REGION}" --format='value(serviceConfig.serviceAccountEmail)' --project="${PROJECT_ID}")"
```

Grant it permission to enqueue tasks and to use the task invoker identity:

```bash
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${MAIN_SERVICE_ACCOUNT}" \
  --role="roles/cloudtasks.enqueuer"

gcloud iam service-accounts add-iam-policy-binding "${TASK_INVOKER_SA}" \
  --member="serviceAccount:${MAIN_SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountUser" \
  --project="${PROJECT_ID}"
```

Deploy the main API. `--clear-vpc-connector` removes the existing connector from the new revision.

```bash
gcloud functions deploy golfjoin-sheet-api \
  --gen2 \
  --runtime=nodejs22 \
  --region="${REGION}" \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --timeout=540s \
  --cpu=1 \
  --memory=512MiB \
  --min-instances=1 \
  --max-instances=5 \
  --concurrency=5 \
  --allow-unauthenticated \
  --clear-vpc-connector \
  '--set-env-vars=^|^GOLFJOIN_SERVICE_ROLE=main|SHEET_WEB_APP_URL=REPLACE_WITH_APPS_SCRIPT_URL|GOOGLE_SHEET_ID=REPLACE_WITH_SPREADSHEET_ID|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com|ADMIN_READ_TOKEN=REPLACE_WITH_ADMIN_TOKEN|ADMIN_LOGIN_ID=REPLACE_WITH_ADMIN_ID|ADMIN_LOGIN_PASSWORD_SHA256=REPLACE_WITH_PASSWORD_SHA256|WRITE_TOKEN=REPLACE_WITH_WRITE_TOKEN|GOLFJOIN_PRODUCTS_BUCKET=golfjoin-bucket|GOLFJOIN_PRODUCTS_PREFIX=web|GOLFJOIN_QUOTES_PREFIX=quotes|GOLFJOIN_ALIGO_SERVICE_URL=REPLACE_WITH_ALIGO_RUN_URL|GOLFJOIN_ALIGO_TASK_QUEUE=golfjoin-aligo|GOLFJOIN_ALIGO_TASK_LOCATION=asia-northeast3|GOLFJOIN_TASKS_SERVICE_ACCOUNT=golfjoin-tasks-invoker@golfjoin-499602.iam.gserviceaccount.com|GOLFJOIN_INTERNAL_SERVICE_TOKEN=REPLACE_WITH_INTERNAL_TOKEN' \
  --project="${PROJECT_ID}"
```

For request-based billing, verify the underlying Cloud Run services use CPU throttling:

```bash
gcloud run services update golfjoin-sheet-api --region="${REGION}" --cpu-throttling --project="${PROJECT_ID}"
gcloud run services update golfjoin-quote-api --region="${REGION}" --cpu-throttling --project="${PROJECT_ID}"
gcloud run services update golfjoin-aligo-api --region="${REGION}" --cpu-throttling --project="${PROJECT_ID}"
```

## 7. Dashboard and verification

`golfjoin_admin_dashboard.html` defaults quote confirmation requests to:

```text
https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-quote-api
```

Verify in this order:

1. Main page lookup, login, wish, and application work through `golfjoin-sheet-api`.
2. Application returns immediately with a queued notification result.
3. The Cloud Task invokes `golfjoin-aligo-api`, and the Aligo delivery log shows the existing fixed IP.
4. Quote confirmation creates `.html` and `.json` under `gs://golfjoin-bucket/quotes/`, but no new `.pdf`.
5. `견적보기` opens through `golfjoin-sheet-api` without a quote-service cold start.
6. `PDF 다운로드` invokes `golfjoin-quote-api`, produces one download, and still creates no `.pdf` object.
7. Cloud Run metrics show the quote service never exceeds one instance.
8. After all revisions using `golfjoin-vpc-connector` have zero traffic, delete the connector.

## Rollback

Route traffic back to the previous main revision before deleting the connector. Existing encrypted HTML/PDF links remain supported. If the quote service is unavailable, change `window.GOLFJOIN_QUOTE_API_ENDPOINT` back to the main function URL temporarily and deploy the main service with `GOLFJOIN_SERVICE_ROLE=all`.
