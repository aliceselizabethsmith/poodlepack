// Safe bridge between the main process (file watcher) and the renderer (the scene).
// The renderer never touches Node APIs directly — it only gets these three streams.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('devcrew', {
  onManifest: (cb) => ipcRenderer.on('manifest', (_e, data) => cb(data)),
  onEvent: (cb) => ipcRenderer.on('event', (_e, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('status', (_e, data) => cb(data)),
  runDir: () => ipcRenderer.invoke('run-dir'),
})
