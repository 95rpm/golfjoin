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

Deploy from this directory:

```bash
gcloud functions deploy golfjoin-sheet-api \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-northeast3 \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --allow-unauthenticated \
  '--set-env-vars=^|^SHEET_WEB_APP_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com,http://localhost:8000,http://192.168.1.119:8000'
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
  --allow-unauthenticated \
  '--set-env-vars=^|^SHEET_WEB_APP_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com'
```

After deployment, set `GOLFJOIN_SHEET_API_ENDPOINT` in `golfjoin_main.html` if the function URL differs from the default.
