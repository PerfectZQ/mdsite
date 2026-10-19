import {useEffect, useRef} from 'react'

export function useDismissibleDetails() {
    const ref = useRef<HTMLDetailsElement>(null)
    useEffect(() => {
        const closeOutside = (event: Event) => {
            if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute('open')
        }
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || !ref.current?.open) return
            event.preventDefault()
            ref.current.open = false
            ref.current.querySelector('summary')?.focus()
        }
        const close = () => ref.current?.removeAttribute('open')
        document.addEventListener('pointerdown', closeOutside)
        document.addEventListener('focusin', closeOutside)
        document.addEventListener('keydown', escape)
        window.addEventListener('hashchange', close)
        return () => {
            document.removeEventListener('pointerdown', closeOutside)
            document.removeEventListener('focusin', closeOutside)
            document.removeEventListener('keydown', escape)
            window.removeEventListener('hashchange', close)
        }
    }, [])
    return ref
}
