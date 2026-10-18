# Prayer Guide images

In admin **Emails → Prayer guide email**, use **Add images** to select one or more JPG, PNG, WebP or GIF files (15 MB per file, up to 10 images). Preview, move up/down, or remove images, then save the email settings.

All selected images render vertically, in the saved order, after the Prayer Guide closing and above the standard footer. They appear only in the Prayer Guide, not the welcome confirmation or recurring reminders. Existing guides with no images remain unchanged.

Files are public Supabase Storage objects in `wall-assets/<wall-id>/prayer-guide/`. The ordered public URLs are stored in the existing `prayer_wall.email_copy` table under `guide_images`. Removing an image from the guide leaves the storage file intact so previously sent emails continue to display it. Uploading alone does not publish the image in future emails until settings are saved.

Uploads go through `UploadGuideImage`, with real and mock storage gateways selected in the container. The email renderer accepts only HTTPS public `wall-assets` URLs matching the origin of the edge function's configured `SUPABASE_URL`. Missing or invalid configuration omits images rather than allowing foreign hosts.

## Deploy and verify

- Publish the frontend and redeploy `send-confirmation`. Per the shared layout release procedure, also redeploy `send-reminders` and `send-donation-thanks`.
- No new database migration is required. Existing migrations 006 (public wall-assets bucket), 034 (email copy), and 035 (admin allowlist/storage access) must already be applied.
- As an allowlisted admin, upload two images, reorder them, save, and reload the Emails tab. Trigger a Prayer Guide to a controlled address and check both images appear in that order below the closing text on desktop and mobile.
- Remove both, save, and verify the next guide has no added images. Confirm the welcome email and reminders do not include them.

Unit tests use mocked storage/email boundaries and do not upload files or send email.
