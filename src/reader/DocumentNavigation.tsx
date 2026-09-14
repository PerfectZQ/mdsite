import {useEffect, useMemo, useRef, useState} from 'react'
import {documentHref} from './navigation'
import type {Catalog} from '../catalog.ts'

interface Directory {
    path: string
    name: string
    folders: Map<string, Directory>
    files: string[]
}

function directoryTree(paths: string[]) {
    const root: Directory = {path: '', name: '', folders: new Map(), files: []}
    for (const path of paths.sort((left, right) => left.localeCompare(right, 'en'))) {
        const parts = path.split('/')
        parts.pop()
        let current = root
        for (const name of parts) {
            if (!current.folders.has(name)) {
                current.folders.set(name, {
                    name,
                    path: current.path ? `${current.path}/${name}` : name,
                    folders: new Map(),
                    files: [],
                })
            }
            current = current.folders.get(name)!
        }
        current.files.push(path)
    }
    return root
}

type TreeProps = {
    directory: Directory
    selected: string
    revealedDirectory: string
    onNavigate: () => void
}

function Tree({directory, selected, revealedDirectory, onNavigate}: TreeProps) {
    return (
        <ul className="nav-tree">
            {[...directory.folders.values()].map(folder => (
                <Folder
                    key={folder.path}
                    directory={folder}
                    selected={selected}
                    revealedDirectory={revealedDirectory}
                    onNavigate={onNavigate}
                />
            ))}
            {directory.files.map(path => (
                <li key={path}>
                    <a
                        href={documentHref(path)}
                        title={path}
                        aria-current={selected === path ? 'page' : undefined}
                        onClick={onNavigate}
                    >
                        <span className="file-mark" aria-hidden="true">
                            ▤
                        </span>
                        <span>{path.split('/').at(-1)}</span>
                    </a>
                </li>
            ))}
        </ul>
    )
}

function Folder(props: TreeProps) {
    const {directory, selected, revealedDirectory} = props
    const active =
        selected.startsWith(`${directory.path}/`) ||
        revealedDirectory === directory.path ||
        revealedDirectory.startsWith(`${directory.path}/`)
    const [open, setOpen] = useState(active)
    useEffect(() => {
        if (active) setOpen(true)
    }, [active, selected, revealedDirectory])
    return (
        <li>
            <details open={open} onToggle={event => setOpen(event.currentTarget.open)}>
                <summary className="folder-name" data-directory-path={directory.path}>
                    {directory.name}/
                </summary>
                <Tree {...props} />
            </details>
        </li>
    )
}

export function Navigation({
    catalog,
    selected,
    revealedDirectory,
    onNavigate = () => {},
}: {
    catalog: Catalog
    selected: string
    revealedDirectory: string
    onNavigate?: () => void
}) {
    const navigation = useRef<HTMLElement>(null)
    const directory = useMemo(
        () => directoryTree([...catalog.documents.map(document => document.path), ...Object.keys(catalog.aliases)]),
        [catalog],
    )
    useEffect(() => {
        if (!revealedDirectory) return
        // 目录链接只展开真实文件树，不生成第二套目录首页。
        const frame = requestAnimationFrame(() => {
            if (!navigation.current?.checkVisibility()) return
            const folder = [...navigation.current.querySelectorAll<HTMLElement>('[data-directory-path]')].find(
                element => element.dataset.directoryPath === revealedDirectory,
            )
            folder?.scrollIntoView({block: 'nearest'})
            folder?.focus({preventScroll: true})
        })
        return () => cancelAnimationFrame(frame)
    }, [revealedDirectory])
    return (
        <nav ref={navigation} aria-label="文档导航">
            <a className="root-directory" href="#/" onClick={onNavigate}>
                {catalog.rootName}/
            </a>
            <Tree
                directory={directory}
                selected={selected}
                revealedDirectory={revealedDirectory}
                onNavigate={onNavigate}
            />
        </nav>
    )
}
