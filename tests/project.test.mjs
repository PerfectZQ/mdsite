import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rename, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { scan } from '../dist/content/scan.js'
import { createPage } from '../dist/site.js'
import { createPreview } from '../dist/preview.js'

const exec = promisify(execFile)
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))

async function fixture(t, files = {}) {
  const root = await mkdtemp(join(tmpdir(), 'mdsite-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const [name, content] of Object.entries(files)) {
    const file = join(root, name)
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, content)
  }
  return root
}

function catalogFromPage(page) {
  return JSON.parse(page.split('<script id="documentation" type="application/json">')[1].split('</script>')[0])
}

test('project files become a searchable offline page with native paths and Markdown features', async t => {
  const root = await fixture(t, {
    'README.md': '# 示例项目\n\n[指南](docs/guide.md#中文章节) · [目录](internal/mod/) · [HTML](docs/guide.html)\n\n<script>alert("unsafe")</script><img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29)',
    'docs/guide.md': '---\ntitle: metadata\n---\n# 使用指南\n\n## 中文章节\n\n可检索的正文。[^note]\n\n## 中文章节\n\n| 名称 | 值 |\n| --- | --- |\n| 配置 | OK |\n\n- [x] 完成\n\n```go\nfmt.Println("hello")\n```\n\n![图](image.svg)\n\n[^note]: 脚注说明\n\n术语\n: 定义内容\n\n<details><summary>展开</summary>详细内容</details>',
    'docs/image.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'internal/mod/readme.MD': '# 模块\n\n模块说明',
    '.feature/plan.md': '# 原生隐藏目录',
    'node_modules/dependency/README.md': '# 排除依赖',
    'private/note.md': '# 按路径排除',
    'src/main.go': 'PRIVATE_SOURCE_NOT_SERVED',
  })
  const page = await createPage(root, { title: '示例项目', exclude: ['private'] })
  const catalog = catalogFromPage(page)
  assert.deepEqual(catalog.documents.map(doc => doc.path), ['.feature/plan.md', 'README.md', 'docs/guide.md', 'internal/mod/readme.MD'])
  assert.equal(catalog.title, '示例项目')
  assert.equal(catalog.home, 'README.md')
  const home = catalog.documents[1].html
  for (const fragment of ['#/docs/guide.md?heading=', '#/internal/mod/readme.MD', '#/docs/guide.md']) assert.ok(home.includes(fragment), fragment)
  assert.doesNotMatch(home, /<script|onerror|(?:href|src)="javascript:|unsafe|PRIVATE_SOURCE_NOT_SERVED/)
  const guide = catalog.documents[2]
  for (const fragment of ['<table>', 'type="checkbox"', 'disabled', 'class="language-go"', 'data:image/svg+xml;base64,', '脚注说明', '<details>', '<dl>']) assert.ok(guide.html.includes(fragment), fragment)
  assert.equal(guide.headings[1].id, '中文章节')
  assert.equal(guide.headings[2].id, '中文章节-1')
  assert.match(guide.text, /可检索的正文/)
  assert.match(guide.html, /id="fn1"/)
  assert.match(guide.html, /\?heading=fn1/)
  assert.doesNotMatch(page, /mdsiteMermaid=/)
  assert.doesNotMatch(page, /<script[^>]+src=|<link[^>]+href=/)
})

test('payload cannot close its script and diagrams include their local renderer', async t => {
  const source = '# Diagram\n\n```html\n</ScRiPt><script>globalThis.injected=true</script>\n```\n\n```mermaid\ngraph LR\nA-->B\n```'
  const root = await fixture(t, { 'README.md': source })
  const page = await createPage(root, { title: '</title><script>alert(1)</script>' })
  assert.equal(catalogFromPage(page).documents[0].source, source)
  assert.match(page, /mdsiteMermaid=/)
  assert.doesNotMatch(page, /<script>globalThis.injected/)
  assert.match(page, /&lt;\/title&gt;&lt;script&gt;/)
})

test('file aliases deduplicate search; directory links and outside links are skipped', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t, { 'README.md': '# Project', 'docs/guide.md': '# Guide' })
  for (const [name, target] of Object.entries({ 'AGENTS.md': 'README.md', linked: 'docs', 'directory-link.md': 'linked/guide.md', 'outside.md': '../outside.md', 'cycle.md': 'cycle.md' })) {
    await symlink(target, join(root, name))
  }
  const catalog = await scan(root)
  assert.deepEqual(catalog.documents.map(doc => doc.path), ['README.md', 'docs/guide.md'])
  assert.deepEqual({ ...catalog.aliases }, { 'AGENTS.md': 'README.md' })
})

