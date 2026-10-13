# Guest checkout verification checklist

Run this checklist on a preview build and a non-production D1 database before merging or deploying.

## Storefront regression
- [ ] Catalogue still loads the full current product list, including Jewelry.
- [ ] Existing search, category tabs, sorting, pagination, sold-out states, badges, prices, WhatsApp links, and image fallback work.
- [ ] Header, shipping marquee, store information, reviews, and Instagram sections are unchanged.
- [ ] Admin Studio opens, sends OTP, verifies OTP, saves a product, and saves settings.
- [ ] OTP cooldown, expiry, invalid-code attempt limit, and one-time use still behave as before.

## Cart
- [ ] Add a product from each category and add the same product more than once.
- [ ] Cart count reflects total quantity and remains after refresh.
- [ ] Increase/decrease quantity, remove an item, and reach the empty-cart state.
- [ ] Sold-out items cannot be added; products removed from the authoritative catalogue are pruned from the cart.
- [ ] Cart localStorage contains product IDs and quantities only, never name/mobile/address.

## Checkout validation
- [ ] Full name and mobile are required and validated.
- [ ] House/street, city, district, state, and six-digit PIN are required; landmark is optional.
- [ ] No customer email field, customer email notification, prices, or totals appear in cart/checkout.
- [ ] Submit Order is disabled during submission and shows safe errors.
- [ ] Successful order shows a reference and clears the cart only after the server confirms it was saved.
- [ ] Simulate a network failure after submit, retry with the same idempotency key, and confirm only one order is stored.

## Worker and storage
- [ ] Existing OTP send and verify routes pass regression tests with unchanged TTL, cooldown, and attempt limits.
- [ ] Order request rejects invalid IDs, quantities, unavailable products, malformed addresses, unknown origins, and missing D1 binding.
- [ ] Same idempotency key returns the same reference and does not create a second order.
- [ ] Concurrent retries for one pending order acquire only one notification lease and send at most one owner email.
- [ ] Failed email delivery releases its lease for immediate retry; a crashed sender lease becomes eligible for retry after five minutes.
- [ ] D1 contains the order before the customer sees accepted success.
- [ ] Resend delivers an owner notification to srisaivanicollections@gmail.com; email has names/quantities/contact/address/reference/time and no prices.
- [ ] Temporarily force Resend failure; order remains saved as pending and the scheduled retry sends it after service recovers.
- [ ] Rate limiting applies to new order submissions without interfering with OTP KV keys.
- [ ] Confirm no endpoint exposes order records publicly.

## Device checks
- [ ] Mobile viewport around 360px: image cart button, drawer, quantity controls, and checkout form fit without horizontal scrolling.
- [ ] Desktop viewport: cart control aligns in header and drawer stays within viewport.
- [ ] Keyboard: cart opens/closes, Escape closes it, form labels are accessible, focus indicators are visible.
- [ ] Check current Firefox and Android Chrome after Cloudflare and D1 setup.
