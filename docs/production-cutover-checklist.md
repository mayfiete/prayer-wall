# Launch checklist: remove test activity from the existing project

Use this checklist for a one-time cleanup, BEFORE accepting real signups or donations. It deletes test activity; it does not add an `is_test` feature. Nothing here has been run against your Supabase database.

Keep this page open and complete the boxes in order. All SQL runs in **Supabase Dashboard → SQL Editor**, using the administrative `postgres` role. Confirm the selected project is `swrcawckpsotialqnisq` before every operation.

The SQL files are operational scripts, not migrations. Do not put them into the migrations directory or apply them as part of normal deployment.

## 1. Identify the two walls

- [ ] Run this read-only query:

```sql
SELECT id, name, app_type FROM prayer_wall.walls ORDER BY app_type, name;
```

- [ ] Copy the prayer wall UUID and giving wall UUID. Check that these match the frontend wall IDs and backend `GIVING_WALL_ID`.
- [ ] Confirm all signup and donation activity on these specific walls is test activity. Do not include another wall or organization.

We PRESERVE organizations, walls, categories, meditations, email schedules and category assignments, themes, email wording, Storage images, auth users, and the admin allowlist. We REMOVE signups, donations, their category/rhythm assignments, personal prayer points, and related email logs. We RETAIN webhook audit history, though its donation links become null when donations are deleted.

## 2. Stop new activity

- [ ] Put the website into maintenance/offline mode in your hosting dashboard. Keep it closed until step 9.
- [ ] Record the current cron state; save the results locally:

```sql
SELECT jobid, jobname, active
FROM cron.job WHERE jobname = 'send-prayer-reminders';
```

- [ ] Open `scripts/production-cutover/00_pause_new_signups.sql`. The two wall IDs are already filled in from your confirmed query results. Verify them and run the whole file. This blocks new browser signups even from cached pages, and pauses the reminder cron job. This does not stop service-role functions already running.
- [ ] Temporarily remove `STRIPE_SECRET_KEY` in **Supabase → Edge Functions → Secrets** to stop the checkout function creating more sessions. Keep the existing secret in your secure password manager first; do not paste secrets into SQL or chat.
- [ ] In Stripe's TEST environment, disable the test webhook endpoint for this app. Do not re-enable that endpoint against this production backend after cleanup.
- [ ] Resolve pending test payments; expire open test Checkout Sessions or wait until they expire. Cancel unwanted test subscriptions in Stripe. Database deletion does not cancel a subscription.
- [ ] Wait for in-flight email/checkout/webhook functions to finish. Check their logs and stop any manual automation that writes records. A paused cron job does not cancel an already queued request.

