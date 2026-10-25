/* Critical Minerals Desk 桌面端预加载桥（最小暴露面） */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rmaDesktop', {
  diagnose: () => ipcRenderer.invoke('rma-diagnose'),
  killPid: (pid) => ipcRenderer.invoke('rma-kill', pid),
  version: () => ipcRenderer.invoke('rma-version'),
  proxyInfo: () => ipcRenderer.invoke('rma-proxy-info'),
  retryProxy: () => ipcRenderer.invoke('rma-proxy-retry'),
  onProxyStatus: (cb) => {
    const h = (e, payload) => { try { cb(payload); } catch (err) {} };
    ipcRenderer.on('rma-proxy-status', h);
    return () => ipcRenderer.removeListener('rma-proxy-status', h);
  },
});
