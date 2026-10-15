/* 资源版本戳（cache busting）
   ---------------------------------------------------------------------------
   问题：GitHub Pages 给 css/js 发的是长缓存（约 10 分钟）。每次发布后文件名
   不变，浏览器就继续吃旧文件 —— 表现为「线上明明更新了，刷新还是老样子」，
   必须 Ctrl+Shift+R 才看得到。

   做法：把文件内容的 md5 前 8 位拼成 ?v=xxxx，挂到 css/js 的 URL 后面。
     · 内容没变 → 戳不变 → 继续走缓存（不打搅访问者）
     · 内容变了 → 戳变了 → URL 变了 → 浏览器必然重新拉取（无需强刷）

   为什么不用时间戳：时间戳每次构建都变，等于每次都让所有人重新下载，
   白白浪费带宽。内容哈希只在真正改动时才换。

   用法：<%- vurl('/css/liubai.css') %>  →  /css/liubai.css?v=3f9a1c02
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const cache = {};

function stamp(rel) {
  if (cache[rel]) return cache[rel];
  // rel 形如 /css/liubai.css，在主题 source/ 下找实体文件
  const file = path.join(hexo.theme_dir, 'source', rel.replace(/^\//, ''));
  let v = '';
  try {
    v = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
  } catch (e) {
    // 找不到文件就退回构建时间，至少不会两个版本撞车
    v = Date.now().toString(36).slice(-8);
  }
  cache[rel] = v;
  return v;
}

hexo.extend.helper.register('vurl', function (rel) {
  // url_for 处理 root 前缀（部署在子路径时也对）
  const base = this.url_for(rel);
  const sep = base.indexOf('?') >= 0 ? '&' : '?';
  return base + sep + 'v=' + stamp(rel);
});
