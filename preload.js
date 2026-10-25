/* Critical Minerals Desk 桌面端预加载桥（最小暴露面） */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rmaDesktop', {
  diagnose: () => ipcRenderer.invoke('rma-diagnose'),
  killPid: (pid) => ipcRenderer.invoke('rma-kill', pid),
  version: () => ipcRenderer.invoke('rma-version'),
});
