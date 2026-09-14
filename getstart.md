# 使用指南

[返回项目介绍](README.md)

mdsite 将项目中的 Markdown 生成为可浏览、检索的文档 UI。使用前准备 Node.js 24+；生成的 HTML 可以离线打开，托管时无需 Node 服务。

## 安装

当前版本通过 npm 发行包安装。在收到的发行包所在目录执行：

```sh
npm install -g ./mdsite-0.2.0.tgz
mdsite version
```

安装后可在任意项目中使用，无需下载 mdsite 源码或自行编译。

包发布到 npm 后，也可以直接运行：

```sh
npx mdsite@latest serve .
npx mdsite@latest build .
```

通过 npm 全局安装使用 `npm install -g mdsite`；需要固定为业务项目的构建依赖时使用 `npm install -D mdsite`，再通过 `npx mdsite` 执行命令。

## 首次使用

进入需要阅读文档的项目目录：

```sh
mdsite serve .                            # http://127.0.0.1:6060
mdsite build .                            # dist/index.html
mdsite build . -o public/docs/index.html   # 放入业务项目的静态资源目录
```

无需初始化或登记文档。将 Markdown 放在合适的目录中，mdsite 自动生成文件树、正文和搜索内容。

## 命令


```sh
mdsite serve [目录] [--addr 127.0.0.1:6060] [--title 名称] [--exclude 路径]
mdsite build [目录] [-o dist/index.html] [--title 名称] [--exclude 路径]
mdsite version
mdsite --help
```

目录默认是当前目录，标题默认是目录名。选项可放在目录之前或之后；`--exclude` 用逗号分隔多个根目录相对路径。`-o` 也可写作 `--output`，输出路径相对执行命令时的工作目录，必须使用 `.html` 或 `.htm` 扩展名。

`serve` 每次刷新都会重新扫描 Markdown 和 `.mdignore`，新增、修改、移动、删除文件都会生效。只提供生成页面，不暴露源码文件。`build` 生成完整页面后才替换输出；生成失败时保留上一份产物。

## 集成生成的 UI

```sh
mdsite build . -o public/docs/index.html
```

将生成的 HTML 放到已有网站、Nginx 或服务的静态资源目录即可。页面使用 hash 路由，支持 `/docs/` 等任意挂载路径，无需接口、数据库或 Node 服务。Markdown 更新后重新运行构建命令。

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
