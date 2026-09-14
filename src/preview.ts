import { createServer } from 'node:http'
import type { ScanOptions } from './content/scan.ts'
import { createPage } from './site.ts'

export function createPreview(directory: string, options: ScanOptions = {}) {
  return createServer({ headersTimeout: 5_000 }, async (request, response) => {
    const path = request.url?.split('?')[0]
    response.setHeader('X-Content-Type-Options', 'nosniff')
    if (path !== '/' && path !== '/index.html') {
      response.writeHead(404).end('Not found')
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed')
      return
    }
    try {
      const page = await createPage(directory, options)
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(page),
        'Cache-Control': 'no-store',
      })
      response.end(request.method === 'HEAD' ? undefined : page)
    } catch (error) {
      console.error('文档读取失败：', error instanceof Error ? error.message : error)
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('文档读取失败，请检查终端输出后刷新。')
    }
  })
}
