import { useState, useRef, useEffect, useCallback } from 'react';
import type { CartItem, DailyStats, Product, AppSettings } from '../../types';
import {
  getProductByBarcode,
  completeSale,
  getDailyStats,
  getLowStockProducts,
} from '../../utils/database';
import { useToast } from '../../components/ToastProvider';
import ProductDrawer from '../../components/ProductDrawer';
import LowStockModal from '../../components/LowStockModal';
import StockSummaryModal from '../../components/StockSummaryModal';

interface SalesScreenProps {
  settings: AppSettings;
  onRefreshSettings: () => void;
}

export default function SalesScreen({ settings, onRefreshSettings }: SalesScreenProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    total_sales_count: 0,
    total_revenue: 0,
    cash_revenue: 0,
    card_revenue: 0,
    card_commission: 0,
    net_revenue: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showStockSummary, setShowStockSummary] = useState(false);
  const [lastScanned, setLastScanned] = useState<string>('');
  const barcodeRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const commissionRate = parseFloat(settings.card_commission_rate ?? '2.5');
  const currency = settings.currency_symbol ?? '₺';

  const refreshStats = useCallback(() => {
    setDailyStats(getDailyStats());
    setLowStockProducts(getLowStockProducts());
  }, []);

  useEffect(() => {
    refreshStats();
    barcodeRef.current?.focus();
    // Her dakika istatistikleri güncelle
    const interval = setInterval(refreshStats, 60000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  // Barkod alanı her zaman odakta kalsın
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('input, button, .drawer-overlay, .modal-overlay')) {
        barcodeRef.current?.focus();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const totalAmount = cart.reduce((s, i) => s + i.total_price, 0);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  function handleBarcodeInput(e: React.ChangeEvent<HTMLInputElement>) {
    setBarcode(e.target.value);
  }

  function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && barcode.trim()) {
      processBarcode(barcode.trim());
    }
  }

  function processBarcode(code: string) {
    const product = getProductByBarcode(code);
    if (!product) {
      showToast(`Barkod bulunamadı: ${code}`, 'error');
      setBarcode('');
      return;
    }

    // Stok 0 veya eksi ise: Uyarı ver ama ürünü yine de ekle (fiyat görüntüleme için)
    if (product.stock <= 0) {
      showToast(`⚠️ "${product.name}" stoğu tükenmiş — fiyat bilgisi gösteriliyor`, 'warning');
    }

    setLastScanned(product.name);

    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        // Stok varsa adeti artır; stok yoksa sadece 1 adette tut (fiyat görüntüleme)
        if (product.stock > 0 && existing.qty >= product.stock) {
          showToast(`Maksimum stok adet sayısına ulaşıldı (${product.stock})`, 'warning');
          return prev;
        }
        if (product.stock <= 0) {
          showToast(`"${product.name}" stoğu yok — adet artırılamaz`, 'warning');
          return prev;
        }
        return prev.map(i =>
          i.product_id === product.id
            ? { ...i, qty: i.qty + 1, total_price: (i.qty + 1) * i.unit_price }
            : i
        );
      }
      return [...prev, {
        product_id: product.id,
        barcode: product.barcode,
        name: product.name,
        qty: 1,
        unit_price: product.sell_price,
        total_price: product.sell_price,
        outOfStock: product.stock <= 0,
      }];
    });

    // Düşük stok uyarısı (stok > 0 durumunda)
    if (product.stock > 0 && product.stock - 1 <= product.min_stock && product.stock - 1 > 0) {
      showToast(`Uyarı: "${product.name}" azalıyor (${product.stock - 1} adet kaldı)`, 'warning');
    }

    setBarcode('');
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }


  function updateQty(productId: number, delta: number) {
    setCart(prev => {
      return prev.map(i => {
        if (i.product_id !== productId) return i;
        const newQty = Math.max(0, i.qty + delta);
        if (newQty === 0) return null as any;
        return { ...i, qty: newQty, total_price: newQty * i.unit_price };
      }).filter(Boolean);
    });
  }

  function removeFromCart(productId: number) {
    setCart(prev => prev.filter(i => i.product_id !== productId));
  }

  function handleCancel() {
    setCart([]);
    setLastScanned('');
    showToast('Satış iptal edildi.', 'warning');
    barcodeRef.current?.focus();
  }

  function handlePay(paymentType: 'CASH' | 'CARD') {
    if (cart.length === 0) {
      showToast('Sepet boş!', 'warning');
      return;
    }

    // Stok sıfır olan ürünler var mı kontrol et
    const oosItems = cart.filter(i => i.outOfStock);
    if (oosItems.length > 0) {
      const names = oosItems.map(i => `"${i.name}"`).join(', ');
      showToast(
        `⚠️ Stoğu olmayan ürün(ler) sepette: ${names}. Önce stok ekleyip tekrar deneyin.`,
        'error'
      );
      return;
    }


    try {
      const saleId = completeSale(cart, paymentType, paymentType === 'CARD' ? commissionRate : 0);

      const commissionText = paymentType === 'CARD'
        ? ` (+${currency}${((totalAmount * commissionRate) / 100).toFixed(2)} komisyon)`
        : '';

      showToast(
        `✓ Satış tamamlandı! ${currency}${totalAmount.toFixed(2)}${commissionText} — #${saleId}`,
        'success'
      );

      setCart([]);
      setLastScanned('');
      refreshStats();
      barcodeRef.current?.focus();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  const cardTotal = totalAmount + (totalAmount * commissionRate) / 100;

  return (
    <>
      <div className="sales-screen">
        {/* ── Sol: Sepet ── */}
        <div className="cart-area">
          {/* Barkod girişi */}
          <div className="barcode-input-wrap">
            <input
              ref={barcodeRef}
              id="barcode-main-input"
              type="text"
              className="barcode-input"
              placeholder="🔍  Barkod okutun veya girin → Enter"
              value={barcode}
              onChange={handleBarcodeInput}
              onKeyDown={handleBarcodeKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              id="btn-open-drawer"
              style={{
                background: 'var(--bg-card)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                padding: '12px 14px',
                cursor: 'pointer',
                fontSize: 20,
                transition: 'var(--transition)',
                flexShrink: 0,
              }}
              onClick={() => setShowDrawer(true)}
              title="Stok Yönetimi"
            >
              📦
            </button>
            <button
              id="btn-stock-summary"
              style={{
                background: 'var(--bg-card)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                padding: '12px 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                transition: 'var(--transition)',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                letterSpacing: '0.3px',
              }}
              onClick={() => setShowStockSummary(true)}
              title="Tüm stoğu görüntüle"
            >
              📋 Tüm Stok
            </button>
          </div>

          {/* Son taranan ürün göstergesi */}
          {lastScanned && (
            <div style={{
              background: 'rgba(108, 99, 255, 0.08)',
              border: '1px solid rgba(108, 99, 255, 0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: 13,
              color: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span>✓</span> <span>{lastScanned} eklendi</span>
            </div>
          )}

          {/* Düşük stok banner */}
          {lowStockProducts.length > 0 && (
            <button
              id="btn-low-stock-banner"
              className="low-stock-banner"
              onClick={() => setShowLowStockModal(true)}
            >
              <span className="low-stock-banner-icon">⚠️</span>
              <span>
                <strong>{lowStockProducts.length} ürün</strong> kritik stok seviyesinde → Detaylar için tıklayın
              </span>
            </button>
          )}

          {/* Sepet başlık */}
          <div className="cart-header">
            <h2>Sepet</h2>
            <span className="cart-count">{totalItems} ürün</span>
          </div>

          {/* Sepet listesi */}
          <div className="cart-list">
            {cart.length === 0 ? (
              <div className="cart-empty">
                <div className="cart-empty-icon">🛒</div>
                <div className="cart-empty-text">Sepet boş</div>
                <div className="cart-empty-hint">Satışa başlamak için barkod okutun</div>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product_id} className={`cart-item${item.outOfStock ? ' cart-item-oos' : ''}`}>
                  <div className="cart-item-info">
                    <div className="cart-item-name" title={item.name}>{item.name}</div>
                    <div className="cart-item-barcode">
                      {item.barcode}
                      {item.outOfStock && (
                        <span style={{
                          marginLeft: 8,
                          background: 'var(--danger-dim)',
                          color: 'var(--danger)',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 99,
                          border: '1px solid rgba(255,71,87,0.3)',
                          letterSpacing: '0.5px',
                        }}>
                          STOK YOK
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="cart-item-qty">
                    <button
                      className="qty-btn"
                      onClick={() => updateQty(item.product_id, -1)}
                      id={`qty-dec-${item.product_id}`}
                    >−</button>
                    <span className="qty-value">{item.qty}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateQty(item.product_id, 1)}
                      id={`qty-inc-${item.product_id}`}
                      disabled={!!item.outOfStock}
                    >+</button>
                  </div>

                  <div className="cart-item-price">
                    <div className={`cart-item-total${item.outOfStock ? ' text-muted' : ''}`}>
                      {currency}{item.total_price.toFixed(2)}
                    </div>
                    <div className="cart-item-unit">
                      {item.qty} × {currency}{item.unit_price.toFixed(2)}
                    </div>
                  </div>

                  <button
                    className="cart-remove-btn"
                    onClick={() => removeFromCart(item.product_id)}
                    title="Sil"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Sağ: Ödeme Paneli ── */}
        <div className="payment-panel">
          {/* Günlük İstatistikler */}
          <div className="daily-stats">
            <div className="daily-stats-title">📊 Günlük Özet</div>
            <div className="daily-stat-row">
              <span className="daily-stat-label">Satış Sayısı</span>
              <span className="daily-stat-value">{dailyStats.total_sales_count}</span>
            </div>
            <div className="daily-stat-row">
              <span className="daily-stat-label">Nakit Ciro</span>
              <span className="daily-stat-value text-success">
                {currency}{dailyStats.cash_revenue.toFixed(2)}
              </span>
            </div>
            <div className="daily-stat-row">
              <span className="daily-stat-label">Kart Ciro</span>
              <span className="daily-stat-value" style={{ color: 'var(--card-color)' }}>
                {currency}{dailyStats.card_revenue.toFixed(2)}
              </span>
            </div>
            {dailyStats.card_commission > 0 && (
              <div className="daily-stat-row">
                <span className="daily-stat-label">Kart Komisyon</span>
                <span className="daily-stat-value text-warning">
                  −{currency}{dailyStats.card_commission.toFixed(2)}
                </span>
              </div>
            )}
            <div className="divider" />
            <div className="daily-stat-row">
              <span className="daily-stat-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                Toplam Ciro
              </span>
              <span className="daily-stat-value highlight">
                {currency}{dailyStats.total_revenue.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Toplam Tutar */}
          <div className="cart-total-section">
            <div className="cart-total-label">Ödenecek Tutar</div>
            <div className="cart-total-amount">
              {currency}{totalAmount.toFixed(2)}
            </div>
            {totalItems > 0 && (
              <div className="cart-total-items">
                {totalItems} ürün · {cart.length} çeşit
              </div>
            )}
          </div>

          {/* Ödeme Butonları */}
          <div className="payment-buttons">
            <button
              id="btn-pay-cash"
              className="pay-btn cash"
              onClick={() => handlePay('CASH')}
              disabled={cart.length === 0}
            >
              💵 NAKİT
              {cart.length > 0 && (
                <span style={{ fontSize: 14, opacity: 0.85 }}>
                  — {currency}{totalAmount.toFixed(2)}
                </span>
              )}
            </button>

            <button
              id="btn-pay-card"
              className="pay-btn card"
              onClick={() => handlePay('CARD')}
              disabled={cart.length === 0}
            >
              💳 KART
              {cart.length > 0 && (
                <span style={{ fontSize: 13, opacity: 0.85 }}>
                  — {currency}{cardTotal.toFixed(2)} (+%{commissionRate})
                </span>
              )}
            </button>

            <button
              id="btn-cancel"
              className="pay-btn cancel"
              onClick={handleCancel}
              disabled={cart.length === 0}
            >
              ✕ İPTAL
            </button>
          </div>
        </div>
      </div>

      {/* Modaller */}
      {showDrawer && (
        <ProductDrawer
          onClose={() => {
            setShowDrawer(false);
            refreshStats();
            barcodeRef.current?.focus();
          }}
        />
      )}

      {showLowStockModal && (
        <LowStockModal
          products={lowStockProducts}
          onClose={() => setShowLowStockModal(false)}
        />
      )}

      {showStockSummary && (
        <StockSummaryModal
          onClose={() => {
            setShowStockSummary(false);
            barcodeRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
