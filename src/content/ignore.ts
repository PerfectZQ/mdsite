import {lstat, readFile} from 'node:fs/promises'
import {join} from 'node:path'
import ignore from 'ignore'

const defaults = [
    '.git',
    '.hg',
    '.svn',
    '.codegraph',
    'node_modules',
    'vendor',
    'dist',
    'output',
    '.next',
    '.venv',
    'venv',
    '__pycache__',
]

export async function readIgnore(root: string, exclude: string[] = []) {
    const rules = ignore().add(defaults)
    const file = join(root, '.mdignore')
    try {
        const info = await lstat(file)
        if (!info.isFile()) throw new Error('.mdignore 必须是普通文件，不能是目录或符号链接')
        rules.add((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const excluded = exclude
        .map(path =>
            path
                .trim()
                .replaceAll('\\', '/')
                .replace(/^\.\//, '')
                .replace(/^\/+|\/+$/g, ''),
        )
        .filter(Boolean)
    return (name: string, directory = false) =>
        excluded.some(path => name === path || name.startsWith(`${path}/`)) ||
        rules.ignores(directory ? `${name}/` : name)
}

export type Ignore = Awaited<ReturnType<typeof readIgnore>>
