/**
 * Sri Sai Vani Collections - Admin OTP Worker
 *
 * Required Cloudflare Worker bindings/secrets:
 *   KV namespace binding: OTP_STORE
 *   Secret: RESEND_API_KEY (Vinith)
 *   Secret: RESEND_API_KEY_SRISAI (Sri Sai Vani)
 *
 * Deploy this file to the Worker separately. Committing it to GitHub provides
 * version control only; it does not automatically deploy the Cloudflare Worker.
 */

const ALLOWED_ORIGINS = new Set([
  "https://vinith1111.github.io",
  "https://srisaivanicollections.github.io",
]);

const ADMIN_EMAILS = new Set([
  "vinith.paithari@gmail.com",
  "srisaivanicollections@gmail.com",
]);

const OTP_TTL_SECONDS = 300; // 5 minutes
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;

function jsonResponse(body, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function randomOtp() {
  // Generate a uniformly distributed six-digit code using Web Crypto.
  const values = new Uint32Array(1);
  const range = 1_000_000;
  const ceiling = Math.floor(0x1_0000_0000 / range) * range;
  let value;

  do {
    crypto.getRandomValues(values);
    value = values[0];
  } while (value >= ceiling);

  return String(value % range).padStart(6, "0");
}

async function sendOtpEmail(env, email, otp) {
  // Select the Resend account associated with the requested Admin email.
  const apiKey = email === "srisaivanicollections@gmail.com"
    ? env.RESEND_API_KEY_SRISAI
    : env.RESEND_API_KEY;

  if (!apiKey) {
    console.error("Missing Resend API key for authorized Admin email.");
    throw new Error("Email provider is not configured for this address.");
  }
  const subject = `Your Sri Sai Vani Admin verification code: ${otp}`;
  const text = [
    "Sri Sai Vani Collections Admin verification",
    "",
    `Your verification code is: ${otp}`,
    "",
    "Enter this six-digit code in the Admin sign-in window.",
    "This code expires in 5 minutes and can be used only once.",
    "If you did not request this code, you can ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#faf7f2;color:#1c1917;font-family:Arial,Helvetica,sans-serif">
    <main style="max-width:480px;margin:0 auto;background:#fff;padding:28px;border:1px solid #e4d8c5;border-radius:12px">
      <p style="margin:0 0 12px;color:#7b6848;font-size:12px;letter-spacing:1.5px;text-transform:uppercase">Sri Sai Vani Collections</p>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px">Admin verification code</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px">Use this six-digit code to sign in to Admin Studio:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;background:#f4f0e9;border-radius:8px;width:auto"><tr><td align="center" valign="middle" style="padding:12px 8px 12px 14px;font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:700;letter-spacing:6px;line-height:1.2;color:#1c1917;white-space:nowrap">${otp}</td><td align="center" valign="middle" style="padding:10px 12px 10px 6px"><a href="https://srisaivanicollections.github.io/otp/copy-otp.html#${otp}" style="display:inline-block;padding:11px 14px;border:0;border-radius:7px;background:#1c1917;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;line-height:1.2;text-align:center;text-decoration:none;white-space:nowrap">Copy code</a></td></tr></table>
      <p style="font-size:13px;line-height:1.6;text-align:center;color:#625d55;margin:0 0 14px">Copy the code and paste it into the Admin sign-in window you already opened.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 8px">This code expires in <strong>5 minutes</strong> and can be used only once.</p>
      <p style="font-size:13px;line-height:1.6;color:#625d55;margin:0">If you did not request this code, ignore this email.</p>
    </main>
  </body>
</html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Sri Sai Vani Admin <onboarding@resend.dev>",
      to: [email],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    // Do not return provider response details or credentials to the browser.
    console.error("Resend email request failed with status", response.status);
    throw new Error("Could not send the verification email. Please try again later.");
  }
}


const ORDER_NOTIFICATION_TO = "srisaivanicollections@gmail.com";
const ORDER_CATALOG_URL = "https://raw.githubusercontent.com/srisaivanicollections/srisaivanicollections.github.io/main/data/products.json";
const ORDER_MAX_ITEMS = 40;
const ORDER_MAX_QUANTITY = 20;

function cleanOrderText(value, maxLength = 160) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function validOrderMobile(value) {
  return /^\+?[0-9]{10,13}$/.test(String(value || "").replace(/[\s()-]/g, ""));
}
function orderEscapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
async function sendOrderNotification(env, order) {
  if (!env.RESEND_API_KEY_SRISAI) throw new Error("Order notification email is not configured.");
  const itemLines = order.items.map(item => "• " + item.name + " × " + item.quantity).join("\n");
  const address = [order.shipping.houseStreet, order.shipping.landmark, order.shipping.city, order.shipping.district, order.shipping.state, order.shipping.pinCode].filter(Boolean).join(", ");
  const text = [
    "New Sri Sai Vani Collections order",
    "Order reference: " + order.reference,
    "Submitted: " + order.createdAt,
    "",
    "Items:",
    itemLines,
    "",
    "Customer: " + order.customer.fullName,
    "Mobile: " + order.customer.mobile,
    "Shipping address: " + address
  ].join("\n");
  const html = "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#1c1917\"><h2>New store order</h2><p><strong>Reference:</strong> " + orderEscapeHtml(order.reference) + "<br><strong>Submitted:</strong> " + orderEscapeHtml(order.createdAt) + "</p><h3>Items</h3><ul>" + order.items.map(item => "<li>" + orderEscapeHtml(item.name) + " × " + item.quantity + "</li>").join("") + "</ul><h3>Customer</h3><p>" + orderEscapeHtml(order.customer.fullName) + "<br>Mobile: " + orderEscapeHtml(order.customer.mobile) + "</p><h3>Shipping address</h3><p>" + orderEscapeHtml(address) + "</p></body></html>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.RESEND_API_KEY_SRISAI, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Sri Sai Vani Orders <onboarding@resend.dev>",
      to: [ORDER_NOTIFICATION_TO],
      subject: "New store order " + order.reference,
      text,
      html
    })
  });
  if (!response.ok) {
    console.error("Order notification email failed with status", response.status);
    throw new Error("Order notification could not be sent.");
  }
}
async function submitOrder(request, env, origin, payload) {
  if (!env.ORDERS_DB) return jsonResponse({ success: false, message: "Order storage is not configured yet." }, 503, origin);
  const idempotencyKey = String(request.headers.get("Idempotency-Key") || payload?.idempotencyKey || "");
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) return jsonResponse({ success: false, message: "Refresh checkout and try again." }, 400, origin);
  const customer = payload?.customer || {};
  const shipping = payload?.shipping || {};
  const fullName = cleanOrderText(customer.fullName, 100);
  const mobile = String(customer.mobile || "").replace(/[\s()-]/g, "");
  const fields = {
    houseStreet: cleanOrderText(shipping.houseStreet, 180),
    landmark: cleanOrderText(shipping.landmark, 120),
    city: cleanOrderText(shipping.city, 100),
    district: cleanOrderText(shipping.district, 100),
    state: cleanOrderText(shipping.state, 100),
    pinCode: String(shipping.pinCode || "").trim()
  };
  if (fullName.length < 2 || !validOrderMobile(mobile)) return jsonResponse({ success: false, message: "Enter a valid name and mobile number." }, 400, origin);
  if (!fields.houseStreet || !fields.city || !fields.district || !fields.state || !/^[1-9][0-9]{5}$/.test(fields.pinCode)) return jsonResponse({ success: false, message: "Complete all required shipping address fields and enter a valid PIN code." }, 400, origin);
  if (Object.values(fields).some(value => value.length > 180)) return jsonResponse({ success: false, message: "One or more address fields are too long." }, 400, origin);
  const submitted = payload?.items;
  if (!Array.isArray(submitted) || submitted.length < 1 || submitted.length > ORDER_MAX_ITEMS) return jsonResponse({ success: false, message: "Your cart is empty or too large." }, 400, origin);
  const seen = new Set();
  const ids = [];
  for (const row of submitted) {
    const productId = Number(row?.id), quantity = Number(row?.quantity);
    if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > ORDER_MAX_QUANTITY || seen.has(productId)) return jsonResponse({ success: false, message: "Cart items are invalid. Please review your cart." }, 400, origin);
    seen.add(productId); ids.push({ id: productId, quantity });
  }
  let catalog;
  try {
    const response = await fetch(ORDER_CATALOG_URL, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Catalog unavailable");
    catalog = await response.json();
  } catch {
    return jsonResponse({ success: false, message: "The product catalogue could not be verified. Please try again." }, 503, origin);
  }
  if (!Array.isArray(catalog)) return jsonResponse({ success: false, message: "The product catalogue could not be verified." }, 503, origin);
  const productsById = new Map(catalog.map(product => [Number(product.id), product]));
  const items = [];
  for (const row of ids) {
    const product = productsById.get(row.id);
    if (!product || product.availability === false || product.inStock === false || product.outOfStock === true) return jsonResponse({ success: false, message: "A selected item is no longer available. Please refresh your cart." }, 409, origin);
    items.push({ id: row.id, name: cleanOrderText(product.name, 120), quantity: row.quantity });
  }
  const existing = await env.ORDERS_DB.prepare("SELECT order_ref, payload_json, notification_status FROM orders WHERE idempotency_key = ?").bind(idempotencyKey).first();
  let order;
  if (existing) {
    order = JSON.parse(existing.payload_json);
    if (existing.notification_status !== "sent") {
      try {
        await sendOrderNotification(env, order);
        await env.ORDERS_DB.prepare("UPDATE orders SET notification_status = 'sent' WHERE idempotency_key = ?").bind(idempotencyKey).run();
      } catch {
        return jsonResponse({ success: true, accepted: true, reference: existing.order_ref, notificationPending: true, message: "Your order is saved. Store notification is pending." }, 202, origin);
      }
    }
    return jsonResponse({ success: true, accepted: true, reference: existing.order_ref, message: "Your order has been received." }, 200, origin);
  }
  // Basic per-IP throttling for new guest orders. Uses a dedicated KV prefix,
  // so it cannot collide with OTP, cooldown, or verification-attempt records.
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clientIp));
  const ipHash = Array.from(new Uint8Array(ipDigest)).map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const rateKey = "order-rate:" + ipHash;
  const rateCount = Number(await env.OTP_STORE.get(rateKey) || "0");
  if (rateCount >= 5) return jsonResponse({ success: false, message: "Too many order attempts. Please wait before trying again." }, 429, origin);
  await env.OTP_STORE.put(rateKey, String(rateCount + 1), { expirationTtl: 3600 });

  const reference = "SSV-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + crypto.randomUUID().slice(0,8).toUpperCase();
  order = {
    reference,
    createdAt: new Date().toISOString(),
    customer: { fullName, mobile },
    shipping: fields,
    items
  };
  try {
    await env.ORDERS_DB.prepare("INSERT INTO orders (order_ref, idempotency_key, payload_json, notification_status, created_at) VALUES (?, ?, ?, 'pending', ?)").bind(reference, idempotencyKey, JSON.stringify(order), order.createdAt).run();
  } catch (error) {
    const duplicate = await env.ORDERS_DB.prepare("SELECT order_ref, payload_json, notification_status FROM orders WHERE idempotency_key = ?").bind(idempotencyKey).first();
    if (!duplicate) {
      console.error("Order persistence failed:", error instanceof Error ? error.message : "Unknown error");
      return jsonResponse({ success: false, message: "We could not save your order. Your cart has been kept; please try again." }, 503, origin);
    }
    order = JSON.parse(duplicate.payload_json);
  }
  try {
    await sendOrderNotification(env, order);
    await env.ORDERS_DB.prepare("UPDATE orders SET notification_status = 'sent' WHERE order_ref = ?").bind(order.reference).run();
  } catch {
    return jsonResponse({ success: true, accepted: true, reference: order.reference, notificationPending: true, message: "Your order is saved. Store notification is pending." }, 202, origin);
  }
  return jsonResponse({ success: true, accepted: true, reference: order.reference, message: "Your order has been received." }, 201, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 403, headers: { "Vary": "Origin" } });
      }

      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, message: "Method not allowed." }, 405, origin);
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse({ success: false, message: "Origin not allowed." }, 403);
    }

    if (!env.OTP_STORE || !env.RESEND_API_KEY) {
      console.error("Worker configuration is missing OTP_STORE or RESEND_API_KEY.");
      return jsonResponse({ success: false, message: "OTP service is not configured." }, 500, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ success: false, message: "Invalid request body." }, 400, origin);
    }

    const action = String(payload?.action || "").trim().toLowerCase();
    if (action === "submitOrder") return submitOrder(request, env, origin, payload);
    const email = normalizeEmail(payload?.email);

    if (!isValidEmail(email)) {
      return jsonResponse({ success: false, message: "Enter a valid email address." }, 400, origin);
    }

    if (!ADMIN_EMAILS.has(email)) {
      return jsonResponse({ success: false, message: "This email is not authorized for Admin access." }, 403, origin);
    }

    const otpKey = `otp:${email}`;
    const cooldownKey = `cooldown:${email}`;
    const attemptsKey = `attempts:${email}`;

    if (action === "send") {
      const existingCooldown = await env.OTP_STORE.get(cooldownKey);
      if (existingCooldown) {
        return jsonResponse({
          success: false,
          message: "Please wait before requesting another code.",
        }, 429, origin);
      }

      const otp = randomOtp();

      try {
        // Send first; store the OTP only if the email provider accepts the request.
        await sendOtpEmail(env, email, otp);
      } catch (error) {
        console.error("OTP email delivery failed:", error instanceof Error ? error.message : "Unknown error");
        return jsonResponse({
          success: false,
          message: "Could not send the verification email. Please try again later.",
        }, 502, origin);
      }

      const record = {
        otp,
        expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
      };

      await Promise.all([
        env.OTP_STORE.put(otpKey, JSON.stringify(record), { expirationTtl: OTP_TTL_SECONDS }),
        env.OTP_STORE.put(cooldownKey, "1", { expirationTtl: RESEND_COOLDOWN_SECONDS }),
        env.OTP_STORE.delete(attemptsKey),
      ]);

      return jsonResponse({ success: true, message: "OTP sent." }, 200, origin);
    }

    if (action === "verify") {
      const submittedOtp = String(payload?.otp || "").replace(/\D/g, "");
      if (!/^\d{6}$/.test(submittedOtp)) {
        return jsonResponse({ success: false, message: "Enter the 6-digit OTP." }, 400, origin);
      }

      const currentAttempts = Number(await env.OTP_STORE.get(attemptsKey) || "0");
      if (currentAttempts >= MAX_VERIFY_ATTEMPTS) {
        return jsonResponse({
          success: false,
          message: "Too many incorrect attempts. Request a new code.",
        }, 429, origin);
      }

      const stored = await env.OTP_STORE.get(otpKey);
      if (!stored) {
        return jsonResponse({
          success: false,
          message: "This code has expired or was already used. Request a new code.",
        }, 400, origin);
      }

      let record;
      try {
        record = JSON.parse(stored);
      } catch {
        await env.OTP_STORE.delete(otpKey);
        return jsonResponse({ success: false, message: "Invalid code. Request a new one." }, 400, origin);
      }

      if (!record?.expiresAt || Date.now() > record.expiresAt) {
        await Promise.all([
          env.OTP_STORE.delete(otpKey),
          env.OTP_STORE.delete(attemptsKey),
        ]);
        return jsonResponse({
          success: false,
          message: "This code has expired. Request a new code.",
        }, 400, origin);
      }

      if (record.otp !== submittedOtp) {
        const nextAttempts = currentAttempts + 1;
        await env.OTP_STORE.put(attemptsKey, String(nextAttempts), {
          expirationTtl: OTP_TTL_SECONDS,
        });

        return jsonResponse({
          success: false,
          message: nextAttempts >= MAX_VERIFY_ATTEMPTS
            ? "Too many incorrect attempts. Request a new code."
            : "Incorrect code. Please try again.",
        }, 400, origin);
      }

      await Promise.all([
        env.OTP_STORE.delete(otpKey),
        env.OTP_STORE.delete(attemptsKey),
        env.OTP_STORE.delete(cooldownKey),
      ]);

      return jsonResponse({ success: true, message: "OTP verified." }, 200, origin);
    }

    return jsonResponse({ success: false, message: "Unsupported action." }, 400, origin);
  },
  async scheduled(controller, env, ctx) {
    if (!env.ORDERS_DB || !env.RESEND_API_KEY_SRISAI) return;
    const pending = await env.ORDERS_DB.prepare("SELECT order_ref, payload_json FROM orders WHERE notification_status = 'pending' ORDER BY created_at ASC LIMIT 20").all();
    for (const row of (pending.results || [])) {
      try {
        const order = JSON.parse(row.payload_json);
        await sendOrderNotification(env, order);
        await env.ORDERS_DB.prepare("UPDATE orders SET notification_status = 'sent' WHERE order_ref = ? AND notification_status = 'pending'").bind(row.order_ref).run();
      } catch (error) {
        console.error("Scheduled order notification retry failed for", row.order_ref, error instanceof Error ? error.message : "Unknown error");
      }
    }
  },
};
