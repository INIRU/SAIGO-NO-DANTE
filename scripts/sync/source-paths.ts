import { dirname, join, resolve } from 'node:path'

/** An explicit recovery source must never silently mix in the old local export (../assets beside the repository). */
export function gameDataPaths(source = process.env.LIMBUS_DATA_DIR) {
  const data = resolve(source || join(__dirname, '../../../assets/data/Json (Text)'))
  const legacyRoot = dirname(data)
  return {
    data,
    kr: join(data, 'KR'), en: join(data, 'EN'), jp: join(data, 'JP'),
    krLatest: source ? join(data, 'KR') : join(legacyRoot, 'kr'),
    enLatest: source ? join(data, 'EN') : join(legacyRoot, 'en'),
    jpLatest: source ? join(data, 'JP') : join(legacyRoot, 'jp'),
  }
}

/**
 * A manual run without LIMBUS_DATA_DIR reads the defaults, which differ by script (gifts and themes: the old local export;
 * the event rebuild: the 2026-09-10 recovery), so one run can mix two game versions. Returns the warning to print, or null.
 */
export function implicitDataDirWarning(label: string, dir: string, source = process.env.LIMBUS_DATA_DIR): string | null {
  return source ? null : `[sync] LIMBUS_DATA_DIR 미설정 — ${label}은(는) 기본 경로를 읽습니다: ${dir}. 추출본을 쓰려면 LIMBUS_DATA_DIR를 지정하세요.`
}
