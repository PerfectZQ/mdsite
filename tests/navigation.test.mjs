import assert from 'node:assert/strict'
import test from 'node:test'
import {adjacentDocuments, documentHref, readRoute} from '../src/reader/navigation.ts'
import {createSearchIndex, searchSections, searchExcerpt} from '../src/reader/search/search.ts'

test('search combines native paths and body terms, ranking titles before body-only matches', () => {
    const documents = [
        {
            path: 'internal/worker/README.md',
            title: 'Worker',
            headings: [],
            sections: [{heading: '', text: 'refresh 中文内容'}],
        },
        {path: 'doc/search.md', title: 'Refresh', headings: [], sections: [{heading: '', text: '中文内容'}]},
        {path: 'README.md', title: '首页', headings: [], sections: [{heading: '', text: 'other text'}]},
    ]
    const index = createSearchIndex(documents)
    const search = query => searchSections(index, query).map(result => result.document)
    assert.deepEqual(search('refresh 中文'), [documents[1], documents[0]])
    assert.deepEqual(search('internal 中文'), [documents[0]])
    assert.deepEqual(search('missing'), [])
    assert.deepEqual(search(''), documents)
})

test('deep links preserve actual filenames and Unicode headings', () => {
    const file = 'doc/中文 #?+.md'
    const heading = '中文章节-1'
    globalThis.window = {location: {hash: documentHref(file, heading)}}
    assert.deepEqual(readRoute(), {path: file, heading, query: ''})
    globalThis.window.location.hash = documentHref(file, heading, '校验 C++ & [x]')
    assert.deepEqual(readRoute(), {path: file, heading, query: '校验 C++ & [x]'})
    globalThis.window.location.hash = '#/%broken'
    assert.deepEqual(readRoute(), {path: '%broken', heading: '', query: ''})
})

test('section search carries heading context, finds code literals and avoids duplicate path-only hits', () => {
    const document = {
        path: 'doc/install.md',
        title: '安装指南',
        headings: [
            {id: '安装指南', title: '安装指南', level: 1},
            {id: '校验', title: '校验', level: 2},
            {id: 'linux', title: 'Linux', level: 3},
            {id: '卸载', title: '卸载', level: 2},
        ],
        sections: [
            {heading: '安装指南', text: '安装指南：安装说明'},
            {heading: '校验', text: '校验说明'},
            {heading: 'linux', text: 'Linux 使用 sha256sum，支持 C++ 和 [x]。'},
            {heading: '卸载', text: '卸载后删除文件'},
        ],
    }
    const index = createSearchIndex([document])
    const results = searchSections(index, '校验 sha256sum')
    assert.deepEqual(
        results.map(result => result.heading),
        ['linux'],
    )
    assert.equal(results[0].trail, '校验 / Linux')
    assert.equal(searchSections(index, 'install.md').length, 1)
    assert.deepEqual(
        searchSections(index, 'c++ [x]').map(result => result.heading),
        ['linux'],
    )
    assert.match(searchExcerpt('前文'.repeat(40) + 'sha256sum 命令', '不存在 sha256sum'), /sha256sum/)
})

test('adjacent reading follows actual filenames within one directory, including alias locations', () => {
    const catalog = {
        documents: [
            {path: 'README.md', title: '首页'},
            {path: 'guide/a.md', title: '入门'},
            {path: 'guide/b.md', title: '深入'},
            {path: 'other/c.md', title: '其他'},
        ],
        aliases: {'guide/z.md': 'other/c.md'},
    }
    assert.deepEqual(adjacentDocuments(catalog, 'guide/b.md'), {
        previous: {path: 'guide/a.md', title: '入门'},
        next: {path: 'guide/z.md', title: '其他'},
    })
    assert.deepEqual(adjacentDocuments(catalog, 'README.md'), {previous: undefined, next: undefined})
    assert.deepEqual(adjacentDocuments(catalog, 'guide/z.md'), {
        previous: {path: 'guide/b.md', title: '深入'},
        next: undefined,
    })
    assert.deepEqual(adjacentDocuments(catalog, 'missing.md'), {previous: undefined, next: undefined})
})
