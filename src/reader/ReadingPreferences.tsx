import {useLayoutEffect, useRef, useState} from 'react'

const sizes = {compact: '紧凑', comfortable: '舒适', large: '大字'} as const
const widths = {standard: '标准', narrow: '窄栏'} as const
type Preferences = {size: keyof typeof sizes; width: keyof typeof widths}
const defaults: Preferences = {size: 'compact', width: 'standard'}

function readPreferences(): Preferences {
    try {
        const saved = JSON.parse(localStorage.getItem('mdsite-reading') || '{}')
        return {
            size: Object.hasOwn(sizes, saved?.size) ? saved.size : defaults.size,
            width: Object.hasOwn(widths, saved?.width) ? saved.width : defaults.width,
        }
    } catch {
        return defaults
    }
}

export function ReadingPreferences() {
    const [preferences, setPreferences] = useState(readPreferences)
    const dialog = useRef<HTMLDialogElement>(null)
    useLayoutEffect(() => {
        document.documentElement.dataset.readingSize = preferences.size
        document.documentElement.dataset.readingWidth = preferences.width
        try {
            localStorage.setItem('mdsite-reading', JSON.stringify(preferences))
        } catch {
            /* Reading preferences also work without browser storage. */
        }
    }, [preferences])
    return (
        <>
            <button
                className="reading-settings-trigger"
                aria-label="阅读设置"
                title="阅读设置"
                onClick={() => dialog.current?.showModal()}
            >
                Aa
            </button>
            <dialog
                ref={dialog}
                className="reading-settings"
                aria-labelledby="reading-settings-title"
                onClick={event => {
                    if (event.target === event.currentTarget) event.currentTarget.close()
                }}
            >
                <div className="dialog-heading">
                    <h2 id="reading-settings-title">阅读设置</h2>
                    <button onClick={() => dialog.current?.close()} aria-label="关闭阅读设置">
                        关闭 ×
                    </button>
                </div>
                <fieldset>
                    <legend>字号</legend>
                    <div className="reading-options">
                        {Object.entries(sizes).map(([size, label]) => (
                            <label key={size}>
                                <input
                                    type="radio"
                                    name="reading-size"
                                    value={size}
                                    checked={preferences.size === size}
                                    onChange={() => setPreferences({...preferences, size: size as Preferences['size']})}
                                />
                                <span>{label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                <fieldset>
                    <legend>正文行宽</legend>
                    <div className="reading-options">
                        {Object.entries(widths).map(([width, label]) => (
                            <label key={width}>
                                <input
                                    type="radio"
                                    name="reading-width"
                                    value={width}
                                    checked={preferences.width === width}
                                    onChange={() =>
                                        setPreferences({...preferences, width: width as Preferences['width']})
                                    }
                                />
                                <span>{label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                <button className="reset-reading" onClick={() => setPreferences(defaults)}>
                    恢复默认
                </button>
            </dialog>
        </>
    )
}
