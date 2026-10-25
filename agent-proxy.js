#!/usr/bin/env node
/* 零依赖本地工具代理 —— 配合 index.html 的"联网工具"使用
 *
 * 功能：
 *   GET /api/health           → {ok:true, engines:[...]}
 *   GET /api/search?q=关键词   → {results:[{title,url,snippet}]}   依次尝试 ddg → bing → baidu
 *   GET /api/fetch?url=链接    → {url,title,text}                  抓取网页并提取正文文本
 *   其余路径                  → 静态文件服务（index.html 等）
 *
 * 启动：  node agent-proxy.js          （默认 http://127.0.0.1:8210，可用 PORT 环境变量改端口）
 */
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');

const PORT = Number(process.env.PORT) || 8210;
const ROOT = __dirname;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_TEXT = 20000;

function strip(s) {
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#x?[0-9a-f]+;/gi, ' ')
    .replace(/[ \t\u00a0]+/g, ' ')
    .trim();
}

function htmlToText(html) {
  let t = String(html);
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
       .replace(/<style[\s\S]*?<\/style>/gi, ' ')
       .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const title = strip((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(t) || [])[1] || '');
  t = t.replace(/<\/(p|div|li|tr|h[1-6]|section|article|table)>/gi, '\n')
       .replace(/<br\s*\/?>/gi, '\n')
       .replace(/<[^>]+>/g, ' ');
  t = t.replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return { title, text: t };
}

async function timedFetch(url, ms, headers) {
  return fetch(url, { headers: headers || { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(ms) });
}

/* ---------- 搜索引擎（依次回退） ---------- */

function jstr(s) { try { return JSON.parse('"' + s + '"'); } catch (e) { return s; } }

async function searchBaidu(q) {
  const r = await timedFetch('https://www.baidu.com/s?wd=' + encodeURIComponent(q) + '&rn=10', 8000);
  const html = (await r.text()).replace(/\\"/g, '"');
  const results = [];
  // 新版页面：结果以 JSON 记录内嵌（abstract → title → source → linkInfo.href）
  const jre = /"abstract":"((?:[^"\\]|\\.)*)"\s*,\s*"title":"((?:[^"\\]|\\.)*)"(?:[\s\S]{0,600}?"sourceName":"((?:[^"\\]|\\.)*)")?[\s\S]{0,1200}?"href":"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = jre.exec(html)) && results.length < 6) {
    const title = jstr(m[2]).trim();
    const href = jstr(m[4]);
    if (!title || !/^https?:\/\//i.test(href)) continue;
    results.push({ title, url: href, snippet: jstr(m[1]).trim().slice(0, 200), source: jstr(m[3] || '') });
  }
  if (results.length >= 3) return results;
  // 兜底：h3 标题 + 链接
  const hre = /<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const seen = new Set(results.map(x => x.url));
  while ((m = hre.exec(html)) && results.length < 6) {
    const title = strip(m[2]);
    if (!title || seen.has(m[1])) continue;
    seen.add(m[1]);
    results.push({ title, url: m[1], snippet: '', source: '' });
  }
  return results;
}

async function searchSogou(q) {
  const r = await timedFetch('https://www.sogou.com/web?query=' + encodeURIComponent(q), 8000);
  const html = await r.text();
  const results = [];
  const re = /<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && results.length < 6) {
    let url = m[1];
    if (url.startsWith('/')) url = 'https://www.sogou.com' + url;
    const title = strip(m[2]);
    if (!title) continue;
    results.push({ title, url, snippet: '', source: '' });
  }
  return results;
}

async function searchSo360(q) {
  const r = await timedFetch('https://www.so.com/s?q=' + encodeURIComponent(q), 8000);
  const html = await r.text();
  const results = [];
  const re = /<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && results.length < 6) {
    const title = strip(m[2]);
    if (!title) continue;
    results.push({ title, url: m[1], snippet: '', source: '' });
  }
  return results;
}

async function searchDDG(q) {
  const r = await timedFetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), 8000);
  const html = await r.text();
  const results = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && results.length < 6) {
    let url = m[1];
    const uddg = /uddg=([^&]+)/.exec(url);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (url.startsWith('//')) url = 'https:' + url;
    results.push({ title: strip(m[2]), url, snippet: strip(m[3]).slice(0, 200), source: '' });
  }
  return results;
}

