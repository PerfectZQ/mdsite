import {useEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {CodeBlock} from './CodeBlock'
import {MermaidDiagram} from './MermaidDiagram'
import {CopyButton} from './CopyButton'
import {Icon} from './Icon'
import {documentHref} from './navigation'
import type {DocumentRecord} from '../catalog.ts'

type CodeMount = {element: HTMLElement; source: string; language: string}

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
    const [blocks, setBlocks] = useState<CodeMount[]>([])
    // Navigation updates must preserve the DOM containers owned by the portals.
    const body = useMemo(() => ({__html: current.html}), [current.html])
    useEffect(() => {
        const element = article.current!
        element.innerHTML = current.html
        const mounts = [...element.querySelectorAll<HTMLElement>('pre > code')].map(code => {
            const mount = document.createElement('div')
            mount.className = 'code-mount'
            const language = [...code.classList].find(name => name.startsWith('language-'))?.slice(9) || ''
            const source = code.textContent || ''
            code.parentElement!.replaceWith(mount)
            return {element: mount, source, language}
        })
        element.querySelectorAll<HTMLTableElement>('table').forEach(table => {
            const scroll = document.createElement('div')
            scroll.className = 'table-scroll'
            scroll.tabIndex = 0
            scroll.setAttribute('role', 'region')
            scroll.setAttribute('aria-label', '表格，可横向滚动')
            table.replaceWith(scroll)
            scroll.append(table)
        })
        element.querySelectorAll<HTMLElement>('h2, h3, h4, h5, h6').forEach(heading => {
            const link = document.createElement('a')
            link.className = 'heading-anchor'
            link.href = documentHref(current.path, heading.id)
            link.setAttribute('aria-label', `链接到 ${heading.textContent}`)
            link.textContent = '#'
            heading.append(link)
        })
        setBlocks(mounts)
    }, [current])

    useEffect(() => {
        if (!heading) return
        const element = article.current!
        const target = document.getElementById(heading)
        // Keep deep links aligned while diagrams load, until the reader takes control.
        const observer = new ResizeObserver(() => {
            target?.scrollIntoView({block: 'start'})
            if (!element.querySelector('[aria-busy="true"]')) observer.disconnect()
        })
        observer.observe(element)
        const input = new AbortController()
        for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
            window.addEventListener(event, () => observer.disconnect(), {signal: input.signal, passive: true})
        }
        return () => {
            observer.disconnect()
            input.abort()
        }
    }, [current, heading, blocks])

    return (
        <>
            <div className="document-tools">
                <code>{current.path}</code>
                <div>
                    <CopyButton text={() => window.location.href} label="复制链接" icon="link" />
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
                        <Icon name="download" />
                        下载 Markdown
                    </button>
                </div>
            </div>
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
            {blocks.map((block, index) =>
                createPortal(
                    block.language === 'mermaid' ? (
                        <MermaidDiagram source={block.source} theme={theme} />
                    ) : (
                        <CodeBlock source={block.source} language={block.language} />
                    ),
                    block.element,
                    String(index),
                ),
            )}
            <footer className="document-footer">
                <span>文档来源于仓库 Markdown</span>
                <a href={documentHref(current.path)} onClick={() => window.scrollTo(0, 0)}>
                    返回文首 ↑
                </a>
            </footer>
        </>
    )
}
