/* Critical Minerals Desk 桌面端（Electron 壳）
 * - 界面一律 loadFile 加载，不依赖工具代理；
 * - 工具代理（搜索/读网页/文件/代码执行）自动启动：端口池 8210-8219 回退，
 *   打包版经 asarUnpack 加载 agent-proxy.js，开发版 spawn 系统 node；
 * - 代理不可用时仅联网工具受限，弹一次提示。
 */
const { app, BrowserWindow, Menu, dialog, utilityProcess } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let PORT = 8210;
let proxyProc = null;

function proxyScriptPath() {
  let p = path.join(__dirname, 'agent-proxy.js');
  if (p.includes('app.asar')) p = p.replace('app.asar', 'app.asar.unpacked');
  return p;
}
function healthAt(port) {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:' + port + '/api/health', r => { r.resume(); resolve(r.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(700, () => { req.destroy(); resolve(false); });
  });
}
const waitHealth = async (port, tries) => { for (let i = 0; i < tries; i++) { if (await healthAt(port)) return true; } return false; };

function startProxyAt(port) {
  const p = proxyScriptPath();
  if (app.isPackaged) {
    proxyProc = utilityProcess.fork(p, [], {
      env: { ...process.env, PORT: String(port) },
      serviceName: 'tool-proxy-' + port,
    });
    proxyProc.on('exit', () => { proxyProc = null; });
  } else {
    proxyProc = spawn('node', [p], {
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore', windowsHide: true,
    });
  }
}

async function ensureProxy() {
  const ports = [8210, 8211, 8212, 8213, 8214, 8215, 8216, 8217, 8218, 8219];
  for (const p of ports) {
    if (await healthAt(p)) { PORT = p; return 'reuse'; }
  }
  for (const p of ports) {
    startProxyAt(p);
    if (await waitHealth(p, 12)) { PORT = p; return 'spawned'; }
    try { if (proxyProc) proxyProc.kill(); } catch (e) {}
    proxyProc = null;
  }
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
      dialog.showMessageBox(win, {
        type: 'warning',
        message: '工具代理未能启动（联网搜索/读网页/文件/代码执行不可用）。\n界面、对话与计算器不受影响。请确认端口 8210-8219 未被占用，或手动运行 agent-proxy.js。',
        buttons: ['知道了'],
      });
    }
    try { await win.loadFile('index.html'); }
    catch (e) { dialog.showMessageBox(win, { type: 'error', message: '页面加载失败：' + e.message, buttons: ['知道了'] }); }
  });

  app.on('window-all-closed', () => {
    if (proxyProc) { try { proxyProc.kill(); } catch (e) {} }
    app.quit();
  });
}
