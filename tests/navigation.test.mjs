import assert from 'node:assert/strict'
import test from 'node:test'
import { documentHref, readRoute, searchDocuments } from '../src/reader/navigation.ts'

test('search combines native paths and body terms, ranking titles before body-only matches', () => {
  const documents = [
    {path: 'internal/worker/README.md', title: 'Worker', text: 'refresh 中文内容'},
    {path: 'doc/search.md', title: 'Refresh', text: '中文内容'},
    {path: 'README.md', title: '首页', text: 'other text'},
  ]
  assert.deepEqual(searchDocuments(documents, 'refresh 中文'), [documents[1], documents[0]])
  assert.deepEqual(searchDocuments(documents, 'internal 中文'), [documents[0]])
  assert.deepEqual(searchDocuments(documents, 'missing'), [])
  assert.deepEqual(searchDocuments(documents, ''), documents)
})

test('deep links preserve actual filenames and Unicode headings', () => {
  const file = 'doc/中文 #?+.md'
  const heading = '中文章节-1'
  globalThis.window = {location: {hash: documentHref(file, heading)}}
  assert.deepEqual(readRoute(), {path:file, heading})
  globalThis.window.location.hash = '#/%broken'
  assert.deepEqual(readRoute(), {path:'%broken', heading:''})
})
