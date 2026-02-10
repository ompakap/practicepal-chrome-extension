// Real-time pitch shifter — overlap-add with 4 Hann-windowed grains
// Large grain size (4096 samples ≈ 93ms) for natural-sounding shifts
// 75% overlap (4 grains offset by grainSize/4) for artifact-free output

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

    this.grainSize = 4096;
    this.numGrains = 4;
    this.hopSize = this.grainSize / this.numGrains; // 1024

    // Circular buffer — large enough for safe reading
    this.bufSize = 32768;
    this.buf = new Float32Array(this.bufSize);
    this.writePos = 0;
    this.inputSamplesWritten = 0;

    // Pre-compute Hann window
    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      // Hann window: 0.5 * (1 - cos(2π * i / N))
      this.window[i] = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * i / this.grainSize));
    }

    // Calculate normalization factor for overlapping Hann windows
    // With 4 grains at 75% overlap, the sum of Hann windows ≈ 1.5
    let winSum = 0;
    for (let s = 0; s < this.hopSize; s++) {
      let total = 0;
      for (let g = 0; g < this.numGrains; g++) {
        const phase = (s + g * this.hopSize) % this.grainSize;
        total += this.window[phase];
      }
      winSum += total;
    }
    this.windowNorm = this.hopSize / winSum * this.numGrains;

    // Grain states
    this.grains = [];
    for (let g = 0; g < this.numGrains; g++) {
      this.grains.push({
        phase: g * this.hopSize,  // staggered start positions
        readPos: 0,
        active: false
      });
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length || !output || !output.length) return true;

    const pitchFactor = parameters.pitchFactor[0];
    const blockSize = input[0].length;

    // Passthrough when no pitch shift
    if (Math.abs(pitchFactor - 1.0) < 0.001) {
      for (let ch = 0; ch < output.length; ch++) {
        const src = input[Math.min(ch, input.length - 1)];
        if (src) output[ch].set(src);
      }
      return true;
    }

    // Write input to circular buffer
    for (let i = 0; i < blockSize; i++) {
      this.buf[this.writePos] = input[0][i];
      this.writePos = (this.writePos + 1) % this.bufSize;
      this.inputSamplesWritten++;
    }

    // Need enough data before we start outputting
    if (this.inputSamplesWritten < this.grainSize * 2) {
      for (let ch = 0; ch < output.length; ch++) {
        output[ch].fill(0);
      }
      return true;
    }

    // Process output samples
    for (let i = 0; i < blockSize; i++) {
      let outSample = 0;

      for (let g = 0; g < this.numGrains; g++) {
        const grain = this.grains[g];

        // Grain phase reset — re-anchor read position
        if (grain.phase >= this.grainSize) {
          grain.phase = 0;
          // Place read pointer behind write head by a safe distance
          grain.readPos = ((this.writePos - i + blockSize - this.grainSize - this.hopSize * 2) % this.bufSize + this.bufSize) % this.bufSize;
        }

        if (!grain.active && this.inputSamplesWritten >= this.grainSize) {
          grain.active = true;
          grain.readPos = ((this.writePos - i + blockSize - this.grainSize - this.hopSize * 2) % this.bufSize + this.bufSize) % this.bufSize;
        }

        if (grain.active) {
          // Read with linear interpolation
          const idx = grain.readPos;
          const idx0 = Math.floor(idx) % this.bufSize;
          const idx1 = (idx0 + 1) % this.bufSize;
          const frac = idx - Math.floor(idx);
          const sample = this.buf[idx0] + frac * (this.buf[idx1] - this.buf[idx0]);

          // Apply Hann window
          const w = this.window[grain.phase];
          outSample += sample * w;

          // Advance read position at pitch rate
          grain.readPos += pitchFactor;
          if (grain.readPos >= this.bufSize) grain.readPos -= this.bufSize;
          if (grain.readPos < 0) grain.readPos += this.bufSize;
        }

        // Advance phase (always at 1x rate — grain timing is independent of pitch)
        grain.phase++;
      }

      // Normalize overlapping windows
      outSample *= this.windowNorm;

      // Write to all output channels
      for (let ch = 0; ch < output.length; ch++) {
        output[ch][i] = outSample;
      }
    }

    return true;
  }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
