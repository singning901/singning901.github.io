# singning901 博客（重建版）

原来 `singning901.github.io` 仓库里**只有生成后的静态页**，Hexo 源码已经丢失。
这个目录是根据线上成品**重建**出来的 Hexo 工程，用来继续写博客。

- 原站技术栈：Hexo 5.3.0 + Sakura 主题（主题仓库已归档）
- 现用技术栈：**Hexo 8.1.2 + Butterfly 5.7.0**（维护中，外观与旧站不同）
- 站点地址：<https://singning901.github.io>

## 常用操作

| 想做什么 | 怎么做 |
| --- | --- |
| 本地预览 | 双击 `dev.cmd`，然后浏览器打开 <http://localhost:4000/> |
| 只生成静态页 | 双击 `build.cmd`，产物在 `public\` |
| 写新文章 | 在 `source\_posts\` 里新建 `.md` 文件（见下方模板） |
| 改站点名/副标题/作者 | `_config.yml` |
| 改导航菜单、头像、社交链接、评论 | `_config.butterfly.yml` |
| 改关于 / 友人帐 / 留言板页 | `source\about\` `source\links\` `source\comment\` |

## 写一篇新文章

在 `source\_posts\` 下新建 `随便什么名字.md`：

```markdown
---
title: 文章标题
date: 2026-01-01 12:00:00
tags:
  - 标签A
categories:
  - 分类A
---

正文写在这里，支持 Markdown。
```

文件名决定网址。文章网址格式是 `年月日/标题/`
（由 `_config.yml` 的 `permalink: :year/:month/:day/:title/` 决定，和旧站一致）。

文章写完后，在 `dev.cmd` 开着的窗口里按 `Ctrl+C` 停掉再重新运行，
或者刷新页面——Hexo 通常会自动重新生成。

## 目录结构

```
singning901-blog/
├── _config.yml              # 站点配置（标题、网址、永久链接…）
├── dev.cmd / build.cmd      # 预览 / 构建 快捷脚本
├── publish.cmd              # 一键发布（提交源码 → 构建 → 推 main）
├── package.json
├── scaffolds/               # 新文章的模板
├── source/
│   ├── _posts/myfirstpost.md    # 原有的那篇日志
│   ├── about/  links/  comment/  music/
│   └── img/                     # 头像、头图、卡片配图等素材
├── themes/
│   ├── liubai/              # ★ 当前使用的自定义主题
│   └── butterfly/           # 已弃用，留作备查，可整个删掉
├── preview/                 # 截图（已 gitignore）
└── public/                  # 构建产物（不要手工编辑）
```

## 环境说明

本机**没有装 Node.js 和 npm**，脚本会自动回退到 DSH 自带的 Node（v24）。
依赖用 **pnpm** 安装（不是 npm）。

几个踩过的坑，改环境时注意：

1. `package.json` 里必须有 `"hexo": { "version": ... }` 字段，
   否则 `hexo-cli` 找不到本地工程，只会打印 help。
2. 主题的脚本需要 `hexo-util` 和 `moment-timezone`，
   已按项目直接依赖装好；不要再依赖 pnpm 的隐式提升。
3. `themes/` 下是**真实目录**（不是联接），主题随仓库一起提交。
   `hexo-util` / `moment-timezone` 是 Butterfly 时期留下的依赖，
   现在的 `liubai` 主题用不到；留着无害，想干净可以 `pnpm remove` 掉。

## 主题：留白 (liubai)

从零手写的自定义主题，中式简约 + 前卫，不依赖任何第三方主题包。
配色取自你自己的素材（宣纸白 / 墨黑 / **朱砂红** / 靛青）。

```
themes/liubai/
├── _config.yml              # ★ 主题的所有可调项都在这里
├── layout/
│   ├── layout.ejs           # 外壳
│   ├── index.ejs            # 首页（首屏 + 链接卡片 + 文章列表）
│   ├── post.ejs  page.ejs  archive.ejs
│   └── _partial/            # head / nav / footer / aside / paginator
└── source/
    ├── css/liubai.css       # 全部样式与设计令牌
    └── js/liubai.js         # 导航展开、渐显、目录、视差
