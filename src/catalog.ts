export interface Heading {
    id: string
    title: string
    level: number
}

export interface DocumentRecord {
    path: string
    title: string
    summary: string
    html: string
    headings: Heading[]
    text: string
    words: number
    source: string
}

export interface Catalog {
    title: string
    rootName: string
    home: string
    aliases: Record<string, string>
    documents: DocumentRecord[]
}