test('root ignore rules refresh, support exceptions, and cannot override explicit exclusions', async t => {
  const root = await fixture(t, {
    'README.md': '# Project', 'generated/README.md': '# Kept', 'generated/api.md': 'EXCLUDED_GENERATED_BODY',
    'docs/guide.md': '# Guide', 'docs/.mdignore': 'guide.md', '.gitignore': 'docs/',
    'dist/README.md': '# Reincluded default', 'private/note.md': 'EXCLUDED_PRIVATE_BODY',
    '.mdignore': 'generated/**\n!generated/README.md\n!dist/\n!private/\n',
  })
  const paths = async () => (await scan(root, { exclude: ['private'] })).documents.map(doc => doc.path)
  assert.deepEqual(await paths(), ['README.md', 'dist/README.md', 'docs/guide.md', 'generated/README.md'])
  await writeFile(join(root, '.mdignore'), 'generated/\n!generated/README.md\n')
  assert.deepEqual(await paths(), ['README.md', 'docs/guide.md'])
  await rm(join(root, '.mdignore'))
  assert.deepEqual(await paths(), ['README.md', 'docs/guide.md', 'generated/README.md', 'generated/api.md'])
})

test('ignore rules also protect images and symlink targets', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t, {
    '.mdignore': 'private/\n!private/note.md\n!private/picture.svg',
    'README.md': '# Project\n![direct](private/picture.svg)\n![alias](picture.svg)',
    'private/note.md': 'EXCLUDED_LINK_BODY', 'private/picture.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  })
  await symlink('private/note.md', join(root, 'alias.md'))
  await symlink('private/picture.svg', join(root, 'picture.svg'))
  const page = await createPage(root)
  assert.doesNotMatch(page, /EXCLUDED_LINK_BODY|alias\.md|data:image\/svg\+xml;base64,/)
  await rm(join(root, '.mdignore'))
  await symlink('README.md', join(root, '.mdignore'))
  await assert.rejects(scan(root), /普通文件/)
})

test('empty projects work and missing roots or invalid ignore files fail', async t => {
  const root = await fixture(t)
  assert.deepEqual(catalogFromPage(await createPage(root)).documents, [])
  await assert.rejects(scan(join(root, 'missing')), { code: 'ENOENT' })
  await mkdir(join(root, '.mdignore'))
  await assert.rejects(scan(root), /普通文件/)
})

test('preview refreshes files and ignore rules, and serves only the generated UI', async t => {
  const root = await fixture(t, { 'README.md': '# Before', 'private.md': '# Private', 'src/main.ts': 'SECRET_SOURCE' })
  const server = createPreview(root)
  t.after(() => { server.close(); server.closeAllConnections() })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const url = `http://127.0.0.1:${server.address().port}`
  assert.equal(await (await fetch(url)).text(), await createPage(root))
  for (const [method, path, status] of [['GET', '/', 200], ['HEAD', '/', 200], ['GET', '/index.html', 200], ['GET', '/README.md', 404], ['GET', '/src/main.ts', 404], ['POST', '/', 405]]) {
    const response = await fetch(url + path, { method })
    assert.equal(response.status, status, `${method} ${path}`)
    if (method === 'HEAD') assert.equal(await response.text(), '')
  }
  await writeFile(join(root, 'README.md'), '# After')
  await writeFile(join(root, '.mdignore'), 'private.md')
  const response = await fetch(url)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const catalog = catalogFromPage(await response.text())
  assert.deepEqual(catalog.documents.map(doc => doc.title), ['After'])
  await rm(join(root, 'README.md'))
  assert.deepEqual(catalogFromPage(await (await fetch(url)).text()).documents, [])
})

test('CLI builds outside its package, validates arguments, and preserves previous output on failure', async t => {
  const root = await fixture(t, { 'README.md': '# CLI project', 'existing.html': 'previous output' })
  const run = args => exec(process.execPath, [cli, ...args], { cwd: root })
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal((await run(['version'])).stdout.trim(), `mdsite ${version}`)
  assert.match((await run(['--help'])).stdout, /mdsite build/)
  await run(['build', '.', '--title', 'Custom', '-o', 'nested/docs.html'])
  assert.equal(catalogFromPage(await readFile(join(root, 'nested/docs.html'), 'utf8')).title, 'Custom')
  for (const args of [['build', '.', '-o', 'README.md'], ['build', 'missing', '-o', 'existing.html'], ['build', '.', 'extra'], ['unknown'], ['serve', '--addr', 'invalid'], ['build', '--addr', '127.0.0.1:0']]) {
    await assert.rejects(run(args))
  }
  assert.equal(await readFile(join(root, 'existing.html'), 'utf8'), 'previous output')
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), '# CLI project')
})

