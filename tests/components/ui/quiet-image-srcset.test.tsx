import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import QuietImage from '@/components/ui/QuietImage'
import { trimFixedSrcSet, withoutBlurPlaceholder } from '@/lib/utils/images'

const widths = (html: string) => (html.match(/srcSet="([^"]*)"/)?.[1] ?? '').split(', ').filter(Boolean).map(entry => Number(entry.split(' ').at(-1)!.replace('w', '')))
const src = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/ego-gifts/a.webp'

describe('fixed-size images', () => {
  it('keeps the smallest width for each of 1x, 2x and 3x screens', () => {
    const all = [64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200].map(w => `/i?w=${w} ${w}w`).join(', ')
    expect(trimFixedSrcSet(all, 120)).toBe('/i?w=128 128w, /i?w=256 256w, /i?w=384 384w')
    expect(trimFixedSrcSet(all, 40)).toBe('/i?w=64 64w, /i?w=96 96w, /i?w=128 128w')
    // a slot wider than the largest width keeps the largest
    expect(trimFixedSrcSet('/i?w=64 64w, /i?w=96 96w', 200)).toBe('/i?w=96 96w')
  })

  it('a QuietImage of one fixed size carries three widths, not every width the site knows', () => {
    // a 120px gift sent ten widths of about 190 characters each: 762KB of a plan page's 2.8MB HTML were srcset
    expect(widths(renderToStaticMarkup(<QuietImage src={src} alt="" fill sizes="120px" />))).toHaveLength(3)
    expect(widths(renderToStaticMarkup(<QuietImage src={src} alt="" fill sizes="2rem" />)).length).toBeLessThanOrEqual(3)
    // a size that depends on the screen keeps them all
    expect(widths(renderToStaticMarkup(<QuietImage src={src} alt="" fill sizes="(max-width: 640px) 17vw, 6vw" />)).length).toBeGreaterThan(3)
  })

  it('a fixed-size image starts with the blur and has a style without it for after load', () => {
    // the blur stayed behind object-contain art: a grey frame around every theme pack poster
    const blurDataURL = 'data:image/png;base64,iVBORw0KGgo='
    const html = renderToStaticMarkup(<QuietImage src={src} alt="" fill sizes="150px" placeholder="blur" blurDataURL={blurDataURL} className="object-contain" />)
    expect(html).toContain('background-image')

    const loaded = withoutBlurPlaceholder({ position: 'absolute', backgroundSize: 'contain', backgroundPosition: '50% 50%', backgroundRepeat: 'no-repeat', backgroundImage: 'url(x)', color: 'transparent' })
    expect(loaded).toEqual({ position: 'absolute', color: 'transparent' })
    expect(withoutBlurPlaceholder(undefined)).toBeUndefined()
  })
})
