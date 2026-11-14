/**
 * The gift-icon classifier (public/models/assist-scene/icon-classifier.onnx, scripts/vision/train_icons.py): one
 * MobileNetV4-Conv-Small pass (MobileNetV3-small until 2026-11-04b) over 96 px crops of 1.3x a fusion slot region names the gift in every slot at once. It was trained
 * on catalog icons pasted into real empty slots with fading, small captures and JPEG, the cases template matching missed.
 */
import { AUTO_ACQUIRE_EXCLUDED_GIFT_IDS } from './popup-evidence'
import type { FusionSlotRead } from './fusion-evidence'
import { IMAGENET_MEAN as MEAN, IMAGENET_STD as STD } from './strong-read'

export const ICON_INPUT = 96
/** Crop side relative to the slot region, as in training. */
export const ICON_CROP = 1.3
/** The label of an empty slot and of the five vestiges, one class each (the app never tells vestiges apart). */
const BLANK_LABEL = 'blank'
const VESTIGE_LABEL = '9991'
/**
 * Logit scale before the softmax. Label smoothing keeps the trained probabilities low (median 0.90 on 887 labelled real
 * slots); at 1.5x, 884 of them pass the strong-read bar (0.85, lead 0.25) while the same slots with their true class
 * removed, as a gift the model never saw would look, stay below every bar (at most 0.27). At 2x that reached 0.65.
 */
export const ICON_LOGIT_SCALE = 1.5

/** NCHW, ImageNet-normalized input for 96 px RGBA crops. */
export function iconTensor(crops: Uint8ClampedArray[]): Float32Array {
  const plane = ICON_INPUT * ICON_INPUT
  const out = new Float32Array(crops.length * 3 * plane)
  crops.forEach((pixels, index) => {
    for (let pixel = 0; pixel < plane; pixel++) {
      for (let channel = 0; channel < 3; channel++) {
        out[(index * 3 + channel) * plane + pixel] = (pixels[pixel * 4 + channel] / 255 - MEAN[channel]) / STD[channel]
      }
    }
  })
  return out
}

/**
 * One slot read from the classifier's logits: its top gift with the lead over the runner-up, as template reads are scored.
 * When the top gift is held (or a vestige), the lead is measured against the other held gifts only (see heldSlotRead). An
 * empty slot per the classifier is left unknown (null): the luminance check decides blanks, and a slot it saw as filled
 * but the classifier as empty is only starting to fade in.
 */
export function classifierSlotRead(logits: ArrayLike<number>, labels: readonly string[], held?: ReadonlySet<string>): FusionSlotRead {
  const scaled = Array.from(logits, value => value * ICON_LOGIT_SCALE)
  const max = Math.max(...scaled)
  const exp = scaled.map(value => Math.exp(value - max))
  const sum = exp.reduce((total, value) => total + value, 0)
  const ranked = exp.map((value, index) => ({ id: labels[index], p: value / sum })).sort((first, second) => second.p - first.p)
  const [first, second] = ranked
  if (!first || first.id === BLANK_LABEL) return null
  const usable = (id: string) => id !== BLANK_LABEL && (id === VESTIGE_LABEL || !!held?.has(id))
  if (held?.size && usable(first.id)) {
    const runnerUp = ranked.find(item => item.id !== first.id && usable(item.id))
    return { id: first.id, score: first.p, margin: first.p - (runnerUp?.p ?? 0) }
  }
  return { id: first.id, score: first.p, margin: first.p - (second?.p ?? 0) }
}

/** Held gifts by class label: enhancement suffixes dropped upstream; vestiges fold into their one class. */
export function heldLabels(candidates: readonly string[] | undefined): Set<string> {
  return new Set((candidates ?? []).map(id => AUTO_ACQUIRE_EXCLUDED_GIFT_IDS.has(id) ? VESTIGE_LABEL : id))
}

/**
 * Whether the classifier may read a fusion's slots: every held gift must be one of its classes. A gift added to the
 * game after training could be read as a lookalike, so such a fusion is read by template matching (built from the live
 * catalog) until the model is retrained.
 */
export function classifierKnowsHeld(labels: readonly string[], held: ReadonlySet<string>): boolean {
  const known = new Set(labels)
  return [...held].every(id => known.has(id))
}
