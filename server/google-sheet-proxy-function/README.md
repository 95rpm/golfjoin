# Golfjoin Google Sheet proxy

This function keeps the Apps Script Web App URL out of the browser HTML.

The proxy validates write requests before forwarding them to Apps Script:

- Allowed write sources only:
  - `new_schedule_builder`
  - `join_apply`
  - `join_member_profile`
  - `join_review`
- The optional `sheet` value must match the source.
- Applicant/profile phone numbers must be Korean mobile numbers in `010########` format.
- Applicant/profile name, birth year, gender, level, styles, and required agreement are checked.
- Reviews require rating `1`-`5`, at least 20 review characters, and at most 3 image records.
- Review/profile image URLs must point to the expected GCS paths:
  - `golfjoin_uploads/photos/profiles/...`
  - `golfjoin_uploads/photos/reviews/...`

Read security:

- Public `GET` responses are redacted by default for sheets used by the main page.
- Full administrator reads require `ADMIN_READ_TOKEN` and the `X-Golfjoin-Admin-Token` request header.
- Private sheets such as `join_member_profiles`, `join_wishes`, and `all` are blocked without the admin token.
- Admin-only Secret Tour detail proxy actions are available for the dashboard:
  - `GET ?action=secret_tour_goods_detail&goodSeq=...&eventSeq=...`
  - `GET ?action=secret_tour_flight_schedule&eventSeq=...&goodTransportSeq=...&startDay=...&endDay=...`
  - `GET ?action=secret_tour_goods_list&cate1=...&page=...&rows=...`
  - `GET ?action=secret_tour_goods_events&goodSeq=...`
- Admin-only product refresh persists the latest Secret Tour product data to GCS:
  - `POST ?action=refresh_secret_tour_products`
  - Default save targets:
    - `gs://golfjoin-bucket/web/golfjoin_local_data.js`
    - `gs://golfjoin-bucket/web/golfjoin_local_data.json`
  - Override with `GOLFJOIN_PRODUCTS_BUCKET`, `GOLFJOIN_PRODUCTS_PREFIX`, and `SECRET_TOUR_GOODS_CATEGORY_ROOTS`.

Write security:

- If `WRITE_TOKEN` is configured, all `POST` writes require the `X-Golfjoin-Write-Token` request header.
- Leave `WRITE_TOKEN` unset only while the public page cannot inject the token from a trusted server-side template.

Deploy from this directory:

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
  '--set-env-vars=^|^SHEET_WEB_APP_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com,http://localhost:8000,http://192.168.1.119:8000|ADMIN_READ_TOKEN=REPLACE_WITH_ADMIN_TOKEN|GOLFJOIN_PRODUCTS_BUCKET=golfjoin-bucket|GOLFJOIN_PRODUCTS_PREFIX=web|SECRET_TOUR_GOODS_CATEGORY_ROOTS=1,2,3,5'
```

For production, remove local test origins:

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
  '--set-env-vars=^|^SHEET_WEB_APP_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com|ADMIN_READ_TOKEN=REPLACE_WITH_ADMIN_TOKEN|WRITE_TOKEN=REPLACE_WITH_WRITE_TOKEN|GOLFJOIN_PRODUCTS_BUCKET=golfjoin-bucket|GOLFJOIN_PRODUCTS_PREFIX=web|SECRET_TOUR_GOODS_CATEGORY_ROOTS=1,2,3,5'
```

After deployment, set `GOLFJOIN_SHEET_API_ENDPOINT` in `golfjoin_main.html` if the function URL differs from the default.
