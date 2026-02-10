// Real-time pitch shifter using granular synthesis (dual-pointer crossfade)
// This shifts pitch WITHOUT affecting playback speed

class PitchShifterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'pitchFactor',
        defaultValue: 1.0,
        minValue: 0.5,
        maxValue: 2.0,
        automationRate: 'k-rate'
      }
    ];
  }

  constructor() {
    super();
    // Circular buffer (must be power of 2 for fast masking)
    this.bufferSize = 8192;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferMask = this.bufferSize - 1;

    // Write position (integer, advances 1 sample per input sample)
    this.writePos = 0;

    // Two read pointers for crossfading
    this.readPos1 = 0;
    this.readPos2 = this.bufferSize / 2; // offset by half buffer

    // Grain/crossfade window size
    this.grainSize = 1024;
    this.overlap = this.grainSize; // crossfade region = full grain for smooth blending

    this.port.onmessage = (e) => {
      if (e.data.type === 'setPitch') {
        // Handled via AudioParam, but also accept messages as fallback
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const pitchFactor = parameters.pitchFactor[0];
    const blockSize = input[0].length;

    // Process each channel
    for (let ch = 0; ch < input.length; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch] || output[0];

      if (ch === 0) {
        // Write input to circular buffer (only once for mono, channel 0)
        for (let i = 0; i < blockSize; i++) {
          this.buffer[(this.writePos + i) & this.bufferMask] = inputChannel[i];
        }
      }

      // If pitch factor is 1, pass through directly
      if (Math.abs(pitchFactor - 1.0) < 0.001) {
        outputChannel.set(inputChannel);
        continue;
      }

      // Read from buffer with pitch-shifted rate using two crossfaded pointers
      for (let i = 0; i < blockSize; i++) {
        // Advance read pointers at pitch rate
        this.readPos1 += pitchFactor;
        this.readPos2 += pitchFactor;

        // Wrap read positions
        if (this.readPos1 >= this.bufferSize) this.readPos1 -= this.bufferSize;
        if (this.readPos2 >= this.bufferSize) this.readPos2 -= this.bufferSize;
        if (this.readPos1 < 0) this.readPos1 += this.bufferSize;
        if (this.readPos2 < 0) this.readPos2 += this.bufferSize;

        // Interpolated reads
        const val1 = this.interpolate(this.readPos1);
        const val2 = this.interpolate(this.readPos2);

        // Crossfade based on distance between read and write pointers
        const dist1 = this.circularDistance(this.readPos1, this.writePos + i);
        const dist2 = this.circularDistance(this.readPos2, this.writePos + i);

        // Fade: when a read pointer gets too close to write pointer, fade it out
        const fade1 = this.calculateFade(dist1);
        const fade2 = this.calculateFade(dist2);

        // Reset pointer if it gets too close to write position
        if (dist1 < 128) {
          this.readPos1 = (this.writePos + i - this.bufferSize / 2) & this.bufferMask;
        }
        if (dist2 < 128) {
          this.readPos2 = (this.writePos + i - this.bufferSize / 2) & this.bufferMask;
        }

        // Mix the two pointers
        const totalFade = fade1 + fade2;
        if (totalFade > 0) {
          outputChannel[i] = (val1 * fade1 + val2 * fade2) / totalFade;
        } else {
          outputChannel[i] = 0;
        }
      }
    }

    // Advance write position
    this.writePos = (this.writePos + blockSize) & this.bufferMask;

    return true;
  }

  // Linear interpolation from circular buffer
  interpolate(pos) {
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = this.buffer[idx & this.bufferMask];
    const s1 = this.buffer[(idx + 1) & this.bufferMask];
    return s0 + frac * (s1 - s0);
  }

  // Circular distance between two positions (always positive, in range 0..bufferSize/2)
  circularDistance(a, b) {
    let d = Math.abs(((a - b) % this.bufferSize + this.bufferSize) % this.bufferSize);
    if (d > this.bufferSize / 2) d = this.bufferSize - d;
    return d;
  }

  // Fade function: full volume when far from write pointer, fade out when close
  calculateFade(distance) {
    const fadeZone = 512;
    if (distance < 128) return 0;
    if (distance < fadeZone) return (distance - 128) / (fadeZone - 128);
    return 1.0;
  }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
