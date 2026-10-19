import {useEffect, useMemo, useRef, useState} from 'react'
import {Navigation} from './DocumentNavigation'
import {MarkdownDocument} from './MarkdownDocument'
import {DocumentActions} from './DocumentActions'
import {DocumentPagination} from './DocumentPagination'
import {ReadingPreferences} from './ReadingPreferences'
import {MobileChapters, PageOutline} from './TableOfContents'
import {SearchDialog} from './search/SearchDialog'
import {documentHref, readingOffset, readRoute} from './navigation'
import type {Catalog} from '../catalog.ts'
import {useTheme} from './theme'

export function DocumentationSite({catalog}: {catalog: Catalog}) {
    const [route, setRoute] = useState(readRoute)
    const {theme, toggle} = useTheme()
    const [sourceNotice, setSourceNotice] = useState('')
    const [activeHeading, setActiveHeading] = useState('')
    const search = useRef<HTMLDialogElement>(null)
    const mobileNavigation = useRef<HTMLDialogElement>(null)
    const content = useRef<HTMLElement>(null)
    const selectedPath = route.path || catalog.home
    const documentPath = catalog.aliases[selectedPath] || selectedPath
    const [revealRequest, setRevealRequest] = useState<{path: string} | null>(null)
    const current = useMemo(
        () => catalog.documents.find(document => document.path === documentPath),
        [catalog, documentPath],
    )
    const headings = useMemo(() => current?.headings.filter(heading => heading.level <= 3) ?? [], [current])
    const outline = {path: current?.path || '', headings, activeHeading}

    useEffect(() => {
        const change = () => {
            setRoute(readRoute())
            setSourceNotice('')
        }
        const keyboard = (event: KeyboardEvent) => {
            const input = (event.target as HTMLElement).closest('input,textarea,[contenteditable]')
            if (
                (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) ||
                (event.key === '/' && !input)
            ) {
                event.preventDefault()
                mobileNavigation.current?.close()
                search.current?.showModal()
            }
        }
        window.addEventListener('hashchange', change)
        window.addEventListener('keydown', keyboard)
        return () => {
            window.removeEventListener('hashchange', change)
            window.removeEventListener('keydown', keyboard)
        }
    }, [])

    useEffect(() => {
        const viewport = window.matchMedia('(max-width: 960px)')
        const change = () => {
            if (!viewport.matches && mobileNavigation.current?.open) {
                mobileNavigation.current.close()
                content.current?.focus({preventScroll: true})
            }
        }
        viewport.addEventListener('change', change)
        return () => viewport.removeEventListener('change', change)
    }, [])

    useEffect(() => {
        document.title = `${current?.title || catalog.title} · 文档`
        if (!route.heading && !route.query) {
            window.scrollTo(0, 0)
            content.current?.focus({preventScroll: true})
        }
    }, [current, catalog.title, route.heading])

    useEffect(() => {
        const elements = headings
            .map(heading => document.getElementById(heading.id))
            .filter((element): element is HTMLElement => !!element)
        let frame = 0
        const update = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                const offset = readingOffset() + 4
                const visible =
                    elements.filter(element => element.getBoundingClientRect().top <= offset).at(-1) || elements[0]
                setActiveHeading(visible?.id || '')
            })
        }
        const observer = new ResizeObserver(update)
        if (content.current) observer.observe(content.current)
        window.addEventListener('scroll', update, {passive: true})
        window.addEventListener('resize', update)
        update()
        return () => {
            cancelAnimationFrame(frame)
            observer.disconnect()
            window.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
        }
    }, [headings])

    const revealPath = (path: string) => {
        setRevealRequest({path})
        if (window.matchMedia('(max-width: 960px)').matches) mobileNavigation.current?.showModal()
    }

    const onSourceLink = (path: string, isDirectory: boolean) => {
        if (isDirectory && catalog.documents.some(document => document.path.startsWith(path))) {
            revealPath(path.replace(/\/$/, ''))
            return
        }
        setSourceNotice(`此链接指向文件 ${path}，请在项目目录中查看。`)
    }

    return (
        <>
            <a
                className="skip-link"
                href="#main-content"
                onClick={event => {
                    event.preventDefault()
                    content.current?.focus()
                }}
            >
                跳到正文
            </a>
            <header className="topbar">
                <a className="brand" href="#/" aria-label={`${catalog.title} 文档首页`}>
                    <span className="brand-mark" aria-hidden="true">
                        M↓
                    </span>
                    <strong>{catalog.title}</strong>
                    <span className="brand-label">文档</span>
                </a>
                <button className="search-trigger" aria-label="搜索文档" onClick={() => search.current?.showModal()}>
                    <span aria-hidden="true">⌕</span>
                    <span>搜索文档…</span>
                    <kbd>⌘ K</kbd>
                </button>
                <ReadingPreferences />
                <button
                    className="theme-toggle"
                    onClick={toggle}
                    aria-label={theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'}
                    title={theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'}
                >
                    {theme === 'dark' ? '☀' : '☾'}
                </button>
                <button
                    className="mobile-menu"
                    onClick={() => mobileNavigation.current?.showModal()}
                    aria-label="打开文档目录"
                >
                    文档 ☰
                </button>
            </header>
            <MobileChapters {...outline} />
            <aside className="sidebar">
                <Navigation catalog={catalog} selected={selectedPath} revealRequest={revealRequest} />
                <div className="sidebar-footer">{catalog.documents.length} 篇文档</div>
            </aside>
            <div className="page-layout">
                <main id="main-content" ref={content} tabIndex={-1}>
                    {sourceNotice && (
                        <div className="inline-notice" role="status">
                            {sourceNotice}
                            <button onClick={() => setSourceNotice('')} aria-label="关闭提示">
                                ×
                            </button>
                        </div>
                    )}
                    {current ? (
                        <>
                            <div className="document-context">
                                <span className="document-breadcrumb">
                                    <a href="#/">{catalog.rootName}</a>
                                    {current.path.includes('/') && (
                                        <> / {current.path.slice(0, current.path.lastIndexOf('/'))}</>
                                    )}
                                </span>
                                <span className="reading-time">
                                    约 {Math.max(1, Math.ceil(current.words / 650))} 分钟
                                </span>
                                <DocumentActions
                                    key={current.path}
                                    document={current}
                                    onLocate={() => revealPath(selectedPath)}
                                />
                            </div>
                            {route.query && (
                                <div className="search-context" role="status">
                                    <span>
                                        搜索：<strong>{route.query}</strong>
                                    </span>
                                    <button
                                        onClick={() => {
                                            history.replaceState(
                                                history.state,
                                                '',
                                                documentHref(selectedPath, route.heading),
                                            )
                                            setRoute(readRoute())
                                        }}
                                    >
                                        清除高亮
                                    </button>
                                </div>
                            )}
                            <MarkdownDocument
                                key={current.path}
                                document={current}
                                route={route}
                                theme={theme}
                                onSourceLink={onSourceLink}
                            />
                            <DocumentPagination catalog={catalog} selected={selectedPath} />
                            <footer className="document-footer">
                                <code>{current.path}</code>
                                <a href={documentHref(current.path)} onClick={() => window.scrollTo(0, 0)}>
                                    返回文首 ↑
                                </a>
                            </footer>
                        </>
                    ) : (
                        <section className="not-found">
                            <h1>{catalog.documents.length ? '没有找到这篇文档' : '还没有 Markdown 文档'}</h1>
                            <code>{selectedPath}</code>
                            <p>
                                {catalog.documents.length
                                    ? '文件可能已移动，试试搜索文档标题或回到文档首页。'
                                    : '在项目目录中创建 README.md 或其他 .md 文件，然后刷新预览。'}
                            </p>
                            <a href="#/">返回文档首页 →</a>
                        </section>
                    )}
                </main>
                {current && <PageOutline {...outline} />}
            </div>
            <SearchDialog
                catalog={catalog}
                dialogRef={search}
                onSelect={href => {
                    // Re-selecting the same result must reveal it again, even without a hashchange.
                    if (window.location.hash === href) setRoute(readRoute())
                }}
            />
            <dialog
                className="navigation-dialog"
                ref={mobileNavigation}
                aria-label="文档目录"
                onClick={event => {
                    if (event.target === event.currentTarget) event.currentTarget.close()
                }}
            >
                <div className="dialog-heading">
                    <strong>文档目录</strong>
                    <button onClick={() => mobileNavigation.current?.close()} aria-label="关闭文档目录">
                        关闭 ×
                    </button>
                </div>
                <Navigation
                    catalog={catalog}
                    selected={selectedPath}
                    revealRequest={revealRequest}
                    onNavigate={() => mobileNavigation.current?.close()}
                />
            </dialog>
        </>
    )
}
