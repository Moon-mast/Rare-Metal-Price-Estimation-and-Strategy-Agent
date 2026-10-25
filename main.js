/* Critical Minerals Desk 桌面端（Electron 壳）
 * - 界面一律 loadFile 加载，不依赖工具代理；
 * - 工具代理（搜索/读网页/文件/代码执行）自动启动：端口池 8210-8219 回退，
 *   打包版经 asarUnpack 加载 agent-proxy.js（Electron 内置 Node）；
 *   开发版优先 spawn 系统 node，缺失时自动改用 Electron 内置 Node；
 * - 启动采用“截止时间 + 间隔轮询”等待健康，进程秒退时立刻换端口；
 * - 启动结果（实际端口）通过 IPC 同步给界面，设置里的代理地址自动对齐；
 * - 代理不可用时仅联网工具受限，弹一次提示；设置→诊断代理环境可查看日志并重试。
 */
const { app, BrowserWindow, Menu, dialog, utilityProcess, ipcMain } = require('electron');
const { spawn, execFile } = require('child_process');
const path = require('path');
const http = require('http');
const net = require('net');
const fs = require('fs');

const PORTS = [8210, 8211, 8212, 8213, 8214, 8215, 8216, 8217, 8218, 8219];
const START_TIMEOUT_MS = 8000;   // 单个端口等待代理就绪的截止时间
const POLL_INTERVAL_MS = 150;    // 健康轮询间隔（不能为 0，否则会在 Node 启动前就判失败）

let win = null;
let proxyProc = null;
let proxyStarting = null;
let PROXY_PORT = 0;
let PROXY_STATUS = 'starting';   // starting | ok | failed
let useUtility = false;          // 系统 node 不可用时改用 Electron 内置 Node
let logPath = '';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 日志（排查用，写到 userData/agent-proxy.log） ---------- */
function initLog() {
  try { logPath = path.join(app.getPath('userData'), 'agent-proxy.log'); }
  catch (e) { logPath = path.join(__dirname, 'agent-proxy.log'); }
}
function logLine(s) {
  try { fs.appendFileSync(logPath, '[' + new Date().toISOString() + '] ' + s + '\n'); } catch (e) {}
}

/* ---------- 代理脚本路径（打包版从 asar.unpacked 取） ---------- */
function proxyScriptPath() {
  let p = path.join(__dirname, 'agent-proxy.js');
  if (p.includes('app.asar')) p = p.replace('app.asar', 'app.asar.unpacked');
  return p;
}

/* ---------- 探测 ---------- */
function healthAt(port) {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:' + port + '/api/health', r => {
      r.resume();
      resolve(r.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(700, () => { req.destroy(); resolve(false); });
  });
}
function tcpOpen(port) {
  return new Promise(resolve => {
    const s = net.connect({ host: '127.0.0.1', port });
    const done = v => { try { s.destroy(); } catch (e) {} resolve(v); };
    s.setTimeout(700, () => done(false));
    s.on('connect', () => done(true));
    s.on('error', () => done(false));
  });
}
/** 在截止时间内反复探测健康；进程提前退出时立刻放弃。 */
async function waitHealth(port, isDead) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await healthAt(port)) return true;
    if (isDead()) return false;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

/* ---------- 进程管理 ---------- */
function startProxy(port) {
  const script = proxyScriptPath();
  const env = { ...process.env, PORT: String(port) };
  const state = { proc: null, dead: false, spawnError: null, mode: '' };

  try {
    if (app.isPackaged || useUtility) {
      state.mode = 'utilityProcess';
      state.proc = utilityProcess.fork(script, [], {
        env,
        serviceName: 'tool-proxy-' + port,
        stdio: 'pipe',
      });
    } else {
      state.mode = 'node';
      state.proc = spawn('node', [script], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    }
  } catch (e) {
    state.dead = true;
    state.spawnError = 'throw:' + (e && e.message);
    logLine('代理启动异常（端口 ' + port + ', ' + state.mode + '）: ' + (e && e.message));
    return state;
  }

  const proc = state.proc;
  proc.on('exit', code => {
    state.dead = true;
    if (proxyProc === proc) proxyProc = null;
    if (PROXY_STATUS === 'ok') logLine('代理进程退出（端口 ' + port + ', ' + state.mode + ', code=' + code + '）');
  });
  proc.on('error', err => {
    state.dead = true;
    state.spawnError = (err && err.code) || 'error';
    logLine('代理进程错误（端口 ' + port + ', ' + state.mode + '）: ' + (err && err.message));
  });
  if (proc.stdout) proc.stdout.on('data', d => logLine('[proxy] ' + String(d).trim()));
  if (proc.stderr) proc.stderr.on('data', d => logLine('[proxy:err] ' + String(d).trim()));
  return state;
}

function killState(state) {
  try { if (state && state.proc) state.proc.kill(); } catch (e) {}
}

function setProxy(port, status) {
  PROXY_PORT = port;
  PROXY_STATUS = status;
  notifyProxy();
}
function notifyProxy() {
  if (win && !win.isDestroyed() && win.webContents && !win.webContents.isLoading()) sendProxyStatus();
}
function sendProxyStatus() {
  try {
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('rma-proxy-status', { port: PROXY_PORT, status: PROXY_STATUS });
    }
  } catch (e) {}
}

