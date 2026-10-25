/* Critical Minerals Desk 桌面端（Electron 壳）
 * 启动时自动拉起工具代理 agent-proxy.js（8210），退出时一并结束；
 * 代理已在外部运行则直接复用；代理启动失败时退化为直接加载 index.html。
 */
const { app, BrowserWindow, Menu, dialog, utilityProcess } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 8210;
const BASE = 'http://127.0.0.1:' + PORT + '/';
let proxyProc = null;
let win = null;

function health() {
  return new Promise(resolve => {
    const req = http.get(BASE + 'api/health', r => { r.resume(); resolve(r.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => { req.destroy(); resolve(false); });
  });
}

async function ensureProxy() {
  for (let i = 0; i < 5; i++) { if (await health()) return 'reuse'; }
  // 打包版没有系统 node，用 Electron 自带的 utilityProcess 运行代理；开发版直接 spawn node
  if (app.isPackaged) {
    proxyProc = utilityProcess.fork(path.join(__dirname, 'agent-proxy.js'), [], {
      env: { ...process.env, PORT: String(PORT) },
      serviceName: 'tool-proxy',
    });
    proxyProc.on('exit', () => { proxyProc = null; });
  } else {
    proxyProc = spawn('node', [path.join(__dirname, 'agent-proxy.js')], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'ignore', windowsHide: true,
    });
  }
  for (let i = 0; i < 25; i++) { if (await health()) return 'spawned'; }
  return 'failed';
}

function createWindow() {
  win = new BrowserWindow({
    width: 1380, height: 920, minWidth: 960, minHeight: 620,
    title: 'Critical Minerals Desk · 稀有金属价格预估与策略 Agent',
    icon: path.join(__dirname, '图标.png'),
    backgroundColor: '#0f0c29',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.critical-minerals.desk');
    Menu.setApplicationMenu(null);
    createWindow();

    const status = await ensureProxy();
    if (status === 'failed') {
      await win.loadFile('index.html');
      dialog.showMessageBox(win, {
        type: 'warning',
        message: '工具代理未能启动（联网搜索/读网页不可用）。\n其余功能正常；如需工具，请确认已安装 Node.js 并可运行 agent-proxy.js。',
        buttons: ['知道了'],
      });
    } else {
      try { await win.loadURL(BASE); }
      catch (e) { await win.loadFile('index.html'); }
    }
  });

  app.on('window-all-closed', () => {
    if (proxyProc) { try { proxyProc.kill(); } catch (e) {} }
    app.quit();
  });}
