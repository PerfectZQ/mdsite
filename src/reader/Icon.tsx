const paths = {
    chevron: 'm9 5 7 7-7 7',
    folder: 'M3 7V5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z',
    markdown: 'M5 3h9l5 5v13H5Z M14 3v5h5 M8 17v-5l2 3 2-3v5 M16 12v5m-2-2 2 2 2-2',
    copy: 'M9 9h11v11H9Z M15 5V3H3v12h2',
    check: 'm5 12 4 4L19 6',
    wrap: 'M3 6h18 M3 11h14a4 4 0 0 1 0 8h-5m3-3-3 3 3 3 M3 16h4',
    diagram: 'M9 3h6v6H9Z M3 16h6v5H3Z M15 16h6v5h-6Z M12 9v4M6 16v-3h12v3',
    expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    close: 'm6 6 12 12M6 18 18 6',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    minus: 'M5 12h14',
    plus: 'M5 12h14M12 5v14',
    collapse: 'M4 4h12v12H4Z M8 20h12V8 M7 10h6',
    link: 'm10 13 4-4 M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
} as const

export function Icon({name}: {name: keyof typeof paths}) {
    return (
        <svg
            className={`icon icon-${name}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d={paths[name]} />
        </svg>
    )
}
