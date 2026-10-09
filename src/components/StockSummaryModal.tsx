import { useState, useEffect } from 'react';
import { getStockSummary } from '../utils/database';
import type { StockSummary } from '../utils/database';

interface StockSummaryModalProps {
  onClose: () => void;
}

export default function StockSummaryModal({ onClose }: StockSummaryModalProps) {
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSummary(getStockSummary());
  }, []);

  const filtered = summary?.products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.includes(search)
  ) ?? [];

  function stockColor(stock: number, minStock: number): string {
    if (stock <= 0) return 'var(--danger)';
    if (stock <= minStock) return 'var(--warning)';
    return 'var(--success)';
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 680, width: '100%' }}>
        {/* Başlık */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 24 }}>📦</span>
          <h3 className="modal-title">Tüm Stok Görünümü</h3>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >✕</button>
        </div>

        {/* Özet İstatistikler */}
        {summary && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 16,
          }}>
            {[
              { label: 'Toplam Çeşit', value: summary.total_unique_products, color: 'var(--accent-light)', icon: '🏷️' },
              { label: 'Toplam Adet', value: summary.total_stock_units, color: 'var(--success)', icon: '📦' },
              { label: 'Tükenmiş', value: summary.out_of_stock_count, color: 'var(--danger)', icon: '❌' },
              { label: 'Kritik Stok', value: summary.low_stock_count, color: 'var(--warning)', icon: '⚠️' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
                <div style={{
                  fontSize: 24,
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono)',
                  color: stat.color,
                  lineHeight: 1,
                }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Arama */}
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Ürün adı veya barkod ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 12, fontSize: 14 }}
          autoFocus
        />

        {/* Ürün Listesi */}
        <div style={{
          maxHeight: 340,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
              {search ? 'Eşleşen ürün bulunamadı.' : 'Henüz ürün eklenmemiş.'}
            </div>
          ) : (
            filtered.map(p => (
              <div key={p.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                alignItems: 'center',
                gap: 12,
                padding: '9px 12px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${p.stock <= 0 ? 'rgba(255,71,87,0.25)' : p.stock <= p.min_stock ? 'rgba(255,165,2,0.2)' : 'var(--border)'}`,
              }}>
                {/* Ürün bilgisi */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {p.barcode}
                  </div>
                </div>

                {/* Fiyat */}
                <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>
                  ₺{p.sell_price.toFixed(2)}
                </div>

                {/* Stok */}
                <div style={{
                  minWidth: 60,
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  fontSize: 16,
                  color: stockColor(p.stock, p.min_stock),
                  background: p.stock <= 0
                    ? 'var(--danger-dim)'
                    : p.stock <= p.min_stock
                    ? 'var(--warning-dim)'
                    : 'var(--success-dim)',
                  padding: '3px 10px',
                  borderRadius: 99,
                }}>
                  {p.stock <= 0 ? 'SIFIR' : p.stock}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Alt bilgi */}
        <div style={{
          marginTop: 12,
          fontSize: 12,
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>{filtered.length} ürün gösteriliyor</span>
          <span>Yeşil = Normal · Turuncu = Kritik · Kırmızı = Tükenmiş</span>
        </div>
      </div>
    </div>
  );
}
