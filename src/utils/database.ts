// ============================================================
// ESNAF POS - sql.js Veritabanı Servisi (Browser/Renderer)
// sql.js: Pure JavaScript SQLite - derleme gerektirmez
// ============================================================

import type { Database, SqlJsStatic } from 'sql.js';
import type {
  Product, CartItem, DailyStats, AppSettings, LicenseStatus
} from '../types';

const SCHEMA = `
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

CREATE TABLE IF NOT EXISTS Sales (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  total_amount    REAL NOT NULL,
  payment_type    TEXT NOT NULL,
  commission_rate REAL NOT NULL DEFAULT 0,
  commission_amt  REAL NOT NULL DEFAULT 0,
  net_amount      REAL NOT NULL,
  sale_date       TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS SaleItems (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id     INTEGER NOT NULL,
  product_id  INTEGER NOT NULL,
  barcode     TEXT NOT NULL,
  name        TEXT NOT NULL,
  qty         INTEGER NOT NULL DEFAULT 1,
  unit_price  REAL NOT NULL,
  total_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS StockMovements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL,
  barcode     TEXT NOT NULL,
  name        TEXT NOT NULL,
  movement    TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  prev_stock  INTEGER NOT NULL,
  new_stock   INTEGER NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS Settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

INSERT OR IGNORE INTO Settings (key, value) VALUES
  ('card_commission_rate', '2.5'),
  ('store_name', 'Esnaf POS'),
  ('license_expiry', date('now', '+30 days')),
  ('license_key', ''),
  ('currency_symbol', '₺'),
  ('tax_rate', '0'),
  ('low_stock_alert', 'true');
`;

const DB_KEY = 'esnaf_pos_db';

let sqlJs: SqlJsStatic | null = null;
let db: Database | null = null;

async function initSqlJs(): Promise<SqlJsStatic> {
  if (sqlJs) return sqlJs;

  // sql-asm.js'i script tag ile yükle - globalThis.initSqlJs'i expose eder
  await new Promise<void>((resolve, reject) => {
    if ((window as any).initSqlJs) { resolve(); return; }
    const script = document.createElement('script');
    script.src = '/sql-asm.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('sql-asm.js yüklenemedi'));
    document.head.appendChild(script);
  });

  // initSqlJs() çağrısıyla SQL modülünü al
  sqlJs = await (window as any).initSqlJs();
  return sqlJs!;
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  // localStorage'dan mevcut DB'yi yükle
  const savedDb = localStorage.getItem(DB_KEY);
  if (savedDb) {
    const buf = Uint8Array.from(atob(savedDb), c => c.charCodeAt(0));
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA);
  saveDatabase();

  return db;
}

export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const base64 = btoa(String.fromCharCode(...data));
  localStorage.setItem(DB_KEY, base64);
}

function getDb(): Database {
  if (!db) throw new Error('Veritabanı henüz başlatılmadı');
  return db;
}

