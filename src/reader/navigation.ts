import type {Catalog} from '../catalog.ts'

export interface DocumentRoute {
    path: string
    heading: string
    query: string
}

export function readingOffset() {
    return ['.topbar', '.reading-bar', '.search-context'].reduce(
        (offset, selector) => offset + (document.querySelector(selector)?.getBoundingClientRect().height || 0),
        26,
    )
}

export function documentHref(path: string, heading = '', query = '') {
    const params = new URLSearchParams()
    if (heading) params.set('heading', heading)
    if (query.trim()) params.set('q', query.trim())
    return `#/${path.split('/').map(encodeURIComponent).join('/')}${params.size ? `?${params}` : ''}`
}

export function readRoute(): DocumentRoute {
    const [encodedPath, query = ''] = window.location.hash.slice(2).split('?')
    try {
        return {
            path: decodeURIComponent(encodedPath || ''),
            heading: new URLSearchParams(query).get('heading') || '',
            query: new URLSearchParams(query).get('q') || '',
        }
    } catch {
        return {path: encodedPath, heading: '', query: ''}
    }
}

export function comparePaths(left: string, right: string) {
    return left.localeCompare(right, 'en')
}

export function adjacentDocuments(catalog: Catalog, selected: string) {
    const directory = (path: string) => path.slice(0, path.lastIndexOf('/') + 1)
    const documents = new Map(catalog.documents.map(document => [document.path, document]))
    const siblings = [...new Set([...documents.keys(), ...Object.keys(catalog.aliases)])]
        .filter(path => directory(path) === directory(selected))
        .sort(comparePaths)
        .map(path => ({path, title: documents.get(catalog.aliases[path] || path)!.title}))
    const index = siblings.findIndex(document => document.path === selected)
    return {previous: index > 0 ? siblings[index - 1] : undefined, next: index >= 0 ? siblings[index + 1] : undefined}
}