test('CLI refreshes changed resources and preserves unchanged output timestamps', async t => {
  const root = await fixture(t, { 'README.md': '# Before\n\n![image](picture.svg)', 'picture.svg': '<svg/>' })
  const output = join(root, 'public/docs/index.html')
  const run = (...options) => exec(process.execPath, [cli, 'build', '.', '-o', output, ...options], { cwd: root })
  const page = () => readFile(output, 'utf8')
  const documents = async () => catalogFromPage(await page()).documents
  await run()
  const original = await page()
  await utimes(output, 1, 1)
  await writeFile(join(root, 'unrelated.ts'), '// Not documentation')
  assert.match((await run()).stdout, /内容未变/)
  assert.equal((await stat(output)).mtimeMs, 1000)

  await writeFile(join(root, 'picture.svg'), '<svg><title>Updated image</title></svg>')
  await run()
  assert.notEqual(await page(), original)
  assert.ok((await documents())[0].html.includes(Buffer.from('<svg><title>Updated image</title></svg>').toString('base64')))
  await writeFile(join(root, 'README.md'), '# After')
  await writeFile(join(root, 'extra.md'), '# Extra')
  await run()
  assert.deepEqual((await documents()).map(doc => doc.title), ['After', 'Extra'])
  await rename(join(root, 'extra.md'), join(root, 'moved.md'))
  await run()
  assert.deepEqual((await documents()).map(doc => doc.path), ['README.md', 'moved.md'])
  await writeFile(join(root, '.mdignore'), 'moved.md')
  await run()
  assert.deepEqual((await documents()).map(doc => doc.path), ['README.md'])
  await rm(join(root, '.mdignore'))
  await rm(join(root, 'moved.md'))
  await run('--title', 'Changed title')
  const expected = await page()
  assert.equal(catalogFromPage(expected).title, 'Changed title')
  assert.deepEqual((await documents()).map(doc => doc.path), ['README.md'])
  await writeFile(output, 'Damaged output')
  await run('--title', 'Changed title')
  assert.equal(await page(), expected)
  await rm(output)
  await run('--title', 'Changed title')
  assert.equal(await page(), expected)
})

test('ignore matching agrees with Git across patterns and directory pruning', async t => {
  try { await exec('git', ['--version']) } catch { t.skip('Git unavailable'); return }
  const names = ['README.md', 'guide.md', 'a.md', 'b.md', '1.md', 'ab.md', '中文.md', 'docs/README.md', 'docs/a.md', 'docs/b.md', 'docs/nested/a.md', 'docs/nested/b.md', 'other/docs/a.md', 'other/guide.md', 'cache/a.md', 'other/cache/a.md', 'generated/README.md', 'generated/a.md', 'generated/nested/a.md', 'file.md', 'nested/file.md/README.md', '#note.md', '!note.md', '[note].md', 'space .md', 'trailing.md ', ' leading.md']
  const root = await fixture(t, Object.fromEntries(names.map(name => [name, '# Document'])))
  const git = args => exec('git', args, { cwd: root, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' } })
  await git(['init', '--quiet'])
  const patterns = ['', '# comment\n\ncache/\n', '/cache/', 'docs/a.md', '/docs/', 'file.md/', '*.md\n!README.md', '/README.md', '?.md', '[ab].md', '[!a].md', '[a-z].md', '**/a.md', 'docs/**', 'docs/**/a.md', '**/docs/**/a.md', 'docs/*/a.md', 'docs/*', 'generated/\n!generated/README.md', 'generated/**\n!generated/README.md', 'generated/\n!generated/\ngenerated/*\n!generated/README.md', 'docs/**\n!docs/nested/\n!docs/nested/a.md', 'a.md\n!a.md\n/docs/a.md', '\\#note.md\n\\!note.md\n\\[note].md', 'space\\ .md\n leading.md', '\uFEFF# comment\r\n/docs/   \r\n', 'trailing.md\\ \n']
  for (const pattern of patterns) {
    await writeFile(join(root, '.mdignore'), pattern)
    await writeFile(join(root, '.gitignore'), pattern)
    const result = await git(['ls-files', '--others', '--exclude-standard', '-z'])
    const expected = result.stdout.split('\0').filter(name => /\.md$/i.test(name)).sort()
    assert.deepEqual((await scan(root)).documents.map(doc => doc.path), expected, pattern)
  }
})
