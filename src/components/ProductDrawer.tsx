import { useState, useRef, useEffect } from 'react';
import type { Product } from '../types';
import { getProductByBarcode, addProduct, updateProductStock } from '../utils/database';
import { useToast } from './ToastProvider';

interface ProductDrawerProps {
  onClose: () => void;
}

type Tab = 'add-stock' | 'new-product';

export default function ProductDrawer({ onClose }: ProductDrawerProps) {
  const [tab, setTab] = useState<Tab>('add-stock');
  const { showToast } = useToast();

  return (
    <div className="drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer">
        <div className="drawer-header">
          <button className="drawer-back-btn" onClick={onClose}>←</button>
          <h3 className="drawer-title">Stok Yönetimi</h3>
        </div>

        <div className="drawer-body">
          <div className="drawer-tabs">
            <button
              className={`drawer-tab ${tab === 'add-stock' ? 'active' : ''}`}
              onClick={() => setTab('add-stock')}
            >
              📦 Stok Ekle
            </button>
            <button
              className={`drawer-tab ${tab === 'new-product' ? 'active' : ''}`}
              onClick={() => setTab('new-product')}
            >
              ➕ Yeni Ürün
            </button>
          </div>

          {tab === 'add-stock' ? (
            <AddStockForm onClose={onClose} showToast={showToast} />
          ) : (
            <NewProductForm onClose={onClose} showToast={showToast} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mevcut Stoğa Ekle ──
function AddStockForm({ onClose, showToast }: { onClose: () => void; showToast: (m: string, t?: any) => void }) {
  const [barcode, setBarcode] = useState('');
  const [qty, setQty] = useState('');
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  function handleBarcodeSearch(value: string) {
    setBarcode(value);
    if (value.length >= 3) {
      const product = getProductByBarcode(value);
      setFoundProduct(product);
    } else {
      setFoundProduct(null);
    }
  }

  function handleBarcodeKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && barcode) {
      const product = getProductByBarcode(barcode);
      if (product) {
        setFoundProduct(product);
      } else {
        showToast('Ürün bulunamadı! Önce yeni ürün olarak ekleyin.', 'error');
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!foundProduct) return;
    const qtyNum = parseInt(qty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      showToast('Geçerli bir adet giriniz.', 'error');
      return;
    }
    try {
      updateProductStock(foundProduct.id, qtyNum, 'IN', 'Manuel stok ekleme');
      showToast(`${foundProduct.name} için ${qtyNum} adet stok eklendi ✓`, 'success');
      setBarcode('');
      setQty('');
      setFoundProduct(null);
      barcodeRef.current?.focus();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group">
        <label className="form-label">Barkod / Ürün Kodu</label>
        <input
          ref={barcodeRef}
          type="text"
          className="form-input"
          placeholder="Barkod okutun veya girin..."
          value={barcode}
          onChange={(e) => handleBarcodeSearch(e.target.value)}
          onKeyDown={handleBarcodeKeyDown}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}
        />
      </div>

      {foundProduct && (
        <div className="found-product-card">
          <div className="found-product-name">{foundProduct.name}</div>
          <div className="found-product-meta">
            <span className="found-product-badge price">
              ₺{foundProduct.sell_price.toFixed(2)}
            </span>
            <span className={`found-product-badge ${foundProduct.stock <= foundProduct.min_stock ? 'low-stock' : 'stock'}`}>
              Stok: {foundProduct.stock} adet
              {foundProduct.stock <= foundProduct.min_stock && ' ⚠️'}
            </span>
          </div>
        </div>
      )}

      {!foundProduct && barcode.length >= 3 && (
        <div style={{ color: 'var(--danger)', fontSize: 13, padding: '8px 12px', background: 'var(--danger-dim)', borderRadius: 8 }}>
          ❌ Bu barkoda sahip ürün bulunamadı
        </div>
      )}

      {foundProduct && (
        <div className="form-group">
          <label className="form-label">Eklenecek Adet</label>
          <input
            type="number"
            className="form-input"
            placeholder="Kaç adet eklenecek?"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            min="1"
            style={{ fontSize: 20, fontWeight: 700, textAlign: 'center' }}
            autoFocus
          />
        </div>
      )}

      <button
        type="submit"
        className="form-submit-btn"
        disabled={!foundProduct || !qty || parseInt(qty) <= 0}
      >
        📦 Stoğa Ekle
      </button>
    </form>
  );
}

// ── Yeni Ürün Ekle ──
function NewProductForm({ onClose, showToast }: { onClose: () => void; showToast: (m: string, t?: any) => void }) {
  const [form, setForm] = useState({
    barcode: '',
    name: '',
    buy_price: '',
    sell_price: '',
    stock: '',
    min_stock: '5',
  });
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.barcode || !form.name || !form.sell_price || !form.stock) {
      showToast('Lütfen zorunlu alanları doldurun.', 'error');
      return;
    }
    const existing = getProductByBarcode(form.barcode);
    if (existing) {
      showToast('Bu barkod zaten kayıtlı! Stok ekle sekmesini kullanın.', 'warning');
      return;
    }
    try {
      addProduct({
        barcode: form.barcode,
        name: form.name,
        buy_price: parseFloat(form.buy_price) || 0,
        sell_price: parseFloat(form.sell_price),
        stock: parseInt(form.stock) || 0,
        min_stock: parseInt(form.min_stock) || 5,
      });
      showToast(`"${form.name}" başarıyla eklendi ✓`, 'success');
      setForm({ barcode: '', name: '', buy_price: '', sell_price: '', stock: '', min_stock: '5' });
      barcodeRef.current?.focus();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-group">
        <label className="form-label">Barkod *</label>
        <input
          ref={barcodeRef}
          type="text"
          className="form-input"
          placeholder="Barkod okutun veya girin..."
          value={form.barcode}
          onChange={(e) => handleChange('barcode', e.target.value)}
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Ürün Adı *</label>
        <input
          type="text"
          className="form-input"
          placeholder="Ürünün tam adı"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Alış Fiyatı (₺)</label>
          <input
            type="number"
            className="form-input"
            placeholder="0.00"
            value={form.buy_price}
            onChange={(e) => handleChange('buy_price', e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Satış Fiyatı (₺) *</label>
          <input
            type="number"
            className="form-input"
            placeholder="0.00"
            value={form.sell_price}
            onChange={(e) => handleChange('sell_price', e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Başlangıç Stok *</label>
          <input
            type="number"
            className="form-input"
            placeholder="0"
            value={form.stock}
            onChange={(e) => handleChange('stock', e.target.value)}
            min="0"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Min. Stok Uyarısı</label>
          <input
            type="number"
            className="form-input"
            placeholder="5"
            value={form.min_stock}
            onChange={(e) => handleChange('min_stock', e.target.value)}
            min="0"
          />
        </div>
      </div>

      <button
        type="submit"
        className="form-submit-btn"
        disabled={!form.barcode || !form.name || !form.sell_price}
      >
        ➕ Ürünü Kaydet
      </button>
    </form>
  );
}
