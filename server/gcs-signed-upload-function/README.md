# Golfjoin GCS Signed Upload Function

This function returns short-lived GCS signed PUT URLs for review and profile images.
The browser compresses images first, asks this function for upload URLs, uploads to GCS, then stores the returned public URLs in Google Sheets.

The function enforces these server-side limits:

- Upload types: `join_profile_image`, `join_review_images`
- GCS prefixes:
  - `golfjoin_uploads/photos/profiles/{profileId}/...`
  - `golfjoin_uploads/photos/reviews/{reviewId}/...`
- MIME types: `image/webp`, `image/jpeg`, `image/png`
- Profile images: 1 item, 200KB max after browser resize
- Review images: 6 items max, 2MB max per resized image
- Object names are generated on the server with UUIDs; browser-provided file names are not used as GCS object names.

## Deploy

```bash
gcloud functions deploy golfjoin-sign-gcs-upload \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-northeast3 \
  --source=server/gcs-signed-upload-function \
  --entry-point=signGcsUpload \
  --trigger-http \
  --allow-unauthenticated \
  '--set-env-vars=^|^GCS_BUCKET=golfjoin-bucket|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com,http://localhost:8000,http://192.168.1.119:8000'
```

For production, remove local test origins:

```bash
gcloud functions deploy golfjoin-sign-gcs-upload \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-northeast3 \
  --source=server/gcs-signed-upload-function \
  --entry-point=signGcsUpload \
  --trigger-http \
  --allow-unauthenticated \
  '--set-env-vars=^|^GCS_BUCKET=golfjoin-bucket|ALLOWED_ORIGINS=https://m.secret-tour.com,https://www.secret-tour.com'
```

After deployment, copy the function URL into `REVIEW_IMAGE_SIGN_ENDPOINT` in `golfjoin_main.html`.

## Required GCS Permissions

The Cloud Function service account needs object write permission on the bucket.
It also needs `iam.serviceAccounts.signBlob` permission to generate V4 signed URLs.

For the current deployment, the service account is:

```text
583406426382-compute@developer.gserviceaccount.com
```

Grant both permissions:

```bash
gcloud storage buckets add-iam-policy-binding gs://golfjoin-bucket \
  --member=serviceAccount:583406426382-compute@developer.gserviceaccount.com \
  --role=roles/storage.objectCreator

gcloud iam service-accounts add-iam-policy-binding \
  583406426382-compute@developer.gserviceaccount.com \
  --member=serviceAccount:583406426382-compute@developer.gserviceaccount.com \
  --role=roles/iam.serviceAccountTokenCreator
```

Uploaded images are exposed through `https://storage.googleapis.com/golfjoin-bucket/...`.
The bucket or uploaded object path must be publicly readable.
