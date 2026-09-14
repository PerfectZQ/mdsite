import {readFile, readdir, realpath, stat} from 'node:fs/promises'
import {basename, extname, join} from 'node:path'
import type {Catalog} from '../catalog.ts'
import {resolveFile} from './files.ts'
import {readIgnore} from './ignore.ts'
import {renderMarkdown} from './markdown.ts'

export interface ScanOptions {
    title?: string
    exclude?: string[]
}

export async function scan(directory: string, options: ScanOptions = {}): Promise<Catalog> {
    const root = await realpath(directory)
    if (!(await stat(root)).isDirectory()) throw new Error(`不是目录：${directory}`)
    const ignored = await readIgnore(root, options.exclude)
    const sources = new Map<string, string>()
    const aliases: Record<string, string> = Object.create(null)

    async function walk(directory: string) {
        const entries = await readdir(join(root, directory), {withFileTypes: true})
        entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        for (const entry of entries) {
            const name = directory ? `${directory}/${entry.name}` : entry.name
            if (ignored(name, entry.isDirectory())) continue
            if (entry.isDirectory()) {
                await walk(name)
                continue
            }
            if (extname(name).toLowerCase() !== '.md') continue
            let target: string
            try {
                target = await resolveFile(root, name)
            } catch (error) {
                if (entry.isSymbolicLink()) continue
                throw error
            }
            if (ignored(target)) continue
            if (target !== name) aliases[name] = target
            if (!sources.has(target)) sources.set(target, await readFile(join(root, target), 'utf8'))
        }
    }

    await walk('')
    const known = new Set(sources.keys())
    const documents = []
    for (const path of [...known].sort()) {
        documents.push(await renderMarkdown(root, path, sources.get(path)!, known, aliases, ignored))
    }
    const home =
        documents.find(document => document.path.toLowerCase() === 'readme.md')?.path ?? documents[0]?.path ?? ''
    const title = options.title || basename(root) || '文档'
    return {title, rootName: title, home, aliases, documents}
}
