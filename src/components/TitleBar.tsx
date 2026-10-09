// Pencere kontrollerinin Electron olmayan ortamda çalışması için wrapper
export const windowControls = {
  minimize: () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.minimize();
    }
  },
  maximize: () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.maximize();
    }
  },
  close: () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.close();
    }
  },
};

interface TitleBarProps {
  storeName: string;
  licenseValid: boolean;
  daysLeft: number;
}

export default function TitleBar({ storeName, licenseValid, daysLeft }: TitleBarProps) {
  return (
    <div className="titlebar">
      <span className="titlebar-logo">⚡ ESNAF POS</span>
      <span className="titlebar-title">{storeName}</span>

      {licenseValid && daysLeft <= 14 && (
        <span className="badge badge-warning" style={{ fontSize: '11px', marginRight: 'auto', marginLeft: '8px' }}>
          Lisans: {daysLeft} gün
        </span>
      )}

      {!licenseValid && (
        <span className="badge badge-danger" style={{ fontSize: '11px', marginRight: 'auto', marginLeft: '8px' }}>
          LİSANS SONA ERDİ
        </span>
      )}

      <div className="titlebar-controls">
        <button
          className="titlebar-btn"
          onClick={windowControls.minimize}
          title="Küçült"
        >
          ─
        </button>
        <button
          className="titlebar-btn"
          onClick={windowControls.maximize}
          title="Büyüt"
        >
          □
        </button>
        <button
          className="titlebar-btn close"
          onClick={windowControls.close}
          title="Kapat"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
