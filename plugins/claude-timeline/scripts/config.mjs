import fs from 'fs'
import os from 'os'
import path from 'path'

export const CONFIG_PATH = path.join(os.homedir(), '.claude', 'claude-timeline.json')
export const CACHE_DIR = path.join(os.homedir(), '.cache', 'claude-timeline')
export const OUR_CACHE = path.join(CACHE_DIR, 'last_stdin.json')
export const STATUSBAR_CACHE_DIR = path.join(os.homedir(), '.cache', 'claude-statusbar', 'sessions')
export const PID_FILE = path.join(CACHE_DIR, 'server.pid')
export const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')
export const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')

const DEFAULTS = {
  port: 7373,
  source: 'auto',
  downstream_statusline: null,
  refresh_ms: 2000,
}

export function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    return { ...DEFAULTS, ...raw }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...DEFAULTS, ...cfg }, null, 2))
}

export function ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
}

export function ensureConfig() {
  if (!fs.existsSync(CONFIG_PATH)) writeConfig({})
}
