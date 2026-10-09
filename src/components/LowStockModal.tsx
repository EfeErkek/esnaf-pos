import type { Product } from '../types';

interface LowStockModalProps {
  products: Product[];
  onClose: () => void;
}

export default function LowStockModal({ products, onClose }: LowStockModalProps) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <h3 className="modal-title" style={{ color: 'var(--danger)' }}>
            Düşük Stok Uyarısı
          </h3>
        </div>

        <p className="modal-body">
          Aşağıdaki {products.length} ürünün stok miktarı kritik seviyeye ulaştı veya bitti:
        </p>

        <div className="low-stock-list">
          {products.map(p => (
            <div key={p.id} className="low-stock-item">
              <div>
                <div className="low-stock-name">{p.name}</div>
                <div className="low-stock-min text-muted" style={{ fontSize: 11 }}>
                  Min. Uyarı: {p.min_stock} adet
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={`low-stock-qty ${p.stock === 0 ? 'text-danger' : 'text-warning'}`}>
                  {p.stock === 0 ? 'TÜKENDI' : `${p.stock} adet`}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="modal-btn secondary" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
