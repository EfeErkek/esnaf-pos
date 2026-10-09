-- ============================================================
-- ESNAF POS - SQLite Veritabanı Şeması
-- ============================================================

-- Ürünler Tablosu
CREATE TABLE IF NOT EXISTS Products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode     TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    buy_price   REAL NOT NULL DEFAULT 0,
    sell_price  REAL NOT NULL DEFAULT 0,
    stock       INTEGER NOT NULL DEFAULT 0,
    min_stock   INTEGER NOT NULL DEFAULT 5,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Satışlar Tablosu (Her satış işlemi)
CREATE TABLE IF NOT EXISTS Sales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    total_amount    REAL NOT NULL,
    payment_type    TEXT NOT NULL CHECK(payment_type IN ('CASH', 'CARD')),
    commission_rate REAL NOT NULL DEFAULT 0,
    commission_amt  REAL NOT NULL DEFAULT 0,
    net_amount      REAL NOT NULL,
    sale_date       TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Satış Kalemleri (Sepet içeriği)
CREATE TABLE IF NOT EXISTS SaleItems (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id     INTEGER NOT NULL REFERENCES Sales(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES Products(id),
    barcode     TEXT NOT NULL,
    name        TEXT NOT NULL,
    qty         INTEGER NOT NULL DEFAULT 1,
    unit_price  REAL NOT NULL,
    total_price REAL NOT NULL
);

-- Stok Hareketleri Tablosu
CREATE TABLE IF NOT EXISTS StockMovements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES Products(id),
    barcode     TEXT NOT NULL,
    name        TEXT NOT NULL,
    movement    TEXT NOT NULL CHECK(movement IN ('IN', 'OUT', 'ADJUST')),
    qty         INTEGER NOT NULL,
    prev_stock  INTEGER NOT NULL,
    new_stock   INTEGER NOT NULL,
    note        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Ayarlar Tablosu (key-value store)
CREATE TABLE IF NOT EXISTS Settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- Varsayılan Ayarlar
-- ============================================================
INSERT OR IGNORE INTO Settings (key, value) VALUES
    ('card_commission_rate', '2.5'),
    ('store_name', 'Esnaf POS'),
    ('license_expiry', '2027-12-31'),
    ('license_key', ''),
    ('currency_symbol', '₺'),
    ('tax_rate', '0'),
    ('low_stock_alert', 'true');

-- ============================================================
-- İndeksler (Performans)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_barcode ON Products(barcode);
CREATE INDEX IF NOT EXISTS idx_sales_date ON Sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_saleitems_sale ON SaleItems(sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_product ON StockMovements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_date ON StockMovements(created_at);
