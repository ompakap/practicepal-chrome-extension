// AudioWorklet processor for sample collection and audio pass-through
// Replaces deprecated ScriptProcessorNode

class SampleCollectorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.maxSamples = 44100 * 2; // 2 seconds at 44.1kHz
    this.sendInterval = 4096; // Send samples in chunks
    this.sampleCount = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (input.length === 0) return true;

    const inputChannel0 = input[0];
    if (!inputChannel0) return true;

    // Pass-through audio to output (all channels)
    for (let ch = 0; ch < output.length; ch++) {
      const inputCh = input[Math.min(ch, input.length - 1)];
      if (inputCh && output[ch]) {
        output[ch].set(inputCh);
      }
    }

    // Collect samples from channel 0
    for (let i = 0; i < inputChannel0.length; i++) {
      this.buffer.push(inputChannel0[i]);
    }
    this.sampleCount += inputChannel0.length;

    // Trim buffer to max size
    while (this.buffer.length > this.maxSamples) {
      this.buffer.shift();
    }

    // Send samples periodically
    if (this.sampleCount >= this.sendInterval) {
      this.port.postMessage({
        type: 'samples',
        samples: new Float32Array(this.buffer)
      });
      this.sampleCount = 0;
    }

    return true;
  }
}

registerProcessor('sample-collector-processor', SampleCollectorProcessor);