```

### 常用改动位置

| 想改什么 | 改哪里 |
| --- | --- |
| **入场动画**（大字、提示语、是否只播一次） | `themes/liubai/_config.yml` 的 `intro` |
| **首页那三张链接卡片** | 同文件的 `cards.items` |
| 导航菜单 | 同文件的 `nav.menu` |
| 首屏高度 / 头图 / 竖排字 | 同文件的 `hero` |
| 页脚链接、起始年份 | 同文件的 `footer` |
| 颜色、圆角、字号 | `source/css/liubai.css` 顶部的 `:root` 令牌 |
| 动效开关 | 同文件 `motion`，或用系统的「减弱动态效果」自动关 |

### 词标（不是字体文件，是手绘 SVG）

「Singning901」在导航、首屏、入场层、页脚四处出现，用的是**手绘矢量词标**：
`themes/liubai/layout/_partial/wordmark.ejs`

- 9 个字形（s i n g 9 0 1）全部是等宽单线几何路径，round 端点
- 两个 `i` 的点是**朱砂方点**，`901` 整组用**朱砂描边**，与字母形成层级
- 不加载任何网络字体（国内访问 Google Fonts 会失败），矢量缩放不糊
- 首屏那版是**纯白**的 —— 底图红灯笼会把朱砂数字吃掉，白线反而更利落

要调字形就改这个文件里的 `<path d="...">`；
坐标系：基线 `y=72`，x-height 顶 `y=22`，数字顶 `y=4`，降部到 `y≈98`。

### 入场动画

打开首页会先出现一层入场画面，**点击后才进入主页**。

**昼夜更替**（按访客本地时间自动切换，颜色带 transition 渐变，不跳变）：

| 时段 | 小时 | 天体 | 天空 | 问候 |
| --- | --- | --- | --- | --- |
| 清晨 `dawn` | 05–08 | 柔和橙日 | 暖白 | GOOD MORNING · 晨 |
| 白天 `day` | 08–17 | 琥珀日 | 宣纸白 | GOOD DAY · 昼 |
| 傍晚 `dusk` | 17–20 | 深橙落日 | 暖橘 | GOOD EVENING · 暮 |
| 夜晚 `night` | 20–05 | **月牙**（天空色圆遮挡而成） | 深墨 | GOOD NIGHT · 夜 |

- 想固定某个时段：`_config.yml` 里 `intro.force_daypart: night`
- 想临时预览：网址后加 `?daypart=night`（不需要改配置、不需要重建）

**背景是手绘的抽象技术图形**（不是风景画）——照鹰角网络的平面语言做的：

- **切角面板**（45° 切边的矩形）从画面右侧与左下出血
- **同心断弧**（半径 520/700/880/1060），圆心在画外，120 秒转一圈
- **斜向虚线带**、**底部刻度尺**、**左侧竖向刻度**、**十字定位标记**
- 天体缓慢上下浮动；日/月、天空、线条颜色全部由 CSS 变量驱动

底层实现：`layout/_partial/intro.ejs` 里的内联 SVG（所以 CSS 才能改它的颜色），
配色在 `source/css/liubai.css` 的 `[data-daypart="..."]` 段。
时段判定在 `_partial/head.ejs` 的内联脚本里，**在 CSS 生效前就写好**，避免闪一下。

其他：

- 出现顺序：问候 → 印章 → 大字逐字上浮 → 词标 → 中线展开 → 按钮 → 状态行
- 点击后：上下两片幕布向两侧拉开，**首页的首屏动画这时才开始播**
- 任意键（Enter / 空格 / Esc）或点遮罩任意处都能进入

配置项（`themes/liubai/_config.yml` 的 `intro`）：

```yaml
intro:
  enable: true
  once_per_session: true   # 同一会话只播一次；false = 每次打开首页都播
  display: 武陵            # 中间的大字，逐字入场；留空不显示
  latin: SINGNING901 / TALOS-II
  prompt: 点击进入
  enter_label: ENTER
  status_left: 九〇一 · 小世界
  status_right: SYSTEM READY
```

> 跳过一次之后想再看：开发者工具里执行
> `sessionStorage.removeItem('liubai-intro-seen')` 再刷新。

`cards.items` 里每一项支持 `name` / `desc` / `url` / `img` / `tag`，
`img` 留空会退化成纯色块 + 首字，所以**加卡片不用动模板**。

### 已实现的动效

- 顶部导航**默认收起**，鼠标移进屏幕顶部才滑出；滚动一段后自动常驻
- 首屏底图缓慢推近 + 文字错峰上浮 + 滚动视差
- 卡片悬停：整卡上浮、配图放大、左侧朱砂竖线展开、箭头右移
- 文章行悬停：整行右移并浮出朱砂竖线
- 正文标题左侧朱砂竖线；目录（TOC）随滚动高亮
- 头像**不做任何旋转**（旧主题那种一直转的效果已去掉）

### 无障碍

- 渐显动画的初始隐藏态只在有 JS 时生效，JS 失败内容也照常显示；另有 3 秒兜底
- 完整支持 `prefers-reduced-motion`
- 导航可见性同时响应键盘 Tab（`:focus-within`）
- 页面顶部有「跳到正文」跳转链接

## 改外观（旧主题 Butterfly，已弃用）

- ❌ 已不再使用。`themes/butterfly/` 和 `_config.butterfly.yml` 只是留档，
  改它们不会影响站点。确认不需要后可以整个删掉。

> ⚠️ **重要**：`hexo server` 不会热重载 `_config*.yml`（站点配置和**主题配置**都算）。
> 改完配置必须**重启**服务器。`dev.cmd` 每次都是新启动的，正常用没问题；
> 但如果服务器一直开着再改配置，页面上不会生效 —— 这个坑我踩过。
>
> 另外：**主题目录会被 `hexo server` 监视并占用文件**，
> 服务器开着时改 `themes/liubai/` 下的文件可能报 `EIO`，先停掉服务器再改。

## 已知问题 / 待办
- ✅ **发布流程已接好**：`publish.cmd`（提交源码 → 构建 → 推 `main`）。
  Git 用的是便携版，装在 `%USERPROFILE%\tools\PortableGit`；
  GitHub 凭据已存进 Windows 凭据管理器，推送走本地代理 `127.0.0.1:7897`。
  源码在 `src` 分支，成品在 `main` 分支。
- **评论**：沿用了旧站的 Valine（LeanCloud）appId/appKey。
  那是 2021 年的应用，可能已经失效或被停用；留言板打不开属正常，
  建议换成 Waline / Twikoo / Giscus。
- **音乐页**只留了占位，旧站的 APlayer + MetingJS 播放器没迁移。
- ✅ **首页三张链接卡片已恢复**，并且做成了可配置接口：
  改 `themes/liubai/_config.yml` 的 `cards.items` 即可增删改，不用动模板。
- 旧站的打赏二维码路径 `/img/custom/donate/*.jpg` 在旧仓库里就不存在（一直是坏图），
  所以没有迁移。
