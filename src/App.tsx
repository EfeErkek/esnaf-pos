import { useState, useEffect } from 'react';
import './index.css';
import { ToastProvider } from './components/ToastProvider';
import TitleBar from './components/TitleBar';
import SalesScreen from './screens/SalesScreen';
import LicenseScreen from './screens/LicenseScreen';
import SettingsScreen from './screens/SettingsScreen';
import {
  initDatabase,
  getAllSettings,
  checkLicense,
} from './utils/database';
import type { AppSettings, AppScreen, LicenseStatus } from './types';

function App() {
  const [loading, setLoading] = useState(true);
  const [activeScreen, setActiveScreen] = useState<AppScreen>('sales');
  const [settings, setSettings] = useState<AppSettings>({} as AppSettings);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({
    isValid: true,
    expiryDate: '',
    daysLeft: 999,
  });

  useEffect(() => {
    async function bootstrap() {
      try {
        await initDatabase();
        refreshData();
      } catch (err) {
        console.error('DB init hatası:', err);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  function refreshData() {
    const s = getAllSettings();
    setSettings(s);
    const lic = checkLicense();
    setLicenseStatus(lic);
    // Lisans sona erdiyse direkt o ekrana git
    if (!lic.isValid) {
      setActiveScreen('license');
    }
  }

  if (loading) {
    return (
      <div className="loading-screen" style={{ height: '100vh' }}>
        <div className="loading-logo">⚡ ESNAF POS</div>
        <div className="loading-spinner" />
        <div className="loading-text">Veritabanı yükleniyor...</div>
      </div>
    );
  }

  const nav = [
    { id: 'sales' as AppScreen, icon: '🛒', label: 'Satış', disabled: !licenseStatus.isValid },
    { id: 'settings' as AppScreen, icon: '⚙️', label: 'Ayarlar', disabled: false },
  ];

  return (
    <ToastProvider>
      <div id="root-layout" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TitleBar
          storeName={settings.store_name ?? 'Esnaf POS'}
          licenseValid={licenseStatus.isValid}
          daysLeft={licenseStatus.daysLeft}
        />

        <div className="app-layout">
          {/* Sidebar Navigasyon */}
          <nav className="sidebar">
            {nav.map(n => (
              <button
                key={n.id}
                id={`nav-${n.id}`}
                className={`sidebar-btn ${activeScreen === n.id ? 'active' : ''}`}
                onClick={() => !n.disabled && setActiveScreen(n.id)}
                title={n.label}
                disabled={n.disabled}
                style={{ opacity: n.disabled ? 0.3 : 1, cursor: n.disabled ? 'not-allowed' : 'pointer' }}
              >
                {n.icon}
              </button>
            ))}

            <div className="sidebar-spacer" />

            {/* Lisans ikonu */}
            <button
              id="nav-license"
              className={`sidebar-btn ${activeScreen === 'license' ? 'active' : ''}`}
              onClick={() => setActiveScreen('license')}
              title="Lisans"
              style={{ color: licenseStatus.isValid ? 'var(--text-muted)' : 'var(--danger)' }}
            >
              {licenseStatus.isValid ? '🔑' : '🔒'}
            </button>
          </nav>

          {/* Ana İçerik */}
          <main className="main-content">
            {activeScreen === 'sales' && licenseStatus.isValid && (
              <SalesScreen
                settings={settings}
                onRefreshSettings={refreshData}
              />
            )}
            {activeScreen === 'settings' && (
              <SettingsScreen
                settings={settings}
                licenseStatus={licenseStatus}
                onSave={() => {
                  refreshData();
                }}
                onLicenseRevoked={() => {
                  refreshData();
                  setActiveScreen('license');
                }}
              />
            )}
            {(activeScreen === 'license' || !licenseStatus.isValid) && (
              <LicenseScreen
                licenseStatus={licenseStatus}
                onActivated={() => {
                  refreshData();
                  setActiveScreen('sales');
                }}
              />
            )}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

export default App;
