# QUICK START

[返回项目介绍](README.md)

mdsite 将项目中的 Markdown 生成为可浏览、检索的文档 UI。使用前准备 Node.js 24+；生成的 HTML 可以离线打开，托管时无需 Node 服务。

## 安装和更新

从 GitHub Releases 公网下载并安装最新正式版：

```sh
npm install -g https://github.com/PerfectZQ/mdsite/releases/latest/download/mdsite.tgz
mdsite version
```

更新时再次执行同一条安装命令即可。无需 GitHub 或 npm 账号，无需手动下载文件，也无需获取源码或自行编译。

需要固定版本时，在 URL 中指定版本标签，例如：

```sh
npm install -g https://github.com/PerfectZQ/mdsite/releases/download/v0.2.1/mdsite.tgz
```

也可以只运行一次，不全局安装：

```sh
npx --yes --package=https://github.com/PerfectZQ/mdsite/releases/latest/download/mdsite.tgz mdsite build . -o public/docs/index.html
```

[版本列表](https://github.com/PerfectZQ/mdsite/releases)提供各版本的安装包和 SHA-256 校验文件。npm 在这里作为安装工具，mdsite 的发行包由 GitHub 托管。

## 推荐：生成 UI 资源，随业务服务一起构建

在业务项目根目录执行：

```sh
mdsite build . -o public/docs/index.html
```

mdsite 自动扫描当前项目，读取根目录的 `.mdignore`，将 Markdown、搜索数据、阅读器 UI 和本地图片生成到指定文件。`public/docs` 可替换为项目实际使用的资源目录；`-o` 要写到 HTML 文件名。

将该文件接入服务的静态资源路由，例如 `/docs/`。之后把同一条命令放到现有构建脚本中、服务编译或资源打包之前：

```sh
#!/bin/sh
set -eu

# 在业务项目根目录运行，先同步文档资源
mdsite build . -o public/docs/index.html

# 接着执行项目原有的服务构建命令；这里以 Go 项目为例
go build -o output/service ./cmd/service
```

每次发布运行业务构建脚本即可，生成资源会进入本次服务产物。Node.js 24+ 和 mdsite 只需装在开发机或 CI 构建环境，服务运行时直接托管 HTML。

### 自动检测变更

`build` 每次重新扫描并生成完整页面，与已有输出比较：

- 首次运行或输出缺失：自动创建目录和 HTML。
- Markdown 新增、修改、移动、删除，本地引用图片、忽略规则、标题或升级后的 UI 使页面发生变化：更新 HTML。
- 生成结果未变：输出“内容未变”，保留原文件和修改时间，命令成功退出。
- 生成失败：命令以非零状态退出，保留上一份 HTML；上面的 `set -e` 会阻止后续服务构建。

比较覆盖最终页面，不依赖 Git 提交记录或时间戳缓存。被忽略的内容不会进入资源；输出 HTML 也不会被当作 Markdown 再次扫描。服务构建在文档检查成功后照常运行。

### 直接使用随包脚本

如果希望直接复用脚本，公网安装后在业务项目根目录执行一次：

```sh
mkdir -p scripts
cp "$(npm root -g)/mdsite/examples/build-with-docs.sh" scripts/build-with-docs.sh
```

之后将项目原有构建命令作为参数传入：

```sh
# 先更新 public/docs/index.html，再构建 Go 服务
sh scripts/build-with-docs.sh go build -o output/service ./cmd/service

# 自定义资源目录，再执行项目原有的 npm 构建
MDSITE_OUTPUT=static/help/index.html sh scripts/build-with-docs.sh npm run build
```

从业务项目根目录运行，脚本会扫描当前项目；`MDSITE_OUTPUT` 相对当前工作目录解析，也可以使用绝对路径。脚本随安装包分发，[源码在这里](examples/build-with-docs.sh)。业务服务仍由你传入的原构建命令负责。

### 已有 npm 构建流程

也可以把 mdsite 作为项目开发依赖，从公网安装并记录在锁文件中：

```sh
npm install --save-dev https://github.com/PerfectZQ/mdsite/releases/download/v0.2.1/mdsite.tgz
```

在业务项目 `package.json` 中添加：

```json
{
  "scripts": {
    "docs:build": "mdsite build . -o public/docs/index.html",
    "prebuild": "npm run docs:build"
  }
}
```

保留项目已有的 `build` 命令。执行 `npm run build` 时，npm 会先运行 `prebuild`，再执行服务构建。如果已有 `prebuild`，将文档命令合入原流程；CI 中在生成文档前安装开发依赖。可将生成的 HTML 加入 `.gitignore`，每次构建重新生成；是否忽略源文档由 `.mdignore` 单独控制。

## 本地预览

```sh
mdsite serve .                            # http://127.0.0.1:6060
```

无需初始化或登记文档。修改 Markdown 后刷新页面，即可查看最新 UI；正式集成使用上面的 `build` 流程。

## 命令

```sh
mdsite serve [目录] [--addr 127.0.0.1:6060] [--title 名称] [--exclude 路径]
mdsite build [目录] [-o dist/index.html] [--title 名称] [--exclude 路径]
mdsite version
mdsite --help
```

目录默认是当前目录，标题默认是目录名。选项可放在目录之前或之后；`--exclude` 用逗号分隔多个根目录相对路径。`-o` 也可写作 `--output`，输出路径相对执行命令时的工作目录，必须使用 `.html` 或 `.htm` 扩展名。

`serve` 每次刷新都会重新扫描 Markdown 和 `.mdignore`，新增、修改、移动、删除文件都会生效。只提供生成页面，不暴露源码文件。`build` 生成完整页面并比较后，仅在内容变化时替换输出；生成失败时保留上一份产物。

## 集成生成的 UI

```sh
mdsite build . -o public/docs/index.html
```

将生成的 HTML 放到已有网站、Nginx 或服务的静态资源目录即可。页面使用 hash 路由，支持 `/docs/` 等任意挂载路径，无需接口、数据库或 Node 服务。使用上面的业务构建脚本，每次发布时自动更新资源。

Go 的 `embed` 是使用方的一种集成方式，只依赖 Go 标准库：

```go
package main

import (
    "embed"
    "io/fs"
    "log"
    "net/http"
)

//go:embed public/docs/index.html
var assets embed.FS

func main() {
    docs, err := fs.Sub(assets, "public/docs")
    if err != nil { log.Fatal(err) }
    mux := http.NewServeMux()
    mux.Handle("/docs/", http.StripPrefix("/docs", http.FileServerFS(docs)))
    log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
```

mdsite 不提供 Go 包或运行时绑定；使用方负责静态资源挂载和访问控制。其他语言同样可以直接使用生成的 HTML。

## 目录和内容

```text
project/
├── README.md
├── doc/
│   └── architecture.md
└── internal/
    └── worker/
        └── README.md
```

文件树显示原始目录和文件名，只展示含 Markdown 的路径，同层目录在前、文件在后。默认打开根 `README.md`，不存在时打开按路径排序的第一篇文档。递归扫描 `.md`（扩展名不区分大小写），包括未提交文件和隐藏目录。

- 标题、路径和全文搜索，多个关键词同时匹配；`⌘ K` / `Ctrl K` 或 `/` 打开，方向键选择，Enter 跳转。
- 明暗主题、代码高亮、桌面章节目录和移动端目录。
- CommonMark、表格、任务列表、脚注、删除线、定义列表、中文和重复标题锚点。
- 相对 Markdown 链接、目录 README 和 `.html` 到 `.md` 的链接解析；源码和非图片附件显示来源路径。
- Mermaid 在文档包含图表时随页面内联，语法错误保留源码；普通文档不携带图表引擎。
- 本地 PNG、JPEG、GIF、WebP、AVIF、SVG 内联到 HTML，外部图片仍需要网络。
- HTML 经过清理，保留 `details` 等排版，禁用文档中的脚本和事件处理器。

文件符号链接在目录树保留入口、搜索按原文件去重；不跟随目录符号链接、绝对路径链接或越出扫描根目录的链接。图片也遵循相同路径和忽略规则。

## 忽略规则

根目录可添加 `.mdignore`，使用 `.gitignore` 规则：

```gitignore
# 任意层级的缓存目录
.cache/

# 只忽略根目录的临时文档
/scratch/

# 忽略生成内容，保留说明
/generated/**
!/generated/README.md

*.draft.md
docs/**/internal-*.md
```

支持 `*`、`?`、字符范围、`**`、目录末尾 `/`、根路径开头 `/`、`!` 例外和反斜杠转义，后面的规则覆盖前面的规则。父目录整体被忽略时不会继续遍历，必须先恢复父目录才能恢复其中的文件。仅读取根 `.mdignore`，不读取 `.gitignore` 或嵌套 `.mdignore`。

默认忽略 `.git`、`.hg`、`.svn`、`.codegraph`、`node_modules`、`vendor`、`dist`、`output`、`.next`、`.venv`、`venv`、`__pycache__`。默认规则可由 `.mdignore` 覆盖，例如 `!dist/`。`--exclude private,.cache` 优先级最高，按根目录相对路径排除，不解析通配符，不受 `!` 覆盖。

`.mdignore` 必须是普通文件；读取失败会终止构建。被忽略的内容不会进入页面或搜索，也不能通过符号链接或内联图片绕过。
