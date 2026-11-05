/**
 * Steps of the friend code guide: the real game screen of each (the extractor, the Windows extraction tool, writes
 * public/assets/guides/friend-codes/<name>.webp with other players' cards blurred out) and what to press on it.
 * spots: the marks as percentages of the 1920x1080 screen, printed by that script.
 */
export const FRIEND_GUIDE_STEPS = [
  { key: 'code', spots: [{ left: 4.4, top: 17.9, width: 14.7, height: 4.5 }] },
  { key: 'copy', spots: [{ left: 30.5, top: 23, width: 6.8, height: 5 }] },
  { key: 'friends', spots: [{ left: 38.1, top: 3.9, width: 12.1, height: 7.4 }, { left: 26.9, top: 27.2, width: 11.6, height: 5.7 }] },
  { key: 'add', spots: [{ left: 23.1, top: 32.1, width: 17.8, height: 4.4 }] },
  { key: 'company', spots: [{ left: 25.8, top: 4.2, width: 12.1, height: 7.1 }] },
] as const
