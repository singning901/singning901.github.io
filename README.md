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
├── _config.butterfly.yml    # 主题配置（菜单、头像、社交、评论…）
├── dev.cmd / build.cmd      # 预览 / 构建 快捷脚本
├── package.json
├── scaffolds/               # 新文章的模板
├── source/
│   ├── _posts/myfirstpost.md    # 原有的那篇日志
│   ├── about/  links/  comment/  music/
│   └── img/                     # 头像、favicon 等图片素材
├── themes/butterfly → node_modules/hexo-theme-butterfly   # 目录联接
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
3. `themes/butterfly` 是指向 `node_modules/hexo-theme-butterfly` 的**目录联接**。
   如果哪天删了 `node_modules` 重装，这个联接需要重建。

## 已知问题 / 待办

- **还没接发布流程**。改动目前只在本地，没有推到 GitHub。
  要发布需要在 `_config.yml` 里配好 `deploy:`，并装 Git。
- **评论**：沿用了旧站的 Valine（LeanCloud）appId/appKey。
  那是 2021 年的应用，可能已经失效或被停用；留言板打不开属正常，
  建议换成 Waline / Twikoo / Giscus。
- **音乐页**只留了占位，旧站的 APlayer + MetingJS 播放器没迁移。
- 首页原来那几张卡片（Bilibili 拜年纪 / Bilibili / 高考加油）是 Sakura 主题特有能力，
  Butterfly 没有对应功能，目前没有迁移。图片素材还在 `source\img\` 里
  （`chun5.jpg`、`bilibili.jpg`、`gaokao.jpg` 等）。
- 旧站的打赏二维码路径 `/img/custom/donate/*.jpg` 在旧仓库里就不存在（一直是坏图），
  所以没有迁移。
