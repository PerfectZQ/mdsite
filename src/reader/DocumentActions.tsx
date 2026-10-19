import {CopyButton} from './CopyButton'
import {Icon} from './Icon'
import {useDismissibleDetails} from './useDismissibleDetails'
import type {DocumentRecord} from '../catalog.ts'

export function DocumentActions({document, onLocate}: {document: DocumentRecord; onLocate: () => void}) {
    const details = useDismissibleDetails()
    return (
        <details className="document-actions" ref={details}>
            <summary aria-label="文档操作" title="文档操作">
                更多 <Icon name="chevron" />
            </summary>
            <div className="document-actions-panel">
                <code>{document.path}</code>
                <button
                    onClick={() => {
                        details.current!.open = false
                        details.current!.querySelector('summary')?.focus({preventScroll: true})
                        onLocate()
                    }}
                >
                    <Icon name="folder" />
                    定位到目录
                </button>
                <CopyButton text={() => window.location.href} label="复制链接" icon="link" />
                <button
                    onClick={() => {
                        const url = URL.createObjectURL(
                            new Blob([document.source], {type: 'text/markdown;charset=utf-8'}),
                        )
                        const link = window.document.createElement('a')
                        link.href = url
                        link.download = document.path.split('/').at(-1)!
                        link.click()
                        setTimeout(() => URL.revokeObjectURL(url), 1000)
                    }}
                >
                    <Icon name="download" />
                    下载 Markdown
                </button>
            </div>
        </details>
    )
}
