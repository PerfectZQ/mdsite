import type {Catalog} from '../catalog.ts'
import {adjacentDocuments, documentHref} from './navigation'

export function DocumentPagination({catalog, selected}: {catalog: Catalog; selected: string}) {
    const {previous, next} = adjacentDocuments(catalog, selected)
    if (!previous && !next) return null
    return (
        <nav className="document-pagination" aria-label="同目录文档">
            <div className="pagination-heading">
                <strong>同目录文档</strong>
                <span>按文件名排序</span>
            </div>
            <div className="pagination-links">
                {[
                    {document: previous, label: '上一篇', direction: 'previous'},
                    {document: next, label: '下一篇', direction: 'next'},
                ].map(
                    ({document, label, direction}) =>
                        document && (
                            <a key={direction} className={`pagination-${direction}`} href={documentHref(document.path)}>
                                <span>{label}</span>
                                <strong>{document.title}</strong>
                                <code>{document.path.split('/').at(-1)}</code>
                            </a>
                        ),
                )}
            </div>
        </nav>
    )
}
