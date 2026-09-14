#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createPage } from './site.ts'
import { createPreview } from './preview.ts'

const help = `mdsite — Markdown 所在的目录，就是文档目录。

  mdsite serve [目录] [选项]  本地预览，刷新时读取最新文件
  mdsite build [目录] [选项]  生成可离线打开的静态 HTML
  mdsite version            查看版本

选项：
  --title 名称    默认使用项目目录名
  --exclude 路径  排除相对路径，以逗号分隔
  --addr 地址     预览监听地址，默认 127.0.0.1:6060
  -o, --output    构建输出，默认 dist/index.html
  -h, --help      显示帮助

默认读取当前目录，自动应用根目录的 .mdignore。
生成的页面包含 UI、文档和本地图片，可由任意静态服务器托管或嵌入业务服务。`

async function run(args: string[]) {
  const [command, ...rest] = args
  if (!command || ['help', '--help', '-h'].includes(command)) {
    console.log(help)
    return
  }
  if (command === 'version' || command === '--version') {
    if (rest.length) throw new Error('version 不接受其他参数')
    const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
    console.log(`mdsite ${version}`)
    return
  }
  if (command !== 'build' && command !== 'serve') throw new Error(`未知命令 ${command}，运行 mdsite --help 查看用法`)
  const { values, positionals } = parseArgs({
    args: rest, allowPositionals: true, options: {
      title: { type: 'string' }, exclude: { type: 'string' }, help: { type: 'boolean', short: 'h' },
      output: { type: 'string', short: 'o' }, addr: { type: 'string' },
    },
  })
  if (values.help) {
    console.log(help)
    return
  }
  if (positionals.length > 1) throw new Error('只接受一个文档目录')
  if (command === 'serve' && values.output !== undefined) throw new Error('--output 仅用于 build')
  if (command === 'build' && values.addr !== undefined) throw new Error('--addr 仅用于 serve')
  const directory = resolve(positionals[0] || '.')
  const options = { title: values.title, exclude: values.exclude?.split(',') }
  if (command === 'build') {
    const output = resolve(values.output ?? 'dist/index.html')
    if (!['.html', '.htm'].includes(extname(output).toLowerCase())) throw new Error('输出必须使用 .html 或 .htm 文件，不能覆盖 Markdown')
    const page = await createPage(directory, options)
    await mkdir(dirname(output), { recursive: true })
    const stage = await mkdtemp(join(dirname(output), '.mdsite-'))
    try {
      const file = join(stage, 'index.html')
      await writeFile(file, page, { mode: 0o644 })
      await rename(file, output)
    } finally {
      await rm(stage, { recursive: true, force: true })
    }
    console.log(`已生成 ${output}（${(Buffer.byteLength(page) / 1024 / 1024).toFixed(2)} MB）`)
    return
  }
  const address = values.addr ?? '127.0.0.1:6060'
  const match = /^(\[[\da-f:]+\]|[^/:\s]+):(\d+)$/i.exec(address)
  if (!match || Number(match[2]) > 65535) throw new Error('监听地址应为 host:port，例如 127.0.0.1:6060')
  await createPage(directory, options)
  const server = createPreview(directory, options)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(Number(match[2]), match[1].replace(/^\[|\]$/g, ''), () => {
      server.off('error', reject)
      resolve()
    })
  })
  const bound = server.address()
  console.log(`文档预览：http://${match[1]}:${typeof bound === 'object' && bound ? bound.port : match[2]}\n目录：${directory}\n修改 Markdown 或 .mdignore 后刷新页面即可。`)
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      server.close()
      server.closeAllConnections()
    })
  }
}

run(process.argv.slice(2)).catch(error => {
  console.error(`mdsite: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
