// Pitch shifter — two sweeping delay taps with crossfade
// Each tap reads from the buffer at a rate = pitchFactor, creating the pitch shift.
// When a tap's sweep reaches its end, it resets — the crossfade masks the reset.
// sin²/cos² complementary windows ensure the sum is always 1.

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

    // Power-of-2 buffer for efficient wrapping
    this.N = 65536;
    this.mask = this.N - 1;
    this.buf = new Float32Array(this.N);
    this.wp = 0; // write pointer (integer, always advances by 1)

    // Two read pointers (float — advance at pitchFactor rate)
    // Start behind write pointer by grainLen
    this.grainLen = 4096;
    this.rp = new Float64Array(2);
    this.grainPhase = new Float64Array(2); // 0..grainLen
    this.rp[0] = -this.grainLen;
    this.rp[1] = -this.grainLen;
    this.grainPhase[0] = 0;
    this.grainPhase[1] = this.grainLen / 2; // offset by half for crossfade

    this.samplesWritten = 0;
    this.started = false;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const pitch = parameters.pitchFactor[0];
    const inData = input[0];
    const n = inData.length;

    // Passthrough when pitch = 1.0
    if (Math.abs(pitch - 1.0) < 0.0001) {
      for (let ch = 0; ch < output.length; ch++) {
        const src = ch < input.length ? input[ch] : input[0];
        if (src) output[ch].set(src);
      }
      // Still write to buffer so we're ready when pitch changes
      for (let i = 0; i < n; i++) {
        this.buf[(this.wp + i) & this.mask] = inData[i];
      }
      this.wp = (this.wp + n) & this.mask;
      this.samplesWritten += n;
      return true;
    }

    // Write input into circular buffer (mono — take first channel)
    for (let i = 0; i < n; i++) {
      this.buf[(this.wp + i) & this.mask] = inData[i];
    }

    // Wait for buffer to fill before starting output
    if (!this.started) {
      if (this.samplesWritten + n >= this.grainLen * 2) {
        this.started = true;
        // Initialize read pointers behind write pointer
        const startWp = this.wp + n;
        this.rp[0] = startWp - this.grainLen * 2;
        this.rp[1] = startWp - this.grainLen * 2;
        this.grainPhase[0] = 0;
        this.grainPhase[1] = this.grainLen / 2;
      } else {
        this.samplesWritten += n;
        this.wp = (this.wp + n) & this.mask;
        for (let ch = 0; ch < output.length; ch++) output[ch].fill(0);
        return true;
      }
    }

    this.samplesWritten += n;

    // Generate output
    const outData = output[0];
    for (let i = 0; i < n; i++) {
      let sample = 0.0;

      for (let t = 0; t < 2; t++) {
        // Hann window based on grain phase (0 at start/end, 1 in middle)
        const phase01 = this.grainPhase[t] / this.grainLen;
        const w = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * phase01));

        // Read from buffer with linear interpolation
        const rpFloor = Math.floor(this.rp[t]);
        const frac = this.rp[t] - rpFloor;
        const i0 = rpFloor & this.mask;
        const i1 = (rpFloor + 1) & this.mask;
        const s = this.buf[i0] + frac * (this.buf[i1] - this.buf[i0]);

        sample += s * w;

        // Advance read pointer at pitch rate (this creates the pitch shift)
        this.rp[t] += pitch;

        // Advance grain phase
        this.grainPhase[t] += 1;

        // When grain completes, reset read pointer near write pointer
        if (this.grainPhase[t] >= this.grainLen) {
          this.grainPhase[t] = 0;
          // Place read pointer behind current write position
          this.rp[t] = (this.wp + i) - this.grainLen;
        }
      }

      outData[i] = sample;
    }

    // Copy mono output to all channels
    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(outData);
    }

    this.wp = (this.wp + n) & this.mask;
    return true;
  }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
