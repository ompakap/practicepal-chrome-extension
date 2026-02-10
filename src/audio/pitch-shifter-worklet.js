// Pitch shifter — 2 Hann-windowed grains, large grain for tonal clarity
// Proven 2-grain approach with bigger grains to reduce "radio" artifacts.

class PitchShifterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{
      name: 'pitchFactor',
      defaultValue: 1.0,
      minValue: 0.5,
      maxValue: 2.0,
      automationRate: 'k-rate'
    }];
  }

  constructor() {
    super();

    this.N = 131072;
    this.mask = this.N - 1;
    this.buf = new Float32Array(this.N);
    this.wp = 0;

    this.grainLen = 8192; // ~170ms — larger grains for tonal clarity
    this.halfGrain = this.grainLen >> 1;

    // Pre-compute Hann window
    this.win = new Float32Array(this.grainLen);
    for (let i = 0; i < this.grainLen; i++) {
      this.win[i] = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * i / this.grainLen));
    }

    // Two grains offset by half a grain
    this.phase0 = 0;
    this.phase1 = this.halfGrain;
    this.rp0 = 0.0;
    this.rp1 = 0.0;
    this.needsInit = true;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input?.[0] || !output?.[0]) return true;

    const pitch = parameters.pitchFactor[0];
    const inp = input[0];
    const n = inp.length;

    // Write input to circular buffer first
    for (let i = 0; i < n; i++) {
      this.buf[(this.wp + i) & this.mask] = inp[i];
    }

    // Passthrough when pitch = 1.0
    if (Math.abs(pitch - 1.0) < 0.0001) {
      for (let ch = 0; ch < output.length; ch++) {
        const src = ch < input.length ? input[ch] : input[0];
        if (src) output[ch].set(src);
      }
      this.wp = (this.wp + n) & this.mask;
      this.needsInit = true; // re-init grains when pitch changes back
      return true;
    }

    // Initialize/re-initialize grain read pointers
    if (this.needsInit) {
      // Place both read pointers behind write pointer
      this.rp0 = this.wp - this.grainLen;
      this.rp1 = this.wp - this.grainLen;
      this.phase0 = 0;
      this.phase1 = this.halfGrain;
      this.needsInit = false;
    }

    const out = output[0];
    for (let i = 0; i < n; i++) {
      // Window values
      const w0 = this.win[this.phase0];
      const w1 = this.win[this.phase1];

      // Read with linear interpolation — grain 0
      const floor0 = Math.floor(this.rp0);
      const frac0 = this.rp0 - floor0;
      const s0 = this.buf[floor0 & this.mask] * (1 - frac0)
               + this.buf[(floor0 + 1) & this.mask] * frac0;

      // Read with linear interpolation — grain 1
      const floor1 = Math.floor(this.rp1);
      const frac1 = this.rp1 - floor1;
      const s1 = this.buf[floor1 & this.mask] * (1 - frac1)
               + this.buf[(floor1 + 1) & this.mask] * frac1;

      out[i] = s0 * w0 + s1 * w1;

      // Advance read pointers at pitch rate (this creates pitch shift)
      this.rp0 += pitch;
      this.rp1 += pitch;

      // Advance grain phases at normal rate
      this.phase0 = (this.phase0 + 1) % this.grainLen;
      this.phase1 = (this.phase1 + 1) % this.grainLen;

      // Reset grain when it completes — sync read pointer to near write head
      if (this.phase0 === 0) {
        this.rp0 = this.wp + i - this.grainLen;
      }
      if (this.phase1 === 0) {
        this.rp1 = this.wp + i - this.grainLen;
      }
    }

    // Copy to other channels
    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(out);
    }

    this.wp = (this.wp + n) & this.mask;
    return true;
  }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
