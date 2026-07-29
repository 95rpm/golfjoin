# Golfjoin Google Sheet proxy

This function keeps the Apps Script Web App URL out of the browser HTML.

Fast Google Sheets API reads/writes:

- `GOOGLE_SHEET_ID` enables direct Google Sheets API reads from this Cloud Function.
- Join completion checks now calculate `schedule_participant_summary` directly from Sheets API data before falling back to Apps Script.
- Generic `GET ?sheet=...` reads use the Sheets API first, including fresh `schedule_participant_summary` calculation.
- Migrated read actions:
  - `POST ?action=member_profile_lookup`
  - `POST ?action=home_bootstrap`
  - `POST ?action=home_bootstrap_light`
  - `POST ?action=join_wishes_lookup`
  - `GET ?action=admin_bootstrap`
- Migrated write sources:
  - `source=new_schedule_builder`
  - `source=join_apply`
  - `source=join_member_profile`
  - `source=join_review`
  - `source=join_wish`
  - `source=product_display_rule`
  - `source=recommended_schedule`
  - `POST ?action=admin_status_update`
- Share the spreadsheet with the Cloud Function service account as an editor.
- If a direct Sheets API operation fails, the migrated actions fall back to the existing Apps Script Web App path while `SHEET_WEB_APP_URL` is configured.

The proxy validates write requests before forwarding them to Apps Script:

- Allowed write sources only:
  - `new_schedule_builder`
  - `join_apply`
  - `join_member_profile`
  - `join_review`
  - `join_wish`
  - `product_display_rule`
  - `recommended_schedule`
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
- Newly confirmed quote HTML and PDF-render data are AES-256-GCM encrypted before GCS storage and can only be read through a high-entropy protected link. The sheet stores only the token hash.
  - Quote confirmation does not render or store a PDF.
  - `PDF 다운로드` renders one PDF in memory and returns it as an attachment. The generated PDF is not added to GCS.
  - Existing stored PDFs are still served for backward compatibility.
  - The quote service serializes PDF rendering to one job per instance. Deploy it with `--max-instances=1` to guarantee one PDF render across the whole service.
  - Protected quote links remain valid until the quote is regenerated or its stored file is removed.
  - `GOLFJOIN_QUOTE_VIEW_BASE_URL` can override the function URL used for quote links; normally it is inferred from the quote-generation request.
  - `GOLFJOIN_QUOTE_PDF_BASE_URL` can point PDF downloads to a separate quote service while HTML views stay on the warm main API.
  - When overriding it, use the complete public function URL, including `/golfjoin-sheet-api`: `https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api`.
  - Regenerate older public quotes once after deploying this version to migrate them to encrypted storage and protected links.
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

Admin roster and ERP member lookup:

- Required ERP environment variables: `ERP_OFFICE_ID`, `ERP_EMP_NO`, `ERP_EMP_PW`.
- Optional: `ERP_SESSION_TTL_MS` (default 10 minutes), `ERP_MEMBER_SEARCH_START_DATE`.
- Admin-token protected actions:
  - `POST ?action=admin_erp_login_check`
  - `POST ?action=admin_erp_member_lookup`
  - `POST ?action=admin_participant_lookup`
  - `POST ?action=admin_participant_batch_upsert`
- Administrator-created participants are stored in `join_applications` with `source=join_apply` and `registrationSource=admin`.
- A matching profile is reused. Otherwise a temporary `join_member_profiles` row is created and is claimed when that person later completes the website profile flow.
- These actions use the direct Google Sheets API and never fall back to Apps Script or send an application Alimtalk.

Alimtalk:

- `new_schedule_builder` and `join_apply` writes send Alimtalk after the Google Sheet write succeeds.
- The write response includes a `notifications` array with the actual send result or skip/failure reason.
- Required production env vars:
  - `ALIGO_ENABLED=Y`
  - `ALIGO_USERID`
  - `ALIGO_APIKEY`
  - `ALIGO_SENDERKEY`
  - `ALIGO_SENDER=0234461119`
  - Optional: `ALIGO_TESTMODE=N`, `ALIGO_REQUEST_TIMEOUT_MS=8000`
- Split-service mode:
  - Main API: set `GOLFJOIN_ALIGO_SERVICE_URL`, `GOLFJOIN_ALIGO_TASK_QUEUE`, `GOLFJOIN_ALIGO_TASK_LOCATION`, `GOLFJOIN_TASKS_SERVICE_ACCOUNT`, and `GOLFJOIN_INTERNAL_SERVICE_TOKEN`.
  - Aligo service: set `GOLFJOIN_SERVICE_ROLE=aligo`, the same internal token, and all `ALIGO_*` credentials.
  - Cloud Tasks invokes the private Aligo service with OIDC, so a Direct VPC + Cloud NAT cold start never blocks the customer's application response.

Write security:

- If `WRITE_TOKEN` is configured, all `POST` writes require the `X-Golfjoin-Write-Token` request header.
- Leave `WRITE_TOKEN` unset only while the public page cannot inject the token from a trusted server-side template.

Deploy from this directory:

PDF images are loaded directly from `golfjoin-bucket/golfjoin_img`. The WebP hero is converted to a transparent PNG buffer for PDFKit. Quote generation fails instead of producing an image-less PDF if a required bucket image is unavailable.

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
  '--set-env-vars=^|^SHEET_WEB_APP_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec|GOOGLE_SHEET_ID=REPLACE_WITH_SPREADSHEET_ID|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com,https://admin.secret-tour.com,https://dashboad-golfjoin-secrettour.web.app,http://localhost:8000,http://192.168.1.119:8000|ADMIN_READ_TOKEN=REPLACE_WITH_ADMIN_TOKEN|GOLFJOIN_PRODUCTS_BUCKET=golfjoin-bucket|GOLFJOIN_PRODUCTS_PREFIX=web|SECRET_TOUR_GOODS_CATEGORY_ROOTS=1,2,3,5'
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
  '--set-env-vars=^|^SHEET_WEB_APP_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec|GOOGLE_SHEET_ID=REPLACE_WITH_SPREADSHEET_ID|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com,https://admin.secret-tour.com,https://dashboad-golfjoin-secrettour.web.app|ADMIN_READ_TOKEN=REPLACE_WITH_ADMIN_TOKEN|WRITE_TOKEN=REPLACE_WITH_WRITE_TOKEN|GOLFJOIN_PRODUCTS_BUCKET=golfjoin-bucket|GOLFJOIN_PRODUCTS_PREFIX=web|SECRET_TOUR_GOODS_CATEGORY_ROOTS=1,2,3,5'
```

After deployment, set `GOLFJOIN_SHEET_API_ENDPOINT` in `golfjoin_main.html` if the function URL differs from the default.

For the Golfjoin admin dashboard and product summary refresh deployment sequence, see
`doc/golfjoin-deploy-commands.md`.

For the main/quote/Aligo split deployment, see `doc/golfjoin-split-services.md`.
