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

Product family administration (server foundation):

- The first admin request creates and initializes these private sheets when they do not exist:
  - `product_family_master`
  - `product_family_members`
  - `product_family_audit_log`
- Admin-token protected actions:
  - `POST ?action=admin_product_family_bootstrap`
  - `POST ?action=admin_product_family_assign`
  - `POST ?action=admin_product_family_representative_update`
  - `POST ?action=admin_product_family_revoke`
  - `POST ?action=admin_product_family_republish`
- Bootstrap returns `catalogRevision`, `analysisRevision`, the numeric-goodSeq catalog, server-generated `candidates`, `familyDiagnostics`, summary counts, and committed family revisions.
- Mutation requests must send the bootstrap `expectedAnalysisRevision` and the selected family's `expectedConfigRevision` (`0` for a new family).
- Assignment requires at least two numeric `memberGoodSeqs` with different durations. One active goodSeq cannot belong to two families.
- Representative mode is `lowest_price` or `manual`; manual mode also requires `preferredGoodSeq`.
- Send a stable 8-120 character `operationId` when retry safety is required.
- `refresh_secret_tour_products` reconciles committed families by numeric `goodSeq` after the new product payload is saved. Existing memberships are retained; unavailable or materially changed members move the family to `review_required`, while lowest-price representative changes are updated automatically.
- Successful assignment, representative change, revoke, republish, and product refresh operations publish an immutable versioned catalog to `web/product-family/catalogs/{publicationRevision}.json`.
- Only valid `approved` families are included in a version. A duplicate goodSeq or invalid approved family fails publication without replacing the existing individual-product payload.
- After the version file and sheet publication state both succeed, `web/product-family/manifest.json` is switched with a GCS generation precondition. The manifest records the active and previous publication revisions for rollback.
- A manifest conflict or write failure leaves the previous manifest active and marks the attempted family publication as failed.
- Product-family mutations and product refreshes use a bucket-backed distributed lock so two administrators cannot replace the same current state concurrently.
- After a successful commit/publication attempt, `product_family_master` and `product_family_members` are atomically compacted to current state only. The master keeps one row per family, active families keep only their current member rows, and revoked families keep a master tombstone for retry safety.
- `product_family_audit_log` remains append-only. If compaction fails, the committed append-only rows remain readable and a later operation can compact them again.
- The refresh response includes the same server candidate analysis plus reconciliation counts, publication metadata, and diagnostics under `productFamily`.
- Member rows are appended before the master revision. A partial write without the final master row is ignored when the committed state is read.
- Public product cards do not consume the manifest until the main-page family integration is deployed.

Atomic Release manifest V2 (admin-only publication and browser gate):

- `GET ?action=admin_release_v2_status` verifies the active root manifest and all five referenced objects, then returns only revision and verification metadata.
- `POST ?action=admin_release_v2_shadow_compare` rebuilds the legacy and V2 candidate views from the same source snapshot and compares home products, all availability events, public schedules, participant summaries, and product families without publishing anything.
- `POST ?action=admin_release_v2_publish` reads the current home products, public live member summary, and published product-family catalog. It writes immutable content-hash objects first, verifies their bytes, SHA-256, JSON metadata and shared snapshot stamp, writes an immutable archive manifest, and switches `web/release-manifest-v2.json` last.
- `POST ?action=admin_release_v2_rollback` requires `{ "targetReleaseRevision": "gjr_..." }`. It verifies the archived target and all referenced objects before switching the root with a GCS generation precondition.
- `POST ?action=admin_release_v2_browser_gate` accepts an explicit boolean `browserReadEnabled`. Enabling also requires the exact current `expectedReleaseRevision`; disabling intentionally does not require a target so an operator can stop browser reads immediately.
- All actions require the existing admin credentials. Publish, rollback, and browser-gate changes also use the product-family distributed lock.
- Publish runs the same server-side shadow comparison before it calls the object publisher. Any field mismatch, missing item, or unexpected item returns `release_shadow_mismatch` and leaves the root manifest untouched.
- Shadow reports contain counts, field paths, error codes, and hashed identities only. They never include raw product, event, schedule, member identifiers, participant names, mobile numbers, or email addresses.
- Normal publish and rollback always write `browserReadEnabled: false`. A separate generation-guarded gate command may change only the active root flag after all five referenced objects have been verified. Immutable objects and the archive manifest remain unchanged.
- The main HTML applies V2 only when the browser is anonymous, its persistent non-personal rollout bucket is inside the configured percentage, and the active root has `browserReadEnabled: true`.
- `staticRevision`, `liveRevision`, `familyRevision`, `availabilityRevision`, and `detailRevision` are separate. A live participant update therefore does not force the static home-card or availability revision to change.
- The current detail index explicitly reports `legacy-on-demand`; it does not claim that legacy product details have already been pre-published. Detail snapshot publication is handled in the later detail phase.
- Existing `refresh_secret_tour_products`, schedule writes, and background home refreshes do not publish V2 automatically. An administrator must explicitly call the publish action.
- Safe CLI examples read `ADMIN_READ_TOKEN` from the existing env YAML without printing it:
  - Status: `node release-admin-cli.js status --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml`
  - Shadow compare only: `node release-admin-cli.js shadow --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml`
  - Publish: `node release-admin-cli.js publish --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml`
  - Enable the exact current release: `node release-admin-cli.js gate-on --target=gjr_... --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml`
  - Emergency browser OFF: `node release-admin-cli.js gate-off --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml`
  - Rollback: `node release-admin-cli.js rollback --target=gjr_... --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml`

