# Mini-Tools Image Upload API

Base URL:

```text
https://api.mini-tools.uk
```

## Apply for access

API access is issued manually, in the same way as long-term image storage.
Email `yuyananuu@gmail.com` to request an API user ID and API key.
The administrator must verify the applicant's email address before API access is activated.
API uploads remain subject to the same content review and removal rules as website uploads.

The administrator provides both values:

```text
X-API-User-ID: assigned-user-id
Authorization: Bearer mtu_live_xxx
```

Both values are required. Keep the API key on a trusted server and do not put it
in browser JavaScript, mobile application source, or a public repository.

## Upload images

```text
POST /v1/upload
Content-Type: multipart/form-data
```

Fields:

- `file`: required. Send one image or repeat this field for multiple images.
- `duration`: optional. `1-day`, `7-day`, `30-day`, or `permanent`.

Limits:

- JPG, PNG, GIF, and WebP only.
- Maximum 5 MB per image.
- Maximum 10 images per request.
- Maximum 25 MB for all images in one request.
- The assigned account must allow the requested retention type.
- Daily temporary quotas reset at midnight in `Asia/Shanghai`.
- Permanent uploads use the assigned total quota.

Successful uploads are available immediately through the returned public `url`.
They do not need to wait for review before use.

Single-image example:

```bash
curl "https://api.mini-tools.uk/v1/upload" \
  -H "X-API-User-ID: assigned-user-id" \
  -H "Authorization: Bearer mtu_live_xxx" \
  -H "Idempotency-Key: upload-request-001" \
  -F "duration=7-day" \
  -F "file=@image.png"
```

`Idempotency-Key` is optional but recommended for requests that may be retried.
Use a unique value for each logical upload. Repeating the same upload with the
same key returns the stored response without uploading again or consuming quota
twice. Reusing a key with different files returns HTTP `409`.

Multiple-image example:

```bash
curl "https://api.mini-tools.uk/v1/upload" \
  -H "X-API-User-ID: assigned-user-id" \
  -H "Authorization: Bearer mtu_live_xxx" \
  -F "duration=7-day" \
  -F "file=@first.png" \
  -F "file=@second.webp"
```

Successful upload response:

```json
{
  "success": true,
  "partial": false,
  "uploaded": [
    {
      "success": true,
      "key": "7-day/example.png",
      "url": "https://pub.mini-tools.uk/7-day/example.png",
      "duration": "7-day",
      "expires_at": "2026-08-05T12:00:00.000Z",
      "size": 24831,
      "mime": "image/png",
      "risk": "normal"
    }
  ],
  "failed": [],
  "account": {
    "id": "assigned-user-id",
    "plan_type": "custom",
    "allow_temporary": true,
    "temporary_daily_limit": 100,
    "temporary_used_today": 1,
    "temporary_remaining_today": 99,
    "allow_permanent": false,
    "permanent_quota_total": 0,
    "permanent_quota_used": 0,
    "permanent_quota_remaining": 0,
    "usage_date": "2026-07-29",
    "reset_at": "2026-07-29T16:00:00.000Z",
    "timezone": "Asia/Shanghai"
  },
  "usage": {
    "user_id": "assigned-user-id",
    "plan_type": "custom",
    "temporary": {
      "enabled": true,
      "limit": 100,
      "used": 1,
      "remaining": 99,
      "reset_at": "2026-07-29T16:00:00.000Z",
      "timezone": "Asia/Shanghai"
    },
    "permanent": {
      "enabled": false,
      "limit": 0,
      "used": 0,
      "remaining": 0
    },
    "usage_date": "2026-07-29"
  }
}
```

For a partially successful batch, HTTP `207` is returned. Each item in `failed`
contains `index`, `file_name`, `error`, and `code`. Failed images do not consume
quota.

## Get used and remaining quota

```text
GET /v1/usage
```

Example:

```bash
curl "https://api.mini-tools.uk/v1/usage" \
  -H "X-API-User-ID: assigned-user-id" \
  -H "Authorization: Bearer mtu_live_xxx"
```

Response:

```json
{
  "success": true,
  "usage": {
    "user_id": "assigned-user-id",
    "plan_type": "custom",
    "temporary": {
      "enabled": true,
      "limit": 100,
      "used": 24,
      "remaining": 76,
      "reset_at": "2026-07-29T16:00:00.000Z",
      "timezone": "Asia/Shanghai"
    },
    "permanent": {
      "enabled": false,
      "limit": 0,
      "used": 0,
      "remaining": 0
    },
    "usage_date": "2026-07-29"
  }
}
```

`GET /v1/account` remains available for compatibility and returns the same
quota values in a flat `account` object.

## Get upload records

```text
GET /v1/images?limit=20&cursor=...
```

Example:

```bash
curl "https://api.mini-tools.uk/v1/images?limit=20" \
  -H "X-API-User-ID: assigned-user-id" \
  -H "Authorization: Bearer mtu_live_xxx"
```

Response:

```json
{
  "success": true,
  "records": [
    {
      "key": "7-day/example.png",
      "url": "https://pub.mini-tools.uk/7-day/example.png",
      "size": 24831,
      "mime": "image/png",
      "uploaded_at": "2026-08-05T12:00:00.000Z"
    }
  ],
  "next_cursor": null
}
```

Only active uploads owned by the authenticated API user are returned. The public
`url` can be used directly. Retention, expiry, and review status are deliberately
omitted. `limit` defaults to 20 and is capped at 100. Pass a non-null
`next_cursor` back as the `cursor` query parameter to fetch the next page.

## Delete an uploaded image

```text
DELETE /v1/images/:key
```

Example:

```bash
curl -X DELETE "https://api.mini-tools.uk/v1/images/7-day/example.png" \
  -H "X-API-User-ID: assigned-user-id" \
  -H "Authorization: Bearer mtu_live_xxx"
```

The authenticated API user can delete only images uploaded by that same user.
Deleting an image does not refund daily or permanent quota.

## Status codes

- `200`: query or deletion succeeded.
- `201`: every image uploaded successfully.
- `207`: some images uploaded and some failed.
- `400`: invalid multipart body, field, or retention value.
- `401`: missing or invalid API user ID or API key.
- `403`: account disabled, email verification required, or retention type not allowed.
- `404`: image not found or not owned by the authenticated API user.
- `409`: idempotency key is in progress or was reused for a different upload.
- `413`: file count or size limit exceeded.
- `415`: file content does not match its image type.
- `422`: all images in a valid batch failed processing.
- `429`: daily or permanent quota exhausted.
- `503`: API database is unavailable.

Error responses include a stable `code` where available. Clients should accept
unknown response fields for forward compatibility.
