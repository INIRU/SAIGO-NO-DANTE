import { describe, expect, it } from 'vitest'
import { fileNameOf, frameSize, videoType } from '@/lib/spine/save'

describe('saving pictures of a figure or an illustration', () => {
  it('REQ-CATALOG-029 saves a video as MP4 where the browser can record it, as WebM elsewhere', () => {
    expect(videoType(type => type.startsWith('video/mp4'))).toMatchObject({ extension: 'mp4' })
    expect(videoType(type => type.startsWith('video/webm'))).toMatchObject({ extension: 'webm' })
    expect(videoType(() => false)).toBeNull()
  })

  it('REQ-CATALOG-029 scales a frame down to the longest side allowed, never up, to even numbers', () => {
    expect(frameSize(2880, 1620, 1920)).toEqual([1920, 1080])
    expect(frameSize(1201, 1201, 480)).toEqual([480, 480])
    expect(frameSize(300, 201, 480)).toEqual([300, 200])
  })

  it('REQ-CATALOG-029 names the file after the identity, without what a file name cannot hold', () => {
    expect(fileNameOf('로보토미 E.G.O:: 사랑과 증오의 이름으로')).toBe('로보토미 E.G.O 사랑과 증오의 이름으로')
    expect(fileNameOf('  ')).toBe('illustration')
  })
})
