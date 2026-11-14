/**
 * The Assist's own log: what the screen reading saw and decided (connection, the text reader's engine, scenes, text reads,
 * floors, rooms, acquisitions, sales, fusions; on the prescript terminal its prescripts too), kept in this page's memory
 * only, the last LOG_MAX entries. The recognition settings' 로그 내보내기 saves it as one JSON file; F12 shows a short note
 * and `assist.*` commands (USER 2026-11-04: "설정으로 로그 내보내기, F12 누르면 나오면 좋을듯"). Nothing leaves the browser
 * unless the player saves the file.
 */
interface LogEntry { at: number; kind: string; data?: unknown }

export const LOG_MAX = 3000
const DEBUG_KEY = 'assist-debug'

const entries: LogEntry[] = []
let verbose = (() => { try { return typeof window !== 'undefined' && Boolean(window.localStorage.getItem(DEBUG_KEY)) } catch { return false } })()

/** Verbose logging: the frequent entries (the cursor every 150 ms) are kept too, and every entry is echoed to the console. */
export const isVerbose = () => verbose
export function setVerbose(on: boolean) {
  verbose = on
  try { if (on) window.localStorage.setItem(DEBUG_KEY, '1'); else window.localStorage.removeItem(DEBUG_KEY) } catch { /* this page only */ }
}

/** One entry. `frequent`: kept only while verbose (it would push everything else out of the buffer). */
export function plog(kind: string, data?: unknown, frequent = false) {
  if (frequent && !verbose) return
  entries.push({ at: Date.now(), kind, data })
  if (entries.length > LOG_MAX) entries.splice(0, entries.length - LOG_MAX)
  if (verbose) console.info(`[prescript] ${kind}`, data ?? '')
}

export const logEntries = (): LogEntry[] => entries.slice()
export function clearLog() { entries.length = 0 }

/** The export: the entries with the terminal's state when saved. */
export function logFile(state: unknown, now = Date.now()) {
  return { app: 'assist', exportedAt: new Date(now).toISOString(),
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent, state, entries: logEntries() }
}

/** Saves the export as prescript-log-<date>.json (a download the player asked for). */
export function downloadLog(state: unknown) {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const url = URL.createObjectURL(new Blob([JSON.stringify(logFile(state, now.getTime()), null, 1)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `assist-log-${stamp}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * `window.assist` for the F12 console, and a note there once: help, log (the last entries as a table), state, export,
 * debug (verbose on or off), clear.
 */
export function installConsole(state: () => unknown) {
  const help = () => console.info([
    'assist.log(n = 30)   최근 기록 n개를 표로 본다',
    'assist.state()       지금 상태(화면 연결, 글자 읽기 엔진, 장면, 층, 런)',
    'assist.export()      기록을 파일로 저장한다 (인식 설정 → 로그 내보내기와 같다)',
    'assist.debug(true)   자세한 기록을 켠다 (커서까지, 콘솔에도 바로 찍는다). false로 끈다',
    'assist.clear()       기록을 비운다',
  ].join('\n'))
  const api = {
    help,
    log: (n = 30) => { console.table(logEntries().slice(-n).map(entry => ({ time: new Date(entry.at).toLocaleTimeString(), kind: entry.kind,
      data: typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)?.slice(0, 200) }))) },
    state,
    export: () => downloadLog(state()),
    debug: (on = true) => { setVerbose(on); return on ? 'verbose on' : 'verbose off' },
    clear: clearLog,
  }
  const scope = window as unknown as { assist?: typeof api }
  const first = !scope.assist
  scope.assist = api
  if (first) console.info('%c어시스트 기록%c  보려면 assist.help()', 'color:#e8b030;font-weight:700;font-size:14px', 'color:#9c8b73')
  return () => { if (scope.assist === api) delete scope.assist }
}
