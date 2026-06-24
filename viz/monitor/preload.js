const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kennel', {
  onRoster: (cb) => ipcRenderer.on('roster', (_e, data) => cb(data)),
  playMusic: (on) => ipcRenderer.invoke('music', on),  // OS-level looping music
  chime: () => ipcRenderer.send('chime'),               // OS-level completion sound
})
