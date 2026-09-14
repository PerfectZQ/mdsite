import {test, expect} from '@playwright/test'
import {mkdtemp, mkdir, writeFile, rm, readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {once} from 'node:events'
import {spawn, type ChildProcess} from 'node:child_process'
import {createInterface} from 'node:readline'

const source =
    '/* 多行注释\n * Preserve empty lines and token colors.\n */\n\nconst message = "' +
    '文档与源码 <script> & '.repeat(14) +
    '";\nconsole.log(message);\n'
const flowchart =
    'flowchart LR\n  A[Markdown] --> B{忽略规则}\n  B -->|保留| C[渲染正文]\n  B -->|排除| D[跳过]\n  C --> E[独立 HTML]'
const sequence =
    'sequenceDiagram\n  participant A as 作者\n  participant B as 构建器\n  A->>B: build\n  Note right of B: 读取 Markdown\n  B-->>A: HTML'
const fence = (lang: string, text: string) => `\n\n\`\`\`${lang}\n${text}${text.endsWith('\n') ? '' : '\n'}\`\`\`\n`
let root: string
let url: string
let server: ChildProcess

test.use({viewport: {width: 1600, height: 1000}, launchOptions: {channel: process.env.CI ? undefined : 'chrome'}})

test.beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'mdsite-reader-'))
    await mkdir(join(root, 'guide/deep'), {recursive: true})
    await writeFile(
        join(root, 'README.md'),
        '# 阅读器验收\n\n[深入文档](guide/deep/rendering.md)\n\n[目录入口](guide/deep/)\n',
    )
    await writeFile(
        join(root, 'guide/deep/rendering.md'),
        '# 技术文档\n\n正文与 **强调**，`inline code`。\n\n## 代码\n' +
            fence('typescript', source) +
            fence('unknown-language', '<script>window.__mdsiteCodeExecuted=true</script>\n\nplain & safe') +
            '\n## 表格\n\n| 左 | 中 | 右 |\n| :--- | :---: | ---: |\n| 内容 | 内容 | 内容 |\n\n## 流程\n' +
            fence('mermaid', flowchart) +
            '\n## 时序\n' +
            fence('mermaid', sequence) +
            '\n## 后续章节\n\n' +
            '用于检查深链接定位。\n\n'.repeat(24),
    )
    await writeFile(
        join(root, 'guide/broken.md'),
        '# 错误图表\n' + fence('mermaid', 'not-a-real-diagram !!!') + fence('mermaid', flowchart),
    )
    server = spawn(process.execPath, [resolve('dist/cli.js'), 'serve', root, '--addr', '127.0.0.1:0'], {
        stdio: ['ignore', 'pipe', 'inherit'],
    })
    for await (const line of createInterface({input: server.stdout!})) {
        const address = /http:\/\/127\.0\.0\.1:\d+/.exec(line)
        if (address) {
            url = address[0]
            break
        }
    }
    if (!url) throw new Error('Missing preview address')
})

test.afterAll(async () => {
    if (server?.exitCode === null) {
        server.kill()
        await once(server, 'exit')
    }
    await rm(root, {recursive: true, force: true})
})

test('code preserves multiline tokens, blank lines and clipboard content; wrapping stays inside the page', async ({
    page,
    context,
}) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`${url}/#/guide/deep/rendering.md`)
    const block = page.locator('.code-block').first()
    const code = block.locator('code')
    expect(await code.textContent()).toBe(source.trimEnd())
    await expect(block.locator('.code-line').nth(1).locator('.hljs-comment')).toContainText('Preserve')
    await expect(block.locator('.code-line')).toHaveCount(6)
    await block.getByRole('button', {name: '复制代码'}).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source)
    await expect(block.getByRole('button', {name: '已复制'})).toBeVisible()
    const pre = block.locator('pre')
    expect(await pre.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
    await block.getByRole('button', {name: '自动换行'}).click()
    await expect(block.getByRole('button', {name: '自动换行'})).toHaveAttribute('aria-pressed', 'true')
    expect(await pre.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    expect(await page.locator('.code-block').nth(1).locator('code').textContent()).toContain(
        '<script>window.__mdsiteCodeExecuted=true</script>',
    )
    expect(await page.evaluate(() => '__mdsiteCodeExecuted' in window)).toBe(false)
    await page.getByRole('button', {name: '切换为深色主题'}).click()
    await expect(block.getByRole('button', {name: '自动换行'})).toHaveAttribute('aria-pressed', 'true')
})

test('Mermaid renders both themes, zooms, exports SVG and restores focus after fullscreen', async ({page}) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${url}/#/guide/deep/rendering.md`)
    await expect(page.locator('.diagram-image svg')).toHaveCount(2)
    const diagram = page.locator('.diagram').first()
    const image = diagram.locator('.diagram-image')
    const light = await image.locator('svg').innerHTML()
    const before = (await image.boundingBox())!.width
    await diagram.getByRole('button', {name: '放大图表', exact: true}).click()
    await expect(diagram.getByRole('button', {name: '重置图表缩放'})).toHaveText('125%')
    expect((await image.boundingBox())!.width).toBeGreaterThan(before * 1.2)
    const downloadEvent = page.waitForEvent('download')
    await diagram.getByRole('button', {name: '下载 SVG'}).click()
    const download = await downloadEvent
    expect(download.suggestedFilename()).toBe('diagram.svg')
    const saved = await readFile((await download.path())!, 'utf8')
    expect(saved).toContain('<svg')
    expect(saved).toContain('Markdown')
    await diagram.getByRole('button', {name: '全屏查看图表'}).click()
    const dialog = page.getByRole('dialog', {name: '全屏图表'})
    await expect(dialog).toBeVisible()
    await expect(page.locator('.diagram-image svg')).toHaveCount(2)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(diagram.getByRole('button', {name: '全屏查看图表'})).toBeFocused()
    await page.getByRole('button', {name: '切换为深色主题'}).click()
    await expect(page.locator('.diagram-image svg')).toHaveCount(2)
    expect(await image.locator('svg').innerHTML()).not.toBe(light)
    await page.getByRole('button', {name: '切换为浅色主题'}).click()
    await page.getByRole('button', {name: '切换为深色主题'}).click()
    await expect(page.locator('.diagram-image svg')).toHaveCount(2)
    expect(errors).toEqual([])
})

