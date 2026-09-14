# QUICK START

[返回项目介绍](../README.md)

mdsite 将项目中的 Markdown 生成为可浏览、检索的文档 UI。安装后，在包含 Markdown 的业务项目目录中使用；无需初始化文档工程或登记页面。

| 你要做什么 | 使用命令 | 得到什么 |
| --- | --- | --- |
| 边写文档边在浏览器查看 | `mdsite serve .` | 本地预览地址，刷新时读取最新文档 |
| 生成可分发、部署或嵌入服务的静态资源 | `mdsite build . -o public/docs/index.html` | 一个包含完整文档 UI 的 HTML 文件 |

运行 mdsite 需要 Node.js 24+。构建完成的 HTML 可离线打开或交给静态服务器托管，访问者不需要安装 Node.js 或 mdsite。

## 安装和更新

从 GitHub Releases 公网下载并安装最新正式版：

```sh
npm install -g https://github.com/PerfectZQ/mdsite/releases/latest/download/mdsite.tgz
mdsite version
```

更新时再次执行同一条安装命令即可。无需 GitHub 或 npm 账号，无需手动下载文件，也无需获取源码或自行编译。

需要固定版本时，将安装 URL 中的 `latest/download` 替换为 `download/v0.2.4` 等版本路径。[版本列表](https://github.com/PerfectZQ/mdsite/releases)提供各版本的安装包和 SHA-256 校验文件。

若安装成功后 `mdsite version` 仍提示“未知命令”，请先看文末的[旧命令冲突排查](#旧命令冲突排查)。

## 方式一：本地预览

适合写文档、检查渲染效果和本地浏览项目资料。在业务项目根目录执行：

```sh
mdsite serve .
```

终端会打印预览地址，默认是 **http://127.0.0.1:6060**。用浏览器打开该地址，并保持终端中的命令运行；结束预览时按 `Ctrl+C`。

- `.` 表示扫描当前项目，包含子目录中的 Markdown，并读取项目根目录的 `.mdignore`。
- 新增、修改、移动或删除 Markdown，以及修改本地图片或 `.mdignore` 后，手动刷新浏览器即可看到最新结果。
- `serve` 不写出静态 HTML；关闭预览进程后，本地地址停止服务。

只预览某个目录，或更换标题、端口：

```sh
mdsite serve ./doc --title "项目文档" --addr 127.0.0.1:6061
```

此时只扫描 `./doc`，读取其中的 `.mdignore`，浏览器访问 http://127.0.0.1:6061。

## 方式二：构建静态资源

适合发布文档、分发离线文件，或将文档 UI 嵌入已有网站和业务服务。在业务项目根目录执行：

```sh
mdsite build . -o public/docs/index.html
```

命令生成文件后退出，产物是：

```text
public/
└── docs/
    └── index.html
```

这个 HTML 内含阅读器 UI、文档内容、搜索数据、JavaScript、CSS 和本地图片；有 Mermaid 图表时也会内联渲染器。分发这一个文件即可，文档中引用的外部图片仍需要网络。

`-o`（或 `--output`）指定输出文件，路径相对执行命令时的工作目录；父目录不存在时自动创建。省略 `-o` 时默认输出 `dist/index.html`。也可以只构建某个文档目录：

```sh
mdsite build ./doc --output public/docs/index.html --title "项目文档"
```

生成后，可以直接用浏览器打开 HTML，发送给其他人，或将它放到已有网站、Nginx、业务服务的静态资源目录。若服务将 `public/docs/` 挂载到 `/docs/`，访问对应的 `/docs/` 地址即可；页面使用 hash 路由，支持任意挂载路径，使用方负责静态资源挂载和访问控制。

之后修改 Markdown，需要再次执行 `mdsite build` 更新 HTML。`build` 不启动预览服务，也不持续监听文件变化。

### 接入业务项目的构建流程

把同一条 `mdsite build` 命令放到项目现有构建脚本中、服务编译或资源打包之前。以 Go 项目为例：

```sh
#!/bin/sh
set -eu

# 在业务项目根目录运行，先同步文档资源
mdsite build . -o public/docs/index.html

# 项目原有的服务构建命令
go build -o output/service ./cmd/service
```

每次发布运行业务构建脚本即可。将输出路径设为项目实际打包或嵌入的资源位置，生成的 HTML 就会进入本次服务产物。Node.js 24+ 和 mdsite 只需装在开发机或 CI 构建环境，服务运行时直接托管 HTML。

可将生成的 HTML 加入 `.gitignore`，每次构建重新生成；是否忽略源文档由 `.mdignore` 控制。

### 自动检测变更

`build` 每次重新扫描并生成完整页面，与已有输出比较：

- 首次运行或输出缺失：自动创建目录和 HTML。
- Markdown 新增、修改、移动、删除，本地引用图片、忽略规则、标题或升级后的 UI 使页面发生变化：更新 HTML。
- 生成结果未变：输出“内容未变”，保留原文件和修改时间，命令成功退出。
- 生成失败：命令以非零状态退出，保留上一份 HTML；上面的 `set -e` 会阻止后续服务构建。

比较覆盖最终页面，不依赖 Git 提交记录或时间戳缓存。被忽略的内容不会进入资源；输出 HTML 也不会被当作 Markdown 再次扫描。服务构建在文档检查成功后照常运行。

## 命令

```sh
mdsite serve [目录] [--addr 127.0.0.1:6060] [--title 名称] [--exclude 路径]
mdsite build [目录] [-o dist/index.html] [--title 名称] [--exclude 路径]
mdsite version
mdsite --help
```

目录默认是当前目录，标题默认是目录名。选项可放在目录之前或之后；`--exclude` 用逗号分隔多个根目录相对路径。`-o` 也可写作 `--output`，输出路径相对执行命令时的工作目录，必须使用 `.html` 或 `.htm` 扩展名。

`serve` 每次刷新都会重新扫描 Markdown 和 `.mdignore`，新增、修改、移动、删除文件都会生效。只提供生成页面，不暴露源码文件。`build` 生成完整页面并比较后，仅在内容变化时替换输出；生成失败时保留上一份产物。

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

## 旧命令冲突排查

如果 npm 安装成功，但 `mdsite version` 提示“未知命令”，或 `--help` 仍显示旧参数格式，终端可能优先运行了以前安装的同名程序。macOS / Linux 下执行：

```sh
type -a mdsite
npm list -g mdsite --depth=0
"$(npm prefix -g)/bin/mdsite" version
```

`type -a` 按查找顺序列出入口；第三条命令直接运行当前 npm 的全局安装版本。例如，旧 Go 版可能位于 `~/.local/bin/mdsite`，排在 npm 的 `/opt/homebrew/bin/mdsite` 前面，重新安装 npm 包不会覆盖前者。

如果直接运行 npm 入口可以正确显示版本，移走已确认的旧同名程序，再打开新终端；zsh 也可执行 `rehash` 刷新命令缓存。然后重新运行 `mdsite version`，确认终端使用的是已安装的新版本。
