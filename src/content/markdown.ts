import {readFile} from 'node:fs/promises'
import {join, posix} from 'node:path'
import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import deflist from 'markdown-it-deflist'
import taskLists from 'markdown-it-task-lists'
import sanitize from 'sanitize-html'
import {parseFragment, serialize, type DefaultTreeAdapterTypes} from 'parse5'
import type {DocumentRecord, Heading} from '../catalog.ts'
import {resolveFile} from './files.ts'
import type {Ignore} from './ignore.ts'

type Node = DefaultTreeAdapterTypes.Node
type Element = DefaultTreeAdapterTypes.Element

const markdown = new MarkdownIt({html: true, linkify: true}).use(footnote).use(deflist).use(taskLists)
const imageTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
}

function attribute(node: Element, name: string, value?: string): string {
    const existing = node.attrs.find(item => item.name === name)
    if (value === undefined) return existing?.value ?? ''
    if (existing) existing.value = value
    else node.attrs.push({name, value})
    return value
}

function plain(node: Node): string {
    if (node.nodeName === '#text') return (node as DefaultTreeAdapterTypes.TextNode).value
    if (!('childNodes' in node)) return ''
    const text = node.childNodes.map(plain).join('')
    return text + ('tagName' in node && /^(p|li|pre|td|th|br|h[1-6]|dt|dd)$/.test(node.tagName) ? ' ' : '')
}

function localURL(raw: string, from: string) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) return null
    try {
        const [pathAndQuery, fragment = ''] = raw.split('#', 2)
        const path = decodeURIComponent(pathAndQuery.split('?')[0])
        const name =
            (path
                ? path.startsWith('/')
                    ? posix.normalize(path.slice(1))
                    : posix.join(posix.dirname(from), path)
                : from
            ).replace(/\/$/, '') || '.'
        if (name === '..' || name.startsWith('../') || name.includes('\\') || name.includes('\0')) return null
        return {name, heading: decodeURIComponent(fragment), directory: path.endsWith('/')}
    } catch {
        return null
    }
}

export async function renderMarkdown(
    root: string,
    path: string,
    source: string,
    known: Set<string>,
    aliases: Record<string, string>,
    ignored: Ignore,
): Promise<DocumentRecord> {
    const raw = markdown.render(source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, ''))
    const document = parseFragment(
        sanitize(raw, {
            allowedTags: [...sanitize.defaults.allowedTags, 'img', 'input', 'details', 'summary', 'del'],
            allowedAttributes: {
                '*': ['id', 'class'],
                a: ['href', 'title'],
                img: ['src', 'alt', 'title', 'width', 'height'],
                input: ['type', 'checked', 'disabled'],
                th: ['align', 'colspan', 'rowspan'],
                td: ['align', 'colspan', 'rowspan'],
                ol: ['start'],
            },
            allowedSchemesByTag: {img: ['http', 'https', 'data']},
        }),
    )
    const headings: Heading[] = []
    const ids = new Set<string>()
    let summary = ''

    async function visit(node: Node) {
        if ('tagName' in node) {
            if (/^h[1-6]$/.test(node.tagName)) {
                const title = plain(node).trim()
                const base =
                    title
                        .toLowerCase()
                        .replace(/\s/gu, '-')
                        .replace(/[^\p{L}\p{N}_-]/gu, '') || 'section'
                let id = base
                for (let n = 1; ids.has(id); n++) id = `${base}-${n}`
                ids.add(id)
                attribute(node, 'id', id)
                headings.push({id, title, level: Number(node.tagName[1])})
            }
            if (node.tagName === 'a') {
                const href = attribute(node, 'href')
                const target = localURL(href, path)
                if (href && target) {
                    const candidates = [target.name]
                    if (posix.extname(target.name).toLowerCase() === '.html')
                        candidates.push(target.name.replace(/\.html$/i, '.md'))
                    candidates.push(
                        ...[...known].filter(
                            name =>
                                posix.dirname(name) === target.name &&
                                posix.basename(name).toLowerCase() === 'readme.md',
                        ),
                    )
                    const found = candidates.map(name => aliases[name] ?? name).find(name => known.has(name))
                    if (found) {
                        attribute(
                            node,
                            'href',
                            `#/${found.split('/').map(encodeURIComponent).join('/')}${target.heading ? `?heading=${encodeURIComponent(target.heading)}` : ''}`,
                        )
                    } else {
                        attribute(node, 'href', `#source=${encodeURIComponent(target.name)}`)
                        attribute(node, 'data-source-path', target.name)
                        attribute(node, 'data-directory', String(target.directory))
                    }
                } else if (/^(https?:)?\/\//i.test(href)) {
                    attribute(node, 'target', '_blank')
                    attribute(node, 'rel', 'noopener noreferrer')
                }
            }
            if (node.tagName === 'img') {
                const src = attribute(node, 'src')
                const target = localURL(src, path)
                if (target) {
                    node.attrs = node.attrs.filter(item => item.name !== 'src')
                    const mime = imageTypes[posix.extname(target.name).toLowerCase()]
                    if (src && mime && !ignored(target.name)) {
                        try {
                            const resolved = await resolveFile(root, target.name)
                            if (!ignored(resolved))
                                attribute(
                                    node,
                                    'src',
                                    `data:${mime};base64,${(await readFile(join(root, resolved))).toString('base64')}`,
                                )
                        } catch {
                            // Missing or inaccessible images keep their alt text.
                        }
                    }
                }
                attribute(node, 'loading', 'lazy')
            }
            if (node.tagName === 'input') {
                attribute(node, 'type', 'checkbox')
                attribute(node, 'disabled', '')
            }
            if (node.tagName === 'p' && !summary) summary = plain(node).trim()
        }
        if ('childNodes' in node) for (const child of node.childNodes) await visit(child)
    }

    await visit(document)
    const text = plain(document).replace(/\s+/g, ' ').trim()
    return {
        path,
        source,
        html: serialize(document),
        headings,
        text,
        title: headings[0]?.title || posix.basename(path, posix.extname(path)),
        summary: [...summary].slice(0, 150).join(''),
        words: [...text].length,
    }
}
