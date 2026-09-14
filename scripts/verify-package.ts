import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

const input = process.argv[2]
if (!input) throw new Error('用法：node scripts/verify-package.ts <本地 .tgz 或公网 URL>')
const source = /^https?:\/\//.test(input) ? input : resolve(input)
const expected = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const sandbox = await mkdtemp(join(tmpdir(), 'mdsite-package-'))

try {
  await writeFile(join(sandbox, '.npmrc'), '')
  execFileSync('npm', ['install', '--prefix', sandbox, '--ignore-scripts', '--omit=dev', '--no-package-lock', '--no-audit', '--no-fund', source], {
    cwd: sandbox, stdio: 'inherit',
    env: { ...process.env, npm_config_userconfig: join(sandbox, '.npmrc'), npm_config_cache: join(sandbox, 'cache') },
  })
  const installed = join(sandbox, 'node_modules', expected.name)
  const pkg = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'))
  assert.equal(pkg.version, expected.version)
  assert.equal(pkg.bin.mdsite, 'dist/cli.js')
  const cli = join(installed, pkg.bin.mdsite)
  const run = (args: string[]) => execFileSync(process.execPath, [cli, ...args], { cwd: sandbox, encoding: 'utf8' })
  assert.equal(run(['version']).trim(), `mdsite ${expected.version}`)
  for (const file of ['README.md', 'getstart.md', 'CONTRIBUTING.md']) await readFile(join(installed, file))

  await mkdir(join(sandbox, 'content'))
  await writeFile(join(sandbox, 'content/README.md'), '# Package check\n\n独立安装验证\n\n```mermaid\ngraph LR\nA-->B\n```\n')
  run(['build', 'content', '-o', 'public/docs/index.html'])
  const page = await readFile(join(sandbox, 'public/docs/index.html'), 'utf8')
  const catalog = JSON.parse(page.split('<script id="documentation" type="application/json">')[1].split('</script>')[0])
  assert.equal(catalog.documents[0].title, 'Package check')
  assert.match(page, /mdsiteMermaid=/)

  const server = spawn(process.execPath, [cli, 'serve', 'content', '--addr', '127.0.0.1:0'], { cwd: sandbox, stdio: ['ignore', 'pipe', 'inherit'] })
  const exited = once(server, 'exit')
  const lines = createInterface({ input: server.stdout })
  const timeout = setTimeout(() => server.kill('SIGKILL'), 15_000)
  try {
    let address = ''
    for await (const line of lines) {
      const match = /http:\/\/127\.0\.0\.1:\d+/.exec(line)
      if (match) { address = match[0]; break }
    }
    assert.ok(address, 'Preview did not start')
    const response = await fetch(address, { signal: AbortSignal.timeout(5_000) })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), page)
    console.log(`mdsite ${pkg.version}: installed package version/build/serve and bundled UI verified`)
  } finally {
    server.kill('SIGTERM')
    await exited
    clearTimeout(timeout)
    lines.close()
  }
} finally {
  await rm(sandbox, { recursive: true, force: true })
}
