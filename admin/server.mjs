/**
 * 留白 · 网站管理程序（后端）
 *
 * 一个程序管全部：写文章 / 换图片 / 改首页 / 本地预览 / 构建 / 部署 / 回滚。
 * 只在 127.0.0.1 监听，零依赖（只用 Node 内置模块）。
 * 启动：双击根目录的「网站管理.cmd」
 *
 * ── 部署策略（保守）────────────────────────────────────────────────────
 *  1. 部署仓独立放在 .deploy/，不放在 public/ —— hexo clean 不会再把它删掉，
 *     于是 git 历史连续，**不需要 push -f**。
 *  2. 推之前自动把线上 main 打一个 backup-<时间戳> 标签并推到远端。
 *  3. 推之前把 public/ 快照到 .backups/，只保留最近 5 份。
 *  4. 推之前做本地预检：关键文件必须存在。
 *  5. 推送用普通 push。被拒绝就停手报告，**绝不强推**。
 *  6. 推完回读线上，验证关键标记；失败会给出回滚命令。
 *  7. 任何时候可以一键回滚到任意一个备份标签。
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const POSTS      = path.join(ROOT, 'source', '_posts');
const IMG        = path.join(ROOT, 'source', 'img');
const THEME_CFG  = path.join(ROOT, 'themes', 'liubai', '_config.yml');
const PUBLIC     = path.join(ROOT, 'public');
const TRASH      = path.join(ROOT, '.trash');
const DEPLOY_DIR = path.join(ROOT, '.deploy');      // 常驻部署仓（含 .git）
const BACKUPS    = path.join(ROOT, '.backups');     // public 快照
const PORT       = Number(process.env.ADMIN_PORT || 4200);
const PREVIEW_PORT = Number(process.env.PREVIEW_PORT || 4000);
const LIVE       = 'https://singning901.github.io/';
const REPO       = 'https://github.com/singning901/singning901.github.io.git';
const GIT_DIR    = 'C:\\Users\\singning\\tools\\PortableGit\\cmd';   // PATH 上没有 git 时用
const KEEP_SNAPSHOTS = 5;

/* 线上必须存在的文件；预检不过就不推 */
const REQUIRED = ['index.html', 'css/liubai.css', 'js/liubai.js', 'legacy/index.html'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};
const json = (res, code, obj) => send(res, code, JSON.stringify(obj));
const readBody = (req, limit = 60 * 1024 * 1024) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const HOST_ENV = () => ({ ...process.env, PATH: GIT_DIR + ';' + (process.env.PATH || '') });

/** 跑一条命令，把输出喂给 log 回调 */
function run(cmd, args, { cwd = ROOT, optional = false, log } = {}) {
  return new Promise((resolve) => {
    log && log('$ ' + cmd.split('\\').pop() + ' ' + args.join(' '));
    const p = spawn(cmd, args, { cwd, env: HOST_ENV(), shell: false });
    const pipe = (b) => {
      const s = b.toString('utf8').replace(/\r/g, '');
      if (s.trim() && log) log(s.trimEnd());
    };
    p.stdout.on('data', pipe);
    p.stderr.on('data', pipe);
    p.on('error', (e) => { log && log('ERR ' + e.message); resolve({ code: -1, ok: false }); });
    p.on('close', (code) => resolve({ code, ok: code === 0 || optional }));
  });
}

/* ── 目录同步：把 src 的内容镜像到 dst，保留 dst/.git ─────────────────── */
async function mirror(src, dst, exclude = ['.git']) {
  await fsp.mkdir(dst, { recursive: true });
  const seen = new Set();
  async function walk(dir, rel) {
    for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (exclude.includes(r.split('/')[0])) continue;
      const s = path.join(dir, e.name), d = path.join(dst, r);
      if (e.isDirectory()) { await fsp.mkdir(d, { recursive: true }); await walk(s, r); }
      else { await fsp.mkdir(path.dirname(d), { recursive: true }); await fsp.copyFile(s, d); seen.add(r); }
    }
  }
  await walk(src, '');
  // 删掉 dst 里 src 已经没有的（.git 除外）
  async function prune(dir, rel) {
    for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (exclude.includes(r.split('/')[0])) continue;
      const d = path.join(dir, e.name);
      if (e.isDirectory()) { await prune(d, r); if (!(await fsp.readdir(d)).length) await fsp.rmdir(d); }
      else if (!seen.has(r)) await fsp.unlink(d);
    }
  }
  await prune(dst, '');
}

