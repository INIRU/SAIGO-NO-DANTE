export const SCENE_SIZE = 224
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

/** Convert a resized RGBA frame into the model's RGB NCHW float tensor. */
export function sceneFrameToTensor(frame: Pick<ImageData, 'data' | 'width' | 'height'>): Float32Array {
  if (frame.width !== SCENE_SIZE || frame.height !== SCENE_SIZE || frame.data.length !== SCENE_SIZE * SCENE_SIZE * 4) {
    throw new Error('Invalid scene frame size')
  }
  const pixels = SCENE_SIZE * SCENE_SIZE
  const tensor = new Float32Array(pixels * 3)
  for (let pixel = 0; pixel < pixels; pixel++) {
    for (let channel = 0; channel < 3; channel++) {
      tensor[channel * pixels + pixel] = (frame.data[pixel * 4 + channel] / 255 - MEAN[channel]) / STD[channel]
    }
  }
  return tensor
}
