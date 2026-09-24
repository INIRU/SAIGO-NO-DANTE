interface DeviceNavigator {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  userAgentData?: { mobile?: boolean }
}

/**
 * Phones and tablets, by the browser's own device report (never by window size, so a small desktop window still
 * counts as a desktop). iPadOS reports a Mac platform but exposes touch points.
 */
export function isMobileDevice(device: DeviceNavigator | undefined): boolean {
  if (!device) return false
  if (device.userAgentData?.mobile === true) return true
  const agent = device.userAgent ?? ''
  if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone|webOS|BlackBerry/i.test(agent)) return true
  return device.platform === 'MacIntel' && (device.maxTouchPoints ?? 0) > 1
}
