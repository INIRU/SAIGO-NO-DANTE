/**
 * What the Assist's two classifiers have in common with their training scripts (scripts/vision/assist_common.py; a test
 * checks the two stay the same): the ImageNet normalisation both models take, and the icon classifier's strong-read bar,
 * the one a single read is trusted on (owned list, shop shelf, fusion slots).
 */
export const IMAGENET_MEAN: readonly number[] = [0.485, 0.456, 0.406]
export const IMAGENET_STD: readonly number[] = [0.229, 0.224, 0.225]
export const STRONG_READ = { score: 0.85, margin: 0.25 } as const

export const isStrongRead = (read: { score: number; margin: number }) => read.score >= STRONG_READ.score && read.margin >= STRONG_READ.margin
