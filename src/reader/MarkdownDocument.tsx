import {useEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {CodeBlock} from './CodeBlock'
import {MermaidDiagram} from './MermaidDiagram'
import {documentHref, readingOffset, type DocumentRoute} from './navigation'
import {highlightSearch} from './search/highlight'
import type {DocumentRecord} from '../catalog.ts'

type CodeMount = {element: HTMLElement; source: string; language: string}

export function MarkdownDocument({
    document: current,
    route,
    theme,
    onSourceLink,
}: {
    document: DocumentRecord
    route: DocumentRoute
    theme: string
    onSourceLink: (path: string, directory: boolean) => void
}) {
    const article = useRef<HTMLElement>(null)
    const [blocks, setBlocks] = useState<CodeMount[]>([])
    const previousRoute = useRef<DocumentRoute | null>(null)
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
        const element = article.current!
        const highlight = highlightSearch(element, route.query, route.heading)
        const previous = previousRoute.current
        previousRoute.current = route
        const clearedSearch =
            previous?.query && !route.query && previous.path === route.path && previous.heading === route.heading
        if ((!route.heading && !route.query) || clearedSearch) return highlight.clear
        const target =
            highlight.target?.startContainer.parentElement || document.getElementById(route.heading) || element
        for (
            let container: HTMLElement | null = target;
            container && container !== element;
            container = container.parentElement
        ) {
            if (container instanceof HTMLDetailsElement) container.open = true
        }
        if (target) {
            target.tabIndex = -1
            target.focus({preventScroll: true})
        }
        const align = () => {
            if (highlight.target) {
                // Reveal a code hit inside its own horizontal scroller before positioning the page.
                highlight.target.startContainer.parentElement?.scrollIntoView({block: 'nearest', inline: 'nearest'})
                window.scrollBy(0, highlight.target.getBoundingClientRect().top - readingOffset())
            } else if (target) {
                target.scrollIntoView({block: 'start'})
                window.scrollBy(0, target.getBoundingClientRect().top - readingOffset())
            }
        }
        // Keep deep links aligned while diagrams load, until the reader takes control.
        const observer = new ResizeObserver(() => {
            align()
            if (!element.querySelector('[aria-busy="true"]')) observer.disconnect()
        })
        observer.observe(element)
        const frame = requestAnimationFrame(align)
        const input = new AbortController()
        for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
            window.addEventListener(
                event,
                () => {
                    observer.disconnect()
                    cancelAnimationFrame(frame)
                },
                {signal: input.signal, passive: true},
            )
        }
        return () => {
            observer.disconnect()
            cancelAnimationFrame(frame)
            input.abort()
            highlight.clear()
        }
    }, [current, route, blocks])

    return (
        <>
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
        </>
    )
}
