import {useEffect, useRef, useState} from 'react'
import {Icon} from './Icon'

export function CopyButton({
    text,
    label = '复制',
    icon = 'copy',
}: {
    text: string | (() => string)
    label?: string
    icon?: 'copy' | 'link'
}) {
    const [status, setStatus] = useState('')
    const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => () => clearTimeout(timeout.current), [])
    return (
        <button
            type="button"
            className="copy-button"
            title={status === '复制失败' ? '请选中内容后手动复制' : label}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(typeof text === 'function' ? text() : text)
                    setStatus('已复制')
                } catch {
                    setStatus('复制失败')
                }
                clearTimeout(timeout.current)
                timeout.current = setTimeout(() => setStatus(''), 2200)
            }}
        >
            <Icon name={status === '已复制' ? 'check' : icon} />
            <span aria-live="polite">{status || label}</span>
        </button>
    )
}
