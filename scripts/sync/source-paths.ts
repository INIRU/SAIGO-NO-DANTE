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
