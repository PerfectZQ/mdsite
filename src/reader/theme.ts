import {useEffect, useState} from 'react'

export function useTheme() {
    const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light')
    useEffect(() => {
        const media = matchMedia('(prefers-color-scheme: dark)')
        const change = () => {
            try {
                if (localStorage.getItem('mdsite-theme')) return
            } catch {
                /* Storage is optional. */
            }
            const next = media.matches ? 'dark' : 'light'
            document.documentElement.dataset.theme = next
            setTheme(next)
        }
        media.addEventListener('change', change)
        return () => media.removeEventListener('change', change)
    }, [])
    const toggle = () => {
        const next = theme === 'dark' ? 'light' : 'dark'
        document.documentElement.dataset.theme = next
        try {
            localStorage.setItem('mdsite-theme', next)
        } catch {
            /* Storage is optional. */
        }
        setTheme(next)
    }
    return {theme, toggle}
}
