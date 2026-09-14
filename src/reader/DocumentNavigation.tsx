import {useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent} from 'react'
import {documentHref} from './navigation'
import {Icon} from './Icon'
import type {Catalog} from '../catalog.ts'

interface Entry {
    path: string
    name: string
    folder: boolean
    children: Entry[]
}

function directoryTree(paths: string[]) {
    const root: Entry = {path: '', name: '', folder: true, children: []}
    for (const path of [...new Set(paths)].sort((a, b) => a.localeCompare(b, 'en'))) {
        const parts = path.split('/')
        let parent = root
        parts.forEach((name, index) => {
            let entry = parent.children.find(child => child.name === name)
            if (!entry) {
                entry = {
                    path: parts.slice(0, index + 1).join('/'),
                    name,
                    folder: index < parts.length - 1,
                    children: [],
                }
                parent.children.push(entry)
            }
            parent = entry
        })
    }
    return root
}

function ancestors(path: string) {
    const parts = path.split('/')
    return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))
}

export function Navigation({
    catalog,
    selected,
    revealedDirectory,
    onNavigate = () => {},
}: {
    catalog: Catalog
    selected: string
    revealedDirectory: {path: string} | null
    onNavigate?: () => void
}) {
    const navigation = useRef<HTMLElement>(null)
    const revealFocus = useRef('')
    const [open, setOpen] = useState(() => new Set(ancestors(selected)))
    const [focused, setFocused] = useState(selected)
    const directory = useMemo(
        () => directoryTree([...catalog.documents.map(document => document.path), ...Object.keys(catalog.aliases)]),
        [catalog],
    )
    const rows: (Entry & {depth: number; position: number; size: number})[] = []
    const visit = (parent: Entry, depth: number) => {
        const children = [...parent.children].sort((a, b) => Number(b.folder) - Number(a.folder))
        children.forEach((entry, index) => {
            rows.push({...entry, depth, position: index + 1, size: children.length})
            if (entry.folder && open.has(entry.path)) visit(entry, depth + 1)
        })
    }
    visit(directory, 1)
    const focusPath = rows.some(row => row.path === focused) ? focused : rows[0]?.path

    useEffect(() => {
        setOpen(previous => new Set([...previous, ...ancestors(selected)]))
        setFocused(selected)
    }, [selected])
    useEffect(() => {
        if (!revealedDirectory) return
        const {path} = revealedDirectory
        revealFocus.current = path
        setOpen(previous => new Set([...previous, ...ancestors(path), path]))
        setFocused(path)
    }, [revealedDirectory])
    useEffect(() => {
        if (!revealFocus.current) return
        const frame = requestAnimationFrame(() => {
            const element = [...navigation.current!.querySelectorAll<HTMLElement>('[data-path]')].find(
                row => row.dataset.path === revealFocus.current,
            )
            if (element?.checkVisibility()) {
                element.scrollIntoView({block: 'nearest'})
                element.focus({preventScroll: true})
                revealFocus.current = ''
            }
        })
        return () => cancelAnimationFrame(frame)
    }, [open])

    const toggle = (path: string) =>
        setOpen(previous => {
            const next = new Set(previous)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return next
        })
    const keyboard = (event: KeyboardEvent<HTMLElement>, entry: Entry, index: number) => {
        let next = index
        switch (event.key) {
            case 'ArrowDown':
                next = Math.min(rows.length - 1, index + 1)
                break
            case 'ArrowUp':
                next = Math.max(0, index - 1)
                break
            case 'Home':
                next = 0
                break
            case 'End':
                next = rows.length - 1
                break
            case 'ArrowRight':
                if (!entry.folder) return
                if (!open.has(entry.path)) toggle(entry.path)
                else next = Math.min(rows.length - 1, index + 1)
                break
            case 'ArrowLeft':
                if (entry.folder && open.has(entry.path)) toggle(entry.path)
                else {
                    const parent = ancestors(entry.path).at(-1)
                    const parentIndex = rows.findIndex(row => row.path === parent)
                    if (parentIndex >= 0) next = parentIndex
                }
                break
            case ' ':
            case 'Enter':
                if (entry.folder) toggle(entry.path)
                else {
                    window.location.hash = documentHref(entry.path)
                    onNavigate()
                }
                break
            default:
                return
        }
        event.preventDefault()
        const path = rows[next]?.path
        if (path) {
            setFocused(path)
            navigation.current?.querySelectorAll<HTMLElement>('[role="treeitem"]')[next]?.focus()
        }
    }
    return (
        <nav ref={navigation} aria-label="文档导航">
            <div className="tree-heading">
                <a className="root-directory" href="#/" onClick={onNavigate} title={catalog.rootName}>
                    <Icon name="folder" />
                    <span>{catalog.rootName}</span>
                </a>
                <button
                    className="tree-collapse"
                    title="折叠所有目录"
                    aria-label="折叠所有目录"
                    onClick={() => {
                        setOpen(new Set())
                        setFocused(directory.children[0]?.path || '')
                    }}
                >
                    <Icon name="collapse" />
                </button>
            </div>
            <div className="nav-tree" role="tree" aria-label="项目文件">
                {rows.map((entry, index) => {
                    const props = {
                        className: `tree-row${entry.folder ? ' tree-folder' : ' tree-file'}`,
                        role: 'treeitem',
                        'aria-level': entry.depth,
                        'aria-posinset': entry.position,
                        'aria-setsize': entry.size,
                        'aria-selected': selected === entry.path,
                        tabIndex: focusPath === entry.path ? 0 : -1,
                        'data-path': entry.path,
                        title: entry.path,
                        style: {'--depth': entry.depth - 1} as CSSProperties,
                        onFocus: () => setFocused(entry.path),
                        onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboard(event, entry, index),
                    }
                    const content = (
                        <>
                            <span className="tree-indent" aria-hidden="true">
                                {Array.from({length: entry.depth - 1}, (_, index) => (
                                    <i key={index} />
                                ))}
                            </span>
                            <span className="tree-chevron">{entry.folder && <Icon name="chevron" />}</span>
                            <Icon name={entry.folder ? 'folder' : 'markdown'} />
                            <span className="tree-name">{entry.name}</span>
                        </>
                    )
                    return entry.folder ? (
                        <button
                            {...props}
                            type="button"
                            key={entry.path}
                            aria-expanded={open.has(entry.path)}
                            onClick={() => toggle(entry.path)}
                        >
                            {content}
                        </button>
                    ) : (
                        <a
                            {...props}
                            key={entry.path}
                            href={documentHref(entry.path)}
                            aria-current={selected === entry.path ? 'page' : undefined}
                            onClick={onNavigate}
                        >
                            {content}
                        </a>
                    )
                })}
            </div>
        </nav>
    )
}