/** public 快照，只留最近 N 份 */
async function snapshot() {
  await fsp.mkdir(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dst = path.join(BACKUPS, 'public-' + stamp);
  await mirror(PUBLIC, dst, []);
  const all = (await fsp.readdir(BACKUPS)).filter((f) => f.startsWith('public-')).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP_SNAPSHOTS))) {
    await fsp.rm(path.join(BACKUPS, old), { recursive: true, force: true });
  }
  return 'public-' + stamp;
}

/* ── 任务队列 ─────────────────────────────────────────────────────────── */
const jobs = new Map();
let currentJob = null;
let previewProc = null;

function startJob(action, payload = {}) {
  if (currentJob && currentJob.status === 'running') {
    return { ok: false, error: '已有任务在跑：' + currentJob.action };
  }
  const id = 'job-' + Date.now();
  const job = { id, action, status: 'running', log: [], startedAt: new Date().toISOString() };
  jobs.set(id, job);
  currentJob = job;
  const log = (s) => job.log.push(s);
  const hexo = path.join(ROOT, 'node_modules', 'hexo', 'bin', 'hexo');
  const node = process.execPath;

  (async () => {
    /* ── 构建 ── */
    if (action === 'build' || action === 'publish') {
      await run(node, [hexo, 'clean'], { log });
      const g = await run(node, [hexo, 'generate'], { log });
      if (!g.ok) { job.status = 'failed'; log('✗ 构建失败，已中止'); return; }
    }

    /* ── 本地预检 ── */
    if (action === 'publish') {
      log('');
      log('— 本地预检 —');
      const missing = REQUIRED.filter((f) => !fs.existsSync(path.join(PUBLIC, f)));
      if (missing.length) {
        job.status = 'failed';
        log('✗ 缺少关键文件：' + missing.join(', '));
        log('  预检不过，已中止。线上没有被改动。');
        return;
      }
      log('✓ 关键文件齐全（' + REQUIRED.join(' / ') + '）');

      /* 快照 public */
      const snap = await snapshot();
      log('✓ 已快照 public/ → .backups/' + snap);

      /* 准备部署仓：首次从远端 main 克隆，让历史连续，之后就不需要强推 */
      if (!fs.existsSync(path.join(DEPLOY_DIR, '.git'))) {
        log('');
        log('— 首次准备部署仓 .deploy/ —');
        await fsp.mkdir(DEPLOY_DIR, { recursive: true });
        const c = await run('git', ['clone', '--branch', 'main', '--single-branch', REPO, DEPLOY_DIR], { log, optional: true });
        if (!c.ok) {
          log('  克隆失败或分支为空，改为就地初始化');
          await run('git', ['init', '-q'], { cwd: DEPLOY_DIR, log });
          await run('git', ['checkout', '-q', '-B', 'main'], { cwd: DEPLOY_DIR, log });
          await run('git', ['remote', 'add', 'origin', REPO], { cwd: DEPLOY_DIR, log });
        }
      }

      /* 备份线上 main 为一个标签 */
      log('');
      log('— 备份线上版本 —');
      await run('git', ['fetch', 'origin', 'main', '--tags'], { cwd: DEPLOY_DIR, log, optional: true });
      const tag = 'backup-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const t = await run('git', ['tag', '-f', tag, 'origin/main'], { cwd: DEPLOY_DIR, log, optional: true });
      if (t.ok) {
        await run('git', ['push', 'origin', tag, '--force'], { cwd: DEPLOY_DIR, log, optional: true });
        log('✓ 线上当前版本已存为标签 ' + tag);
      } else {
        log('· 远端还没有 main（首次部署），跳过备份');
      }

      /* 镜像 public → .deploy */
      log('');
      log('— 同步 public/ → .deploy/ —');
      await mirror(PUBLIC, DEPLOY_DIR);
      await fsp.writeFile(path.join(DEPLOY_DIR, '.nojekyll'), '');
      await run('git', ['add', '-A'], { cwd: DEPLOY_DIR, log });

      const staged = await new Promise((r) => {
        const p = spawn('git', ['diff', '--cached', '--name-only'], { cwd: DEPLOY_DIR, env: HOST_ENV() });
        let o = ''; p.stdout.on('data', (b) => o += b); p.on('close', () => r(o.trim()));
      });
      if (!staged) { log('· 内容没有变化，无需推送'); job.status = 'done'; log('✓ 完成（线上未改动）'); return; }

      await run('git', ['-c', 'user.name=singning901',
                        '-c', 'user.email=singning901@users.noreply.github.com',
                        'commit', '-q', '-m', 'deploy: ' + new Date().toISOString().slice(0, 16)],
                { cwd: DEPLOY_DIR, log });

      /* 普通 push —— 被拒绝就停手，绝不强推 */
      log('');
      log('— 推送到 GitHub（普通 push，不用 -f）—');
      const pushed = await run('git', ['push', 'origin', 'main'], { cwd: DEPLOY_DIR, log });
      if (!pushed.ok) {
        job.status = 'failed';
        log('');
        log('✗ 推送被拒绝（远端有新提交）。');
        log('  按保守策略这里停手，没有强推。线上仍是原来的版本。');
        log('  想覆盖远端的话，先跑一次「同步远端」再重试。');
        return;
      }

      /* 回读线上验证 */
      log('');
      log('— 回读线上验证（最多等 3 分钟）—');
      let ok = false;
      for (let i = 1; i <= 18; i++) {
        await new Promise((r) => setTimeout(r, 10000));
        try {
          const r = await fetch(LIVE + '?t=' + Date.now());
          const html = await r.text();
          const hit = html.includes('data-daypart') && html.includes('href="/legacy/"');
          log('  第 ' + i + ' 次：HTTP ' + r.status + (hit ? ' · 标记命中' : ' · 还没更新'));
          if (r.ok && hit) { ok = true; break; }
        } catch (e) { log('  第 ' + i + ' 次：' + e.message); }
      }
      if (ok) {
        job.status = 'done';
        log('');
        log('✓ 已发布并验证通过：' + LIVE);
      } else {
        job.status = 'failed';
        log('');
        log('✗ 推送成功但线上没验证到新内容（可能 Pages 还在构建）。');
        log('  请稍后手动刷新确认。');
      }
      return;
    }

    /* ── 只构建 ── */
    job.status = 'done';
    log('✓ 构建完成（public/），线上未改动');
  })().catch((e) => { job.status = 'failed'; log('ERR ' + e.message); });

  return { ok: true, id };
}

