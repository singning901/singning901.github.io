/**
 * 留白 · 本地管理面板后端
 *
 * 只在 127.0.0.1 上监听，不对外暴露。零依赖，只用 Node 内置模块。
 * 启动： admin.cmd   或   node admin/server.mjs
 *
 * 能力：
 *   POST /api/post          新建 / 覆盖文章（写 source/_posts/*.md）
 *   POST /api/upload        上传图片（写 source/img/）
 *   POST /api/delete-image  删除图片
 *   POST /api/delete-post   删除文章（移到 .trash/，不真删）
 *   POST /api/settings      改主题配置（首页大图、副标题、竖排字）
 *   POST /api/job           跑构建 / 发布（后台任务，前端轮询日志）
 *   GET  /api/state         读取站点现状
 *   GET  /api/job           读取任务日志
 *   GET  /img/<name>        预览图片
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const POSTS     = path.join(ROOT, 'source', '_posts');
const IMG       = path.join(ROOT, 'source', 'img');
const THEME_CFG = path.join(ROOT, 'themes', 'liubai', '_config.yml');
const PUBLIC    = path.join(ROOT, 'public');
const TRASH     = path.join(ROOT, '.trash');
const PORT      = Number(process.env.ADMIN_PORT || 4200);

/* Git 不在 PATH 上时，用随项目记录的 PortableGit */
const GIT_DIR = 'C:\\Users\\singning\\tools\\PortableGit\\cmd';
const REPO    = 'https://github.com/singning901/singning901.github.io.git';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};
const json = (res, code, obj) => send(res, code, JSON.stringify(obj));

const readBody = (req, limit = 40 * 1024 * 1024) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

/* ── 任务队列：构建 / 发布 ─────────────────────────────────────────────── */
const jobs = new Map();
let currentJob = null;