/* ---------- 启动/复用 ---------- */
async function doEnsureProxy() {
  logLine('—— 启动工具代理：探测 8210-8219 ——');
  // 1) 已有代理直接复用
  for (const p of PORTS) {
    if (await healthAt(p)) {
      setProxy(p, 'ok');
      logLine('复用已运行的工具代理: 127.0.0.1:' + p);
      return 'reuse';
    }
  }
  // 2) 逐端口启动；被其他程序占用的端口直接跳过，避免白等
  for (const p of PORTS) {
    if (await tcpOpen(p)) {
      logLine('端口 ' + p + ' 已被其他程序占用，跳过');
      continue;
    }
    const state = startProxy(p);
    proxyProc = state.proc;
    const ok = await waitHealth(p, () => state.dead);
    if (ok) {
      setProxy(p, 'ok');
      logLine('工具代理就绪: 127.0.0.1:' + p + '（' + state.mode + '）');
      return 'spawned';
    }
    logLine('端口 ' + p + ' 未就绪（' + state.mode + (state.spawnError ? ', ' + state.spawnError : '') + '），换下一个端口');
    killState(state);
    proxyProc = null;
    if (state.spawnError === 'ENOENT' && !useUtility) {
      useUtility = true;
      logLine('未找到系统 node，改用 Electron 内置 Node');
    }
    await sleep(120);
  }
  setProxy(0, 'failed');
  logLine('工具代理启动失败：8210-8219 均不可用');
  return 'failed';
}

function ensureProxy() {
  if (!proxyStarting) {
    proxyStarting = doEnsureProxy().finally(() => { proxyStarting = null; });
  }
  return proxyStarting;
}

/* ---------- 窗口 ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1380, height: 920, minWidth: 960, minHeight: 620,
    title: 'Critical Minerals Desk · 稀有金属价格预估与策略 Agent',
    icon: path.join(__dirname, '图标.png'),
    backgroundColor: '#0f0c29',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') },
  });
  win.once('ready-to-show', () => win.show());
  // 页面加载完成后再补发一次当前状态：代理可能在页面加载期间就已就绪，
  // 早于页面加载的事件会被丢弃，导致界面端口没有对齐
  win.webContents.on('did-finish-load', () => sendProxyStatus());
  win.on('closed', () => { win = null; });
}

function tailLog(lines) {
  try {
    const buf = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    return buf.slice(-lines).join('\n');
  } catch (e) { return ''; }
}

/** 诊断用：端口占用 PID/进程名、Node 版本、代理运行状态 */
function runCmd(cmd, args) {
  return new Promise(res => execFile(cmd, args, { windowsHide: true, timeout: 4000 }, (e, out) => res(String(out || '').trim())));
}
ipcMain.handle('rma-version', () => app.getVersion());
ipcMain.handle('rma-proxy-info', () => ({
  port: PROXY_PORT, status: PROXY_STATUS, logPath, logTail: tailLog(8),
}));
ipcMain.handle('rma-proxy-retry', async () => {
  const status = await ensureProxy();
  return { status, port: PROXY_PORT };
});
ipcMain.handle('rma-kill', async (e, pid) => {
  try { await runCmd('taskkill', ['/F', '/PID', String(pid)]); return true; } catch (err) { return false; }
});
ipcMain.handle('rma-diagnose', async () => {
  const report = {
    electron: app.getVersion(), packaged: app.isPackaged, ports: [],
    proxyPort: PROXY_PORT, proxyStatus: PROXY_STATUS, logPath, logTail: tailLog(10),
  };
  try { report.nodeVersion = await runCmd('node', ['-v']) || null; } catch (e) { report.nodeVersion = null; }
  const pidMap = {};
  try {
    const ns = await runCmd('netstat', ['-ano']);
    for (const line of ns.split('\n')) {
      const m = line.match(/127\.0\.0\.1:(82\d\d)\s+\S+\s+LISTENING\s+(\d+)/);
      if (m) pidMap[m[1]] = m[2];
    }
  } catch (e) {}
  for (let p = 8210; p <= 8219; p++) {
    if (await healthAt(p)) { report.ports.push({ port: p, state: 'proxy' }); continue; }
    if (await tcpOpen(p)) {
      const pid = pidMap[String(p)] || null;
      let name = null;
      if (pid) {
        const tl = await runCmd('tasklist', ['/FI', 'PID eq ' + pid, '/FO', 'CSV', '/NH']);
        name = (tl.split('"')[1]) || null;
      }
      report.ports.push({ port: p, state: 'occupied', pid, name });
    } else {
      report.ports.push({ port: p, state: 'free' });
    }
  }
  return report;
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(async () => {
    initLog();
    logLine('应用启动 v' + app.getVersion() + '（' + (app.isPackaged ? '打包版' : '开发版') + '）');
    app.setAppUserModelId('com.critical-minerals.desk');
    Menu.setApplicationMenu(null);
    createWindow();
    // 先让界面出来，代理在后台启动，避免界面等待代理
    win.loadFile('index.html').catch(e => {
      if (win && !win.isDestroyed()) dialog.showMessageBox(win, { type: 'error', message: '页面加载失败：' + e.message, buttons: ['知道了'] });
    });

    const status = await ensureProxy();
    if (status === 'failed' && win && !win.isDestroyed()) {
      dialog.showMessageBox(win, {
        type: 'warning',
        message: '工具代理未能启动（联网搜索/读网页/文件/代码执行不可用）。\n界面、对话与计算器不受影响。\n\n请在右上角 ⚙ → 诊断代理环境查看原因并重试，或在本目录手动运行 node agent-proxy.js。',
        detail: logPath ? ('代理日志：' + logPath + '\n' + tailLog(3)) : '',
        buttons: ['知道了'],
      });
    }
  });

  app.on('window-all-closed', () => {
    if (proxyProc) { try { proxyProc.kill(); } catch (e) {} proxyProc = null; }
    app.quit();
  });
  app.on('before-quit', () => {
    if (proxyProc) { try { proxyProc.kill(); } catch (e) {} proxyProc = null; }
  });
}
