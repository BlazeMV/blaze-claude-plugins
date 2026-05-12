#!/usr/bin/env node
// Wire up the statusLine wrapper in ~/.claude/settings.json
// Detects existing statusLine (e.g. `cs render`), chains it as downstream.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { readConfig, writeConfig, SETTINGS_PATH } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CAPTURE = path.join(__dirname, 'capture.mjs')
const WRAPPER_CMD = `node ${CAPTURE}`

const mode = process.argv[2] || 'install'

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) } catch { return {} }
}
function writeSettings(s) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2))
}

if (mode === 'status') {
  const s = readSettings()
  const cfg = readConfig()
  console.log(JSON.stringify({
    statusLine: s.statusLine || null,
    wrapper_installed: s.statusLine?.command === WRAPPER_CMD,
    downstream_statusline: cfg.downstream_statusline,
    config_path: '~/.claude/claude-timeline.json',
    config: cfg,
  }, null, 2))
  process.exit(0)
}

if (mode === 'uninstall') {
  const s = readSettings()
  const cfg = readConfig()
  if (s.statusLine?.command === WRAPPER_CMD) {
    if (cfg.downstream_statusline) {
      s.statusLine.command = cfg.downstream_statusline
      console.log(`restored statusLine to: ${cfg.downstream_statusline}`)
    } else {
      delete s.statusLine
      console.log('removed statusLine')
    }
    writeSettings(s)
  } else {
    console.log('wrapper not installed; nothing to do')
  }
  writeConfig({ ...cfg, downstream_statusline: null })
  console.log('restart Claude Code to apply.')
  process.exit(0)
}

// install
const s = readSettings()
const cfg = readConfig()
const existing = s.statusLine?.command
if (existing && existing !== WRAPPER_CMD) {
  cfg.downstream_statusline = existing
  console.log(`detected existing statusLine: ${existing}`)
  console.log(`→ saved as downstream; wrapper will pipe stdin through it`)
} else if (existing === WRAPPER_CMD) {
  console.log('wrapper already installed')
}
s.statusLine = { type: 'command', command: WRAPPER_CMD, refreshInterval: s.statusLine?.refreshInterval || 1 }
writeSettings(s)
writeConfig(cfg)
console.log(`✓ statusLine set to: ${WRAPPER_CMD}`)
console.log(`✓ config: ~/.claude/claude-timeline.json`)
console.log('restart Claude Code to apply.')