async function searchBing(q) {
  // 用 Bing 的 RSS 输出：结构稳定、UTF-8；中文相关度弱，作为末位回退
  const r = await timedFetch('https://www.bing.com/search?q=' + encodeURIComponent(q) + '&format=rss', 8000);
  const xml = await r.text();
  const results = [];
  const re = /<item>\s*<title>([\s\S]*?)<\/title>\s*<link>([\s\S]*?)<\/link>(?:\s*<description>([\s\S]*?)<\/description>)?[\s\S]*?<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && results.length < 6) {
    results.push({ title: strip(m[1]), url: strip(m[2]), snippet: strip(m[3] || '').slice(0, 200), source: '' });
  }
  return results;
}

const ENGINES = [['baidu', searchBaidu], ['sogou', searchSogou], ['so360', searchSo360], ['ddg', searchDDG], ['bing', searchBing]];

async function doSearch(q) {
  const tried = [];
  for (const [name, fn] of ENGINES) {
    try {
      const results = await fn(q);
      if (results.length) return { engine: name, results };
      console.error('[search]', name, 'empty');
      tried.push(name + ':空');
    } catch (e) {
      console.error('[search]', name, 'fail:', String(e.message || e).slice(0, 120));
      tried.push(name + ':' + String(e.message || e).slice(0, 60));
    }
  }
  throw new Error('所有搜索引擎均失败（' + tried.join('；') + '）。网络受限时请换用智谱 GLM 的内置联网搜索。');
}

/* ---------- HTTP 服务 ---------- */

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

/* ---------- 工作区文件系统（严格限制在指定目录内） ---------- */

