// ============================================================
// ESNAF POS - Preload Script (Güvenli IPC köprüsü)
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Pencere kontrolü
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
});
