import { lstat, readlink } from 'node:fs/promises'
import { join, posix } from 'node:path'

export async function resolveFile(root: string, name: string): Promise<string> {
  for (let depth = 0; depth < 32; depth++) {
    if (!name || name === '.' || name === '..' || name.startsWith('../') || name.startsWith('/') || name.includes('\\') || name.includes('\0')) {
      throw new Error(`文件超出文档目录：${name}`)
    }
    const parts = name.split('/')
    for (let i = 1; i < parts.length; i++) {
      const info = await lstat(join(root, ...parts.slice(0, i)))
      if (!info.isDirectory()) throw new Error(`不跟随目录符号链接：${name}`)
    }
    const info = await lstat(join(root, name))
    if (!info.isSymbolicLink()) {
      if (!info.isFile()) throw new Error(`不是普通文件：${name}`)
      return name
    }
    const target = await readlink(join(root, name))
    if (posix.isAbsolute(target) || target.includes('\\') || /^[a-z]:/i.test(target)) {
      throw new Error(`不跟随绝对路径符号链接：${name}`)
    }
    name = posix.join(posix.dirname(name), target)
  }
  throw new Error(`符号链接循环：${name}`)
}
