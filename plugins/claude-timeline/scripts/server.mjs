#!/usr/bin/env node
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildSnapshot } from './analyze.mjs'
import { readConfig, ensureCacheDir, PID_FILE } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_DIR = path.join(__dirname, '..', 'web')

const cfg = readConfig()
const PORT = parseInt(process.env.PORT || cfg.port || 7373, 10)
const REFRESH_MS = cfg.refresh_ms || 2500

ensureCacheDir()
fs.writeFileSync(PID_FILE, String(process.pid))

const clients = new Set()
let lastSnapshotJson = null
let cachedSnapshot = null

function compute() {
  try {
    cachedSnapshot = buildSnapshot()
    const j = JSON.stringify(cachedSnapshot)
    if (j !== lastSnapshotJson) {
      lastSnapshotJson = j
      for (const res of clients) {
        try { res.write(`data: ${j}\n\n`) } catch {}
      }
    }
  } catch (err) {
    console.error('[snapshot]', err)
  }
}

setInterval(compute, REFRESH_MS)
compute()

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname === '/') {
    fs.readFile(path.join(WEB_DIR, 'index.html'), (err, body) => {
      if (err) { res.writeHead(500); res.end('index.html missing'); return }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(body)
    })
    return
  }
  if (url.pathname === '/data') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(lastSnapshotJson || '{}')
    return
  }
  if (url.pathname === '/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
      'access-control-allow-origin': '*',
    })
    if (lastSnapshotJson) res.write(`data: ${lastSnapshotJson}\n\n`)
    clients.add(res)
    const ping = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 25000)
    req.on('close', () => { clearInterval(ping); clients.delete(res) })
    return
  }
  res.writeHead(404); res.end('not found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`claude-timeline server: http://localhost:${PORT}`)
  console.log(`source: ${cachedSnapshot?.dataSource || 'unknown'}`)
})

function shutdown() {
  try { fs.unlinkSync(PID_FILE) } catch {}
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 500).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
