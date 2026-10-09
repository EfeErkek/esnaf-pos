import { useState } from 'react';
import { activateLicense } from '../../utils/database';
import { useToast } from '../../components/ToastProvider';
import type { LicenseStatus } from '../../types';

interface LicenseScreenProps {
  licenseStatus: LicenseStatus;
  onActivated: () => void;
}

export default function LicenseScreen({ licenseStatus, onActivated }: LicenseScreenProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  function handleActivate() {
    if (!licenseKey.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const result = activateLicense(licenseKey.trim());

      if (!result.success) {
        showToast(result.reason, 'error');
        setLicenseKey('');
        setLoading(false);
        return;
      }

      if (result.action === 'EXTEND') {
        showToast(
          `✅ Lisans aktive edildi! Bitiş: ${result.newExpiry} (${result.daysLeft} gün)`,
          'success'
        );
        setLicenseKey('');
        setLoading(false);
        onActivated();
        return;
      }

      // REVOKE kodu lisans ekranında anlamsız ama yine de handle edelim
      showToast('Bu kod lisansı iptal eder. İşlem geçerli değil.', 'error');
      setLicenseKey('');
      setLoading(false);
    }, 600);
  }

  const daysMissed = Math.abs(licenseStatus.daysLeft);

  return (
    <div className="license-screen">
      <div className="license-card">
        <div className="license-icon">🔒</div>

        <h1 className="license-title">Lisans Sona Erdi</h1>

        <p className="license-subtitle">
          Lisans geçerlilik tarihiniz dolmuştur. Satış ve stok işlemleri
          lisans yenilenene kadar kilitlenmiştir.
        </p>

        <div className="license-expiry-badge">
          Son geçerlilik: {licenseStatus.expiryDate}
          {daysMissed > 0 && ` · ${daysMissed} gün önce sona erdi`}
        </div>

        <div className="license-input-wrap">
          <label style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Aktivasyon Kodu
          </label>
          {/* Maskelenmiş girdi — type="password" */}
          <input
            type="password"
            id="license-key-input"
            className="license-key-input"
            placeholder="••••••••••"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
            autoComplete="off"
            autoFocus
            style={{ letterSpacing: '4px' }}
          />
          <button
            id="btn-activate-license"
            className="license-activate-btn"
            onClick={handleActivate}
            disabled={!licenseKey.trim() || loading}
          >
            {loading ? '⏳ Doğrulanıyor...' : '🔑 Kodu Uygula'}
          </button>
        </div>

        <div className="license-contact">
          Yeni lisans için sistem yöneticinizle iletişime geçin.
          <br />
          <strong style={{ color: 'var(--accent)' }}>📞 Destek: +90 (212) 000 00 00</strong>
        </div>
      </div>
    </div>
  );
}
