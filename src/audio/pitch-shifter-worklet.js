// Real-time pitch shifter using overlap-add granular synthesis
// Shifts pitch WITHOUT affecting playback speed
//
// Algorithm: Two read pointers traverse a circular buffer at `pitchFactor` rate.
// Each pointer reads a Hann-windowed grain. The pointers are offset by half a
// grain so their windows always sum to 1.0 (complementary crossfade).
// When a pointer finishes a grain, it snaps back near the write head.

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

    // Circular buffer
    this.bufSize = 16384;
    this.buf = new Float32Array(this.bufSize);
    this.writePos = 0;

    // Grain parameters
    this.grainSize = 2048;
    this.halfGrain = this.grainSize / 2;

    // Two read heads with phase offset
    this.phase1 = 0;           // 0..grainSize range (position within grain cycle)
    this.phase2 = this.halfGrain; // offset by half a grain

    // Read positions in the buffer (fractional)
    this.readPos1 = 0;
    this.readPos2 = 0;

    // Pre-compute Hann window
    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / this.grainSize));
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length || !output || !output.length) return true;

    const pitchFactor = parameters.pitchFactor[0];
    const blockSize = input[0].length; // typically 128

    // Passthrough if no shift
    if (Math.abs(pitchFactor - 1.0) < 0.001) {
      for (let ch = 0; ch < output.length; ch++) {
        const src = input[Math.min(ch, input.length - 1)];
        if (src) output[ch].set(src);
      }
      return true;
    }

    for (let i = 0; i < blockSize; i++) {
      // Write mono input into circular buffer
      const inSample = input[0][i];
      this.buf[this.writePos] = inSample;

      // Advance read positions at pitch rate
      this.readPos1 += pitchFactor;
      this.readPos2 += pitchFactor;

      // Advance grain phases linearly (always at 1x so crossfade timing is constant)
      this.phase1 += 1;
      this.phase2 += 1;

      // When a grain phase completes, reset that read pointer near the write head
      if (this.phase1 >= this.grainSize) {
        this.phase1 = 0;
        // Snap read pointer to `grainSize` samples behind write head
        this.readPos1 = this.writePos - this.grainSize;
        if (this.readPos1 < 0) this.readPos1 += this.bufSize;
      }
      if (this.phase2 >= this.grainSize) {
        this.phase2 = 0;
        this.readPos2 = this.writePos - this.grainSize;
        if (this.readPos2 < 0) this.readPos2 += this.bufSize;
      }

      // Wrap read positions into buffer range
      while (this.readPos1 >= this.bufSize) this.readPos1 -= this.bufSize;
      while (this.readPos1 < 0) this.readPos1 += this.bufSize;
      while (this.readPos2 >= this.bufSize) this.readPos2 -= this.bufSize;
      while (this.readPos2 < 0) this.readPos2 += this.bufSize;

      // Read with linear interpolation
      const s1 = this.lerp(this.readPos1);
      const s2 = this.lerp(this.readPos2);

      // Window (Hann) each grain
      const w1 = this.window[this.phase1 | 0] || 0;
      const w2 = this.window[this.phase2 | 0] || 0;

      // Mix
      const out = s1 * w1 + s2 * w2;

      // Write to all output channels
      for (let ch = 0; ch < output.length; ch++) {
        output[ch][i] = out;
      }

      // Advance write position
      this.writePos = (this.writePos + 1) % this.bufSize;
    }

    return true;
  }

  lerp(pos) {
    const idx = pos | 0; // floor
    const frac = pos - idx;
    const s0 = this.buf[idx % this.bufSize];
    const s1 = this.buf[(idx + 1) % this.bufSize];
    return s0 + frac * (s1 - s0);
  }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
