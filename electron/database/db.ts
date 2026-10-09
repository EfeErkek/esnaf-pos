// ============================================================
// ESNAF POS - Veritabanı Servisi
// better-sqlite3 ile senkron SQLite erişimi
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: Database.Database;

export function getDb(): Database.Database {
  return db;
}

export function initDatabase(): Database.Database {
  // Kullanıcı veri dizininde veritabanı oluştur
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'esnaf-pos.db');

  console.log('[DB] Veritabanı yolu:', dbPath);

  db = new Database(dbPath, { verbose: console.log });

  // WAL modu - daha hızlı okuma/yazma
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Şemayı yükle ve uygula
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  console.log('[DB] Veritabanı başarıyla başlatıldı.');
  return db;
}

// ============================================================
// ÜRÜN İŞLEMLERİ
// ============================================================

export interface Product {
  id: number;
  barcode: string;
  name: string;
  buy_price: number;
  sell_price: number;
  stock: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

export function getProductByBarcode(barcode: string): Product | null {
  const stmt = db.prepare('SELECT * FROM Products WHERE barcode = ?');
  return stmt.get(barcode) as Product | null;
}

export function getAllProducts(): Product[] {
  const stmt = db.prepare('SELECT * FROM Products ORDER BY name ASC');
  return stmt.all() as Product[];
}

export function getLowStockProducts(): Product[] {
  const stmt = db.prepare(
    'SELECT * FROM Products WHERE stock <= min_stock ORDER BY stock ASC'
  );
  return stmt.all() as Product[];
}

export function addProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Product {
  const stmt = db.prepare(`
    INSERT INTO Products (barcode, name, buy_price, sell_price, stock, min_stock)
    VALUES (@barcode, @name, @buy_price, @sell_price, @stock, @min_stock)
  `);
  const result = stmt.run(product);
  return getProductById(result.lastInsertRowid as number)!;
}

export function getProductById(id: number): Product | null {
  const stmt = db.prepare('SELECT * FROM Products WHERE id = ?');
  return stmt.get(id) as Product | null;
}

export function updateProductStock(
  productId: number,
  qty: number,
  movement: 'IN' | 'OUT' | 'ADJUST',
  note?: string
): Product {
  const product = getProductById(productId);
  if (!product) throw new Error('Ürün bulunamadı');

  const newStock = movement === 'IN'
    ? product.stock + qty
    : movement === 'OUT'
    ? product.stock - qty
    : qty; // ADJUST: direkt set et

  if (newStock < 0) throw new Error('Yetersiz stok');

  const updateStmt = db.prepare(`
    UPDATE Products
    SET stock = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `);
  updateStmt.run(newStock, productId);

  // Stok hareketi kaydet
  const movStmt = db.prepare(`
    INSERT INTO StockMovements (product_id, barcode, name, movement, qty, prev_stock, new_stock, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  movStmt.run(productId, product.barcode, product.name, movement, qty, product.stock, newStock, note ?? null);

  return getProductById(productId)!;
}

// ============================================================
// SATIŞ İŞLEMLERİ
// ============================================================

export interface CartItem {
  product_id: number;
  barcode: string;
  name: string;
  qty: number;
  unit_price: number;
  total_price: number;
}

export interface SaleResult {
  sale_id: number;
  total_amount: number;
  commission_amt: number;
  net_amount: number;
  payment_type: string;
}

export function completeSale(
  cartItems: CartItem[],
  paymentType: 'CASH' | 'CARD',
  commissionRate: number
): SaleResult {
  const totalAmount = cartItems.reduce((s, i) => s + i.total_price, 0);
  const commissionAmt = paymentType === 'CARD' ? (totalAmount * commissionRate) / 100 : 0;
  const netAmount = totalAmount + commissionAmt;

  // Transaction: satış + stok düşümü atomik
  const transaction = db.transaction(() => {
    // Satışı kaydet
    const saleStmt = db.prepare(`
      INSERT INTO Sales (total_amount, payment_type, commission_rate, commission_amt, net_amount)
      VALUES (?, ?, ?, ?, ?)
    `);
    const saleResult = saleStmt.run(totalAmount, paymentType, commissionRate, commissionAmt, netAmount);
    const saleId = saleResult.lastInsertRowid as number;

    // Kalemleri kaydet ve stokları düş
    const itemStmt = db.prepare(`
      INSERT INTO SaleItems (sale_id, product_id, barcode, name, qty, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of cartItems) {
      itemStmt.run(saleId, item.product_id, item.barcode, item.name, item.qty, item.unit_price, item.total_price);
      updateProductStock(item.product_id, item.qty, 'OUT', `Satış #${saleId}`);
    }

    return { sale_id: saleId, total_amount: totalAmount, commission_amt: commissionAmt, net_amount: netAmount, payment_type: paymentType };
  });

  return transaction() as SaleResult;
}

// ============================================================
// GÜNLÜK CİRO VE İSTATİSTİKLER
// ============================================================

export interface DailyStats {
  total_sales_count: number;
  total_revenue: number;
  cash_revenue: number;
  card_revenue: number;
  card_commission: number;
  net_revenue: number;
}

export function getDailyStats(date?: string): DailyStats {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const stmt = db.prepare(`
    SELECT
      COUNT(*)                                          AS total_sales_count,
      COALESCE(SUM(total_amount), 0)                   AS total_revenue,
      COALESCE(SUM(CASE WHEN payment_type='CASH' THEN total_amount ELSE 0 END), 0) AS cash_revenue,
      COALESCE(SUM(CASE WHEN payment_type='CARD' THEN total_amount ELSE 0 END), 0) AS card_revenue,
      COALESCE(SUM(commission_amt), 0)                 AS card_commission,
      COALESCE(SUM(net_amount), 0)                     AS net_revenue
    FROM Sales
    WHERE date(sale_date) = ?
  `);
  return stmt.get(targetDate) as DailyStats;
}

// ============================================================
// AYARLAR İŞLEMLERİ
// ============================================================

export function getSetting(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM Settings WHERE key = ?');
  const row = stmt.get(key) as { value: string } | null;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const stmt = db.prepare(`
    INSERT INTO Settings (key, value, updated_at)
    VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  stmt.run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const stmt = db.prepare('SELECT key, value FROM Settings');
  const rows = stmt.all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ============================================================
// LİSANS KONTROLÜ
// ============================================================

export function checkLicense(): { isValid: boolean; expiryDate: string; daysLeft: number } {
  const expiryStr = getSetting('license_expiry') ?? '2025-01-01';
  const expiry = new Date(expiryStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const diffMs = expiry.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isValid = daysLeft > 0;

  return { isValid, expiryDate: expiryStr, daysLeft };
}

export function activateLicense(licenseKey: string): boolean {
  // Basit lisans aktivasyon mantığı
  // Format: ESNAF-XXXX-XXXX-YYYYMMDD (son 8 karakter tarih)
  const parts = licenseKey.toUpperCase().split('-');
  if (parts.length < 4 || parts[0] !== 'ESNAF') return false;

  const datePart = parts[parts.length - 1];
  if (datePart.length !== 8) return false;

  const year = parseInt(datePart.slice(0, 4));
  const month = parseInt(datePart.slice(4, 6)) - 1;
  const day = parseInt(datePart.slice(6, 8));
  const expiry = new Date(year, month, day);

  if (isNaN(expiry.getTime())) return false;

  setSetting('license_expiry', expiry.toISOString().slice(0, 10));
  setSetting('license_key', licenseKey);
  return true;
}
