import type { DocumentRecord } from '../catalog.ts'

export function documentHref(path: string, heading = '') {
  return `#/${path.split('/').map(encodeURIComponent).join('/')}${heading ? `?heading=${encodeURIComponent(heading)}` : ''}`
}

export function readRoute() {
  const [encodedPath, query = ''] = window.location.hash.slice(2).split('?')
  try {
    return {
      path: decodeURIComponent(encodedPath || ''),
      heading: new URLSearchParams(query).get('heading') || '',
    }
  } catch {
    return { path: encodedPath, heading: '' }
  }
}

export function searchDocuments(documents: DocumentRecord[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return documents
  return documents
    .flatMap((document) => {
      const title = document.title.toLocaleLowerCase()
      const path = document.path.toLocaleLowerCase()
      const body = document.text.toLocaleLowerCase()
      if (
        !terms.every(
          (term) =>
            title.includes(term) || path.includes(term) || body.includes(term),
        )
      )
        return []
      const score = terms.reduce(
        (sum, term) =>
          sum +
          (title.includes(term) ? 20 : 0) +
          (path.includes(term) ? 10 : 0),
        0,
      )
      return [{ document, score }]
    })
    .sort((left, right) => right.score - left.score)
    .map(({ document }) => document)
}
