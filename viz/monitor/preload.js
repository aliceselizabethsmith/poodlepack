const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kennel', {
  onRoster: (cb) => ipcRenderer.on('roster', (_e, data) => cb(data)),
  activeMs: () => ipcRenderer.invoke('active-ms'),
})
