import { useState } from 'react';
import type { AppSettings, LicenseStatus } from '../../types';
import { setSetting, checkLicense, activateLicense } from '../../utils/database';
import { useToast } from '../../components/ToastProvider';

interface SettingsScreenProps {
  settings: AppSettings;
  licenseStatus: LicenseStatus;
  onSave: () => void;
  onLicenseRevoked: () => void;
}

export default function SettingsScreen({ settings, licenseStatus, onSave, onLicenseRevoked }: SettingsScreenProps) {
  const [form, setForm] = useState({
    store_name: settings.store_name ?? 'Esnaf POS',
    card_commission_rate: settings.card_commission_rate ?? '2.5',
    currency_symbol: settings.currency_symbol ?? '₺',
  });
  const [licenseKey, setLicenseKey] = useState('');
  const [currentLicense, setCurrentLicense] = useState(licenseStatus);
  const { showToast } = useToast();

  function handleSave() {
    setSetting('store_name', form.store_name);
    setSetting('card_commission_rate', form.card_commission_rate);
    setSetting('currency_symbol', form.currency_symbol);
    showToast('Ayarlar kaydedildi ✓', 'success');
    onSave();
  }

  function handleActivateLicense() {
    if (!licenseKey.trim()) return;

    const result = activateLicense(licenseKey.trim());

    if (!result.success) {
      showToast(result.reason, 'error');
      setLicenseKey('');
      return;
    }

    if (result.action === 'EXTEND') {
      showToast(
        `✅ Lisans uzatıldı! Yeni bitiş: ${result.newExpiry} (${result.daysLeft} gün kaldı)`,
        'success'
      );
      setCurrentLicense(checkLicense());
      setLicenseKey('');
      onSave();
    }

    if (result.action === 'REVOKE') {
      showToast('🔒 Lisans iptal edildi. Sistem kilitlendi.', 'warning');
      setLicenseKey('');
      onSave();
      // Kısa bir gecikme sonra lisans ekranına yönlendir
      setTimeout(() => onLicenseRevoked(), 1000);
    }
  }

  return (
    <div className="settings-screen">
      <div>
        <h1 className="screen-title">⚙️ Ayarlar</h1>
        <p className="screen-subtitle">Sistem ve ödeme ayarlarını buradan yapılandırın.</p>
      </div>

      {/* Mağaza Ayarları */}
      <div className="settings-section">
        <div className="settings-section-title">🏪 Mağaza Bilgileri</div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Mağaza / İşletme Adı</div>
            <div className="settings-row-desc">Başlık çubuğunda görünür</div>
          </div>
          <input
            type="text"
            id="input-store-name"
            className="settings-input-sm"
            value={form.store_name}
            onChange={(e) => setForm(p => ({ ...p, store_name: e.target.value }))}
            style={{ width: 180, textAlign: 'left' }}
          />
        </div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Para Birimi Sembolü</div>
            <div className="settings-row-desc">Fiyatların başında gösterilir</div>
          </div>
          <input
            type="text"
            id="input-currency"
            className="settings-input-sm"
            value={form.currency_symbol}
            onChange={(e) => setForm(p => ({ ...p, currency_symbol: e.target.value }))}
            style={{ width: 70 }}
          />
        </div>
      </div>

      {/* Ödeme Ayarları */}
      <div className="settings-section">
        <div className="settings-section-title">💳 Kart Ödeme Ayarları</div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Kart Komisyon Oranı</div>
            <div className="settings-row-desc">
              Kart ile ödemede toplam tutara eklenen oran (%)
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              id="input-commission-rate"
              className="settings-input-sm"
              value={form.card_commission_rate}
              onChange={(e) => setForm(p => ({ ...p, card_commission_rate: e.target.value }))}
              min="0"
              max="20"
              step="0.1"
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: 16 }}>%</span>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          fontSize: 13,
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}>
          Örnek: 100₺ kart ödemesi → {(100 + 100 * parseFloat(form.card_commission_rate || '0') / 100).toFixed(2)}₺
          <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
            (+{(100 * parseFloat(form.card_commission_rate || '0') / 100).toFixed(2)}₺ komisyon)
          </span>
        </div>

        <button
          id="btn-save-settings"
          className="settings-save-btn"
          onClick={handleSave}
        >
          💾 Ayarları Kaydet
        </button>
      </div>

      {/* Lisans Yönetimi */}
      <div className="settings-section">
        <div className="settings-section-title">🔑 Lisans Yönetimi</div>

        {/* Mevcut durum */}
        <div className={`license-info-row ${currentLicense.isValid ? 'valid' : 'expired'}`}>
          <span style={{ fontSize: 20 }}>{currentLicense.isValid ? '✅' : '❌'}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {currentLicense.isValid
                ? `Lisans Aktif — ${currentLicense.daysLeft} gün kaldı`
                : 'Lisans Sona Erdi'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Bitiş tarihi: {currentLicense.expiryDate}
            </div>
          </div>

          {/* Lisans süresi az kaldıysa uyarı */}
          {currentLicense.isValid && currentLicense.daysLeft <= 7 && (
            <span className="badge badge-danger" style={{ marginLeft: 'auto' }}>
              ⚠️ {currentLicense.daysLeft} gün!
            </span>
          )}
        </div>

        {/* Açıklama */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          fontSize: 12,
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          lineHeight: 1.7,
        }}>
          Lisans kodunuzu sistem yöneticinizden alın ve aşağıya girin.
          <br />
          Kod girişi sırasında karakterler gizlenir (****).
        </div>

        {/* Maskeli kod girişi */}
        <div className="form-group">
          <label className="form-label">Lisans / Aktivasyon Kodu</label>
          <input
            type="password"
            id="input-license-key"
            className="form-input"
            placeholder="••••••••••"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleActivateLicense()}
            autoComplete="off"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '3px' }}
          />
        </div>

        <button
          id="btn-activate-license-settings"
          className="settings-save-btn"
          onClick={handleActivateLicense}
          disabled={!licenseKey.trim()}
        >
          🔑 Kodu Uygula
        </button>
      </div>

      {/* Hakkında */}
      <div className="settings-section" style={{ opacity: 0.7 }}>
        <div className="settings-section-title">ℹ️ Hakkında</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div><strong>Esnaf POS</strong> v1.0.0</div>
          <div>Küçük esnaflar için geliştirilmiş POS sistemi</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 8 }}>
            Electron + React + sql.js
          </div>
        </div>
      </div>
    </div>
  );
}