test('file tree supports arrow keys, one tab stop, collapse and directory links', async ({page}) => {
    await page.goto(url)
    const tree = page.getByRole('tree', {name: '项目文件'})
    const guide = tree.getByRole('treeitem', {name: 'guide', exact: true})
    await guide.focus()
    await page.keyboard.press('ArrowRight')
    await expect(guide).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('ArrowRight')
    const deep = tree.getByRole('treeitem', {name: 'deep', exact: true})
    await expect(deep).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    await expect(tree.getByRole('treeitem', {name: 'rendering.md'})).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/guide\/deep\/rendering.md/)
    await expect(tree.getByRole('treeitem', {name: 'rendering.md'})).toHaveAttribute('aria-selected', 'true')
    await expect(tree.locator('[tabindex="0"]')).toHaveCount(1)
    await page.getByRole('button', {name: '折叠所有目录'}).click()
    await expect(guide).toHaveAttribute('aria-expanded', 'false')
    await expect(tree.getByRole('treeitem', {name: 'rendering.md'})).toHaveCount(0)
    await tree.getByRole('treeitem', {name: 'README.md'}).click()
    await page.getByRole('link', {name: '目录入口'}).click()
    await expect(deep).toHaveAttribute('aria-expanded', 'true')
    await expect(deep).toBeFocused()
    await page.getByRole('button', {name: '折叠所有目录'}).click()
    await page.getByRole('link', {name: '目录入口'}).click()
    await expect(deep).toHaveAttribute('aria-expanded', 'true')
    await expect(deep).toBeFocused()
})

test('invalid Mermaid exposes its source and does not prevent the next diagram from rendering', async ({page}) => {
    await page.goto(`${url}/#/guide/broken.md`)
    await expect(page.locator('.diagram-error')).toBeVisible()
    await expect(page.locator('.diagram-source').first()).toHaveAttribute('open', '')
    await expect(page.locator('.diagram-source').first().locator('code')).toContainText('not-a-real-diagram')
    await expect(page.locator('.diagram-image svg')).toHaveCount(1)
    await page.getByRole('button', {name: '切换为深色主题'}).click()
    await expect(page.locator('.diagram-image svg')).toHaveCount(1)
})

test('390px reader contains wide content, supports mobile navigation and reduced motion', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844})
    await page.emulateMedia({reducedMotion: 'reduce'})
    await page.goto(`${url}/#/guide/deep/rendering.md`)
    await expect(page.locator('.diagram-image svg')).toHaveCount(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', {name: '打开文档目录'}).click()
    const navigation = page.getByRole('dialog', {name: '文档目录', exact: true})
    await expect(navigation).toBeVisible()
    await expect(navigation.getByRole('treeitem', {name: 'rendering.md'})).toHaveAttribute('aria-selected', 'true')
    await navigation.getByRole('treeitem', {name: 'README.md'}).click()
    await expect(navigation).not.toBeVisible()
    await page.getByRole('link', {name: '深入文档'}).click()
    await expect(page.locator('.diagram-image svg')).toHaveCount(2)
    const diagram = page.locator('.diagram').first()
    const before = (await diagram.locator('.diagram-image').boundingBox())!.width
    await diagram.getByRole('button', {name: '缩小图表'}).click()
    expect((await diagram.locator('.diagram-image').boundingBox())!.width).toBeLessThan(before)
    await diagram.getByRole('button', {name: '全屏查看图表'}).click()
    const dialog = page.getByRole('dialog', {name: '全屏图表'})
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true)
    await dialog.getByRole('button', {name: '关闭全屏图表'}).click()
    await expect(dialog).not.toBeVisible()
    const duration = await page
        .getByRole('button', {name: '打开文档目录'})
        .evaluate(element => getComputedStyle(element).transitionDuration)
    expect(duration).toBe('0s')
})

test('deep links remain aligned after diagrams finish; generated pages work without network', async ({
    page,
    context,
}) => {
    await page.goto(`${url}/#/guide/deep/rendering.md?heading=${encodeURIComponent('后续章节')}`)
    await expect(page.locator('.diagram-image svg')).toHaveCount(2)
    await expect.poll(async () => Math.round((await page.locator('#后续章节').boundingBox())!.y)).toBe(92)
    await context.setOffline(true)
    await page.getByRole('button', {name: '搜索文档', exact: true}).click()
    await page.getByRole('searchbox').fill('错误图表')
    await page.locator('.search-result').first().click()
    await expect(page.locator('.diagram-error')).toBeVisible()
    await expect(page.locator('.diagram-image svg')).toHaveCount(1)
})
