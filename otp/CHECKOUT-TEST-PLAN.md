# Guest checkout verification checklist

Run this checklist on a preview build and test Worker before enabling checkout for customers. No D1 database is used.

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
- [ ] A successful Resend request returns a reference and clears the cart.
- [ ] Force Resend failure; checkout shows an error and keeps the cart.
- [ ] A sequential retry after a successful request returns the same reference during the 30-day KV marker TTL.
- [ ] Simulate simultaneous duplicate requests and an ambiguous provider timeout; note that KV cannot guarantee atomic deduplication, so duplicate owner emails remain possible in these edge cases.

## Worker and email
- [ ] Worker requires the existing OTP_STORE KV binding and RESEND_API_KEY_SRISAI secret for checkout; no D1 binding or schema is needed.
- [ ] Existing OTP send and verify routes pass regression tests with unchanged TTL, cooldown, and attempt limits.
- [ ] Order request rejects invalid IDs, quantities, unavailable products, malformed addresses, unknown origins, and missing required configuration.
- [ ] Order rate limiting uses a separate KV prefix and does not interfere with OTP keys.
- [ ] Resend sends owner notification to srisaivanicollections@gmail.com with product names/quantities, customer name/mobile, address, reference, and time, without prices.
- [ ] Confirm KV stores only an idempotency reference marker and rate-limit counters, not customer address or order payload.
- [ ] No public endpoint exposes prior orders.

## Device checks
- [ ] Mobile viewport around 360px: cart button, drawer, quantity controls, and checkout form fit without horizontal scrolling.
- [ ] Desktop viewport: cart control aligns in header and drawer stays within viewport.
- [ ] Keyboard: cart opens/closes, Escape closes it, form labels are accessible, focus indicators are visible.
- [ ] Check current Firefox and Android Chrome after the Worker is manually deployed to a test environment.