function queryAll<T>(sql: string, params: (string | number | null)[] = []): T[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

function queryOne<T>(sql: string, params: (string | number | null)[] = []): T | null {
  const results = queryAll<T>(sql, params);
  return results[0] ?? null;
}

function run(sql: string, params: (string | number | null)[] = []): void {
  const d = getDb();
  d.run(sql, params);
  saveDatabase();
}

// ============================================================
// ÜRÜN İŞLEMLERİ
// ============================================================

export function getProductByBarcode(barcode: string): Product | null {
  return queryOne<Product>('SELECT * FROM Products WHERE barcode = ?', [barcode]);
}

export function getAllProducts(): Product[] {
  return queryAll<Product>('SELECT * FROM Products ORDER BY name ASC');
}

export function getLowStockProducts(): Product[] {
  return queryAll<Product>(
    'SELECT * FROM Products WHERE stock <= min_stock ORDER BY stock ASC'
  );
}

export function addProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): void {
  run(
    `INSERT INTO Products (barcode, name, buy_price, sell_price, stock, min_stock)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [product.barcode, product.name, product.buy_price, product.sell_price, product.stock, product.min_stock]
  );
}

export function updateProductStock(
  productId: number,
  qty: number,
  movement: 'IN' | 'OUT' | 'ADJUST',
  note?: string
): void {
  const product = queryOne<Product>('SELECT * FROM Products WHERE id = ?', [productId]);
  if (!product) throw new Error('Ürün bulunamadı');

  const newStock =
    movement === 'IN' ? product.stock + qty :
    movement === 'OUT' ? product.stock - qty :
    qty;

  if (newStock < 0) throw new Error('Yetersiz stok');

  run(
    `UPDATE Products SET stock = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`,
    [newStock, productId]
  );

  run(
    `INSERT INTO StockMovements (product_id, barcode, name, movement, qty, prev_stock, new_stock, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [productId, product.barcode, product.name, movement, qty, product.stock, newStock, note ?? null]
  );
}

// ============================================================
// SATIŞ İŞLEMLERİ
// ============================================================

export function completeSale(
  cartItems: CartItem[],
  paymentType: 'CASH' | 'CARD',
  commissionRate: number
): number {
  const d = getDb();
  const totalAmount = cartItems.reduce((s, i) => s + i.total_price, 0);
  const commissionAmt = paymentType === 'CARD' ? (totalAmount * commissionRate) / 100 : 0;
  const netAmount = totalAmount + commissionAmt;
  const now = new Date().toLocaleString('tr-TR');

  d.run(
    `INSERT INTO Sales (total_amount, payment_type, commission_rate, commission_amt, net_amount, sale_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [totalAmount, paymentType, commissionRate, commissionAmt, netAmount, now]
  );

  const saleResult = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
  const saleId = saleResult!.id;

  for (const item of cartItems) {
    d.run(
      `INSERT INTO SaleItems (sale_id, product_id, barcode, name, qty, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [saleId, item.product_id, item.barcode, item.name, item.qty, item.unit_price, item.total_price]
    );
    updateProductStock(item.product_id, item.qty, 'OUT', `Satış #${saleId}`);
  }

  saveDatabase();
  return saleId;
}

// ============================================================
// GÜNLÜK STATS
// ============================================================

export function getDailyStats(dateStr?: string): DailyStats {
  const today = dateStr ?? new Date().toLocaleDateString('tr-TR');

  // Turkish locale date format: dd.mm.yyyy
  const rows = queryAll<{
    total_sales_count: number;
    total_revenue: number;
    cash_revenue: number;
    card_revenue: number;
    card_commission: number;
    net_revenue: number;
  }>(`
    SELECT
      COUNT(*) AS total_sales_count,
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN payment_type='CASH' THEN total_amount ELSE 0 END), 0) AS cash_revenue,
      COALESCE(SUM(CASE WHEN payment_type='CARD' THEN total_amount ELSE 0 END), 0) AS card_revenue,
      COALESCE(SUM(commission_amt), 0) AS card_commission,
      COALESCE(SUM(net_amount), 0) AS net_revenue
    FROM Sales
    WHERE sale_date LIKE ?
  `, [`%${today}%`]);

  return rows[0] ?? {
    total_sales_count: 0,
    total_revenue: 0,
    cash_revenue: 0,
    card_revenue: 0,
    card_commission: 0,
    net_revenue: 0,
  };
}

// ============================================================
// AYARLAR
// ============================================================

export function getAllSettings(): AppSettings {
  const rows = queryAll<{ key: string; value: string }>('SELECT key, value FROM Settings');
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return map as unknown as AppSettings;
}

export function setSetting(key: string, value: string): void {
  run(
    `INSERT INTO Settings (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value]
  );
}

// ============================================================
// LİSANS
// ============================================================

// Yönetici tarafından belirlenen sabit lisans kodları
// ED535361Y → Mevcut lisansa +30 gün ekle
// ED535361N → Lisansı anında iptal et (sistemi kilitle)
const ADMIN_LICENSE_KEYS: Record<string, 'EXTEND' | 'REVOKE'> = {
  'ED535361Y': 'EXTEND',
  'ED535361N': 'REVOKE',
};

export function checkLicense(): LicenseStatus {
  const settings = getAllSettings();
  const expiryStr = settings.license_expiry ?? '2020-01-01';
  const expiry = new Date(expiryStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { isValid: daysLeft > 0, expiryDate: expiryStr, daysLeft };
}

export type LicenseActionResult =
  | { success: true; action: 'EXTEND'; newExpiry: string; daysLeft: number }
  | { success: true; action: 'REVOKE' }
  | { success: false; reason: string };

export function activateLicense(inputKey: string): LicenseActionResult {
  const key = inputKey.trim().toUpperCase();
  const action = ADMIN_LICENSE_KEYS[key];

  if (!action) {
    return { success: false, reason: 'Geçersiz lisans kodu.' };
  }

  if (action === 'EXTEND') {
    // Mevcut lisans bitiş tarihini al; sona ermişse bugünden başlat
    const current = checkLicense();
    const base = current.isValid
      ? new Date(current.expiryDate)
      : new Date(); // sona erdiyse bugünden say
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + 30);
    const newExpiry = base.toISOString().slice(0, 10);
    setSetting('license_expiry', newExpiry);
    setSetting('license_key', key);
    const updated = checkLicense();
    return { success: true, action: 'EXTEND', newExpiry, daysLeft: updated.daysLeft };
  }

  if (action === 'REVOKE') {
    // Tarihi 2000-01-01 olarak set et → kesinlikle sona ermiş
    setSetting('license_expiry', '2000-01-01');
    setSetting('license_key', key);
    return { success: true, action: 'REVOKE' };
  }

  return { success: false, reason: 'Bilinmeyen işlem.' };
}

// ============================================================
// STOK ÖZET
// ============================================================

export interface StockSummary {
  total_unique_products: number;
  total_stock_units: number;
  out_of_stock_count: number;
  low_stock_count: number;
  products: Product[];
}

export function getStockSummary(): StockSummary {
  const summaryRow = queryOne<{
    total_unique_products: number;
    total_stock_units: number;
    out_of_stock_count: number;
    low_stock_count: number;
  }>(`
    SELECT
      COUNT(*)                                               AS total_unique_products,
      COALESCE(SUM(stock), 0)                                AS total_stock_units,
      COUNT(CASE WHEN stock <= 0 THEN 1 END)                 AS out_of_stock_count,
      COUNT(CASE WHEN stock > 0 AND stock <= min_stock THEN 1 END) AS low_stock_count
    FROM Products
  `);

  const products = queryAll<Product>('SELECT * FROM Products ORDER BY stock ASC, name ASC');

  return {
    total_unique_products: summaryRow?.total_unique_products ?? 0,
    total_stock_units: summaryRow?.total_stock_units ?? 0,
    out_of_stock_count: summaryRow?.out_of_stock_count ?? 0,
    low_stock_count: summaryRow?.low_stock_count ?? 0,
    products,
  };
}
