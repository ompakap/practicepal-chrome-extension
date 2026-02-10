// Pitch shifter using modulated delay lines (Eventide-style)
// Two delay taps sweep through a delay buffer at a rate determined by the pitch shift.
// Crossfaded with complementary cosine windows for seamless output.
// This approach avoids granular artifacts and sounds natural for ±12 semitones.

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

    // Delay buffer (~ 0.5s at 48kHz)
    this.maxDelay = 24000;
    this.delayBuf = new Float32Array(this.maxDelay);
    this.writeIdx = 0;

    // Two delay taps with sawtooth LFO phase (0..1 range)
    this.phase1 = 0;
    this.phase2 = 0.5; // offset by half cycle for crossfade

    // Smoothing for pitch changes
    this.currentPitch = 1.0;
    this.smoothingCoeff = 0.001;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length || !output || !output.length) return true;

    const targetPitch = parameters.pitchFactor[0];
    const blockSize = input[0].length;

    // Passthrough when no pitch shift
    if (Math.abs(targetPitch - 1.0) < 0.001 && Math.abs(this.currentPitch - 1.0) < 0.001) {
      for (let ch = 0; ch < output.length; ch++) {
        const src = input[Math.min(ch, input.length - 1)];
        if (src) output[ch].set(src);
      }
      return true;
    }

    // The sweep rate determines pitch shift.
    // pitchFactor > 1 (higher pitch): taps sweep forward (decreasing delay) 
    // pitchFactor < 1 (lower pitch): taps sweep backward (increasing delay)
    // Rate of change of delay per sample = 1 - pitchFactor
    // LFO period = maxDelay / |1 - pitchFactor| samples

    const sweepRange = 12000; // max delay sweep range in samples

    for (let i = 0; i < blockSize; i++) {
      // Smooth pitch transitions
      this.currentPitch += (targetPitch - this.currentPitch) * this.smoothingCoeff;
      const pitch = this.currentPitch;

      // Write input to delay buffer (mono mix if stereo)
      let inSample = input[0][i];
      if (input.length > 1 && input[1]) {
        inSample = (inSample + input[1][i]) * 0.5;
      }
      this.delayBuf[this.writeIdx] = inSample;

      // Advance sawtooth phases
      // Phase rate = |1 - pitch| / sweepRange
      const phaseRate = Math.abs(1.0 - pitch) / sweepRange;
      this.phase1 += phaseRate;
      this.phase2 += phaseRate;
      if (this.phase1 >= 1.0) this.phase1 -= 1.0;
      if (this.phase2 >= 1.0) this.phase2 -= 1.0;

      // Convert phase (0..1) to delay time in samples
      // For pitch UP: sawtooth sweeps delay from max to 0 (decreasing delay = reading faster)
      // For pitch DOWN: sawtooth sweeps delay from 0 to max (increasing delay = reading slower)
      let delay1, delay2;
      if (pitch >= 1.0) {
        // Pitch up: decreasing delay (phase 0→1 maps to delay sweepRange→0)
        delay1 = (1.0 - this.phase1) * sweepRange;
        delay2 = (1.0 - this.phase2) * sweepRange;
      } else {
        // Pitch down: increasing delay (phase 0→1 maps to delay 0→sweepRange)
        delay1 = this.phase1 * sweepRange;
        delay2 = this.phase2 * sweepRange;
      }

      // Add a base delay to stay safely behind write pointer
      const baseDelay = 256;
      delay1 += baseDelay;
      delay2 += baseDelay;

      // Read from delay buffer with cubic interpolation
      const s1 = this.readDelay(delay1);
      const s2 = this.readDelay(delay2);

      // Crossfade: use cosine-squared windows based on phase
      // phase1 and phase2 are 0.5 apart, so cos² windows are complementary
      const w1 = Math.cos(this.phase1 * Math.PI);
      const w2 = Math.cos(this.phase2 * Math.PI);
      const g1 = w1 * w1;
      const g2 = w2 * w2;

      const outSample = s1 * g1 + s2 * g2;

      // Write to all output channels
      for (let ch = 0; ch < output.length; ch++) {
        output[ch][i] = outSample;
      }

      // Advance write index
      this.writeIdx = (this.writeIdx + 1) % this.maxDelay;
    }

    return true;
  }

  // Read from delay buffer with cubic Hermite interpolation for smooth output
  readDelay(delaySamples) {
    const rd = this.writeIdx - delaySamples;
    const idx = ((rd | 0) % this.maxDelay + this.maxDelay) % this.maxDelay;
    const frac = delaySamples - (delaySamples | 0);

    // 4-point cubic Hermite interpolation
    const im1 = (idx - 1 + this.maxDelay) % this.maxDelay;
    const i0 = idx;
    const i1 = (idx + 1) % this.maxDelay;
    const i2 = (idx + 2) % this.maxDelay;

    const xm1 = this.delayBuf[im1];
    const x0 = this.delayBuf[i0];
    const x1 = this.delayBuf[i1];
    const x2 = this.delayBuf[i2];

    // Hermite coefficients
    const c0 = x0;
    const c1 = 0.5 * (x1 - xm1);
    const c2 = xm1 - 2.5 * x0 + 2.0 * x1 - 0.5 * x2;
    const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);

    return ((c3 * frac + c2) * frac + c1) * frac + c0;
  }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
