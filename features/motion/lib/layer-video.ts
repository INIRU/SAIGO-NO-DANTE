// A layer's own MP4 decoded frame by frame with WebCodecs (version 9 layer videos), and the MP4 reader behind it.

/** version 9: a layer's own video (MP4, H.264 without B-frames: sample n = frame n), decoded with WebCodecs. frame(n) hands over exactly frame n — the page asks for the
 * number it read from the base frame it draws, so the two can never drift apart (two <video> elements can: their clocks only roughly follow each other) */
export class LayerVideo {
  private data: Uint8Array | null = null;
  private samples: { off: number; size: number; key: boolean }[] = [];
  private keys: number[] = [];
  private config: VideoDecoderConfig | null = null;
  private dec: VideoDecoder | null = null;
  private next = 0; // the next sample to decode
  private want = -1;
  private frames = new Map<number, VideoFrame>();
  private failed = false;
  /** a frame the last frame() call waited for is ready */
  onFrame: (() => void) | null = null;
  static AHEAD = 8; // frames decoded ahead of the asked one (playback asks for the next ones soon)

  constructor(url: string, private fps: number, private count: number) {
    fetch(url).then((r) => r.arrayBuffer()).then((b) => this.open(new Uint8Array(b))).catch((e) => { console.error("layer video", url, e); this.failed = true; });
  }
  private open(b: Uint8Array) {
    const m = parseMp4(b);
    this.data = b;
    this.samples = m.samples;
    this.keys = m.samples.map((s, i) => (s.key ? i : -1)).filter((i) => i >= 0);
    this.config = { codec: m.codec, description: m.avcC, codedWidth: m.w, codedHeight: m.h, optimizeForLatency: true };
    if (this.want >= 0) this.frame(this.want);
  }
  /** frame n: the frame, null when it does not exist / failed, undefined while it is being decoded */
  frame(n: number): VideoFrame | null | undefined {
    if (this.failed || n >= this.count) return null;
    this.want = n;
    for (const [i, f] of this.frames) if (i < n - 1 || i > n + LayerVideo.AHEAD + 4) { f.close(); this.frames.delete(i); }
    if (!this.data || !this.config) return undefined;
    const have = this.frames.get(n);
    // restart at the key frame before n when n is behind the decoder or a key frame lies between it and n (a seek)
    const key = this.keys.filter((i) => i <= n).pop() ?? 0;
    if (!have && (!this.dec || this.dec.state !== "configured" || n < this.next - (this.dec.decodeQueueSize + 4) || key > this.next)) this.restart(key);
    this.feed();
    return have;
  }
  private restart(from: number) {
    if (!this.dec || this.dec.state === "closed") {
      this.dec = new VideoDecoder({
        output: (f) => {
          const i = Math.round((f.timestamp * this.fps) / 1e6);
          if (i < this.want - 1 || i > this.want + LayerVideo.AHEAD + 4 || this.frames.has(i)) { f.close(); return; }
          this.frames.set(i, f);
          if (i === this.want) this.onFrame?.();
          this.feed();
        },
        error: (e) => { console.error("layer video decode", e); this.dec = null; },
      });
      this.dec.addEventListener("dequeue", () => this.feed());
    } else this.dec.reset();
    this.dec.configure(this.config!);
    this.next = from;
  }
  private feed() {
    const d = this.dec;
    if (!d || d.state !== "configured" || !this.data) return;
    const end = Math.min(this.want + LayerVideo.AHEAD, this.samples.length - 1);
    while (this.next <= end && d.decodeQueueSize < 12) {
      const s = this.samples[this.next];
      d.decode(new EncodedVideoChunk({ type: s.key ? "key" : "delta", timestamp: Math.round((this.next * 1e6) / this.fps), data: this.data.subarray(s.off, s.off + s.size) }));
      this.next++;
    }
    if (this.next >= this.samples.length && d.decodeQueueSize === 0) d.flush().catch(() => {}); // (the last frames: a decoder may hold them until more input)
  }
  close() {
    for (const f of this.frames.values()) f.close();
    this.frames.clear();
    if (this.dec && this.dec.state !== "closed") this.dec.close();
    this.dec = null;
  }
}

/** the one video track of an MP4 (a layer video from LimbusViewer.LayerExport.cs): the codec string, avcC, size, and every sample's place and key flag */
function parseMp4(b: Uint8Array) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let avcC: Uint8Array | null = null, w = 0, h = 0, sizes: number[] = [], chunks: number[] = [], stsc: [number, number][] = [], sync: Set<number> | null = null;
  const walk = (s: number, e: number) => {
    for (let p = s; p + 8 <= e; ) {
      let size = dv.getUint32(p), hd = 8;
      const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
      if (size === 1) { size = Number(dv.getBigUint64(p + 8)); hd = 16; } else if (size === 0) size = e - p;
      const c = p + hd, end = p + size;
      if (type === "moov" || type === "trak" || type === "mdia" || type === "minf" || type === "stbl") walk(c, end);
      else if (type === "stsd") walk(c + 8, end);
      else if (type === "avc1") { w = dv.getUint16(c + 24); h = dv.getUint16(c + 26); walk(c + 78, end); }
      else if (type === "avcC") avcC = b.slice(c, end);
      else if (type === "stsz") { const fixed = dv.getUint32(c + 4), n = dv.getUint32(c + 8); sizes = Array.from({ length: n }, (_, i) => fixed || dv.getUint32(c + 12 + 4 * i)); }
      else if (type === "stco") chunks = Array.from({ length: dv.getUint32(c + 4) }, (_, i) => dv.getUint32(c + 8 + 4 * i));
      else if (type === "co64") chunks = Array.from({ length: dv.getUint32(c + 4) }, (_, i) => Number(dv.getBigUint64(c + 8 + 8 * i)));
      else if (type === "stsc") stsc = Array.from({ length: dv.getUint32(c + 4) }, (_, i) => [dv.getUint32(c + 8 + 12 * i), dv.getUint32(c + 12 + 12 * i)] as [number, number]);
      else if (type === "stss") sync = new Set(Array.from({ length: dv.getUint32(c + 4) }, (_, i) => dv.getUint32(c + 8 + 4 * i) - 1));
      p = end;
    }
  };
  walk(0, b.length);
  if (!avcC || !sizes.length || !chunks.length) throw new Error("not an H.264 MP4");
  const samples: { off: number; size: number; key: boolean }[] = [];
  for (let ci = 0, si = 0; ci < chunks.length; ci++) {
    let per = 0;
    for (const [first, n] of stsc) if (first <= ci + 1) per = n;
    for (let j = 0, off = chunks[ci]; j < per && si < sizes.length; j++, si++) { samples.push({ off, size: sizes[si], key: sync ? (sync as Set<number>).has(si) : true }); off += sizes[si]; }
  }
  const a = avcC as Uint8Array;
  const codec = "avc1." + [a[1], a[2], a[3]].map((x) => x.toString(16).padStart(2, "0")).join("");
  return { codec, avcC: a, w, h, samples };
}
