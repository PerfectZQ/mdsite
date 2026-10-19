import {useDeferredValue, useMemo, useRef, useState} from 'react'
import {documentHref} from '../navigation'
import {createSearchIndex, searchSections, searchExcerpt, searchPattern} from './search'
import type {Catalog} from '../../catalog.ts'
import './search.css'

function Highlight({text, query}: {text: string; query: string}) {
    const pattern = searchPattern(query)
    if (!pattern) return <>{text}</>
    return (
        <>
            {text
                .split(new RegExp(`(${pattern.source})`, 'gi'))
                .map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}
        </>
    )
}

export function SearchDialog({
    catalog,
    dialogRef,
    onSelect,
}: {
    catalog: Catalog
    dialogRef: React.RefObject<HTMLDialogElement | null>
    onSelect: (href: string) => void
}) {
    const [query, setQuery] = useState('')
    const deferredQuery = useDeferredValue(query)
    const index = useMemo(() => createSearchIndex(catalog.documents), [catalog])
    const results = useMemo(() => searchSections(index, deferredQuery), [index, deferredQuery])
    const documentCount = new Set(results.map(result => result.document.path)).size
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
                {deferredQuery.trim()
                    ? `${results.length} 处匹配 · ${documentCount} 篇文档`
                    : `全部 ${documentCount} 篇文档`}
                <span>↑ ↓ 选择 · Enter 打开</span>
            </div>
            <div className="search-results">
                {results.length === 0 && (
                    <p className="empty-message">没有找到匹配文档。试试模块名称或更短的关键词。</p>
                )}
                {results.slice(0, 80).map(result => (
                    <a
                        className="search-result"
                        key={`${result.document.path}#${result.heading}`}
                        href={documentHref(
                            result.document.path,
                            deferredQuery.trim() ? result.heading : '',
                            deferredQuery,
                        )}
                        onClick={event => {
                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                            dialogRef.current?.close()
                            onSelect(event.currentTarget.hash)
                        }}
                    >
                        <strong>
                            <Highlight text={result.document.title} query={deferredQuery} />
                        </strong>
                        {deferredQuery.trim() && result.trail && (
                            <span className="search-section">
                                <Highlight text={result.trail} query={deferredQuery} />
                            </span>
                        )}
                        <code>
                            <Highlight text={result.document.path} query={deferredQuery} />
                        </code>
                        <p>
                            <Highlight
                                text={searchExcerpt(
                                    deferredQuery.trim() ? result.text : result.document.summary,
                                    deferredQuery,
                                )}
                                query={deferredQuery}
                            />
                        </p>
                    </a>
                ))}
                {results.length > 80 && <p className="empty-message">已显示前 80 处匹配，请输入关键词缩小范围。</p>}
            </div>
        </dialog>
    )
}
