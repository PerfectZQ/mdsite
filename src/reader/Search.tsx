import {useDeferredValue, useMemo, useRef, useState} from 'react'
import {documentHref, searchDocuments} from './navigation'
import type {Catalog, DocumentRecord} from '../catalog.ts'

function Highlight({text, query}: {text: string; query: string}) {
    const terms = query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    if (!terms.length) return <>{text}</>
    const pattern = new RegExp(`(${terms.join('|')})`, 'gi')
    return <>{text.split(pattern).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>
}

function excerpt(document: DocumentRecord, query: string) {
    const first = query.trim().toLocaleLowerCase().split(/\s+/)[0]
    const index = first ? document.text.toLocaleLowerCase().indexOf(first) : -1
    if (index < 0) return document.summary
    const start = Math.max(0, index - 35)
    return `${start > 0 ? '…' : ''}${document.text.slice(start, start + 150)}…`
}

export function Search({catalog, dialogRef}: {catalog: Catalog; dialogRef: React.RefObject<HTMLDialogElement | null>}) {
    const [query, setQuery] = useState('')
    const deferredQuery = useDeferredValue(query)
    const results = useMemo(() => searchDocuments(catalog.documents, deferredQuery), [catalog, deferredQuery])
    const input = useRef<HTMLInputElement>(null)
    return (
        <dialog
            ref={dialogRef}
            className="search-dialog"
            aria-label="搜索项目文档"
            onClick={event => {
                if (event.target === event.currentTarget) event.currentTarget.close()
            }}
            onKeyDown={event => {
                if (event.nativeEvent.isComposing) return
                if (event.key === 'Escape') {
                    event.preventDefault()
                    event.currentTarget.close()
                    return
                }
                const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('.search-result')]
                const index = links.indexOf(document.activeElement as HTMLAnchorElement)
                if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    links[Math.min(index + 1, links.length - 1)]?.focus()
                }
                if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    if (index <= 0) input.current?.focus()
                    else links[index - 1]?.focus()
                }
                if (event.key === 'Enter' && event.target === input.current) {
                    event.preventDefault()
                    links[0]?.click()
                }
            }}
        >
            <div className="search-bar">
                <span aria-hidden="true">⌕</span>
                <input
                    ref={input}
                    autoFocus
                    type="search"
                    aria-label="搜索标题、路径和正文"
                    placeholder="搜索标题、路径和正文…"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                />
                <button className="quiet-button" onClick={() => dialogRef.current?.close()} aria-label="关闭搜索">
                    Esc
                </button>
            </div>
            <div className="search-status" aria-live="polite">
                {query.trim() ? `${results.length} 篇匹配文档` : `全部 ${results.length} 篇文档`}
                <span>↑ ↓ 选择 · Enter 打开</span>
            </div>
            <div className="search-results">
                {results.length === 0 && (
                    <p className="empty-message">没有找到匹配文档。试试模块名称或更短的关键词。</p>
                )}
                {results.slice(0, 80).map(document => (
                    <a
                        className="search-result"
                        key={document.path}
                        href={documentHref(document.path)}
                        onClick={() => dialogRef.current?.close()}
                    >
                        <strong>
                            <Highlight text={document.title} query={deferredQuery} />
                        </strong>
                        <code>{document.path}</code>
                        <p>
                            <Highlight text={excerpt(document, deferredQuery)} query={deferredQuery} />
                        </p>
                    </a>
                ))}
                {results.length > 80 && <p className="empty-message">已显示前 80 篇，请输入关键词缩小范围。</p>}
            </div>
        </dialog>
    )
}
