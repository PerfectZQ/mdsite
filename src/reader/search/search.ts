import type {DocumentRecord, Heading} from '../../catalog.ts'

function searchTerms(query: string) {
    return [...new Set(query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))]
}

export function searchPattern(query: string) {
    const terms = searchTerms(query).sort((a, b) => b.length - a.length)
    return terms.length
        ? new RegExp(terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi')
        : null
}

export function createSearchIndex(documents: DocumentRecord[]) {
    return documents.flatMap(document => {
        const trail: Heading[] = []
        const trails = new Map<string, string>()
        for (const heading of document.headings) {
            while (trail.length && trail.at(-1)!.level >= heading.level) trail.pop()
            trail.push(heading)
            trails.set(
                heading.id,
                trail
                    .filter(item => item.id !== document.headings[0]?.id)
                    .map(item => item.title)
                    .join(' / '),
            )
        }
        const sections = document.sections.length ? document.sections : [{heading: '', text: ''}]
        return sections.map((section, index) => ({
            document,
            heading: section.heading,
            trail: trails.get(section.heading) || '',
            text: section.text,
            first: index === 0,
            titleTerms: document.title.toLocaleLowerCase(),
            pathTerms: document.path.toLocaleLowerCase(),
            headingTerms: (trails.get(section.heading) || '').toLocaleLowerCase(),
            bodyTerms: section.text.toLocaleLowerCase(),
        }))
    })
}

export function searchSections(index: ReturnType<typeof createSearchIndex>, query: string) {
    const terms = searchTerms(query)
    if (!terms.length) return index.filter(entry => entry.first)
    return index
        .flatMap(entry => {
            const {titleTerms: title, pathTerms: path, headingTerms: heading, bodyTerms: body} = entry
            if (
                !terms.every(
                    term =>
                        title.includes(term) || path.includes(term) || heading.includes(term) || body.includes(term),
                )
            )
                return []
            const contentMatch = terms.some(term => heading.includes(term) || body.includes(term))
            // A title/path-only match is one document result, not one result per section.
            if (!contentMatch && !entry.first) return []
            const score = terms.reduce(
                (sum, term) =>
                    sum +
                    (title.includes(term) ? 20 : 0) +
                    (heading.includes(term) ? 15 : 0) +
                    (path.includes(term) ? 10 : 0) +
                    (body.includes(term) ? 1 : 0),
                0,
            )
            return [{entry, score}]
        })
        .sort((left, right) => right.score - left.score)
        .map(({entry}) => entry)
}

export function searchExcerpt(text: string, query: string) {
    const match = searchPattern(query)?.exec(text)
    const start = Math.max(0, (match?.index || 0) - 35)
    const end = Math.min(text.length, start + 150)
    return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}
