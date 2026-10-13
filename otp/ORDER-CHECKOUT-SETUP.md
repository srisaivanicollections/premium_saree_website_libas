# Guest order checkout Worker setup

Guest checkout uses the existing Cloudflare Worker and Resend API. **No database, D1 binding, SQL schema, KV order storage, order rate-limit keys, or Cron Trigger is required for checkout.**

## Required Worker configuration

1. Keep the existing **`OTP_STORE`** binding for the Admin OTP flow. Checkout does not read or write it.
2. Keep the existing secrets **`RESEND_API_KEY`** and **`RESEND_API_KEY_SRISAI`** unchanged. Checkout uses `RESEND_API_KEY_SRISAI` to notify `srisaivanicollections@gmail.com`; the existing OTP routes continue using their existing configuration.
3. Verify the Resend account can send from the configured sender. The order code currently uses `Sri Sai Vani Orders <onboarding@resend.dev>`. If Resend rejects it, use an approved sender for order notifications without changing the OTP sender.
4. Deploy `otp/worker.js` manually to a test Worker first, after reviewing the diff. Committing to GitHub does not deploy the Worker.

## Email-only order flow

The storefront sends product IDs/quantities, customer name/mobile, and shipping address to the Worker. The Worker validates the request and product availability against the public catalogue, then emails the owner. No customer email is collected. The notification excludes prices.

The Worker does not persist the order, customer details, an idempotency marker, or order rate-limit counters. The only persistent KV use remains the existing Admin OTP flow.

## Important limitation

This is a notification email, not a durable order-management system. If a request is retried after an ambiguous provider timeout, the owner could receive duplicate emails. There is no server-side deduplication or automatic retry queue by design. A success response means Resend accepted the email request, not that the message has reached the inbox.

Test actual Resend delivery and the existing Admin OTP flow in a test Worker before using checkout in production.
