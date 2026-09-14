# 开发指南

本文面向修改、测试和发布 mdsite 的开发者。安装、使用和业务项目集成见[QUICK START](QUICK_START.md)，项目介绍见 [README](../README.md)。

## 环境与本地开发

需要 Node.js 24+ 和 npm。在仓库根目录执行：

```sh
npm ci
npm run build
node dist/cli.js serve examples/content
```

访问 http://127.0.0.1:6060 预览示例文档。也可以用本地 CLI 生成静态页面：

```sh
node dist/cli.js build examples/content -o dist/example.html
```

`npm run build` 编译 TypeScript CLI，并打包 React 阅读器资源。修改源码后重新执行构建；修改 CLI 或服务代码后需要重启预览进程。仅修改 Markdown 或 `.mdignore` 时，刷新页面即可读取最新内容。

## 检查与测试

```sh
npm run check
npm test
```

`npm run check` 对 CLI、阅读器和构建脚本进行类型检查。`npm test` 会先构建 CLI 和阅读器，再验证文件扫描、Markdown 渲染、预览刷新、命令行、构建变更检测、链接、图片、忽略规则与搜索。Git 可用时，测试会以 Git 的实际结果核对忽略规则；运行 mdsite 本身不依赖 Git。

修改阅读器或生成页面时，应检查生成 HTML 的独立使用、桌面和移动端表现；涉及 Mermaid 时，同时检查包含和不包含图表的文档。

## 工程结构

```text
src/
├── cli.ts             # build / serve 命令入口
├── content/           # Markdown 扫描、忽略规则、渲染和文件解析
├── reader/            # React 阅读器、导航、搜索和主题
├── catalog.ts         # 生成器与阅读器共用的数据类型
├── site.ts            # 组合内容和阅读器，生成完整 HTML
└── preview.ts         # 本地预览 HTTP 服务
scripts/build.ts       # 构建浏览器资源
scripts/verify-package.ts # 在独立目录验证安装包
.github/workflows/release.yml # GitHub Release 自动发版
tests/                 # 功能回归测试
examples/content/      # Markdown 示例
examples/build-with-docs.sh # 使用方构建脚本：先更新 UI 资源，再执行服务构建
```

工程只有一个 `package.json` 和锁文件。`src/content/` 负责读取和渲染 Markdown，`src/reader/` 负责浏览器交互，`src/site.ts` 组合为完整静态 HTML，`src/preview.ts` 提供本地预览。Go 等语言只在使用方集成生成产物时涉及。

根目录保留 `README.md` 作为项目介绍和入口，其余文档放在 `doc/`：`doc/QUICK_START.md` 面向正式用户，`doc/CONTRIBUTING.md` 承接开发、测试和发包说明。

## GitHub 公网分发

项目使用公开仓库 [PerfectZQ/mdsite](https://github.com/PerfectZQ/mdsite) 的 Releases 分发，不执行 `npm publish`，不需要 npm 发布账号或 npm Token。

本地只做开发、检查和源码提交，不生成 `.tgz`。推送版本标签后，由 GitHub Actions 在线构建、验证并发布发行包。

发行内容由 `package.json` 的 `files` 字段限定，包括编译后的 JavaScript、阅读器资源、第三方许可证、用户/开发文档和使用方构建脚本。不携带源码、测试、开发依赖或平台二进制，`dist/` 和发行包不提交到源码仓库。

[Release 工作流](https://github.com/PerfectZQ/mdsite/blob/main/.github/workflows/release.yml)在推送 `v*` 标签时自动执行：

1. 核对标签、`package.json` 和 `package-lock.json` 中的版本一致；当前只接受 `v主版本.次版本.修订版本` 格式的正式版本。
2. 使用 Node.js 24 执行 `npm ci` 和 `npm pack`，完成类型检查、构建和测试。
3. 在独立目录安装并验证生成的发行包。
4. 将发行包统一命名为 `mdsite.tgz`，生成 `mdsite.tgz.sha256`。
5. 创建带完整附件的 Release 草稿，再发布并标记为 Latest。

工作流使用 GitHub 自动提供的 `GITHUB_TOKEN`，发布任务仅申请 `contents: write`，无需额外配置 Secret。仓库需要保持 Public 且启用 Actions，用户才能匿名下载发行文件。首次推送工作流时，维护者使用的 GitHub 凭据需要有更新工作流的权限。

### 发布一个版本

更新版本号和锁文件，检查后提交全部改动，再将源码和对应标签一起推送。以下以修订版本为例；若本次版本号已更新，跳过第一条命令：

```sh
npm version patch --no-git-tag-version
npm run check
npm test
version=$(node -p "require('./package.json').version")
git add -A
git commit -m "chore: release v$version"
git tag -a "v$version" -m "Release v$version"
git push --atomic origin main "v$version"
```

GitHub Actions 中的 `npm pack` 通过 `prepack` 执行类型检查、构建和测试，再生成发行包并发布到 Releases。工作流运行情况见 [Actions](https://github.com/PerfectZQ/mdsite/actions/workflows/release.yml)，完成后在 [Releases](https://github.com/PerfectZQ/mdsite/releases) 查看安装包。

失败时先查看对应步骤的日志。修正源码后使用新版本发版；如果只是网络等临时故障，可在 Actions 页面重新运行原任务。也支持手动运行工作流，但必须选择版本标签作为 ref，不能选择 `main`。如果失败留下了草稿 Release，先删除该草稿再重跑；已发布的版本不覆盖、不移动标签。

### 公网安装验证

无需登录 GitHub，即可执行正式用户的安装命令：

```sh
npm install -g https://github.com/PerfectZQ/mdsite/releases/latest/download/mdsite.tgz
mdsite version
mdsite build . -o dist/docs.html
mdsite serve .
```

Latest 地址始终指向最新正式版；需要可复现构建时，将 `latest/download` 换成 `download/v0.2.2` 等固定版本路径。

也可以从公网 URL 执行完整的安装包验证，脚本会核对发行包版本与当前源码版本一致：

```sh
node scripts/verify-package.ts https://github.com/PerfectZQ/mdsite/releases/download/v0.2.2/mdsite.tgz
```

`verify-package.ts` 在临时目录中用独立 npm 缓存安装线上发行包，禁用安装脚本，只安装运行依赖，再验证 `version`、`build`、`serve`、随包文档、构建脚本和内联 Mermaid；结束后自动清理。脚本支持 macOS / Linux，GitHub Actions 在 Linux 上使用同一脚本验证待发布的包。

每个 Release 附带 `mdsite.tgz.sha256`。需要独立检查时，将安装包和校验文件下载到同一目录，再执行 `sha256sum -c mdsite.tgz.sha256`（Linux）或 `shasum -a 256 -c mdsite.tgz.sha256`（macOS）。
