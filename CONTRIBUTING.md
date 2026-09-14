# 开发指南

本文面向修改、测试和发布 mdsite 的开发者。安装、使用和业务项目集成见[使用指南](getstart.md)，项目介绍见 [README](README.md)。

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

`npm run check` 对 CLI、阅读器和构建脚本进行类型检查。`npm test` 会先构建 CLI 和阅读器，再验证文件扫描、Markdown 渲染、预览刷新、命令行、链接、图片、忽略规则与搜索。Git 可用时，测试会以 Git 的实际结果核对忽略规则；运行 mdsite 本身不依赖 Git。

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
tests/                 # 功能回归测试
examples/content/      # Markdown 示例
```

工程只有一个 `package.json` 和锁文件。`src/content/` 负责读取和渲染 Markdown，`src/reader/` 负责浏览器交互，`src/site.ts` 组合为完整静态 HTML，`src/preview.ts` 提供本地预览。Go 等语言只在使用方集成生成产物时涉及。

根目录的文档按读者组织：`README.md` 是项目介绍和入口，`getstart.md` 面向正式用户，`CONTRIBUTING.md` 承接开发、测试和发包说明。

## 打包与发布

当前版本尚未发布到 npm。发布前确认包名和发布权限，并保持 `package.json` 与锁文件中的版本一致。

```sh
npm pack
```

`prepack` 会执行类型检查、构建和测试。当前版本生成 `mdsite-0.2.0.tgz`，可交给用户直接安装。发行包通过 `package.json` 的 `files` 字段限定内容，包含编译后的 JavaScript、阅读器资源、第三方许可证及使用和开发文档；不携带源码、测试、开发依赖或平台二进制。

可以在独立目录中安装发行包，检查 `mdsite version`、`mdsite build` 和 `mdsite serve`，确认运行不依赖本仓库。完成验证并确认发布权限后执行：

```sh
npm publish
```

安装和运行入口由 `package.json` 的 `bin` 字段声明，无需按操作系统构建不同版本。生成目录 `dist/` 和本地 `.tgz` 发行包不提交到源码仓库。