/* ── 回滚 ─────────────────────────────────────────────────────────────── */
function startRollback(tag) {
  if (currentJob && currentJob.status === 'running') return { ok: false, error: '已有任务在跑' };
  const id = 'job-' + Date.now();
  const job = { id, action: 'rollback → ' + tag, status: 'running', log: [] };
  jobs.set(id, job); currentJob = job;
  const log = (s) => job.log.push(s);
  (async () => {
    log('— 回滚到 ' + tag + ' —');
    if (!fs.existsSync(path.join(DEPLOY_DIR, '.git'))) {
      await run('git', ['clone', '--branch', 'main', '--single-branch', REPO, DEPLOY_DIR], { log });
    }
    await run('git', ['fetch', 'origin', '--tags', '--force'], { cwd: DEPLOY_DIR, log });
    const r = await run('git', ['checkout', '-q', '--force', tag], { cwd: DEPLOY_DIR, log });
    if (!r.ok) { job.status = 'failed'; log('✗ 找不到标签 ' + tag); return; }
    await run('git', ['checkout', '-q', '-B', 'main'], { cwd: DEPLOY_DIR, log });
    const p = await run('git', ['push', 'origin', 'main'], { cwd: DEPLOY_DIR, log });
    if (!p.ok) { job.status = 'failed'; log('✗ 推送失败'); return; }
    job.status = 'done';
    log('✓ 已回滚到 ' + tag + '，约 1–2 分钟生效');
  })().catch((e) => { job.status = 'failed'; log('ERR ' + e.message); });
  return { ok: true, id };
}

/* ── 工具 ─────────────────────────────────────────────────────────────── */
const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();

