# Work Tracker — GitHub 源码说明

这是当前 Work Tracker 已发布版本的完整源码快照。

- 网站：https://work-tracker-team.flowmddata.chatgpt.site
- 导出日期：2026-10-08（America/Los_Angeles）
- 对应源码 commit：13174d91cdf22115bf0f4479a4532546287a3af0
- 对应 Sites 版本：9
- 验证：15 项自动测试通过；浏览器视觉效果尚未验证。

## 上传到 GitHub

1. 解压 ZIP，打开 `Work-Tracker` 目录。
2. 在 GitHub 创建仓库，然后把此目录的内容上传到仓库根目录。
3. 不要把 ZIP 本身作为唯一文件上传；应该能直接看到 `package.json`、`server.mjs`、`public/` 等源码。
4. 如果使用 Git 客户端，也可以在解压目录初始化新的 Git 仓库后提交和推送。此包不包含原仓库的 `.git` 历史或 Git 凭据。

包内 `.openai/hosting.json` 是当前 Sites 的配置，包括原项目 ID；它不是密码。保留它可对应原 Sites 项目。在其他环境或创建新的 Sites 项目时，需要按目标环境重新配置，避免误部署到原项目。

## 本地查看与测试

需要 Node.js 22 或更高版本，包含内置 `node:sqlite`；建议使用支持该模块的 Node.js 24。

本项目没有第三方 npm 依赖。在项目目录执行：

```bash
npm test
npm run dev
```

本地地址：`http://127.0.0.1:4173`。

本地模式使用测试账号，可通过页面右上角选择 Admin、Engineer、Manager 预览不同权限。生成的本地 SQLite 数据库和本地附件目录已被 `.gitignore` 排除。本地预览的身份模拟只用于本地测试，不能用于生产登录。

## 主要文件

| 文件 / 目录 | 用途 |
| --- | --- |
| `public/index.html` | 页面框架、导航 |
| `public/app.js` | 页面交互、任务、私人工作、版本管理 |
| `public/styles.css` | UI 样式 |
| `server.mjs` | 后端 API、认证、权限和数据访问 |
| `schema.sql` | 初始数据库结构 |
| `migrations/` | 按顺序执行的数据库升级 |
| `node-server.mjs` | 本地 SQLite 测试服务器 |
| `scripts/build.mjs` | 当前 Sites Worker 构建和迁移打包 |
| `tests/workflow.test.mjs` | API、权限、密码、项目、版本流程测试 |
| `.openai/hosting.json` | 原 Sites 项目及 DB、BUCKET 绑定配置 |

## 当前功能与业务规则

- Role：Admin / Member；Engineering、QA、Management 工作分组独立。
- Management 显示 Manager，只读，可查看所有员工的私人工作。
- 员工的私人 Daily Work、Project、Task 仅本人和 Manager 可见。Admin 不因管理权限获得其他员工的私人记录。
- Engineering Board 是共享任务；每日 Engineering Activity 显示在 Board 下方。
- Activity History 聚合页面和 API 仅 Admin 可查看。共享任务自己的活动时间线仍对团队可见。
- Daily Work 合并原 My Work，支持持续多天的私人 Project / Task、子任务和关联的日期记录。
- 本人的私人日期记录可编辑和删除；删除从正常页面隐藏，保留变更记录。
- 新任务 Type 简化为 New Feature / Bug Fix / Improvement，Category 为业务模块，Parent task 为可选目标关联。
- Version Control 自动维持待发布计划。未发布则保留；工程师或 Admin 确认实际发布后，自动生成下一周三的计划。
- 自动归集依据进入 On Production 的日期；已发布任务不重复加入，发布内容保存历史快照。
- “确认实际发布”是记录外部系统已经上线的版本，不会自行部署 CRM 代码。

## 部署边界

GitHub 仓库用于保存和协作源码。GitHub Pages 仅提供静态页面，不能单独运行本项目的账号密码认证、权限、数据库和附件 API。

当前生产部署是 Worker 后端，使用 `DB` 数据库绑定、`BUCKET` 附件绑定和服务端运行配置。`node scripts/build.mjs` 会生成现有 Sites 的部署产物；这不是通用 GitHub Pages 部署包。

如果工程师要迁移到其他平台，需要接入相应数据库和附件存储，配置环境变量，并替换首次管理员初始化中依赖 Sites 的可信拥有者验证。不能把来自普通请求的身份头当成可信身份，也不能在生产环境启用 `DEV_AUTH`。

本 ZIP 不包括真实账号密码、会话、生产数据库记录、用户附件、环境变量值或访问令牌。原网站的数据保留在原部署中，不会因导出源码被转移到 GitHub。

## 后续维护

- 已执行的数据库迁移不要修改，应新增后续迁移并加入构建脚本。
- 更改权限后运行 `npm test`。
- 修改 UI 后补做实际浏览器验证。
