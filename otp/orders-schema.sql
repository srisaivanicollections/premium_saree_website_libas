-- Apply once to the Cloudflare D1 database bound to the Worker as ORDERS_DB.
-- Order records are private server-side data. Do not expose a public list/read endpoint.
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  notification_status TEXT NOT NULL CHECK (notification_status IN ('pending', 'sent')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
