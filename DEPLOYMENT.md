# Oman’s Parfum production release

Use the existing Supabase project, Render API, and Netlify storefront. Supabase permissions
remain a production risk until the first migration commits. The revised frontend and backend
must come from the same reviewed release. The existing `d61306f` draft predates the merchant
dashboard and performance revision.

## Completed compatibility checks

The encrypted production archive was restored. Both original migrations passed against the
restored database. The final merchant migration passed twice on a disposable copy of that
restored database. Those checks preserved the 16 products and their original fields, the
settings row, and existing order data. The tested changes preserve bigint IDs, retain images
and prices, reconcile stock and delivery fee aliases, and add publication and merchandising
fields with safe defaults. Frontend build and local admin and checkout tests are complete.

## 1. Prepare both release artifacts with the current site live

1. Keep Render Auto-Deploy off and the current Netlify deployment published and locked.
   Record the current deploy references. Push only the approved revision to GitHub `main`
   and confirm its SHA. Wait for separate approval before uploading the Netlify draft.
2. Prepare a manual Netlify draft on the existing `omansvogue` site using the matching
   prebuilt `dist` and the current Render API origin. Use the CLI in draft mode with
   `--no-build`; Netlify Drop is a production upload. Check the draft’s homepage, assets
   and direct `/admin` route, and verify the live deploy ID is still locked.
   [Netlify draft deploys](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/#draft-deploys)
3. Confirm the next Render deploy has `CHECKOUT_ENABLED=false` saved. Keep separate approval
   gates for production SQL, Render deployment, Netlify publication, and opening checkout.

## 2. Pause application writes and apply the release migrations

1. In the approved cutover window, use **Manual Deploy → Deploy a specific commit** on
   the existing Render service to deploy `2aeb8306ea63aee878e44c8e365e391403b866d1` from
   `codex/omans-cutover-pause`. The pause build keeps catalogue reads available and
   blocks application writes even if the checkout flag is ignored by the old release.
   Pause any separate writers and keep the Netlify deploy published. Confirm
   `/api/health` reports `cutoverPaused: true`, the catalogue loads, and an empty
   `POST /api/orders` returns `503` with code `omans_cutover_paused`.
   [Render specific commit](https://render.com/docs/deploys#deploying-a-specific-commit)
2. Keep the existing verified archive available. If production writes since its capture
   cannot be ruled out, use the existing [backup script](scripts/backup-supabase.sh) for one
   fresh encrypted archive after the write pause. Keep both archives. No repeat restore
   rehearsal is needed. Retain the Render disk settings and Cloudinary assets.
3. With explicit approval, open the existing production Supabase project and privately
   compare it with Render’s configured `SUPABASE_URL`. In **SQL Editor**, paste each
   complete file in its own query and wait for success before running the next one.

   1. [202611180001_manual_momo_checkout.sql](supabase/migrations/202611180001_manual_momo_checkout.sql)
   2. [202611180002_catalogue_and_inventory.sql](supabase/migrations/202611180002_catalogue_and_inventory.sql)
   3. [202611190001_merchant_catalogue.sql](supabase/migrations/202611190001_merchant_catalogue.sql)
   4. [202611190002_momo_payment_instructions.sql](supabase/migrations/202611190002_momo_payment_instructions.sql)

   Each file owns its transaction and stops on a lock wait longer than five seconds.
   A successful run with no rows is expected. Stop on any error. A previous committed
   migration stays in place.
4. Run the single [read-only release check](supabase/checks/manual_momo_post_migration.sql).
   Expect RLS on all four tables, direct public table privileges denied, and backend
   read/insert/update allowed with delete/truncate denied. Check both deduplication
   indexes, the publication guard, settings revision, the payment instructions column,
   and zero inventory or fee mismatches.
   Compare product and order counts and product IDs with the cutover snapshot.

## 3. Deploy the matched release and verify while checkout is closed

1. After approval, manually deploy the exact GitHub SHA to the existing Render service
   with root `backend`, build `npm ci`, start `npm start`, health check `/api/health`,
   and `CHECKOUT_ENABLED=false`. The pause build stays live until Render promotes a
   healthy release.
2. Check the deployed `/api/health` and `/api/storefront/catalogue`. Use one valid-item
   request to `POST /api/checkout/quote` and require `503` with checkout paused. Require
   `401` on a signed-out order or admin-settings request. Verify the public catalogue
   response omits MoMo settings. These checks use no payment or order submission.
3. After separate approval, publish only the verified matching Netlify draft to the
   existing site. Keep the new published deploy locked. Verify the storefront and
   catalogue on mobile, then sign in at `/admin` and verify the settings and product
   list. Keep the existing Render origin as the frontend API target.
4. The merchant enters actual stock, MoMo number, account name and any custom checkout
   directions, and confirms the
   separate WhatsApp order number, pickup location and campus delivery charge. Keep
   checkout closed until the hosted checks and merchant configuration pass and the
   merchant explicitly approves opening checkout. Then watch one approved genuine
   pickup order. Confirm its total, one saved pending order, WhatsApp retry to the same
   receipt, and revenue only after the merchant verifies the actual payment.

## Production variables already reviewed

| Service | Variables |
| --- | --- |
| Render | `NODE_ENV=production`, `CHECKOUT_ENABLED=false`, existing `CLIENT_ORIGIN`, `CORS_ORIGINS`, `ADMIN_USERNAME`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Initial admin | Existing `ADMIN_PASSWORD` must be unique and 12–128 characters. Remove the bootstrap value after verifying regular sign-in and obtain approval before changing Render settings. |
| Render disk | Keep the current mount and any configured `DATA_DIR`, `UPLOADS_DIR`, or `BRAND_UPLOADS_DIR`. |
| Netlify | `VITE_API_URL` for the existing Render origin, built into the static release. |

## Recovery stops

- **SQL error.** Keep the pause build live. Each failed SQL file rolls itself back. Retain any
  committed security migration and the encrypted snapshots while correcting the issue.
- **Render failure.** Keep the pause build live and checkout closed. The old live commit
  is a pre-cutover reference. After database changes, use a backend artifact verified
  against the migrated database and current draft-product visibility, or correct the
  issue forward.
- **Netlify failure.** The current locked deployment remains the reference until publication.
  After a publish issue, restore and lock the recorded static deploy with separate approval.
  This leaves database records intact.
- **Checkout or payment failure.** Close checkout, preserve saved orders and work forward.
  A database restore is a last resort requiring separate approval. Back up current data
  and reconcile all changes after the chosen recovery point before restoring.

[Render rollback](https://render.com/docs/rollbacks) · [Netlify rollback](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/) · [Supabase backup and restore](https://supabase.com/docs/guides/platform/backups)

## Outside-campus delivery follow-up

1. After approval, apply the single additive
   [delivery quote migration](supabase/migrations/202611190003_outside_campus_delivery.sql)
   to the existing Supabase project. It adds private quotes and an optional link from a
   completed order. Existing products, settings and orders need no data updates.
2. Deploy the matched backend to the existing Render service, then publish the matched
   frontend on the existing Netlify site. The secure links use the existing
   `CLIENT_ORIGIN` and `JWT_SECRET`. The existing checkout flag continues to apply.
3. Verify free pickup and a GH₵10 listed campus destination, then use a controlled
   outside-campus request with approval. In **Orders → Outside-campus delivery quotes**,
   confirm the rider fee and open WhatsApp to send the link. The link expires after
   24 hours. Check the product subtotal and delivery fee separately, confirm that the
   request did not create an order or reserve stock, and verify a controlled order only
   after the merchant confirms receipt of the actual MoMo payment.

Keep the additive migration in place if an application rollback is needed. The previous
release can still serve regular checkout. Restore the delivery-enabled release before
using previously issued outside-campus links.