function fsRoot(dirParam) {
  const d = String(dirParam || 'workspace');
  return path.isAbsolute(d) ? d : path.join(__dirname, d);
}
function safeJoin(rootDir, p) {
  const r = path.resolve(rootDir);
  const t = path.resolve(r, String(p || '.'));
  if (t !== r && !t.startsWith(r + path.sep)) throw new Error('路径越界: ' + p);
  return t;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*' });
    return res.end();
  }

  try {
    if (p === '/api/health') return send(res, 200, { ok: true, engines: ENGINES.map(e => e[0]) });

    if (p === '/api/search') {
      const q = (u.searchParams.get('q') || '').trim();
      if (!q) return send(res, 400, { error: '缺少参数 q' });
      const out = await doSearch(q);
      return send(res, 200, out);
    }

    if (p === '/api/fetch') {
      let target = (u.searchParams.get('url') || '').trim();
      if (!/^https?:\/\//i.test(target)) return send(res, 400, { error: 'url 必须是 http/https 链接' });
      let r, ct = '', raw = '';
      // 搜索引擎结果链接常是 JS 跳转页，最多跟 3 跳
      for (let hop = 0; hop < 3; hop++) {
        r = await timedFetch(target, 12000);
        ct = r.headers.get('content-type') || '';
        if (!/text|json|xml|html/i.test(ct)) throw new Error('不支持的内容类型: ' + ct);
        const buf = await r.arrayBuffer();
        // 编码嗅探：header charset 优先，meta charset 兜底（GBK 系页面常见）
        let cs = (/charset=([\w-]+)/i.exec(ct) || [])[1];
        if (!cs) cs = (/charset=["']?([\w-]+)/i.exec(new TextDecoder('latin1').decode(buf.slice(0, 2048))) || [])[1];
        try { raw = new TextDecoder((cs || 'utf-8').toLowerCase()).decode(buf); }
        catch (e) { raw = new TextDecoder('utf-8').decode(buf); }
        if (/html/i.test(ct) && raw.length < 4000) {
          const m = /window\.location\.replace\("([^"]+)"\)/.exec(raw)
            || /window\.location\.href\s*=\s*"([^"]+)"/.exec(raw)
            || /http-equiv="refresh"[^>]*content="[^"]*url='([^']+)'/i.exec(raw)
            || /http-equiv="refresh"[^>]*content="[^"]*url=([^"'>]+)/i.exec(raw);
          if (m && /^https?:\/\//i.test(m[1])) { target = m[1]; continue; }
        }
        break;
      }
      if (/html/i.test(ct)) {
        const { title, text } = htmlToText(raw);
        return send(res, 200, { url: r.url || target, title, text: text.slice(0, MAX_TEXT) });
      }
      return send(res, 200, { url: r.url || target, title: '', text: raw.slice(0, MAX_TEXT) });
    }

    if (p === '/api/fs/list') {
      const root = fsRoot(u.searchParams.get('dir'));
      const target = safeJoin(root, u.searchParams.get('path') || '.');
      const entries = await fsp.readdir(target, { withFileTypes: true });
      const out = [];
      for (const e of entries.slice(0, 500)) {
        let size = 0;
        try { if (!e.isDirectory()) size = (await fsp.stat(path.join(target, e.name))).size; } catch (err) {}
        out.push({ name: e.name, dir: e.isDirectory(), size });
      }
      return send(res, 200, { root, path: target, entries: out });
    }

    if (p === '/api/fs/read') {
      const root = fsRoot(u.searchParams.get('dir'));
      const target = safeJoin(root, u.searchParams.get('path') || '.');
      const st = await fsp.stat(target);
      if (st.isDirectory()) throw new Error('这是一个目录，请用 list');
      if (st.size > 2 * 1024 * 1024) throw new Error('文件过大（>2MB）');
      const content = await fsp.readFile(target, 'utf8');
      return send(res, 200, { path: target, bytes: st.size, content: content.slice(0, 200000), truncated: content.length > 200000 });
    }

    if (p === '/api/fs/write' && req.method === 'POST') {
      const body = await readBody(req);
      const root = fsRoot(body.dir);
      const target = safeJoin(root, body.path);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, String(body.content ?? ''), 'utf8');
      return send(res, 200, { ok: true, path: target, bytes: Buffer.byteLength(String(body.content ?? '')) });
    }

    if (p === '/api/exec' && req.method === 'POST') {
      const body = await readBody(req);
      const code = String(body.code || '');
      const timeout = Math.min(120000, Math.max(1000, +body.timeoutMs || 30000));
      const tmp = path.join(os.tmpdir(), 'rma_exec_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.js');
      await fsp.writeFile(tmp, code, 'utf8');
      const t0 = Date.now();
      const out = await new Promise(resolve => {
        // 打包版里本代理跑在 Electron 内置 Node 中，process.execPath 是 Electron 可执行文件，
        // 必须带 ELECTRON_RUN_AS_NODE=1 才按 Node 运行脚本；系统 node 下该变量无副作用。
        const cp = spawn(process.execPath, [tmp], { windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
        let so = '', se = '', done = false;
        const timer = setTimeout(() => {
          if (!done) { done = true; try { cp.kill('SIGKILL'); } catch (e) {}
            resolve({ ok: false, timeout: true, stdout: so.slice(0, 60000), stderr: (se + '\n[执行超时 ' + timeout + 'ms，已终止]').slice(0, 60000), durationMs: Date.now() - t0 }); }
        }, timeout);
        cp.stdout.on('data', d => { so = (so + d).slice(0, 200000); });
        cp.stderr.on('data', d => { se = (se + d).slice(0, 100000); });
        cp.on('error', e => { if (!done) { done = true; clearTimeout(timer); resolve({ ok: false, stdout: so, stderr: String(e.message), durationMs: Date.now() - t0 }); } });
        cp.on('close', c => { if (!done) { done = true; clearTimeout(timer); resolve({ ok: c === 0, code: c, stdout: so, stderr: se, durationMs: Date.now() - t0 }); } });
      });
      await fsp.unlink(tmp).catch(() => {});
      return send(res, 200, out);
    }

    if (p === '/api/cmd' && req.method === 'POST') {
      const body = await readBody(req);
      const timeout = Math.min(120000, Math.max(1000, +body.timeoutMs || 30000));
      const out = await new Promise(resolve => {
        exec(String(body.command || ''), { timeout, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
          resolve({ ok: !err, code: err ? (err.code ?? 1) : 0, stdout: String(stdout || '').slice(0, 100000), stderr: String(stderr || (err && err.message) || '').slice(0, 60000) });
        });
      });
      return send(res, 200, out);
    }

    if (p === '/api/fs/drives') {
      const out = [];
      if (process.platform === 'win32') {
        for (let i = 65; i <= 90; i++) {
          const letter = String.fromCharCode(i) + ':\\';
          try { fs.accessSync(letter); out.push(letter); } catch (e) {}
        }
      } else {
        out.push('/');
      }
      return send(res, 200, { drives: out });
    }

    if (p === '/api/fs/browse') {
      const t = path.resolve(String(u.searchParams.get('path') || ''));
      const entries = await fsp.readdir(t, { withFileTypes: true });
      return send(res, 200, { path: t, dirs: entries.filter(e => e.isDirectory()).map(e => e.name).sort() });
    }

    // 静态文件
    const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (e, data) => {
      if (e) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  } catch (e) {
    send(res, 502, { error: String(e.message || e) });
  }
});

server.on('error', e => {
  console.error('[proxy] server error:', e.message);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('工具代理已启动: http://127.0.0.1:' + PORT);
  console.log('  搜索 /api/search?q=…   网页 /api/fetch?url=…   健康 /api/health');
});
