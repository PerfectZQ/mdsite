import {useEffect} from 'react'
import type {Heading} from '../catalog.ts'
import {documentHref} from './navigation'
import {Icon} from './Icon'
import {useDismissibleDetails} from './useDismissibleDetails'

type OutlineProps = {path: string; headings: Heading[]; activeHeading: string}

function ChapterLinks({path, headings, activeHeading, onNavigate}: OutlineProps & {onNavigate?: () => void}) {
    return (
        <nav aria-label="本页章节">
            {headings.map(heading => (
                <a
                    className={`toc-level-${heading.level}`}
                    key={heading.id}
                    aria-current={activeHeading === heading.id ? 'location' : undefined}
                    href={documentHref(path, heading.id)}
                    onClick={event => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                        onNavigate?.()
                        const target = document.getElementById(heading.id)
                        if (target) {
                            target.tabIndex = -1
                            target.focus({preventScroll: true})
                            target.scrollIntoView({block: 'start'})
                        }
                    }}
                >
                    {heading.title}
                </a>
            ))}
        </nav>
    )
}

export function PageOutline(props: OutlineProps) {
    if (!props.headings.length) return null
    return (
        <aside className="page-toc">
            <strong>本页章节</strong>
            <ChapterLinks {...props} />
        </aside>
    )
}

export function MobileChapters(props: OutlineProps) {
    const details = useDismissibleDetails()
    useEffect(() => {
        const viewport = matchMedia('(min-width: 1281px)')
        const close = () => {
            if (viewport.matches) details.current?.removeAttribute('open')
        }
        viewport.addEventListener('change', close)
        return () => viewport.removeEventListener('change', close)
    }, [])
    if (!props.headings.length) return null
    const current = props.headings.find(heading => heading.id === props.activeHeading) || props.headings[0]
    return (
        <div className="reading-bar">
            <details className="mobile-chapters" ref={details}>
                <summary aria-label={`本页章节，当前：${current.title}`}>
                    <span>本页章节</span>
                    <strong>{current.title}</strong>
                    <Icon name="chevron" />
                </summary>
                <ChapterLinks
                    {...props}
                    onNavigate={() => {
                        details.current!.open = false
                    }}
                />
            </details>
        </div>
    )
}
