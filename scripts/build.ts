import {build} from 'esbuild'
import {chmod, mkdir, readFile, writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const output = new URL('../dist/assets/', import.meta.url)
await mkdir(output, {recursive: true})
for (const [name, entry] of [
    ['site', 'main.tsx'],
    ['mermaid', 'mermaid.ts'],
]) {
    await build({
        absWorkingDir: root,
        entryPoints: [`src/reader/${entry}`],
        outfile: `dist/assets/${name}.js`,
        bundle: true,
        format: 'iife',
        minify: true,
        legalComments: 'inline',
        target: ['es2022'],
        supported: {'template-literal': false},
        define: {'process.env.NODE_ENV': '"production"'},
    })
}
const licenses = await Promise.all(
    ['react', 'react-dom', 'mermaid', 'highlight.js'].map(async name => {
        const text = await readFile(new URL(`../node_modules/${name}/LICENSE`, import.meta.url), 'utf8')
        return `${name}\n${text}`
    }),
)
await writeFile(new URL('LICENSES.txt', output), licenses.join('\n\n'))
await chmod(new URL('../dist/cli.js', import.meta.url), 0o755)
