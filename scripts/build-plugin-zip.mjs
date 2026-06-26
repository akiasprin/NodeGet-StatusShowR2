import { createWriteStream } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZipArchive } from 'archiver'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = resolve(projectRoot, 'dist', 'traffic-manager')
const zipPath = resolve(projectRoot, 'dist', 'traffic-manager.zip')

const zipOutput = createWriteStream(zipPath)
const archive = new ZipArchive('zip', { zlib: { level: 9 } })

zipOutput.on('close', () => {
  console.log(`[plugin-zip] traffic-manager.zip 完成，共 ${archive.pointer()} 字节`)
})

archive.on('error', (err) => {
  throw err
})

archive.pipe(zipOutput)
// 保留 traffic-manager/ 顶层目录，便于直接作为插件 zip 安装
archive.directory(sourceDir, 'traffic-manager')
archive.finalize()