Alimtalk:

- `new_schedule_builder` and `join_apply` writes send Alimtalk after the Google Sheet write succeeds.
- The write response includes a `notifications` array with the actual send result or skip/failure reason.
- Required production env vars:
  - `ALIGO_ENABLED=Y`
  - `ALIGO_USERID`
  - `ALIGO_APIKEY`
  - `ALIGO_SENDERKEY`
  - `ALIGO_SENDER=0234461119`
  - Optional: `ALIGO_TESTMODE=N`, `ALIGO_REQUEST_TIMEOUT_MS=15000`, `ALIGO_RETRY_DELAYS_MS=5000,20000,60000`
- Split-service mode:
  - Main API: set `GOLFJOIN_ALIGO_SERVICE_URL`, `GOLFJOIN_ALIGO_TASK_QUEUE`, `GOLFJOIN_ALIGO_TASK_LOCATION`, `GOLFJOIN_TASKS_SERVICE_ACCOUNT`, and `GOLFJOIN_INTERNAL_SERVICE_TOKEN`.
  - Aligo service: set `GOLFJOIN_SERVICE_ROLE=aligo`, the same internal token, and all `ALIGO_*` credentials.
  - Cloud Tasks invokes the private Aligo service with OIDC, so a Direct VPC + Cloud NAT cold start never blocks the customer's application response.
  - Application writes enqueue through Cloud Tasks only. Missing queue or service configuration is recorded as a delivery failure instead of falling back to an in-process background send or synchronous service call.
  - A send attempt times out after 15 seconds. Timeout, network, and HTTP 5xx failures retry after 5, 20, and 60 seconds. Explicit provider rejection is not retried.
  - `alimtalk_delivery_log` is created automatically and keeps one current row per notification id for duplicate prevention and final failure review.

Admin application email:

- `new_schedule_builder` and `join_apply` writes enqueue a dedicated admin-email Cloud Task independently from the Alimtalk task.
- Set `GOLFJOIN_ADMIN_EMAIL_SERVICE_URL` on the main API to the current `golfjoin-sheet-api` Cloud Run service URL. Do not point it at `golfjoin-aligo-api`.
- The dedicated internal action is `send_admin_application_email`. The main API executes it with the existing internal token; the Aligo worker does not execute email delivery.
- Keep `GOLFJOIN_ADMIN_EMAIL_ENABLED=Y`, the Apps Script provider settings, both email secrets, and `GOLFJOIN_EMAIL_REQUEST_TIMEOUT_MS` on the main API only.
- A failure to enqueue Alimtalk no longer suppresses the email task, and an email queue failure no longer blocks the customer application write.
- Task ids and `admin_email_delivery_log` notification ids are deterministic, so retries do not send a second copy to a recipient that already completed successfully.

Member SMS authentication:

- Public lifecycle actions are `member_auth_start`, `member_auth_verify`, `member_auth_refresh`, and `member_auth_logout`. The main API rechecks the general-login member against ERP before it asks the private Aligo service to send an OTP.
- `send_member_sms_otp` is an internal-only action. It requires the existing internal service token and is not a browser endpoint.
- Required production env vars are `GOLFJOIN_MEMBER_AUTH_SECRET` (a unique secret of at least 32 bytes) and `GOLFJOIN_MEMBER_AUTH_BUCKET` (a private bucket used only by the runtime service account).
- Safe initial rollout values are `GOLFJOIN_MEMBER_AUTH_ENABLED=N` and `GOLFJOIN_MEMBER_AUTH_GATE=off`. Never enable `enforce` until Kakao members also receive a trusted member token.
- The browser feature is independently disabled unless a lightweight page sets `window.GOLFJOIN_MEMBER_SMS_AUTH_ENABLED = true` before loading the main JavaScript. A comma-delimited string or array in `window.GOLFJOIN_MEMBER_SMS_AUTH_MEMBER_SEQS` limits the UI to selected general-login member sequences.
- Browser access and refresh tokens live in `sessionStorage`, so they are scoped to the current tab and are cleared when the tab session ends. OTP plaintext is never stored there.
- If OTP startup fails after Secret Tour accepted the password, the page calls `/member/logout.json` and clears the partial local member state instead of leaving an unverified ERP login behind.
- See `docs/home-optimization/STAGE15_SMS_MEMBER_AUTH_PLAN.md` for the private-bucket requirements, staged rollout, tests, and emergency recovery order.

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