Stripe references: [Expire an open Checkout Session](https://docs.stripe.com/api/checkout/sessions/expire), [cancel a subscription](https://docs.stripe.com/billing/subscriptions/cancel).

**Important correction:** retaining `webhook_events` does not by itself stop duplicate donation creation after deleting the donation. The current webhook's effective donation deduplication depends on the donation still existing. Keep test delivery disabled, and configure live mode before reopening.

## 3. Save the backup and counts

- [ ] Make a secure backup folder OUTSIDE the repository, for example `C:\Backups\PrayerWallCutover`.
- [ ] Open `scripts/production-cutover/01_snapshot.sql`. The two wall IDs are already filled in. Verify them and run the whole file.
- [ ] Review the `counts` column. These are the exact records selected for the cleanup, plus the retained webhook records.
- [ ] Save the COMPLETE `snapshot_json` cell as `C:\Backups\PrayerWallCutover\snapshot.json`. Save the raw JSON object only, without CSV quoting, a wrapper array, or the separate counts column. The SQL Editor may truncate what it displays; use its full-cell copy/export facility and verify the saved contents in the next step.
- [ ] Also retain a normal database backup using your established backup process, if available. The snapshot is a scoped row backup, not a full database or Storage backup.

The snapshot includes email addresses and prayer requests. Store it securely; do not commit it, post it in chat, or place it in public Storage.

## 4. Generate the dry-run and recovery SQL

From PowerShell in `C:\Repositories\prayer-wall`, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\production-cutover\New-CutoverSql.ps1 -SnapshotPath C:\Backups\PrayerWallCutover\snapshot.json -Mode Delete -OutputPath C:\Backups\PrayerWallCutover\delete-dry-run.sql

powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\production-cutover\New-CutoverSql.ps1 -SnapshotPath C:\Backups\PrayerWallCutover\snapshot.json -Mode Restore -OutputPath C:\Backups\PrayerWallCutover\restore-dry-run.sql
```

- [ ] Confirm both commands succeed and their printed counts match step 3. This also checks that the backup is valid JSON with the required sections.
- [ ] Open both generated files. They must end with `ROLLBACK;`. They contain the backup data, so protect them like the snapshot.

If the backup contains no activity, stop: no deletion is needed. If a command fails, fix the backup export rather than bypassing validation.

## 5. Rehearse the deletion — nothing is committed

- [ ] Paste the ENTIRE generated `delete-dry-run.sql` into a new Supabase SQL Editor query and run it.
- [ ] Confirm it finishes without errors. Review the NOTICE row counts if your editor shows them.
- [ ] Confirm the original records are still present: the final `ROLLBACK` undoes the rehearsal. Query counts directly if your SQL Editor does not display NOTICE messages.

The script locks the affected tables briefly and compares ALL selected rows against the saved snapshot. If a record was added, changed, or removed, it stops. It does not silently include new records. If it stops, keep maintenance enabled, stop the remaining writer, and create/review a new snapshot and newly generated SQL. Do not remove its checks.

If any SQL script errors inside its transaction, issue `ROLLBACK;` before trying another query in the same session. Never run a selected fragment of these scripts; run the complete file.

## 6. Delete only after the rehearsal succeeds

- [ ] Duplicate the reviewed dry-run query and name it clearly, e.g. `APPROVED test cleanup`.
- [ ] In that copy, change ONLY the final `ROLLBACK;` to `COMMIT;`.
- [ ] Reconfirm the project, wall IDs, backup counts, and maintenance state. Run the whole query once.

The deletion is atomic: a failure causes the transaction to abort. Donations are removed before their linked commitments. Settings, content, images, and admin access are not deleted.

## 7. Verify and rehearse recovery BEFORE reopening

- [ ] Run this query. It should show zero signups and donations for both selected walls:

```sql
SELECT w.id, w.name,
  (SELECT count(*) FROM prayer_wall.commitments c WHERE c.wall_id = w.id) AS signups,
  (SELECT count(*) FROM prayer_wall.donations d WHERE d.giving_wall_id = w.id) AS donations
FROM prayer_wall.walls w
WHERE w.id IN ('00000000-0000-0000-0000-000000000002'::uuid, '25bc7657-e323-47e6-b8a0-c88db46a8250'::uuid);
```

- [ ] Re-run the snapshot query to inspect the remaining activity counts. The six deleted activity sections should be empty; retained webhook events may remain. Save any new export to a DIFFERENT filename so you do not overwrite the original backup.
- [ ] Run the ENTIRE generated `restore-dry-run.sql`, still ending in `ROLLBACK;`. It should restore the backed-up activity inside the transaction and then undo that restoration. Afterward the walls must still be empty. If recovery rehearsal fails, keep maintenance enabled and investigate before launch.
- [ ] Check admin categories, meditations, email copy, images, schedules, and theme settings are intact. Public totals should be zero after a full page reload.

If you actually need recovery: before accepting ANY real records, run a copy of the restore script with its final statement changed to `COMMIT;`. It restores the removed activity, including test reminder preferences, so keep cron and the site paused. Do not reopen production with restored test recipients. Recovery is for the same schema; do not apply migrations between cleanup and recovery rehearsal. The script refuses to restore into walls containing new activity.

## 8. Configure and deploy production

- [ ] In Supabase Edge Function Secrets, set `STRIPE_MODE=live`, the matching LIVE `STRIPE_SECRET_KEY`, and the LIVE endpoint's `STRIPE_WEBHOOK_SECRET`. Verify `GIVING_WALL_ID`, `APP_URL`, `SUPABASE_WALL_ID`, `FROM_EMAIL`, and the reminder Vault/`CRON_SECRET` configuration. Do not put Stripe secrets in frontend variables.
- [ ] Configure the LIVE Stripe webhook for this project and required checkout events. Keep the old TEST endpoint disabled. The backend's live-mode check must reject test events.
- [ ] Deploy the current frontend and modified edge functions. Frontend deployment alone does not update emails. See `README.md` for function-specific JWT flags; the shared email layout requires all three email senders to be redeployed.
- [ ] Resolve the known ESLint configuration failure and run the disposable-database integration checks before declaring production readiness. The recent unit tests/build pass, but those do not verify real email delivery or database access policies.

## 9. Reopen

- [ ] After verification, remove ONLY the temporary signup restriction:

```sql
DROP POLICY IF EXISTS cutover_block_new_signups ON prayer_wall.commitments;
```

- [ ] Re-enable ONLY reminder jobs that were active in your saved step-2 result. Replace the example job ID with the saved ID. Leave originally inactive jobs inactive:

```sql
SELECT cron.alter_job(12345, active := true); -- REPLACE 12345 with the saved jobid
```

- [ ] Reopen the website, reload both walls, and verify the empty wall/zero total starting point.
- [ ] Use a controlled real prayer signup to verify both emails, including the guide image. A live donation test requires a real payment and creates real records; do it deliberately, then cancel/refund in Stripe if appropriate.

Do not rerun the cleanup after real activity begins. Keep future synthetic tests out of this production backend until a separate environment or a fully enforced test-data feature exists.

## Validation limits

These scripts have not been executed against the real project. Docker/Postgres was unavailable locally when they were prepared, so database execution must be verified by the rollback rehearsals above. A successful rehearsal is a prerequisite to changing the deletion's final statement to COMMIT. None of these steps deletes Storage objects or Stripe resources automatically.
