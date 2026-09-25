#!/usr/bin/env node
/**
 * Affiliation filter icons: each affiliation's signature keyword icon from the game's keyword atlas export
 * (LimbusAssets/Images/키워드), converted to 64 px WebP in public/assets/game-ui/affiliations.
 *   node scripts/assets/copy-affiliation-icons.mjs [/path/to/LimbusAssets/Images/키워드]
 * Keep the map in lib/constants/affiliation-icons.ts in step.
 */
import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs'

const source = process.argv[2] ?? path.join(process.env.HOME, 'Downloads/LimbusAssets/Images/키워드')
const out = 'public/assets/game-ui/affiliations'
export const ICONS = {
  dawn: 'DawnTeam_새벽 사무소.png',
  'black-cloud': 'BlackCloud_검은 구름.png',
  'n-corp': 'Assemble_광신.png',
  index: 'BlessingOfIndexPrescriptAlly_지령의 가호.png',
  heishou: 'HeishouSynergy_모든 흑수의 주인.png',
  middle: 'ResentmentIshmael_중지 - 원한.png',
  thumb: 'TeachersCommand_엄지 아비의 명령.png',
  'blade-lineage-hwando': 'ChoiSwordsmanship_본국검술[살].png',
  't-corp': 'TcorpSpecialInvestigator_T사 특별 수사관 배지.png',
  'la-manchaland': 'ParadeConcentration_라만차 퍼레이드.png',
  'rosespanner': 'RoseWedge_장미 쐐기.png',
}
fs.mkdirSync(out, { recursive: true })
for (const [slug, file] of Object.entries(ICONS)) {
  const input = fs.readdirSync(source).find(name => name.normalize('NFC') === file.normalize('NFC'))
  if (!input) { console.error('missing', file); process.exitCode = 1; continue }
  await sharp(path.join(source, input)).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toFile(path.join(out, slug + '.webp'))
  console.log(slug)
}
