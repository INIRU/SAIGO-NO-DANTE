// html2canvas 1.4 draws what the page shows only with some help:
// - it cannot read the modern colour functions (oklch(), color-mix(), the color(srgb ...) they compute to) the cards and
//   E.G.O rows use, so the clone it paints from gets every such colour rewritten as a plain rgba();
// - on a screen with a pixel ratio above 1 it draws next/image pictures at the wrong size (the SELECTED banner is cut off),
//   so each <img> of the clone becomes a box of the size the page lays it out at, with the picture as its background.
const MODERN_COLOR = /(?:oklch|oklab|lab|lch|color-mix|color)\((?:[^()]|\([^()]*\))*\)/g
const NEEDS_FIX = /oklch|oklab|lab\(|lch\(|color\(|color-mix/
const COLOR_PROPERTIES = [
  'color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'textShadow', 'boxShadow', 'webkitTextStrokeColor', 'outlineColor',
] as const
const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

function rgbaOf(probe: CanvasRenderingContext2D, color: string): string {
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`
}

function prepareClone(board: HTMLElement) {
  return (clone: Document, cloneRoot: HTMLElement) => {
    const view = clone.defaultView
    const probe = clone.createElement('canvas').getContext('2d', { willReadFrequently: true })
    if (!view || !probe) return
    for (const element of clone.querySelectorAll<HTMLElement>('*')) {
      const computed = view.getComputedStyle(element)
      for (const property of COLOR_PROPERTIES) {
        const value = computed[property]
        if (value && NEEDS_FIX.test(value)) element.style[property] = value.replace(MODERN_COLOR, color => rgbaOf(probe, color))
      }
    }
    const originals = board.querySelectorAll('img')
    cloneRoot.querySelectorAll('img').forEach((image, index) => {
      const original = originals[index]
      const source = image.getAttribute('src')
      if (!original || !source) return
      const { objectFit, objectPosition } = view.getComputedStyle(image)
      image.style.backgroundImage = `url("${new URL(source, location.href).href}")`
      image.style.backgroundRepeat = 'no-repeat'
      image.style.backgroundSize = objectFit === 'cover' ? 'cover' : objectFit === 'contain' ? 'contain' : '100% 100%'
      image.style.backgroundPosition = objectPosition
      image.style.width = `${original.offsetWidth}px`
      image.style.height = `${original.offsetHeight}px`
      image.style.maxWidth = 'none'
      image.removeAttribute('srcset')
      image.src = BLANK_PIXEL
    })
  }
}

/**
 * The identity board as a PNG download (html2canvas is loaded only when the button is used). Throws when the image cannot be made.
 * The E.G.O board's small text comes out smeared in html2canvas, so only the identity cards are saved.
 */
export async function saveBoardImage(board: HTMLElement, fileName: string): Promise<void> {
  const html2canvas = (await import('html2canvas')).default
  const canvas = await html2canvas(board, { useCORS: true, scale: 2, backgroundColor: '#0d0b08', logging: false, onclone: prepareClone(board) })
  const link = document.createElement('a')
  link.download = fileName
  link.href = canvas.toDataURL('image/png')
  link.click()
}