function startJob(action) {
  if (currentJob && currentJob.status === 'running') {
    return { ok: false, error: '已有任务在跑：' + currentJob.action };
  }
  const id = 'job-' + Date.now();
  const job = { id, action, status: 'running', log: [], startedAt: new Date().toISOString() };
  jobs.set(id, job);
  currentJob = job;

  const hexo = path.join(ROOT, 'node_modules', 'hexo', 'bin', 'hexo');
  const steps = [];
  if (action === 'build') {
    steps.push({ cmd: process.execPath, args: [hexo, 'clean'] });
    steps.push({ cmd: process.execPath, args: [hexo, 'generate'] });
  } else if (action === 'publish') {
    steps.push({ cmd: process.execPath, args: [hexo, 'clean'] });
    steps.push({ cmd: process.execPath, args: [hexo, 'generate'] });
    // 手工从 public 推 —— hexo deploy 会错推源码分支，不要用
    steps.push({ cmd: 'git', args: ['init', '-q'], cwd: PUBLIC });
    steps.push({ cmd: 'git', args: ['checkout', '-q', '-B', 'main'], cwd: PUBLIC });
    steps.push({ cmd: 'git', args: ['remote', 'remove', 'origin'], cwd: PUBLIC, optional: true });
    steps.push({ cmd: 'git', args: ['remote', 'add', 'origin', REPO], cwd: PUBLIC });
    steps.push({ cmd: 'git', args: ['add', '-A'], cwd: PUBLIC });
    steps.push({
      cmd: 'git',
      args: ['-c', 'user.name=singning901',
             '-c', 'user.email=singning901@users.noreply.github.com',
             'commit', '-q', '-m', 'deploy: ' + new Date().toISOString().slice(0, 16)],
      cwd: PUBLIC, optional: true,
    });
    steps.push({ cmd: 'git', args: ['push', '-f', 'origin', 'main'], cwd: PUBLIC });
  }

  (async () => {
    const env = { ...process.env, PATH: GIT_DIR + ';' + (process.env.PATH || '') };
    if (!fs.existsSync(path.join(PUBLIC, '.nojekyll'))) {
      await fsp.writeFile(path.join(PUBLIC, '.nojekyll'), '');
    }
    for (const step of steps) {
      job.log.push('$ ' + step.cmd.split('\\').pop() + ' ' + step.args.join(' '));
      const code = await new Promise((resolve) => {
        const p = spawn(step.cmd, step.args, { cwd: step.cwd || ROOT, env, shell: false });
        const pipe = (buf) => {
          const s = buf.toString('utf8').replace(/\r/g, '');
          if (s.trim()) job.log.push(s.trimEnd());
        };
        p.stdout.on('data', pipe);
        p.stderr.on('data', pipe);
        p.on('error', (e) => { job.log.push('ERR ' + e.message); resolve(-1); });
        p.on('close', resolve);
      });
      if (code !== 0 && !step.optional) {
        job.status = 'failed';
        job.log.push('✗ 退出码 ' + code + '，已中止');
        return;
      }
    }
    job.status = 'done';
    if (action === 'publish') {
      job.log.push('');
      job.log.push('✓ 已发布到 https://singning901.github.io/');
      job.log.push('  GitHub Pages 通常需要 1–2 分钟生效。');
    } else {
      job.log.push('✓ 构建完成（public/）');
    }
  })().catch((e) => { job.status = 'failed'; job.log.push('ERR ' + e.message); });

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
    const tags  = (txt.match(/^tags:\s*\[(.*)\]$/m) || [, ''])[1].trim();
    const st    = await fsp.stat(full);
    out.push({ file: f, title, date, tags, mtime: st.mtimeMs, size: st.size });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

async function listImages() {
  if (!fs.existsSync(IMG)) return [];
  const out = [];
  for (const f of await fsp.readdir(IMG)) {
    const full = path.join(IMG, f);
    const st = await fsp.stat(full);
    if (!st.isFile()) continue;
    out.push({ name: f, size: st.size, mtime: st.mtimeMs });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

/** 只在 hero: 段内替换某个键，避免误伤同名的其他段 */
async function patchTheme(key, value) {
  const yml = await fsp.readFile(THEME_CFG, 'utf8');
  const lines = yml.split('\n');
  let inHero = false, done = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^hero:\s*$/.test(lines[i])) { inHero = true; continue; }
    if (inHero && /^\S/.test(lines[i])) break;
    if (inHero && new RegExp('^\\s+' + key + ':').test(lines[i])) {
      const indent = lines[i].match(/^\s*/)[0];
      const needQuote = /[:#]/.test(value) || value === '';
      lines[i] = indent + key + ': ' + (needQuote ? JSON.stringify(value) : value);
      done = true;
      break;
    }
  }
  if (!done) return { ok: false, error: '在 hero: 段里没找到 ' + key };
  await fsp.writeFile(THEME_CFG, lines.join('\n'), 'utf8');
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
        hero: { image: g('image'), tagline: g('tagline'), vertical: g('vertical') },
        job: currentJob ? { id: currentJob.id, action: currentJob.action, status: currentJob.status } : null,
      });
    }

    if (req.method === 'GET' && p === '/api/job') {
      const id = u.searchParams.get('id');
      const job = id ? jobs.get(id) : currentJob;
      if (!job) return json(res, 200, { status: 'idle', log: [] });
      return json(res, 200, { id: job.id, action: job.action, status: job.status, log: job.log });
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
      const fm = [
        '---',
        'title: ' + JSON.stringify(title),
        'date: ' + stamp,
        tags.length ? 'tags:\n' + tags.map((t) => '  - ' + t).join('\n') : 'tags:',
        b.categories ? 'categories:\n' + b.categories.split(/[,，\s]+/).filter(Boolean).map((t) => '  - ' + t).join('\n') : 'categories:',
        '---',
        '',
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

    if (req.method === 'POST' && p === '/api/settings') {
      const b = JSON.parse((await readBody(req)).toString('utf8'));
      const results = [];
      if (b.image !== undefined) results.push(['image', await patchTheme('image', String(b.image))]);
      if (b.tagline !== undefined) results.push(['tagline', await patchTheme('tagline', String(b.tagline))]);
      if (b.vertical !== undefined) results.push(['vertical', await patchTheme('vertical', String(b.vertical))]);
      const bad = results.filter(([, r]) => !r.ok);
      if (bad.length) return json(res, 400, { ok: false, error: bad.map(([k, r]) => k + ': ' + r.error).join('; ') });
      return json(res, 200, { ok: true, changed: results.map(([k]) => k) });
    }

    if (req.method === 'POST' && p === '/api/job') {
      const b = JSON.parse((await readBody(req)).toString('utf8'));
      if (b.action !== 'build' && b.action !== 'publish') return json(res, 400, { ok: false, error: '未知动作' });
      return json(res, 200, startJob(b.action));
    }

    return json(res, 404, { ok: false, error: 'no route ' + p });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  留白 · 管理面板已启动');
  console.log('  ────────────────────────────────────────');
  console.log('  打开：  http://127.0.0.1:' + PORT + '/');
  console.log('  项目：  ' + ROOT);
  console.log('');
  console.log('  只监听本机，关掉这个窗口就停止。');
  console.log('');
  const url = 'http://127.0.0.1:' + PORT + '/';
  const open = spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
  open.unref();
});
