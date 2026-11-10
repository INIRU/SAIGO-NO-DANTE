/** April 1st in Korea, or `?af=1` in the address (for trying the joke on any day). */
export function isAprilFools(): boolean {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('af') === '1') return true
  const now = new Date()
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return koreaTime.getMonth() === 3 && koreaTime.getDate() === 1
}
