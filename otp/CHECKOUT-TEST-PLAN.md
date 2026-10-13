# Guest checkout verification checklist

Run this checklist on a preview build and test Worker before enabling checkout for customers. Checkout sends an email only; it does not use a database or order storage.

## Storefront regression
- [ ] Catalogue still loads the full current product list, including Jewelry.
- [ ] Existing search, category tabs, sorting, pagination, sold-out states, badges, prices, WhatsApp links, and image fallback work.
- [ ] Header, shipping marquee, store information, reviews, and Instagram sections are unchanged.
- [ ] Admin Studio opens, sends OTP, verifies OTP, saves a product, and saves settings.
- [ ] OTP cooldown, expiry, invalid-code attempt limit, and one-time use still behave as before.

## Cart
- [ ] Add products from different categories and add the same product more than once.
- [ ] Cart count reflects total quantity and remains after refresh.
- [ ] Increase/decrease quantity, remove an item, and reach the empty-cart state.
- [ ] Sold-out items cannot be added; products removed from the catalogue are pruned from the cart.
- [ ] Cart localStorage contains product IDs and quantities only, never customer details.

## Checkout validation
- [ ] Full name and mobile are required and validated.
- [ ] House/street, city, district, state, and six-digit PIN are required; landmark is optional.
- [ ] No customer email field, customer email notification, prices, or totals appear in checkout.
- [ ] Submit Order is disabled during submission and shows safe errors.
- [ ] Successful Resend acceptance returns an order reference and clears the cart.
- [ ] Force Resend failure; checkout shows an error and keeps the cart.
- [ ] Success copy says the request was emailed to the store, not saved or recorded.
- [ ] A retry may send a duplicate email because no server-side order/idempotency storage exists.

## Worker and email
- [ ] Checkout requires only `RESEND_API_KEY_SRISAI`; it does not require OTP_STORE, D1, SQL, or Cron.
- [ ] Existing OTP send and verify routes pass regression tests with unchanged KV keys, TTL, cooldown, and attempt limits.
- [ ] Order request rejects invalid IDs, quantities, unavailable products, malformed addresses, unknown origins, and missing email configuration.
- [ ] Resend sends owner notification to srisaivanicollections@gmail.com with product names/quantities, customer name/mobile, address, reference, and time, without prices.
- [ ] No order payload, customer data, idempotency marker, or order rate-limit counter is persisted server-side.

## Device checks
- [ ] Mobile viewport around 360px: cart button, drawer, quantity controls, and checkout form fit without horizontal scrolling.
- [ ] Desktop viewport: cart control aligns in header and drawer stays within viewport.
- [ ] Keyboard: cart opens/closes, Escape closes it, form labels are accessible, focus indicators are visible.
- [ ] Check Firefox and Android Chrome after deploying the Worker manually to a test environment.
