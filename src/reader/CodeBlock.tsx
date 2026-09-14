import {useMemo, useState} from 'react'
import highlight from 'highlight.js/lib/common'
import {CopyButton} from './CopyButton'
import {Icon} from './Icon'

// Preserve token spans across lines, including multiline comments and strings.
function codeLines(source: string, language: string) {
    source = source.replace(/\n$/, '')
    const html = highlight.getLanguage(language)
        ? highlight.highlight(source, {language, ignoreIllegals: true}).value
        : source.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    const spans: string[] = []
    const lines = ['']
    for (const part of html.split(/(<span[^>]*>|<\/span>|\n)/)) {
        if (part === '\n') {
            lines[lines.length - 1] += '</span>'.repeat(spans.length)
            lines.push(spans.join(''))
        } else {
            if (part.startsWith('<span')) spans.push(part)
            else if (part === '</span>') spans.pop()
            lines[lines.length - 1] += part
        }
    }
    return lines
}

export function CodeBlock({source, language = ''}: {source: string; language?: string}) {
    const [wrap, setWrap] = useState(false)
    const lines = useMemo(() => codeLines(source, language), [source, language])
    const name = highlight.getLanguage(language)?.name || language || 'Text'
    return (
        <div className={`code-block${wrap ? ' code-wrap' : ''}`}>
            <div className="block-toolbar">
                <span className="block-label">{name}</span>
                <div className="block-actions">
                    <button
                        type="button"
                        aria-label="自动换行"
                        aria-pressed={wrap}
                        title="自动换行"
                        onClick={() => setWrap(!wrap)}
                    >
                        <Icon name="wrap" />
                    </button>
                    <CopyButton text={source} label="复制代码" />
                </div>
            </div>
            <pre tabIndex={0} aria-label={`${name} 代码`}>
                <code className="hljs">
                    {lines.map((line, index) => (
                        <span className="code-line" key={index}>
                            <span className="code-line-number" data-line={index + 1} aria-hidden="true" />
                            <span className="code-line-content" dangerouslySetInnerHTML={{__html: line}} />
                            {index < lines.length - 1 ? '\n' : ''}
                        </span>
                    ))}
                </code>
            </pre>
        </div>
    )
}
