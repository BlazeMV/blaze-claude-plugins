#!/usr/bin/env node
// Manage autostart for the claude-timeline server.
//   darwin → launchd user agent at ~/Library/LaunchAgents/com.blaze.claude-timeline.plist
//   linux  → systemd user unit  at ~/.config/systemd/user/claude-timeline.service
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { ensureCacheDir, CACHE_DIR } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.join(__dirname, 'server.mjs')
const STOP_SH = path.join(__dirname, 'stop.sh')
const LABEL = 'com.blaze.claude-timeline'
const UNIT_NAME = 'claude-timeline.service'

const PLIST_PATH = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`)
const UNIT_PATH = path.join(os.homedir(), '.config', 'systemd', 'user', UNIT_NAME)
const LOG_PATH = path.join(CACHE_DIR, 'server.log')

function nodePath() {
  try { return execSync('which node', { encoding: 'utf8' }).trim() }
  catch { return process.execPath }
}

function plistContent() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath()}</string>
    <string>${SERVER}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>${LOG_PATH}</string>
  <key>StandardErrorPath</key><string>${LOG_PATH}</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}</string></dict>
</dict>
</plist>
`
}

function systemdContent() {
  return `[Unit]
Description=claude-timeline live dashboard server
After=default.target

[Service]
Type=simple
ExecStart=${nodePath()} ${SERVER}
Restart=on-failure
RestartSec=2
StandardOutput=append:%h/.cache/claude-timeline/server.log
StandardError=append:%h/.cache/claude-timeline/server.log

[Install]
WantedBy=default.target
`
}

function sh(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, stdio: 'inherit', ...opts })
}

const PLATFORM = process.platform
const action = process.argv[2] || 'status'

function stopRunningServer() {
  try { sh(`bash "${STOP_SH}"`, { stdio: 'ignore' }) } catch {}
}

if (PLATFORM === 'darwin') {
  if (action === 'enable') {
    ensureCacheDir()
    stopRunningServer()
    fs.mkdirSync(path.dirname(PLIST_PATH), { recursive: true })
    fs.writeFileSync(PLIST_PATH, plistContent())
    sh(`launchctl unload "${PLIST_PATH}" 2>/dev/null || true`, { stdio: 'ignore' })
    sh(`launchctl load "${PLIST_PATH}"`)
    console.log(`✓ enabled: ${PLIST_PATH}`)
    console.log('  launches at login + auto-restarts on crash')
    console.log('  (/timeline-stop still works for the current session; reboot or /timeline-autostart disable to revoke)')
  } else if (action === 'disable') {
    sh(`launchctl unload "${PLIST_PATH}" 2>/dev/null || true`, { stdio: 'ignore' })
    try { fs.unlinkSync(PLIST_PATH); console.log('✓ disabled (plist removed, agent unloaded)') }
    catch { console.log('✓ disabled (no plist present)') }
  } else {
    const exists = fs.existsSync(PLIST_PATH)
    let loaded = false
    try {
      const r = spawnSync('launchctl', ['list', LABEL], { encoding: 'utf8' })
      loaded = r.status === 0
    } catch {}
    console.log(JSON.stringify({
      platform: 'darwin',
      autostart_installed: exists,
      autostart_loaded: loaded,
      plist_path: PLIST_PATH,
      log_path: LOG_PATH,
    }, null, 2))
  }
  process.exit(0)
}

if (PLATFORM === 'linux') {
  if (action === 'enable') {
    ensureCacheDir()
    stopRunningServer()
    fs.mkdirSync(path.dirname(UNIT_PATH), { recursive: true })
    fs.writeFileSync(UNIT_PATH, systemdContent())
    sh('systemctl --user daemon-reload')
    sh(`systemctl --user enable --now ${UNIT_NAME}`)
    console.log(`✓ enabled: ${UNIT_PATH}`)
    console.log('  starts on login + restarts on failure')
    console.log('  to keep running across logouts: sudo loginctl enable-linger $USER')
  } else if (action === 'disable') {
    sh(`systemctl --user disable --now ${UNIT_NAME} 2>/dev/null || true`, { stdio: 'ignore' })
    try { fs.unlinkSync(UNIT_PATH); console.log('✓ disabled (unit removed)') }
    catch { console.log('✓ disabled (no unit present)') }
    sh('systemctl --user daemon-reload', { stdio: 'ignore' })
  } else {
    const exists = fs.existsSync(UNIT_PATH)
    const isEnabled = spawnSync('systemctl', ['--user', 'is-enabled', UNIT_NAME], { encoding: 'utf8' }).stdout?.trim() === 'enabled'
    const isActive = spawnSync('systemctl', ['--user', 'is-active', UNIT_NAME], { encoding: 'utf8' }).stdout?.trim() === 'active'
    console.log(JSON.stringify({
      platform: 'linux',
      autostart_installed: exists,
      autostart_enabled: isEnabled,
      autostart_active: isActive,
      unit_path: UNIT_PATH,
      log_path: LOG_PATH,
    }, null, 2))
  }
  process.exit(0)
}

console.error(`unsupported platform: ${PLATFORM} (only darwin/linux supported for autostart; use /timeline manually)`)
process.exit(1)
