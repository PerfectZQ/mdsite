# Markdown 排版

页面提供中文检索、章节锚点、表格、代码高亮、任务列表、脚注与流程图。

## 代码

```go
package main

import "fmt"

func main() {
    fmt.Println("写好 Markdown，就有文档站。")
}
```

## 表格与任务

| 能力 | 入口 |
| --- | --- |
| 本地预览 | `mdsite serve .` |
| 离线页面 | `mdsite build .` |
| 内容检索 | `⌘ K` / `Ctrl K` |

- [x] 按真实目录组织
- [x] 明暗主题
- [ ] 在模块目录继续添加文档

## 流程图

```mermaid
flowchart LR
    A[项目 Markdown] --> B[自动发现]
    B --> C[目录与正文]
    C --> D[浏览与搜索]
```

## 中文章节

可以[返回首页](../README.md)，也可以直接打开[本页章节](#中文章节)。脚注保留原生跳转。[^note]

[^note]: 所有内容来自 Markdown，不需要维护第二份目录。
