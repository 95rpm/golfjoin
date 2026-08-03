# Golfjoin deploy commands

> The current three-service target (main API, on-demand quote/PDF, and Aligo Direct VPC) is documented in `doc/golfjoin-split-services.md`. Use that guide for the VPC connector removal rollout.

Use this checklist from Google Cloud Shell or another shell where `gcloud` is installed and authenticated.

## 1. Preflight

```bash
cd server/google-sheet-proxy-function
node --check index.js
```

Confirm that the spreadsheet is shared with the Cloud Function service account as an editor.

```bash
gcloud functions describe golfjoin-sheet-api \
  --gen2 \
  --region=asia-northeast3 \
  --format='value(serviceConfig.serviceAccountEmail)'
```

## 2. Deploy sheet proxy

Replace all `REPLACE_*` values before running. Keep `SHEET_WEB_APP_URL` during rollout so Apps Script fallback remains available.

```bash
gcloud functions deploy golfjoin-sheet-api \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-northeast3 \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --timeout=540s \
  --memory=1GiB \
  --allow-unauthenticated \
  '--set-env-vars=^|^SHEET_WEB_APP_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec|GOOGLE_SHEET_ID=REPLACE_WITH_SPREADSHEET_ID|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com|ADMIN_READ_TOKEN=REPLACE_WITH_ADMIN_TOKEN|WRITE_TOKEN=REPLACE_WITH_WRITE_TOKEN|GOLFJOIN_PRODUCTS_BUCKET=golfjoin-bucket|GOLFJOIN_PRODUCTS_PREFIX=web|GOLFJOIN_QUOTE_VIEW_BASE_URL=https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api|SECRET_TOUR_GOODS_CATEGORY_ROOTS=1,2,3,5'
```

## 3. Public verification

```bash
FUNCTION_URL="https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api"

curl -sS -X POST "$FUNCTION_URL?action=home_bootstrap_light" \
  -H 'Origin: https://www.secret-tour.com' \
  -H 'Content-Type: application/json' \
  --data '{"newScheduleLimit":100,"joinApplicationLimit":100}'

curl -sS "$FUNCTION_URL?sheet=schedule_participant_summary&limit=3" \
  -H 'Origin: https://www.secret-tour.com'
```

Expected signs:

- `ok` is `true`.
- `source` is `sheets_api`.
- Public responses include `publicRedacted: true`.
- `schedule_participant_summary` rows are returned without waiting for Apps Script summary refresh.

## 4. Admin verification

```bash
curl -sS "$FUNCTION_URL?action=admin_bootstrap&limit=20" \
  -H 'Origin: https://www.secret-tour.com' \
  -H 'X-Golfjoin-Admin-Token: REPLACE_WITH_ADMIN_TOKEN'
```

Expected signs:

- `ok` is `true`.
- `source` is `sheets_api`.
- `builderRows`, `joinRows`, `profileRows`, and `displayRuleRows` are present.

## 5. Optional product refresh

Run after admin verification succeeds whenever the product-card schema, representative image extraction, or compact date selection changes. This refresh reads current Secret Tour products and writes the public JSON files; deploying `index.js` alone does not regenerate them.

```bash
curl -sS -X POST "$FUNCTION_URL?action=refresh_secret_tour_products" \
  -H 'Origin: https://www.secret-tour.com' \
  -H 'X-Golfjoin-Admin-Token: REPLACE_WITH_ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  --data '{}'
```

Expected save targets:

- `gs://golfjoin-bucket/web/golfjoin_home_summary.json`
- `gs://golfjoin-bucket/web/golfjoin_home_cards.json`
- `gs://golfjoin-bucket/web/golfjoin_local_data.json`
- `gs://golfjoin-bucket/web/golfjoin_local_data.js`

`web/generate_home_summary.js` is a local maintenance tool. Do not upload it to the bucket or publish it as JSON. The normal production path is the refresh request above; a manual bucket upload should contain only the generated `golfjoin_home_cards.json` after its contents have been verified.

Verify the compact payload before publishing the HTML:

```bash
curl -sS "https://storage.googleapis.com/golfjoin-bucket/web/golfjoin_home_cards.json" > /tmp/golfjoin_home_cards.json
node -e 'const p=require("/tmp/golfjoin_home_cards.json"); const images=p.items.filter(x=>x.image).length; console.log({generatedAt:p.generatedAt,count:p.count,images}); if(!p.count||!images)process.exit(1)'
```

Expected signs:

- `generatedAt` matches the current refresh.
- `count` is greater than zero and contains multiple future date variants where available.
- `images` is greater than zero before the page HTML is published.

## 6. Rollback

Redeploy the previous revision from Cloud Console, or deploy the last known-good source with the same environment variables.

Keep `SHEET_WEB_APP_URL` configured until the Sheets API path has been verified for public reads, admin reads, and writes.
