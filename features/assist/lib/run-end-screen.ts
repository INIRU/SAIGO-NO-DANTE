/**
 * The dungeon's end screen (탐사 완료): its title with its button or another of its headings, in the game's own words
 * (KR/EN/JP MirrorDungeonUI: explore_dungeon_finished, mirrordungeon_acquire_rewards, participated_personality,
 * dungeon_final_area). The scene classifier had one frame of it to learn from and reads it as another screen (a player's
 * capture, 2026-11-04: start_gift 0.31), so the text decides, as for the starlight screen.
 */
const normalized = (text: string) => text.normalize('NFKC').replace(/\s+/g, '').toLowerCase()

const TITLES = ['탐사완료', 'explorationcomplete', '探査完了']
const OTHERS = ['보상수령', 'claimrewards', '報酬を受け取る', '참여인격', '参加人格', '최종탐사구역', 'lastreached', '最終探索区域']

/** The title alone is not enough (an event or a mission could say it); one more of the screen's own texts is. */
export const showsRunEndScreen = (text: string) => {
  const read = normalized(text)
  return TITLES.some(title => read.includes(title)) && OTHERS.some(other => read.includes(other))
}

export const RUN_END_SCENE = 'run_end'
/** How long a read of that screen keeps it on after the capture it came from. */
export const RUN_END_KEEP_MS = 4000
export const onRunEndScreen = (readAt: number, now: number) => readAt > 0 && now - readAt < RUN_END_KEEP_MS
