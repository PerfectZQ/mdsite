import {useEffect, useMemo, useRef, useState} from 'react'
import highlight from 'highlight.js/lib/common'
import {documentHref} from './navigation'
import type {DocumentRecord} from '../catalog.ts'

let diagramID = 0

export function MarkdownDocument({
    document: current,
    heading,
    theme,
    onSourceLink,
}: {
    document: DocumentRecord
    heading: string
    theme: string
    onSourceLink: (path: string, directory: boolean) => void
}) {
    const article = useRef<HTMLElement>(null)
    const [message, setMessage] = useState('')
    // 保持 HTML 属性引用稳定，目录高亮等更新不能覆盖已经绘制的 Mermaid DOM。
    const body = useMemo(() => ({__html: current.html}), [current.html])
    const latestHeading = useRef(heading)
    latestHeading.current = heading
    useEffect(() => {
        const element = article.current!
        // The effect owns diagram DOM; reset it before rendering a different theme.
        element.innerHTML = current.html
        element.querySelectorAll<HTMLElement>('pre > code').forEach(code => {
            if (!code.classList.contains('language-mermaid')) {
                const language = [...code.classList].find(name => name.startsWith('language-'))?.slice(9)
                if (language && highlight.getLanguage(language)) highlight.highlightElement(code)
            }
        })
        const mermaid = window.mdsiteMermaid
        mermaid?.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            theme: theme === 'dark' ? 'dark' : 'default',
            fontFamily: 'system-ui, sans-serif',
        })
        let cancelled = false
        const sourceBlocks = [...element.querySelectorAll<HTMLElement>('pre > code.language-mermaid')]
        const render = async () => {
            for (const code of sourceBlocks) {
                if (cancelled) return
                const pre = code.parentElement!
                const figure = document.createElement('figure')
                figure.className = 'diagram'
                const canvas = document.createElement('div')
                canvas.className = 'diagram-canvas'
                canvas.setAttribute('aria-label', '文档示意图')
                canvas.setAttribute('tabindex', '0')
                const details = document.createElement('details')
                const summary = document.createElement('summary')
                summary.textContent = '查看 Mermaid 源码'
                details.append(summary)
                pre.replaceWith(figure)
                details.append(pre)
                figure.append(canvas, details)
                canvas.textContent = '正在绘制图表…'
                try {
                    if (!mermaid) throw new Error('Mermaid renderer is unavailable')
                    const {svg} = await mermaid.render(`documentation-diagram-${++diagramID}`, code.textContent || '')
                    if (cancelled) return
                    canvas.innerHTML = svg
                } catch {
                    if (cancelled) return
                    canvas.textContent = '这段 Mermaid 语法未能渲染，可展开查看原文。'
                    canvas.classList.add('diagram-error')
                    details.open = true
                }
            }
            if (!cancelled && latestHeading.current)
                document.getElementById(latestHeading.current)?.scrollIntoView({block: 'start'})
        }
        void render()
        return () => {
            cancelled = true
        }
    }, [current, theme])

    useEffect(() => {
        if (heading) document.getElementById(heading)?.scrollIntoView({block: 'start'})
    }, [current, heading])

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setMessage('已复制')
        } catch {
            setMessage('浏览器不允许访问剪贴板，请选择内容后复制。')
        }
    }
    return (
        <>
            <div className="document-tools">
                <code>{current.path}</code>
                <div>
                    <button onClick={() => void copy(window.location.href)}>复制链接</button>
                    <button
                        onClick={() => {
                            const url = URL.createObjectURL(
                                new Blob([current.source], {
                                    type: 'text/markdown;charset=utf-8',
                                }),
                            )
                            const link = document.createElement('a')
                            link.href = url
                            link.download = current.path.split('/').at(-1)!
                            link.click()
                            setTimeout(() => URL.revokeObjectURL(url), 1000)
                        }}
                    >
                        下载 Markdown
                    </button>
                </div>
            </div>
            {message && (
                <div className="inline-notice" role="status">
                    {message}
                    <button onClick={() => setMessage('')} aria-label="关闭提示">
                        ×
                    </button>
                </div>
            )}
            <article
                ref={article}
                className="markdown-body"
                aria-label={current.title}
                onClick={event => {
                    const target = (event.target as HTMLElement).closest<HTMLAnchorElement>('a')
                    if (target?.dataset.sourcePath) {
                        event.preventDefault()
                        onSourceLink(target.dataset.sourcePath, target.dataset.directory === 'true')
                    } else if (target?.hash === window.location.hash) {
                        const heading = new URLSearchParams(target.hash.split('?')[1]).get('heading')
                        if (heading) document.getElementById(heading)?.scrollIntoView({block: 'start'})
                    }
                }}
                dangerouslySetInnerHTML={body}
            />
            <footer className="document-footer">
                <span>文档来源于仓库 Markdown</span>
                <a href={documentHref(current.path)} onClick={() => window.scrollTo(0, 0)}>
                    返回文首 ↑
                </a>
            </footer>
        </>
    )
}
