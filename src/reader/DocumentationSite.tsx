import {useEffect, useMemo, useRef, useState} from 'react'
import {Navigation} from './DocumentNavigation'
import {MarkdownDocument} from './MarkdownDocument'
import {Search} from './Search'
import {documentHref, readRoute} from './navigation'
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
    const [revealedDirectory, setRevealedDirectory] = useState<{path: string} | null>(null)
    const current = useMemo(
        () => catalog.documents.find(document => document.path === documentPath),
        [catalog, documentPath],
    )
    const headings = current?.headings.filter(heading => heading.level <= 3) ?? []

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
        if (!route.heading) {
            window.scrollTo(0, 0)
            content.current?.focus({preventScroll: true})
        }
        setActiveHeading(route.heading)
    }, [current, catalog.title, route.heading])

    useEffect(() => {
        if (!current) return
        const headings = current.headings
            .map(heading => document.getElementById(heading.id))
            .filter((element): element is HTMLElement => !!element)
        const observer = new IntersectionObserver(
            () => {
                const visible =
                    headings.filter(heading => heading.getBoundingClientRect().top <= 150).at(-1) || headings[0]
                if (visible) setActiveHeading(visible.id)
            },
            {rootMargin: '-70px 0px -65% 0px'},
        )
        headings.forEach(heading => observer.observe(heading))
        return () => observer.disconnect()
    }, [current, theme])

    const onSourceLink = (path: string, isDirectory: boolean) => {
        if (isDirectory && catalog.documents.some(document => document.path.startsWith(path))) {
            setRevealedDirectory({path: path.replace(/\/$/, '')})
            if (window.matchMedia('(max-width: 960px)').matches) mobileNavigation.current?.showModal()
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
                    目录 ☰
                </button>
            </header>
            <aside className="sidebar">
                <Navigation
                    catalog={catalog}
                    selected={selectedPath === '' ? catalog.home : selectedPath}
                    revealedDirectory={revealedDirectory}
                />
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
                                <a href="#/">{catalog.rootName}</a>
                                {current.path.includes('/') && (
                                    <>
                                        <span aria-hidden="true">/</span>
                                        <span>{current.path.slice(0, current.path.lastIndexOf('/'))}</span>
                                    </>
                                )}
                                <span className="reading-time">
                                    约 {Math.max(1, Math.ceil(current.words / 650))} 分钟
                                </span>
                            </div>
                            {headings.length > 0 && (
                                <details className="mobile-toc">
                                    <summary>本页目录</summary>
                                    <nav aria-label="本页章节目录">
                                        {headings.map(heading => (
                                            <a
                                                className={`toc-level-${heading.level}`}
                                                key={heading.id}
                                                aria-current={activeHeading === heading.id ? 'location' : undefined}
                                                href={documentHref(current.path, heading.id)}
                                                onClick={event => {
                                                    event.currentTarget.closest('details')?.removeAttribute('open')
                                                    document
                                                        .getElementById(heading.id)
                                                        ?.scrollIntoView({block: 'start'})
                                                }}
                                            >
                                                {heading.title}
                                            </a>
                                        ))}
                                    </nav>
                                </details>
                            )}
                            <MarkdownDocument
                                key={current.path}
                                document={current}
                                heading={route.heading}
                                theme={theme}
                                onSourceLink={onSourceLink}
                            />
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
                {current && headings.length > 0 && (
                    <aside className="page-toc">
                        <strong>本页目录</strong>
                        <nav aria-label="章节目录">
                            {headings.map(heading => (
                                <a
                                    className={`toc-level-${heading.level}`}
                                    key={heading.id}
                                    aria-current={activeHeading === heading.id ? 'location' : undefined}
                                    href={documentHref(current.path, heading.id)}
                                    onClick={() =>
                                        document.getElementById(heading.id)?.scrollIntoView({block: 'start'})
                                    }
                                >
                                    {heading.title}
                                </a>
                            ))}
                        </nav>
                    </aside>
                )}
            </div>
            <Search catalog={catalog} dialogRef={search} />
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
                    selected={selectedPath === '' ? catalog.home : selectedPath}
                    revealedDirectory={revealedDirectory}
                    onNavigate={() => mobileNavigation.current?.close()}
                />
            </dialog>
        </>
    )
}
