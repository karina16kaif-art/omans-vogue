# Oman’s Parfum production launch

The storefront is the existing Netlify React app. Render runs Express, Supabase stores the
catalogue and orders, and Cloudinary stores product and hero images. Use the existing
services, production domains and linked GitHub repository. Production changes require
explicit approval.

## 1. Prepare and approve

**Complete.** The Free Plan manual archive was restored from the encrypted Mac backup.
Both migrations passed against the restored storefront schema and data. The rehearsal
preserved all 16 products and their existing fields, the settings row and the GH₵10 fee.
The archive had zero orders. Local database probes passed for ID generation, table and
function permissions, checkout deduplication, inventory and admin credentials. Hosted
Supabase and provider integration still need the smoke tests below.

**Next.** Confirm the production inputs in the environment table using the existing Render
and Netlify dashboards. Review values privately. Record each current live deploy ID and
Git SHA before cutover. If Render shows a persistent disk, retain its settings and plan
for a brief API restart. [Render persistent disk deploys](https://render.com/docs/disks#limitations-and-considerations)

After approval, turn Render Auto-Deploy off and lock the current published Netlify deploy.
Push only the reviewed release, record its SHA, and wait for the matching Netlify build to
be ready for manual publication. Keep serving the current Netlify deploy during preparation.
[Render deploy controls](https://render.com/docs/deploys) · [Netlify locked deploys](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#locked-deploys)

Immediately before migrating, pause catalogue and legacy checkout writes and reconcile any
in-flight Hubtel payments. The new checkout gate applies to the new API. If the current
backend is still accepting legacy checkout writes, confirm how its order and payment
endpoints will be paused. The Netlify publish lock only controls which build is served.
Use a short approved maintenance window if the existing controls cannot pause writes
selectively. Take a fresh backup after the write freeze and require the script to confirm
that it can read the archive. Retain both encrypted backups. Preserve the Render disk and
back up local files if they are in use. Supabase stores image URLs and Cloudinary hosts the
assets.

```sh
/bin/bash scripts/backup-supabase.sh \
  "$HOME/Downloads/prod-ca-2021.crt" \
  "/Volumes/Omans Backup"
```

[Supabase backup and recovery documentation](https://supabase.com/docs/guides/platform/backups)

## 2. Apply the approved database changes

After approval, open the **target project's** SQL Editor and run these files individually,
in this order. Each file owns its transaction. A lock wait longer than five seconds aborts
that file.

1. [202611180001_manual_momo_checkout.sql](supabase/migrations/202611180001_manual_momo_checkout.sql)
   sets up secured checkout, settings, order deduplication and admin authentication.
2. [202611180002_catalogue_and_inventory.sql](supabase/migrations/202611180002_catalogue_and_inventory.sql)
   sets up catalogue metadata, product identity, synchronized inventory and verified sales rankings.

Stop if either file fails. If file 1 committed and file 2 failed, retain file 1's protections,
keep checkout closed and resolve the reported issue before retrying file 2. After both files
succeed, run the [post-migration check](supabase/checks/manual_momo_post_migration.sql).
Expect RLS enabled on all four application tables, all public role access false, service
read/insert/update allowed with row deletion and truncation denied, both checkout indexes
ready, and fee and stock mismatches at zero. Compare row counts and product ID bounds with
the fresh backup. Review the count of enabled products with recorded zero stock.

## 3. Deploy the reviewed SHA with checkout closed

1. **Render.** Confirm root `backend`, build `npm ci`, start `npm start`, and health check
   `/api/health`. Retain the existing service, Supabase project, Cloudinary configuration and
   disk paths. Set `CHECKOUT_ENABLED=false` when preparing the initial deployment. Use
   **Save only** for environment changes before the manual deploy. After the SQL checks
   pass, select **Manual Deploy → Deploy a specific commit** and choose the reviewed SHA.
   Confirm `/api/health`, `/api/products` and the hosted closed-checkout checks below.
   [Render environment save options](https://render.com/docs/configure-environment-variables) · [Render manual deploys](https://render.com/docs/deploys#deploying-a-specific-commit)
2. **Netlify.** Verify the ready build uses base `frontend`, command `npm run build`, publish
   directory `dist`, and the existing production Render origin as `VITE_API_URL`. Manually
   publish the reviewed SHA after the Render checks. Verify the storefront and `/admin`
   on the existing domain.
3. **Merchant setup.** Sign in and enter the actual sellable stock and merchant MoMo number
   and registered account name. Confirm the separate WhatsApp number, pickup location and
   campus fee. Check a representative price and image on the live storefront. Keep checkout
   closed until these checks pass. Schedule the approved pilot before enabling checkout.

### Environment variables

| Where | Variables |
|---|---|
| Render | `NODE_ENV=production`, `CLIENT_ORIGIN` and `CORS_ORIGINS` for existing storefront origins, existing `ADMIN_USERNAME`, `JWT_SECRET`, `SUPABASE_URL` for the verified production project, one of `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CHECKOUT_ENABLED=false` for cutover. The app requires explicit `true` in production to open checkout. |
| Render bootstrap | `ADMIN_PASSWORD` for the first admin login only. Keep the admin username. Use a unique password of 12–128 characters and a valid signing secret of at least 32 characters. Remove the bootstrap password after verifying repeat sign-in. |
| Render disk, if used | `DATA_DIR`, `UPLOADS_DIR`, `BRAND_UPLOADS_DIR`. Retain the current disk and paths for existing uploaded files. Render supplies `PORT`. |
| Netlify | Production `VITE_API_URL` must resolve to the existing Render HTTPS API origin. Supabase and Cloudinary credentials belong in Render. |
| Optional notifications | `ADMIN_NOTIFICATION_EMAIL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ADMIN_WHATSAPP_NUMBER`, `WHATSAPP_ALERT_WEBHOOK_URL`. Enable only for approved merchant destinations that can receive order information. |

[Supabase server keys](https://supabase.com/docs/guides/getting-started/api-keys)

## 4. Minimum hosted smoke tests

- With the SQL checks passing, use a public Supabase key and request only `id` with `limit=0`
  on `orders`, `products` and `brand_settings`, and `username` with `limit=0` on
  `admin_credentials`. Expect access denied for each. In Express, confirm signed-out order
  and admin settings reads and product/settings writes return 401. Verify the public
  catalogue displays saved prices, images and availability, and public settings omit the
  MoMo details.
- With checkout closed, submit a valid cart quote on the hosted API and expect 503 with the
  paused message before receiving payment instructions. Check the published storefront, a
  collection, images, cart and admin sign-in on desktop and mobile.
- Once the merchant confirms the inventory and payment settings, explicitly set
  `CHECKOUT_ENABLED=true` and run one approved merchant pickup order for a stocked item.
  Confirm the real MoMo destination, zero pickup fee, correct total and separate WhatsApp
  destination. Use the approved payment reference and verify one order is saved as pending.
  Retry the receipt, confirm the same ID and one stock deduction, and check that WhatsApp
  opens a draft the customer must send. After the merchant checks the actual receipt, mark
  the payment verified in admin and confirm it appears in revenue. Retain the pilot order.
  Close checkout again if the pilot fails.

## 5. Rollback and merchant details

If the pilot fails, set `CHECKOUT_ENABLED=false` and freeze writes while you investigate.
Keep the security changes and saved orders. Republish a known-compatible Netlify deploy and
roll Render back only to an artifact tested against the migrated database and the checkout
gate. Keep the storefront in maintenance if such an artifact is unavailable. A database
restore is a last resort. Take a fresh backup first and reconcile any orders or inventory
changes after the restore point to avoid discarding them.
[Render rollback](https://render.com/docs/rollbacks) ·
[Netlify rollback](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/) ·
[Supabase restore](https://supabase.com/docs/guides/platform/backups)

The merchant needs to confirm the MoMo number and account name, the separate WhatsApp order
number, the saved fee and pickup location, and actual quantities for products recorded as
zero or untracked. Enter real variant sizes and quantities before enabling those variants.
Feature and collection assignments are optional launch merchandising. Customers must press
Send in WhatsApp. The checkout request ID makes retries idempotent, and reuse of the same
MoMo phone and transaction reference for a new checkout is rejected. Pending orders reserve tracked stock. Review cancellations in admin and
adjust stock if it should be returned.