async function listPosts() {
  const out = [];
  if (!fs.existsSync(POSTS)) return out;
  for (const f of await fsp.readdir(POSTS)) {
    if (!f.endsWith('.md')) continue;
    const full = path.join(POSTS, f);
    const txt = await fsp.readFile(full, 'utf8');
    const title = (txt.match(/^title:\s*(.*)$/m) || [, f.replace(/\.md$/, '')])[1].trim().replace(/^["']|["']$/g, '');
    const date  = (txt.match(/^date:\s*(.*)$/m) || [, ''])[1].trim();
    const st    = await fsp.stat(full);
    out.push({ file: f, title, date, mtime: st.mtimeMs, size: st.size });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

async function listImages() {
  if (!fs.existsSync(IMG)) return [];
  const out = [];
  for (const f of await fsp.readdir(IMG)) {
    const st = await fsp.stat(path.join(IMG, f));
    if (st.isFile()) out.push({ name: f, size: st.size, mtime: st.mtimeMs });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

async function listBackups() {
  const out = [];
  if (fs.existsSync(DEPLOY_DIR + '\\.git')) {
    const r = await new Promise((res) => {
      const p = spawn('git', ['tag', '-l', 'backup-*', '--sort=-creatordate'], { cwd: DEPLOY_DIR, env: HOST_ENV() });
      let o = ''; p.stdout.on('data', (b) => o += b); p.on('close', () => res(o));
    });
    r.split('\n').map((s) => s.trim()).filter(Boolean).forEach((t) => out.push({ type: 'tag', name: t }));
  }
  if (fs.existsSync(BACKUPS)) {
    for (const d of (await fsp.readdir(BACKUPS)).filter((f) => f.startsWith('public-')).sort().reverse()) {
      out.push({ type: 'snapshot', name: d });
    }
  }
  return out;
}

/** 只在 hero: 段内替换某个键 */
async function patchTheme(key, value) {
  const lines = (await fsp.readFile(THEME_CFG, 'utf8')).split('\n');
  let inHero = false, done = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^hero:\s*$/.test(lines[i])) { inHero = true; continue; }
    if (inHero && /^\S/.test(lines[i])) break;
    if (inHero && new RegExp('^\\s+' + key + ':').test(lines[i])) {
      const indent = lines[i].match(/^\s*/)[0];
      const needQuote = /[:#]/.test(value) || value === '';
      lines[i] = indent + key + ': ' + (needQuote ? JSON.stringify(value) : value);
      done = true; break;
    }
  }
  if (!done) return { ok: false, error: '在 hero: 段里没找到 ' + key };
  await fsp.writeFile(THEME_CFG, lines.join('\n'), 'utf8');
  return { ok: true };
}

/* ── 首页卡片的读写 ───────────────────────────────────────────────────────
   不引 YAML 库：这个段的结构是我们自己定的（固定五个字段、固定缩进），
   定向处理比通用解析更可控，也不会把注释和格式搅乱。 */
function parseCards(yml) {
  const m = yml.match(/^cards:[\s\S]*?(?=^\S)/m);
  if (!m) return null;
  const block = m[0];
  const g = (k) => {
    const r = block.match(new RegExp('^  ' + k + ':\\s*(.*)$', 'm'));
    return r ? r[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  const items = [];
  let cur = null;
  for (const line of block.split('\n')) {
    const mi = line.match(/^    - (\w+):\s*(.*)$/);
    if (mi) { cur = {}; cur[mi[1]] = mi[2].trim(); items.push(cur); continue; }
    const mf = line.match(/^      (\w+):\s*(.*)$/);
    if (mf && cur) cur[mf[1]] = mf[2].trim();
  }
  return { enable: g('enable') !== 'false', title: g('title'), subtitle: g('subtitle'), items };
}

const yamlVal = (s) => {
  s = String(s == null ? '' : s);
  const needQuote = s === '' || /:\s/.test(s) || /\s#/.test(s) ||
                    /^[-?*&!|>%@`"'\[\]{},\s]/.test(s);
  return needQuote ? JSON.stringify(s) : s;
};

function genCards(c) {
  const L = ['cards:',
    '  enable: ' + (c.enable === false ? 'false' : 'true'),
    '  title: ' + yamlVal(c.title),
    '  subtitle: ' + yamlVal(c.subtitle),
    '  items:'];
  for (const it of (c.items || [])) {
    L.push('    - name: ' + yamlVal(it.name));
    L.push('      desc: ' + yamlVal(it.desc));
    L.push('      url: ' + yamlVal(it.url));
    L.push('      img: ' + yamlVal(it.img));
    L.push('      tag: ' + yamlVal(it.tag));
  }
  return L.join('\n');
}

async function writeCards(c) {
  const yml = await fsp.readFile(THEME_CFG, 'utf8');
  const m = yml.match(/^cards:[\s\S]*?(?=^\S)/m);
  if (!m) return { ok: false, error: '没找到 cards: 段' };
  if (!Array.isArray(c.items) || !c.items.length) return { ok: false, error: '至少保留一张卡片' };
  for (const it of c.items) {
    if (!String(it.name || '').trim()) return { ok: false, error: '每张卡片都要有标题' };
  }
  await fsp.writeFile(THEME_CFG, yml.replace(m[0], genCards(c) + '\n\n'), 'utf8');
  return { ok: true };
}

/* ── 路由 ─────────────────────────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = decodeURIComponent(u.pathname);
  try {
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      return send(res, 200, await fsp.readFile(path.join(__dirname, 'ui.html')), MIME['.html']);
    }
    if (req.method === 'GET' && p.startsWith('/img/')) {
      const f = path.join(IMG, path.basename(p.slice(5)));
      if (!fs.existsSync(f)) return send(res, 404, 'not found', 'text/plain');
      return send(res, 200, await fsp.readFile(f), MIME[path.extname(f).toLowerCase()] || 'application/octet-stream');
    }

    if (req.method === 'GET' && p === '/api/state') {
      const yml = await fsp.readFile(THEME_CFG, 'utf8');
      const heroBlock = (yml.match(/^hero:[\s\S]*?(?=^\S)/m) || [''])[0];
      const g = (k) => ((heroBlock.match(new RegExp('^\\s+' + k + ':\\s*(.*)$', 'm')) || [, ''])[1] || '').trim().replace(/^["']|["']$/g, '');
      return json(res, 200, {
        root: ROOT,
        posts: await listPosts(),
        images: await listImages(),
        backups: await listBackups(),
        hero: { image: g('image'), tagline: g('tagline'), vertical: g('vertical') },
        preview: { running: !!previewProc, port: PREVIEW_PORT },
        deploy: { gitReady: fs.existsSync(path.join(DEPLOY_DIR, '.git')), live: LIVE },
        job: currentJob ? { id: currentJob.id, action: currentJob.action, status: currentJob.status } : null,
      });
    }

    if (req.method === 'GET' && p === '/api/job') {
      const id = u.searchParams.get('id');
      const job = id ? jobs.get(id) : currentJob;
      if (!job) return json(res, 200, { status: 'idle', log: [] });
      return json(res, 200, { id: job.id, action: job.action, status: job.status, log: job.log });
    }

    /* 本地预览：启停 hexo server */
    if (req.method === 'POST' && p === '/api/preview') {
      const b = JSON.parse((await readBody(req)).toString('utf8'));
      if (b.action === 'stop') {
        if (previewProc) { previewProc.kill(); previewProc = null; }
        return json(res, 200, { ok: true, running: false });
      }
      if (previewProc) return json(res, 200, { ok: true, running: true, note: '已在运行' });
      const hexo = path.join(ROOT, 'node_modules', 'hexo', 'bin', 'hexo');
      previewProc = spawn(process.execPath, [hexo, 'server', '--port', String(PREVIEW_PORT)],
                          { cwd: ROOT, env: HOST_ENV(), stdio: 'ignore' });
      previewProc.on('exit', () => { previewProc = null; });
      return json(res, 200, { ok: true, running: true });
    }

    if (req.method === 'POST' && p === '/api/job') {
      const b = JSON.parse((await readBody(req)).toString('utf8'));
      if (b.action !== 'build' && b.action !== 'publish') return json(res, 400, { ok: false, error: '未知动作' });
      return json(res, 200, startJob(b.action));
    }
    if (req.method === 'POST' && p === '/api/rollback') {
      const b = JSON.parse((await readBody(req)).toString('utf8'));
      if (!/^backup-/.test(b.tag || '')) return json(res, 400, { ok: false, error: '标签名不合法' });
      return json(res, 200, startRollback(b.tag));
    }

    if (req.method === 'POST' && p === '/api/post') {
      const b = JSON.parse((await readBody(req)).toString('utf8'));
      const title = safeName(b.title);
      if (!title) return json(res, 400, { ok: false, error: '标题不能为空' });
      const file = title + '.md';
      const d = b.date ? new Date(b.date) : new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      const tags = (b.tags || '').split(/[,，\s]+/).filter(Boolean);
      const cats = (b.categories || '').split(/[,，\s]+/).filter(Boolean);
      const fm = [
        '---', 'title: ' + JSON.stringify(title), 'date: ' + stamp,
        tags.length ? 'tags:\n' + tags.map((t) => '  - ' + t).join('\n') : 'tags:',
        cats.length ? 'categories:\n' + cats.map((t) => '  - ' + t).join('\n') : 'categories:',
        '---', '',
      ].join('\n');
      await fsp.mkdir(POSTS, { recursive: true });
      await fsp.writeFile(path.join(POSTS, file), fm + (b.body || ''), 'utf8');
      return json(res, 200, { ok: true, file });
    }

    if (req.method === 'POST' && p === '/api/delete-post') {
      const b = JSON.parse((await readBody(req)).toString('utf8'));
      const src = path.join(POSTS, path.basename(b.file));
      if (!fs.existsSync(src)) return json(res, 404, { ok: false, error: '文件不存在' });
      await fsp.mkdir(TRASH, { recursive: true });
      await fsp.rename(src, path.join(TRASH, Date.now() + '-' + path.basename(b.file)));
      return json(res, 200, { ok: true, note: '已移到 .trash/，没有真删' });
    }

    if (req.method === 'POST' && p === '/api/upload') {
      const name = safeName(u.searchParams.get('name') || '');
      if (!name) return json(res, 400, { ok: false, error: '缺少文件名' });
      const buf = await readBody(req);
      if (!buf.length) return json(res, 400, { ok: false, error: '文件是空的' });
      await fsp.mkdir(IMG, { recursive: true });
      await fsp.writeFile(path.join(IMG, name), buf);
      return json(res, 200, { ok: true, name, size: buf.length });
    }

    if (req.method === 'POST' && p === '/api/delete-image') {
      const b = JSON.parse((await readBody(req)).toString('utf8'));
      const src = path.join(IMG, path.basename(b.name));
      if (!fs.existsSync(src)) return json(res, 404, { ok: false, error: '图片不存在' });
      await fsp.mkdir(TRASH, { recursive: true });
      await fsp.rename(src, path.join(TRASH, Date.now() + '-' + path.basename(b.name)));
      return json(res, 200, { ok: true, note: '已移到 .trash/' });
    }

    /* 首页卡片 */
    if (req.method === 'GET' && p === '/api/cards') {
      const c = parseCards(await fsp.readFile(THEME_CFG, 'utf8'));
      if (!c) return json(res, 500, { ok: false, error: '主题配置里没有 cards: 段' });
      return json(res, 200, { ok: true, cards: c, images: (await listImages()).map((i) => '/img/' + i.name) });
    }
    if (req.method === 'POST' && p === '/api/cards') {
      const b = JSON.parse((await readBody(req)).toString('utf8'));
      const r = await writeCards({
        enable: b.enable !== false,
        title: b.title || '',
        subtitle: b.subtitle || '',
        items: (b.items || []).map((it) => ({
          name: it.name || '', desc: it.desc || '', url: it.url || '',
          img: it.img || '', tag: it.tag || '',
        })),
      });
      return json(res, r.ok ? 200 : 400, r);
    }

    if (req.method === 'POST' && p === '/api/settings') {
      const b = JSON.parse((await readBody(req)).toString('utf8'));
      const results = [];
      if (b.image !== undefined)    results.push(['image',    await patchTheme('image', String(b.image))]);
      if (b.tagline !== undefined)  results.push(['tagline',  await patchTheme('tagline', String(b.tagline))]);
      if (b.vertical !== undefined) results.push(['vertical', await patchTheme('vertical', String(b.vertical))]);
      const bad = results.filter(([, r]) => !r.ok);
      if (bad.length) return json(res, 400, { ok: false, error: bad.map(([k, r]) => k + ': ' + r.error).join('; ') });
      return json(res, 200, { ok: true, changed: results.map(([k]) => k) });
    }

    return json(res, 404, { ok: false, error: 'no route ' + p });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  留白 · 网站管理程序');
  console.log('  ────────────────────────────────────────────');
  console.log('  面板：  http://127.0.0.1:' + PORT + '/');
  console.log('  项目：  ' + ROOT);
  console.log('');
  console.log('  部署策略：普通 push（不强推）、推前自动备份、');
  console.log('            推后回读验证、随时可一键回滚。');
  console.log('');
  console.log('  只监听本机。关掉这个窗口就停止。');
  console.log('');
  spawn('cmd', ['/c', 'start', '', 'http://127.0.0.1:' + PORT + '/'], { detached: true, stdio: 'ignore' }).unref();
});
