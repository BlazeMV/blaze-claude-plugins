#!/usr/bin/env node
// statusLine wrapper: capture Claude Code's stdin payload into our cache,
// then optionally chain to a downstream statusLine command.
import fs from 'fs'
import { spawn } from 'child_process'
import { readConfig, OUR_CACHE, ensureCacheDir } from './config.mjs'

let buf = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) buf += chunk

ensureCacheDir()
try { fs.writeFileSync(OUR_CACHE, buf) } catch {}

const cfg = readConfig()
if (!cfg.downstream_statusline) {
  // No chained renderer — emit nothing so the bar stays blank.
  process.exit(0)
}

const proc = spawn(cfg.downstream_statusline, { shell: true, stdio: ['pipe', 'inherit', 'inherit'] })
proc.stdin.write(buf)
proc.stdin.end()
proc.on('exit', code => process.exit(code ?? 0))
proc.on('error', () => process.exit(0))
