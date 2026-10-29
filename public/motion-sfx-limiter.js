// The motion player's sound limiter (an AudioWorklet), loaded from the site itself: the CSP keeps script-src to 'self'.
class Lim extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: "ceiling", defaultValue: 1, automationRate: "k-rate" }, { name: "release", defaultValue: 0.0052, automationRate: "k-rate" }]; }
  constructor() { super(); this.L = Math.max(8, Math.round(sampleRate * 0.005)); this.ring = [new Float32Array(this.L), new Float32Array(this.L)]; this.pos = 0; this.gain = 1; this.atk = 1 - Math.exp(-1 / (0.0008 * sampleRate));
    this.qv = new Float32Array(this.L + 1); this.qt = new Float64Array(this.L + 1); this.qf = 0; this.qn = 0; this.t = 0; }
  process(inputs, outputs, parameters) {
    const inp = inputs[0], out = outputs[0], n = out[0].length, L = this.L, Q = L + 1, qv = this.qv, qt = this.qt, c = Math.max(1e-6, parameters.ceiling[0]), rel = 1 - Math.exp(-1 / (Math.max(0.0005, parameters.release[0]) * sampleRate));
    for (let i = 0; i < n; i++) {
      let p = 0;
      for (let ch = 0; ch < out.length; ch++) {
        const x = inp[ch] ? inp[ch][i] : (inp[0] ? inp[0][i] : 0);
        out[ch][i] = this.ring[ch][this.pos];       // the sample from L samples ago
        this.ring[ch][this.pos] = x;
        if (Math.abs(x) > p) p = Math.abs(x);
      }
      // the peaks of the last L samples, falling from the front: a smaller one behind this one can never be the maximum again
      while (this.qn > 0 && qv[(this.qf + this.qn - 1) % Q] <= p) this.qn--;
      const b = (this.qf + this.qn) % Q; qv[b] = p; qt[b] = this.t; this.qn++;
      while (qt[this.qf] <= this.t - L) { this.qf = (this.qf + 1) % Q; this.qn--; }
      this.t++;
      const m = qv[this.qf];
      const target = m > c ? c / m : 1;
      this.gain += (target - this.gain) * (target < this.gain ? this.atk : rel);
      for (let ch = 0; ch < out.length; ch++) out[ch][i] *= this.gain;
      this.pos = (this.pos + 1) % L;
    }
    return true;
  }
}
registerProcessor("sfx-limiter", Lim);