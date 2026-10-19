import {searchPattern} from './search'

// Ranges leave the Markdown DOM and React-owned code/diagram portals intact.
export function highlightSearch(root: HTMLElement, query: string, heading: string) {
    const pattern = searchPattern(query)
    const ranges: Range[] = []
    const blocks = new Map<Element, Text[]>()
    const matches = new Set<Element>()
    let target: Range | undefined
    const headings = [...root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')]
    const sectionIndex = headings.findIndex(element => element.id === heading)
    const sectionStart = headings[sectionIndex]
    const sectionEnd = headings[sectionIndex + 1]
    const follows = (element: Node, node: Node) =>
        element.contains(node) || !!(element.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            return node.parentElement?.closest('.block-toolbar, .heading-anchor, .code-line-number, svg, button')
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT
        },
    })
    if (pattern) {
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const block =
                node.parentElement!.closest('h1,h2,h3,h4,h5,h6,p,li,pre,td,th,dt,dd,summary') || node.parentElement!
            const texts = blocks.get(block) || []
            texts.push(node as Text)
            blocks.set(block, texts)
        }
        for (const [block, nodes] of blocks) {
            const text = nodes.map(node => node.data).join('')
            for (const match of text.matchAll(pattern)) {
                const range = document.createRange()
                const start = match.index
                const end = start + match[0].length
                let offset = 0
                for (const node of nodes) {
                    const next = offset + node.length
                    if (start >= offset && start < next) range.setStart(node, start - offset)
                    if (end > offset && end <= next) {
                        range.setEnd(node, end - offset)
                        break
                    }
                    offset = next
                }
                ranges.push(range)
                matches.add(block)
                if (
                    !target &&
                    (!sectionStart || follows(sectionStart, range.startContainer)) &&
                    (!sectionEnd || !follows(sectionEnd, range.startContainer))
                )
                    target = range
            }
        }
    }
    const native = typeof Highlight !== 'undefined' && !!CSS.highlights
    if (native) CSS.highlights.set('mdsite-search', new Highlight(...ranges))
    for (const block of matches) {
        block.setAttribute('data-search-match', '')
        if (!native) block.classList.add('search-hit')
    }
    return {
        target,
        clear() {
            if (native) CSS.highlights.delete('mdsite-search')
            for (const block of matches) {
                block.removeAttribute('data-search-match')
                block.classList.remove('search-hit')
            }
        },
    }
}
