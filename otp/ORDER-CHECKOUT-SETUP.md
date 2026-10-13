# Guest order checkout Worker setup

The existing Admin OTP flow remains in \`otp/otp-worker.js\`. The \`submitOrder\` action is a separate branch; do not remove or rename OTP actions or their bindings.

## Cloudflare setup before enabling checkout

1. Create a **D1 database** for store orders.
2. Run \`orders-schema.sql\` against that database once.
3. Bind the database to the existing \`ssv-admin-otp\` Worker with binding name **\`ORDERS_DB\`**.
4. Keep existing \`OTP_STORE\`, \`RESEND_API_KEY\`, and \`RESEND_API_KEY_SRISAI\` bindings/secrets unchanged.
5. Verify that the existing Resend account can send to \`srisaivanicollections@gmail.com\` and that its configured sender is permitted. The code reuses the existing \`onboarding@resend.dev\` sender currently used for OTP; if Resend rejects order mail, use a sender/domain already verified in your account, without changing the OTP sender.
6. Deploy \`otp/otp-worker.js\` manually to Cloudflare after reviewing the diff.

## Order API

POST to the existing Worker URL with JSON action \`submitOrder\`, an \`Idempotency-Key\` UUID, product IDs and quantities, customer full name/mobile, and shipping fields. No customer email is collected. The Worker validates product availability against the public GitHub catalogue, stores orders in D1, and sends an owner-only notification. Email content deliberately excludes prices.

The same idempotency key may be submitted again after an ambiguous network failure. The Worker returns the original reference and retries a pending notification rather than inserting a second order.

## Important limitation

A D1 database is required before orders can be accepted. Without the \`ORDERS_DB\` binding, the endpoint returns a configuration error and does not claim the order was placed. Verify the Resend sender before production use. Do not enable checkout for customers until a real end-to-end test confirms D1 persistence and owner email delivery.
