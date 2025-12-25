const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startJob: (payload) => ipcRenderer.send('start-job', payload),
  stopJob: () => ipcRenderer.send('stop-job'),
  
  // Events from Main -> Renderer
  onLog: (callback) => ipcRenderer.on('job-log', (_event, log) => callback(log)),
  onStatsUpdate: (callback) => ipcRenderer.on('job-stats', (_event, stats) => callback(stats)),
  onStatusChange: (callback) => ipcRenderer.on('job-status', (_event, status) => callback(status)),
});