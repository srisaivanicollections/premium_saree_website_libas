# Guest order checkout Worker setup

Guest checkout uses the existing Cloudflare Worker and existing KV namespace. **No D1 database, SQL schema, database binding, or Cron Trigger is required.**

## Required Worker configuration

1. Keep the existing KV namespace binding **`OTP_STORE`** unchanged.
2. Keep the existing secrets **`RESEND_API_KEY`** and **`RESEND_API_KEY_SRISAI`** unchanged. Checkout uses `RESEND_API_KEY_SRISAI` to notify `srisaivanicollections@gmail.com`; the existing OTP routes retain their current account-selection logic.
3. Verify that the Resend account can send from the configured sender. The order code currently uses `Sri Sai Vani Orders <onboarding@resend.dev>`. If Resend rejects it, use an approved sender for the order email without changing the OTP sender.
4. Deploy `otp/otp-worker.js` manually to a test Worker first, after reviewing the diff. Committing to GitHub does not deploy the Worker.

## Order API and privacy

POST to the existing Worker URL with JSON action `submitOrder`, an `Idempotency-Key` UUID, product IDs and quantities, customer full name/mobile, and shipping fields. No customer email is collected. The Worker validates product availability against the public GitHub catalogue and sends an owner-only notification. Email content deliberately excludes prices.

The existing KV namespace is reused for per-IP rate limiting and a 30-day idempotency marker containing only the order reference. Customer name, mobile, address, and the full order payload are not saved in KV. Sequential retries after a successful request return the same reference when the marker is available.

## Important limitation without a database

This is email-only, not a durable order-management system. Cloudflare KV is not transactional, so simultaneous duplicate requests or a timeout after Resend accepted the email can still result in duplicate owner notifications. Failed sends are not queued for automatic retry; the customer keeps the cart and can submit again. Do not describe the checkout as exactly-once or as a guaranteed order ledger.

Test actual Resend delivery and the existing Admin OTP flow in a test Worker before using checkout in production.
