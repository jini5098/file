const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  onShow: cb => ipcRenderer.on('show', (e, d) => cb(d)),
  onHidden: cb => ipcRenderer.on('hidden', () => cb()),
  read: p => ipcRenderer.invoke('read', p),
  save: (src, name, bytes) => ipcRenderer.invoke('save', src, name, bytes),
  hide: () => ipcRenderer.send('hide')
});
