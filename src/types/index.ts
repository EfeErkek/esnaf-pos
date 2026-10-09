// ============================================================
// ESNAF POS - Tip Tanımlamaları
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

export interface CartItem {
  product_id: number;
  barcode: string;
  name: string;
  qty: number;
  unit_price: number;
  total_price: number;
  outOfStock?: boolean; // Stok 0 iken okutulmuş ürün işareti
}

export interface Sale {
  id: number;
  total_amount: number;
  payment_type: 'CASH' | 'CARD';
  commission_rate: number;
  commission_amt: number;
  net_amount: number;
  sale_date: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  barcode: string;
  name: string;
  qty: number;
  unit_price: number;
  total_price: number;
}

export interface StockMovement {
  id: number;
  product_id: number;
  barcode: string;
  name: string;
  movement: 'IN' | 'OUT' | 'ADJUST';
  qty: number;
  prev_stock: number;
  new_stock: number;
  note?: string;
  created_at: string;
}

export interface DailyStats {
  total_sales_count: number;
  total_revenue: number;
  cash_revenue: number;
  card_revenue: number;
  card_commission: number;
  net_revenue: number;
}

export interface AppSettings {
  card_commission_rate: string;
  store_name: string;
  license_expiry: string;
  license_key: string;
  currency_symbol: string;
  tax_rate: string;
  low_stock_alert: string;
}

export interface LicenseStatus {
  isValid: boolean;
  expiryDate: string;
  daysLeft: number;
}

export type PaymentType = 'CASH' | 'CARD';
export type AppScreen = 'sales' | 'settings' | 'license';
