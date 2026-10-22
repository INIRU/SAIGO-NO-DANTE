const normalized = (text: string) => text.normalize('NFKC').replace(/\s+/g, '')

/**
 * The starlight (별의 가호) screen before a run: its title and its 입장 button in one read. The scene classifier learned
 * the old red cards only (14 frames); the 2026-10 screen is blue, and the text is the same in any colour. Either word
 * alone is not enough: the title also names the bonus gift popup ("별의 가호 효과 발동"), 입장 other screens' buttons.
 */
export const showsBlessingScreen = (text: string) => { const read = normalized(text); return read.includes('별의가호') && read.includes('입장') }

/** How long a read of that screen keeps it on after the capture it came from. */
export const BLESSING_KEEP_MS = 4000

export const onBlessingScreen = (readAt: number, now: number) => readAt > 0 && now - readAt < BLESSING_KEEP_MS
