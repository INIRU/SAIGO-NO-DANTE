// Downloads the official PaddleOCR models used by the capture OCR worker into public/models/assist-ocr/paddle:
// PP-OCRv5_mobile_det and korean_PP-OCRv5_mobile_rec (official ONNX exports, Apache-2.0), their character dictionary,
// the Apache-2.0 license text and a provenance note. Revisions are pinned and every model file is checked by sha256.
// Usage: node scripts/vision/fetch_paddle_ocr.mjs
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'public/models/assist-ocr/paddle')
const HF = 'https://huggingface.co/PaddlePaddle'
const DET = { repo: 'PP-OCRv5_mobile_det_onnx', revision: 'e6f4fa85f00e168c862bc462aebca69eef9b3d3d',
  sha256: 'a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d' }
const REC = { repo: 'korean_PP-OCRv5_mobile_rec_onnx', revision: '5c6f574b8e2230adf4287b33e736d71b9fabd28e',
  sha256: '92f0b7785e64fc9090106a241cf4c1eb97472824558272751b88a2a4476d3a08' }
const LICENSE = { url: 'https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/dab3fe35379033fdcb2d0e9572fac0b36c9a9ebf/LICENSE' }
const DICTIONARY_SIZE = 11945

async function download(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')

/** `PostProcess.character_dict` of inference.yml; the official file uses only plain and single-quoted list items. */
function dictionary(yml) {
  const lines = yml.split('\n')
  const start = lines.findIndex(line => line.trim() === 'character_dict:')
  if (start < 0) throw new Error('character_dict not found')
  const items = []
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('  - ')) break
    const value = line.slice(4)
    if (value.startsWith('"')) throw new Error(`Unsupported dictionary entry: ${value}`)
    items.push(value.startsWith("'") && value.endsWith("'") && value.length >= 2 ? value.slice(1, -1).replaceAll("''", "'") : value)
  }
  if (items.length !== DICTIONARY_SIZE) throw new Error(`Expected ${DICTIONARY_SIZE} dictionary entries, found ${items.length}`)
  return items
}

await mkdir(OUT, { recursive: true })
for (const [model, file] of [[DET, 'det.onnx'], [REC, 'rec.onnx']]) {
  const data = await download(`${HF}/${model.repo}/resolve/${model.revision}/inference.onnx`)
  if (sha256(data) !== model.sha256) throw new Error(`${model.repo}: sha256 mismatch`)
  await writeFile(join(OUT, file), data)
}
const yml = (await download(`${HF}/${REC.repo}/resolve/${REC.revision}/inference.yml`)).toString('utf8')
await writeFile(join(OUT, 'dict.json'), JSON.stringify(dictionary(yml)))
await writeFile(join(OUT, 'LICENSE'), await download(LICENSE.url))
await writeFile(join(OUT, 'PROVENANCE.md'), `# PaddleOCR models for capture OCR

Official PaddlePaddle exports, license Apache-2.0 (model cards; full text in LICENSE from PaddlePaddle/PaddleOCR).

| File | Source | Revision | sha256 |
|---|---|---|---|
| det.onnx | ${HF}/${DET.repo} (inference.onnx) | ${DET.revision} | ${DET.sha256} |
| rec.onnx | ${HF}/${REC.repo} (inference.onnx) | ${REC.revision} | ${REC.sha256} |
| dict.json | ${HF}/${REC.repo} (inference.yml PostProcess.character_dict) | ${REC.revision} | ${sha256(Buffer.from(JSON.stringify(dictionary(yml))))} |

Pre/post-processing follows PaddleX (DetResizeForTest, NormalizeImage, DBPostProcess, OCRReisizeNormImg, CTCLabelDecode):
see lib/vision/paddle-text.ts. The models are used unmodified; no fine-tuning or conversion.
`)
console.log(`Wrote ${OUT}`)
