import {useEffect, useRef, useState, type CSSProperties} from 'react'
import {CodeBlock} from './CodeBlock'
import {CopyButton} from './CopyButton'
import {Icon} from './Icon'

let diagramID = 0
let renderQueue = Promise.resolve()

export function MermaidDiagram({source, theme}: {source: string; theme: string}) {
    const [svg, setSVG] = useState('')
    const [width, setWidth] = useState(880)
    const [error, setError] = useState(false)
    const [zoom, setZoom] = useState(1)
    const [expanded, setExpanded] = useState(false)
    const dialog = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        let cancelled = false
        setSVG('')
        setError(false)
        // Mermaid shares configuration globally; initialize and render as one queued operation.
        renderQueue = renderQueue.then(async () => {
            if (cancelled) return
            try {
                const mermaid = window.mdsiteMermaid
                if (!mermaid) throw new Error('Mermaid unavailable')
                const dark = theme === 'dark'
                const ink = dark ? '#dce5f3' : '#20324b'
                const paper = dark ? '#1b222d' : '#ffffff'
                const muted = dark ? '#91a3bd' : '#65758c'
                const border = dark ? '#536074' : '#bbc5d2'
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: 'strict',
                    suppressErrorRendering: true,
                    theme: 'base',
                    look: 'classic',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
                    themeVariables: {
                        darkMode: dark,
                        background: paper,
                        primaryColor: dark ? '#242d3b' : '#f2f5f9',
                        primaryTextColor: ink,
                        primaryBorderColor: border,
                        lineColor: muted,
                        secondaryColor: dark ? '#243a37' : '#edf7f3',
                        secondaryTextColor: ink,
                        secondaryBorderColor: border,
                        tertiaryColor: dark ? '#303146' : '#f4f1fb',
                        tertiaryTextColor: ink,
                        tertiaryBorderColor: border,
                        textColor: ink,
                        mainBkg: dark ? '#242d3b' : '#f2f5f9',
                        nodeBorder: border,
                        clusterBkg: dark ? '#202936' : '#f7f9fc',
                        clusterBorder: dark ? '#3b4b61' : '#dce4ef',
                        edgeLabelBackground: paper,
                        titleColor: ink,
                        fontSize: '14px',
                        actorBkg: dark ? '#242d3b' : '#f2f5f9',
                        actorBorder: border,
                        actorTextColor: ink,
                        actorLineColor: border,
                        signalColor: muted,
                        signalTextColor: ink,
                        labelBoxBkgColor: paper,
                        labelBoxBorderColor: border,
                        labelTextColor: ink,
                        loopTextColor: ink,
                        noteBkgColor: dark ? '#303146' : '#f4f1fb',
                        noteTextColor: ink,
                        noteBorderColor: border,
                        activationBkgColor: dark ? '#344b6c' : '#e1eaff',
                        activationBorderColor: border,
                        sequenceNumberColor: paper,
                    },
                    flowchart: {curve: 'rounded', padding: 18, nodeSpacing: 36, rankSpacing: 48},
                    sequence: {actorMargin: 50, boxMargin: 12, noteMargin: 16, messageMargin: 36, mirrorActors: false},
                    themeCSS:
                        '.node rect, .cluster rect { rx: 4px; ry: 4px; } .flowchart-link { stroke-width: 1.4px; }',
                })
                const result = await mermaid.render(`mdsite-diagram-${++diagramID}`, source)
                if (!cancelled) {
                    const image = new DOMParser().parseFromString(result.svg, 'image/svg+xml').documentElement
                    const dimensions = image
                        .getAttribute('viewBox')
                        ?.split(/[\s,]+/)
                        .map(Number)
                    setWidth(dimensions?.[2] || 880)
                    setSVG(result.svg)
                }
            } catch {
                if (!cancelled) setError(true)
            }
        })
        return () => {
            cancelled = true
        }
    }, [source, theme])

    useEffect(() => {
        if (expanded) dialog.current?.showModal()
        else dialog.current?.close()
    }, [expanded])

    const toolbar = (fullscreen: boolean) => (
        <div className="block-toolbar">
            <span className="block-label">
                <Icon name="diagram" />
                Mermaid
            </span>
            <div className="block-actions">
                <button
                    type="button"
                    aria-label="缩小图表"
                    title="缩小"
                    disabled={!svg || zoom <= 0.5}
                    onClick={() => setZoom(value => Math.max(0.5, value - 0.25))}
                >
                    <Icon name="minus" />
                </button>
                <button
                    type="button"
                    className="diagram-scale"
                    aria-label="重置图表缩放"
                    title="重置缩放"
                    disabled={!svg}
                    onClick={() => setZoom(1)}
                >
                    {Math.round(zoom * 100)}%
                </button>
                <button
                    type="button"
                    aria-label="放大图表"
                    title="放大"
                    disabled={!svg || zoom >= 3}
                    onClick={() => setZoom(value => Math.min(3, value + 0.25))}
                >
                    <Icon name="plus" />
                </button>
                <span className="toolbar-divider" />
                <button
                    type="button"
                    aria-label="下载 SVG"
                    title="下载 SVG"
                    disabled={!svg}
                    onClick={() => {
                        const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml;charset=utf-8'}))
                        const link = document.createElement('a')
                        link.href = url
                        link.download = 'diagram.svg'
                        link.click()
                        setTimeout(() => URL.revokeObjectURL(url), 1000)
                    }}
                >
                    <Icon name="download" />
                </button>
                <button
                    type="button"
                    aria-label={fullscreen ? '关闭全屏图表' : '全屏查看图表'}
                    title={fullscreen ? '关闭' : '全屏查看'}
                    onClick={() => setExpanded(!fullscreen)}
                >
                    <Icon name={fullscreen ? 'close' : 'expand'} />
                </button>
            </div>
        </div>
    )
    const canvas = (
        <div className="diagram-canvas" tabIndex={0} aria-label="图表，可滚动查看" aria-busy={!svg && !error}>
            {svg ? (
                <div
                    className="diagram-image"
                    style={{'--diagram-width': `${width}px`, '--diagram-zoom': zoom} as CSSProperties}
                    dangerouslySetInnerHTML={{__html: svg}}
                />
            ) : (
                <p className={error ? 'diagram-error' : 'diagram-loading'} role="status">
                    {error ? '图表语法未能识别，请查看下方源码。' : '正在绘制图表…'}
                </p>
            )}
        </div>
    )
    return (
        <figure className="diagram">
            {toolbar(false)}
            {!expanded && canvas}
            <details className="diagram-source" open={error || undefined}>
                <summary>查看源码</summary>
                <CodeBlock source={source} language="mermaid" />
            </details>
            <dialog
                ref={dialog}
                className="diagram-dialog"
                aria-label="全屏图表"
                onClose={() => setExpanded(false)}
                onClick={event => {
                    if (event.target === event.currentTarget) setExpanded(false)
                }}
            >
                {toolbar(true)}
                {expanded && canvas}
                <div className="diagram-dialog-footer">
                    <span>放大后可滚动查看，按 Esc 关闭</span>
                    <CopyButton text={source} label="复制源码" />
                </div>
            </dialog>
        </figure>
    )
}
