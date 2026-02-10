// ChordSense - Advanced Chord Detector
// Implements Essentia.js-like algorithms in pure JavaScript
// Features: HPCP, CQT-like analysis, HMM chord smoothing, harmonic analysis

export class ChordDetector {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.isProcessing = false;
    
    // Processing mode
    this.mode = 'advanced';
    
    // Audio configuration
    this.processInterval = 200; // ms between processing
    this.lastProcessTime = 0;
    this.sampleBuffer = [];
    
    // Chord state
    this.lastChord = null;
    this.lastChordTime = 0;
    this.chordHistory = [];
    this.historySize = 12;
    this.minChordDuration = 300; // ms
    
    // Beat/onset state
    this.bpm = 0;
    this.lastBeatTime = 0;
    this.pendingChordChange = null;
    this.onsetTimes = []; // Track onset timestamps for BPM detection
    this.bpmHistory = [];
    this.bpmHistorySize = 10;
    this.onBPMDetected = null; // Callback for BPM updates
    
    // Key detection with confidence tracking
    this.detectedKey = null;
    this.keyConfidence = 0;
    this.keyHistory = [];
    this.keyHistorySize = 8;
    
    // HPCP configuration (Harmonic Pitch Class Profile)
    this.hpcpSize = 12;
    this.harmonics = 6;  // Number of harmonics to consider
    this.harmonicWeights = [1.0, 0.5, 0.33, 0.25, 0.2, 0.166]; // Harmonic weighting
    this.referenceFrequency = 440; // A4
    this.minFrequency = 40;
    this.maxFrequency = 5000;
    
    // Advanced onset detection
    this._lastSpectrum = null;
    this._lastPhase = null;
    this._fluxHistory = [];
    this._hfcHistory = [];
    this.onsetThreshold = 1.5;
    
    // Multi-resolution HPCP buffers
    this._hpcpBuffer = [];
    this._hpcpBufferSize = 5;
    
    // Chord templates with harmonic weights and inversions
    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    this.chordTemplates = this.generateAdvancedChordTemplates();
    
    // HMM transition matrix for chord smoothing
    this.transitionMatrix = this.buildHMMTransitionMatrix();
    this.emissionSmoothing = 0.1;
    
    // Viterbi state tracking
    this._viterbiStates = null;
    this._viterbiProbs = null;
    
    console.log('ChordDetector: Using advanced mode (Essentia-like algorithms)');
  }

  // ==================== INITIALIZATION ====================
  
  async start(stream) {
    console.log('ChordDetector: Starting advanced mode');
    this.stream = stream;
    
    // Setup audio context
    this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    const source = this.audioContext.createMediaStreamSource(stream);
    
    // High-resolution analyser for HPCP
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 16384; // Higher resolution for better frequency accuracy
    this.analyser.smoothingTimeConstant = 0.6;
    
    // Second analyser for onset detection (faster response)
    this.onsetAnalyser = this.audioContext.createAnalyser();
    this.onsetAnalyser.fftSize = 2048;
    this.onsetAnalyser.smoothingTimeConstant = 0.2;
    
    // AudioWorklet for sample collection and audio pass-through
    const workletUrl = new URL('sample-collector-worklet.js', import.meta.url).href;
    await this.audioContext.audioWorklet.addModule(workletUrl);
    const workletNode = new AudioWorkletNode(this.audioContext, 'sample-collector-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    workletNode.port.onmessage = (e) => {
      if (e.data.type === 'samples') {
        this.sampleBuffer = Array.from(e.data.samples);
      }
    };
    
    source.connect(this.analyser);
    source.connect(this.onsetAnalyser);
    this.analyser.connect(workletNode);
    workletNode.connect(this.audioContext.destination);
    
    this.workletNode = workletNode;
    this.source = source;
    this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
    this.onsetData = new Float32Array(this.onsetAnalyser.frequencyBinCount);
    this.isProcessing = true;
    
    console.log('ChordDetector: Started, sampleRate:', this.audioContext.sampleRate);
    this.processLoop();
  }

  stop() {
    this.isProcessing = false;
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.sampleBuffer = [];
    this._viterbiStates = null;
    this._viterbiProbs = null;
    console.log('ChordDetector: Stopped');
  }

  // ==================== MAIN PROCESSING LOOP ====================

  async processLoop() {
    if (!this.isProcessing) return;
    
    const now = Date.now();
    
    // Feed BPM detector at the fast rate (~50ms) for good autocorrelation resolution
    if (!this._lastBPMFeedTime) this._lastBPMFeedTime = 0;
    if (now - this._lastBPMFeedTime >= 50) {
      this._lastBPMFeedTime = now;
      this.onsetAnalyser.getFloatFrequencyData(this.onsetData);
      this._feedBPMDetector();
    }
    
    if (now - this.lastProcessTime >= this.processInterval) {
      this.lastProcessTime = now;
      this.processAdvanced();
    }
    
    setTimeout(() => this.processLoop(), 30);
  }

  processAdvanced() {
    // Get frequency data
    this.analyser.getFloatFrequencyData(this.frequencyData);
    this.onsetAnalyser.getFloatFrequencyData(this.onsetData);
    
    // 1. Compute HPCP (Harmonic Pitch Class Profile) - Essentia-style
    const hpcp = this.computeHPCP(this.frequencyData);
    
    // 2. Multi-resolution HPCP (average over time)
    this._hpcpBuffer.push(hpcp);
    if (this._hpcpBuffer.length > this._hpcpBufferSize) {
      this._hpcpBuffer.shift();
    }
    const smoothedHPCP = this.averageHPCP(this._hpcpBuffer);
    
    // 3. Detect key using enhanced algorithm
    if (!this._keyUpdateCount) this._keyUpdateCount = 0;
    if (++this._keyUpdateCount % 8 === 0) {
      const keyResult = this.detectKeyAdvanced(smoothedHPCP);
      this.detectedKey = keyResult.key;
      this.keyConfidence = keyResult.confidence;
    }
    
    // 4. Detect bass note with harmonic product spectrum
    const bassNote = this.detectBassHPS(this.frequencyData);
    
    // 5. Advanced onset detection (spectral flux + HFC)
    const isOnset = this.detectOnsetAdvanced();
    
    // 6. Match chords using template matching
    const chordScores = this.matchAllChords(smoothedHPCP, bassNote);
    
    // 7. Apply HMM smoothing with Viterbi
    const smoothedChord = this.viterbiSmooth(chordScores);
    
    // 8. Handle detection result
    if (smoothedChord.chord && smoothedChord.confidence > 0.4) {
      this.handleChordDetection(smoothedChord.chord, smoothedChord.confidence, isOnset, bassNote);
      
      // Debug logging
      if (!this._logCount) this._logCount = 0;
      if (++this._logCount % 10 === 0) {
        const keyInfo = this.detectedKey ? ` key=${this.detectedKey}(${(this.keyConfidence*100).toFixed(0)}%)` : '';
        const bassInfo = bassNote ? ` bass=${bassNote}` : '';
        console.log(`ChordSense: ${smoothedChord.chord} (${(smoothedChord.confidence*100).toFixed(0)}%)${keyInfo}${bassInfo}`);
      }
    }
  }

  // ==================== HPCP (Harmonic Pitch Class Profile) ====================
  
  computeHPCP(frequencyData) {
    const sampleRate = this.audioContext.sampleRate;
    const fftSize = this.analyser.fftSize;
    const binWidth = sampleRate / fftSize;
    
    const hpcp = new Array(this.hpcpSize).fill(0);
    
    // Get peaks from spectrum using parabolic interpolation
    const peaks = this.findSpectralPeaks(frequencyData, binWidth);
    
    // For each peak, add contribution to HPCP with harmonic weighting
    for (const peak of peaks) {
      if (peak.frequency < this.minFrequency || peak.frequency > this.maxFrequency) continue;
      
      // Map frequency to pitch class with sub-bin precision
      const pitchInfo = this.frequencyToPitchClass(peak.frequency);
      
      // Add contribution with cosine weighting for pitch accuracy
      const weight = peak.magnitude * this.cosineWeight(pitchInfo.cents);
      const pc = pitchInfo.pitchClass;
      
      // Add to main pitch class
      hpcp[pc] += weight;
      
      // Add harmonic contributions (assume this could be harmonic of lower pitch)
      for (let h = 1; h < this.harmonics; h++) {
        const fundamentalFreq = peak.frequency / (h + 1);
        if (fundamentalFreq >= this.minFrequency) {
          const fundPitch = this.frequencyToPitchClass(fundamentalFreq);
          const harmonicWeight = weight * this.harmonicWeights[h];
          hpcp[fundPitch.pitchClass] += harmonicWeight * this.cosineWeight(fundPitch.cents);
        }
      }
    }
    
    // Non-linear compression (Essentia uses this)
    for (let i = 0; i < this.hpcpSize; i++) {
      hpcp[i] = Math.log1p(hpcp[i]);
    }
    
    // Normalize
    const maxVal = Math.max(...hpcp);
    if (maxVal > 0) {
      for (let i = 0; i < this.hpcpSize; i++) {
        hpcp[i] /= maxVal;
      }
    }
    
    return hpcp;
  }

  findSpectralPeaks(frequencyData, binWidth) {
    const peaks = [];
    const minDB = -60;
    
    for (let i = 2; i < frequencyData.length - 2; i++) {
      const db = frequencyData[i];
      if (db < minDB) continue;
      
      // Check if local maximum
      if (db > frequencyData[i-1] && db > frequencyData[i+1] &&
          db > frequencyData[i-2] && db > frequencyData[i+2]) {
        
        // Parabolic interpolation for better frequency estimate
        const alpha = frequencyData[i-1];
        const beta = db;
        const gamma = frequencyData[i+1];
        
        const p = 0.5 * (alpha - gamma) / (alpha - 2*beta + gamma);
        const interpolatedBin = i + p;
        const frequency = interpolatedBin * binWidth;
        
        // Convert dB to linear magnitude
        const magnitude = Math.pow(10, (db + 80) / 40);
        
        peaks.push({ frequency, magnitude, bin: i });
      }
    }
    
    // Sort by magnitude and take top peaks
    peaks.sort((a, b) => b.magnitude - a.magnitude);
    return peaks.slice(0, 50);
  }

  frequencyToPitchClass(frequency) {
    // MIDI note number (fractional)
    const midiNote = 12 * Math.log2(frequency / this.referenceFrequency) + 69;
    const roundedNote = Math.round(midiNote);
    const cents = (midiNote - roundedNote) * 100; // Deviation in cents
    const pitchClass = ((roundedNote % 12) + 12) % 12;
    
    return { pitchClass, cents, midiNote };
  }

  cosineWeight(cents) {
    // Weight based on how close to exact pitch (max at 0 cents, min at ±50 cents)
    return Math.max(0, Math.cos(cents * Math.PI / 100));
  }

  averageHPCP(buffer) {
    const avg = new Array(this.hpcpSize).fill(0);
    if (buffer.length === 0) return avg;
    
    // Weighted average (more recent = higher weight)
    let totalWeight = 0;
    buffer.forEach((hpcp, idx) => {
      const weight = (idx + 1) / buffer.length;
      totalWeight += weight;
      for (let i = 0; i < this.hpcpSize; i++) {
        avg[i] += hpcp[i] * weight;
      }
    });
    
    for (let i = 0; i < this.hpcpSize; i++) {
      avg[i] /= totalWeight;
    }
    
    return avg;
  }

  // ==================== KEY DETECTION ====================

  detectKeyAdvanced(hpcp) {
    // Enhanced key detection with multiple profiles
    const profiles = {
      major: {
        // Krumhansl-Kessler profile
        kk: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
        // Temperley profile (CBMS)
        temperley: [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0],
      },
      minor: {
        kk: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
        temperley: [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0],
      }
    };
    
    let bestKey = null;
    let bestCorr = -Infinity;
    
    // Try all key rotations
    for (let shift = 0; shift < 12; shift++) {
      const rotatedHPCP = this.rotateArray(hpcp, shift);
      
      // Major key correlation (combine profiles)
      const corrMajorKK = this.correlate(rotatedHPCP, profiles.major.kk);
      const corrMajorT = this.correlate(rotatedHPCP, profiles.major.temperley);
      const corrMajor = corrMajorKK * 0.6 + corrMajorT * 0.4;
      
      if (corrMajor > bestCorr) {
        bestCorr = corrMajor;
        bestKey = this.noteNames[shift];
      }
      
      // Minor key correlation
      const corrMinorKK = this.correlate(rotatedHPCP, profiles.minor.kk);
      const corrMinorT = this.correlate(rotatedHPCP, profiles.minor.temperley);
      const corrMinor = corrMinorKK * 0.6 + corrMinorT * 0.4;
      
      if (corrMinor > bestCorr) {
        bestCorr = corrMinor;
        bestKey = this.noteNames[shift] + 'm';
      }
    }
    
    // Update key history for stability
    this.keyHistory.push({ key: bestKey, confidence: bestCorr });
    if (this.keyHistory.length > this.keyHistorySize) {
      this.keyHistory.shift();
    }
    
    // Get most confident key from history
    const keyVotes = {};
    this.keyHistory.forEach(entry => {
      const weight = entry.confidence > 0 ? entry.confidence : 0.1;
      keyVotes[entry.key] = (keyVotes[entry.key] || 0) + weight;
    });
    
    let stableKey = bestKey;
    let maxVotes = 0;
    for (const [key, votes] of Object.entries(keyVotes)) {
      if (votes > maxVotes) {
        maxVotes = votes;
        stableKey = key;
      }
    }
    
    return { key: stableKey, confidence: Math.max(0, bestCorr) };
  }

  rotateArray(arr, shift) {
    const result = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      result[i] = arr[(i + shift) % arr.length];
    }
    return result;
  }

  correlate(a, b) {
    const n = a.length;
    const meanA = a.reduce((s, v) => s + v, 0) / n;
    const meanB = b.reduce((s, v) => s + v, 0) / n;
    
    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < n; i++) {
      const da = a[i] - meanA;
      const db = b[i] - meanB;
      num += da * db;
      denA += da * da;
      denB += db * db;
    }
    
    return (denA === 0 || denB === 0) ? 0 : num / Math.sqrt(denA * denB);
  }

  // ==================== BASS DETECTION (Harmonic Product Spectrum) ====================

  detectBassHPS(frequencyData) {
    const sampleRate = this.audioContext.sampleRate;
    const fftSize = this.analyser.fftSize;
    const binWidth = sampleRate / fftSize;
    
    // Focus on bass range: 40-300 Hz
    const minBin = Math.floor(40 / binWidth);
    const maxBin = Math.floor(300 / binWidth);
    
    // Convert to linear magnitudes
    const magnitudes = new Array(maxBin - minBin).fill(0);
    for (let i = minBin; i < maxBin; i++) {
      magnitudes[i - minBin] = Math.pow(10, (frequencyData[i] + 80) / 40);
    }
    
    // Harmonic Product Spectrum - multiply original with downsampled versions
    const hps = [...magnitudes];
    const numHarmonics = 3;
    
    for (let h = 2; h <= numHarmonics; h++) {
      for (let i = 0; i < Math.floor(hps.length / h); i++) {
        hps[i] *= magnitudes[i * h] || 0;
      }
    }
    
    // Find peak in HPS
    let maxVal = 0, maxIdx = 0;
    for (let i = 0; i < hps.length / numHarmonics; i++) {
      if (hps[i] > maxVal) {
        maxVal = hps[i];
        maxIdx = i;
      }
    }
    
    // Convert to pitch class
    const frequency = (minBin + maxIdx) * binWidth;
    if (frequency < 40 || maxVal < 1e-6) return null;
    
    const pitchInfo = this.frequencyToPitchClass(frequency);
    
    // Verify with simple chroma check
    const bassChroma = new Array(12).fill(0);
    for (let i = minBin; i < maxBin; i++) {
      const freq = i * binWidth;
      const mag = Math.pow(10, (frequencyData[i] + 60) / 20);
      if (mag > 0.01) {
        const pc = this.frequencyToPitchClass(freq).pitchClass;
        bassChroma[pc] += mag;
      }
    }
    
    const totalBass = bassChroma.reduce((a, b) => a + b, 0);
    if (totalBass > 0) {
      const ratio = bassChroma[pitchInfo.pitchClass] / totalBass;
      if (ratio > 0.2) {
        return this.noteNames[pitchInfo.pitchClass];
      }
    }
    
    return null;
  }

  // ==================== ONSET DETECTION ====================

  detectOnsetAdvanced() {
    // Combined spectral flux + high-frequency content (HFC) onset detection
    const data = this.onsetData;
    
    // Initialize history
    if (!this._lastOnsetSpectrum) {
      this._lastOnsetSpectrum = Array.from(data);
      this._fluxHistory = [];
      this._hfcHistory = [];
      return false;
    }
    
    // Spectral Flux (rectified)
    let flux = 0;
    for (let i = 0; i < data.length; i++) {
      const diff = data[i] - this._lastOnsetSpectrum[i];
      if (diff > 0) flux += diff * diff;
    }
    flux = Math.sqrt(flux);
    
    // High-Frequency Content (HFC) - weights higher frequencies more
    let hfc = 0;
    for (let i = 0; i < data.length; i++) {
      const mag = Math.pow(10, (data[i] + 80) / 40);
      hfc += mag * (i + 1);
    }
    
    this._fluxHistory.push(flux);
    this._hfcHistory.push(hfc);
    if (this._fluxHistory.length > 20) this._fluxHistory.shift();
    if (this._hfcHistory.length > 20) this._hfcHistory.shift();
    
    this._lastOnsetSpectrum = Array.from(data);
    
    // Adaptive threshold
    const avgFlux = this._fluxHistory.reduce((a, b) => a + b, 0) / this._fluxHistory.length;
    const avgHFC = this._hfcHistory.reduce((a, b) => a + b, 0) / this._hfcHistory.length;
    
    const fluxOnset = flux > avgFlux * this.onsetThreshold;
    const hfcOnset = hfc > avgHFC * this.onsetThreshold;
    
    const isOnset = fluxOnset || hfcOnset;
    
    return isOnset;
  }

  // ==================== BPM DETECTION (Autocorrelation-based) ====================

  _feedBPMDetector() {
    // Use low-frequency energy (bass) for beat detection — much more reliable than onset events
    const data = this.onsetData;
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const binWidth = sampleRate / (this.onsetAnalyser?.fftSize || 2048);
    
    // Compute sub-band energy: focus on 40-200 Hz range (kick drum, bass)
    const lowBin = Math.floor(40 / binWidth);
    const highBin = Math.min(Math.ceil(200 / binWidth), data.length - 1);
    
    let energy = 0;
    for (let i = lowBin; i <= highBin; i++) {
      // Convert dB to linear magnitude
      const mag = Math.pow(10, (data[i] + 80) / 20);
      energy += mag * mag;
    }
    energy = Math.sqrt(energy);
    
    // Also compute mid-band energy (200-2000 Hz) for snare/percussion
    const midLowBin = Math.ceil(200 / binWidth);
    const midHighBin = Math.min(Math.ceil(2000 / binWidth), data.length - 1);
    let midEnergy = 0;
    for (let i = midLowBin; i <= midHighBin; i++) {
      const mag = Math.pow(10, (data[i] + 80) / 20);
      midEnergy += mag * mag;
    }
    midEnergy = Math.sqrt(midEnergy);
    
    // Combined energy with emphasis on low-frequency (bass tracks the beat)
    const combinedEnergy = energy * 0.7 + midEnergy * 0.3;
    
    // Store energy samples for autocorrelation
    if (!this._energyBuffer) {
      // ~6 seconds of energy frames at ~50ms intervals
      this._energyBuffer = [];
      this._energyBufferSize = 120; // ~6s at ~50ms per frame
      this._bpmFrameCount = 0;
      this._bpmCalcInterval = 30; // Recalculate BPM every ~30 frames (~1.5s)
    }
    
    this._energyBuffer.push(combinedEnergy);
    if (this._energyBuffer.length > this._energyBufferSize) {
      this._energyBuffer.shift();
    }
    this._bpmFrameCount++;
    
    // Need enough data (~3s) and recalculate periodically
    if (this._energyBuffer.length >= 60 && this._bpmFrameCount % this._bpmCalcInterval === 0) {
      this._calculateBPMAutocorrelation();
    }
  }

  _calculateBPMAutocorrelation() {
    const energy = this._energyBuffer;
    const N = energy.length;
    
    // Step 1: Normalize energy (subtract mean, divide by std dev)
    const mean = energy.reduce((a, b) => a + b, 0) / N;
    const variance = energy.reduce((a, b) => a + (b - mean) ** 2, 0) / N;
    const std = Math.sqrt(variance);
    
    if (std < 0.001) return; // No meaningful audio
    
    const normalized = energy.map(e => (e - mean) / std);
    
    // Step 2: Compute autocorrelation for lag range corresponding to 50-200 BPM
    // Frame interval is ~50ms (BPM feed runs every 50ms)
    const frameInterval = 50; // ms
    const minLag = Math.floor(60000 / (200 * frameInterval)); // 200 BPM -> 6 frames
    const maxLag = Math.ceil(60000 / (50 * frameInterval));   // 50 BPM  -> 24 frames
    
    const autocorr = [];
    for (let lag = minLag; lag <= Math.min(maxLag, N - 1); lag++) {
      let sum = 0;
      let count = N - lag;
      for (let i = 0; i < count; i++) {
        sum += normalized[i] * normalized[i + lag];
      }
      autocorr.push({ lag, value: sum / count });
    }
    
    if (autocorr.length === 0) return;
    
    // Step 3: Find peaks in autocorrelation
    const peaks = [];
    for (let i = 1; i < autocorr.length - 1; i++) {
      if (autocorr[i].value > autocorr[i - 1].value &&
          autocorr[i].value > autocorr[i + 1].value &&
          autocorr[i].value > 0.05) { // Minimum correlation threshold
        // Parabolic interpolation for sub-frame accuracy
        const y0 = autocorr[i - 1].value;
        const y1 = autocorr[i].value;
        const y2 = autocorr[i + 1].value;
        const refinedOffset = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2);
        const refinedLag = autocorr[i].lag + (isFinite(refinedOffset) ? refinedOffset : 0);
        
        peaks.push({
          lag: refinedLag,
          strength: autocorr[i].value
        });
      }
    }
    
    if (peaks.length === 0) return;
    
    // Step 4: Convert peaks to BPM candidates and score them
    const candidates = [];
    for (const peak of peaks) {
      const bpm = 60000 / (peak.lag * frameInterval);
      
      if (bpm >= 50 && bpm <= 200) {
        // Perceptual weighting: prefer tempos in 80-160 range (most common in music)
        let perceptualWeight = 1.0;
        if (bpm >= 80 && bpm <= 160) {
          perceptualWeight = 1.3;
        }
        if (bpm >= 90 && bpm <= 140) {
          perceptualWeight = 1.5;
        }
        
        candidates.push({
          bpm: Math.round(bpm),
          score: peak.strength * perceptualWeight
        });
      }
    }
    
    if (candidates.length === 0) return;
    
    // Step 5: Check for octave errors (half/double tempo relationships)
    // Sort by score, then check if the top candidate's double or half also appears
    candidates.sort((a, b) => b.score - a.score);
    const topBPM = candidates[0].bpm;
    const topScore = candidates[0].score;
    
    // Check if half-time or double-time has a strong peak too
    let bestBPM = topBPM;
    for (const c of candidates) {
      const ratio = c.bpm / topBPM;
      // If a candidate at double tempo has a decent score, prefer it if in the sweet range
      if (Math.abs(ratio - 2.0) < 0.1 && c.score > topScore * 0.5 && c.bpm >= 80 && c.bpm <= 160) {
        bestBPM = c.bpm;
        break;
      }
      // If top is high and half-tempo is in the sweet range, prefer half
      if (Math.abs(ratio - 0.5) < 0.1 && c.score > topScore * 0.5 && c.bpm >= 80 && c.bpm <= 160) {
        bestBPM = c.bpm;
        break;
      }
    }
    
    // Step 6: Smooth BPM with history and outlier rejection
    this.bpmHistory.push(bestBPM);
    if (this.bpmHistory.length > this.bpmHistorySize) {
      this.bpmHistory.shift();
    }
    
    // Need at least 2 estimates before reporting
    if (this.bpmHistory.length < 2) return;
    
    // Use weighted median — reject outliers
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const medianBPM = sorted[Math.floor(sorted.length / 2)];
    
    // Additionally, compute mean of values within 15% of median (reject outliers)
    const tolerance = medianBPM * 0.15;
    const inliers = sorted.filter(b => Math.abs(b - medianBPM) <= tolerance);
    const finalBPM = inliers.length > 0
      ? Math.round(inliers.reduce((a, b) => a + b, 0) / inliers.length)
      : medianBPM;
    
    console.log('BPM: Autocorrelation result:', finalBPM, 
      '(candidates:', candidates.slice(0, 3).map(c => `${c.bpm}@${c.score.toFixed(2)}`).join(', '),
      ', history:', this.bpmHistory.join(','), ')');
    
    if (finalBPM !== this.bpm && finalBPM > 0) {
      this.bpm = finalBPM;
      console.log('BPM: Updated to', this.bpm);
      if (this.onBPMDetected) {
        this.onBPMDetected(this.bpm);
      }
    }
  }

  getBPM() {
    return this.bpm;
  }

  resetBPM() {
    this.bpm = 0;
    this.onsetTimes = [];
    this.bpmHistory = [];
    this._energyBuffer = null;
    this._bpmFrameCount = 0;
  }

  // ==================== CHORD TEMPLATES ====================

  generateAdvancedChordTemplates() {
    const templates = {};
    
    // Extended chord types with weighted intervals
    // [intervals, weights] - weights indicate importance of each note
    const chordTypes = {
      '':      { intervals: [0, 4, 7],       weights: [1.0, 0.7, 0.6] },           // Major
      'm':     { intervals: [0, 3, 7],       weights: [1.0, 0.7, 0.6] },           // Minor
      '7':     { intervals: [0, 4, 7, 10],   weights: [1.0, 0.6, 0.5, 0.55] },     // Dominant 7
      'maj7':  { intervals: [0, 4, 7, 11],   weights: [1.0, 0.6, 0.5, 0.55] },     // Major 7
      'm7':    { intervals: [0, 3, 7, 10],   weights: [1.0, 0.6, 0.5, 0.55] },     // Minor 7
      'dim':   { intervals: [0, 3, 6],       weights: [1.0, 0.7, 0.7] },           // Diminished
      'aug':   { intervals: [0, 4, 8],       weights: [1.0, 0.7, 0.7] },           // Augmented
      'sus4':  { intervals: [0, 5, 7],       weights: [1.0, 0.6, 0.6] },           // Suspended 4
      'sus2':  { intervals: [0, 2, 7],       weights: [1.0, 0.6, 0.6] },           // Suspended 2
      'add9':  { intervals: [0, 4, 7, 14],   weights: [1.0, 0.6, 0.5, 0.4] },      // Add 9
      'm9':    { intervals: [0, 3, 7, 10, 14], weights: [1.0, 0.6, 0.5, 0.45, 0.35] }, // Minor 9
      '9':     { intervals: [0, 4, 7, 10, 14], weights: [1.0, 0.6, 0.5, 0.45, 0.35] }, // Dominant 9
    };
    
    this.noteNames.forEach((root, rootIndex) => {
      Object.entries(chordTypes).forEach(([type, { intervals, weights }]) => {
        const chordName = `${root}${type}`;
        const chroma = new Array(12).fill(0);
        
        intervals.forEach((interval, idx) => {
          const pc = (rootIndex + interval) % 12;
          chroma[pc] += weights[idx];
        });
        
        // Normalize
        const sum = chroma.reduce((a, b) => a + b, 0);
        templates[chordName] = chroma.map(v => v / sum);
      });
    });
    
    return templates;
  }

  matchAllChords(hpcp, bassNote) {
    const scores = {};
    const keyChords = this.detectedKey ? this.getKeyChords(this.detectedKey) : null;
    
    for (const [name, template] of Object.entries(this.chordTemplates)) {
      let score = this.chordSimilarity(hpcp, template);
      
      // Boost if chord root matches bass (very important for accuracy)
      if (bassNote) {
        const chordRoot = name.match(/^[A-G]#?/)?.[0];
        if (chordRoot === bassNote) {
          score *= 1.2;
        }
      }
      
      // Boost chords in detected key
      if (keyChords && keyChords.includes(name)) {
        score *= 1.1;
      }
      
      scores[name] = score;
    }
    
    return scores;
  }

  chordSimilarity(hpcp, template) {
    // Combined cosine similarity and correlation
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < 12; i++) {
      dot += hpcp[i] * template[i];
      normA += hpcp[i] * hpcp[i];
      normB += template[i] * template[i];
    }
    const cosine = (normA === 0 || normB === 0) ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
    const corr = this.correlate(hpcp, template);
    
    // Weighted combination
    return cosine * 0.6 + (corr + 1) / 2 * 0.4;
  }

  getKeyChords(key) {
    const isMinor = key.endsWith('m');
    const root = key.replace('m', '');
    const rootIdx = this.noteNames.indexOf(root);
    if (rootIdx === -1) return null;
    
    const n = this.noteNames;
    if (isMinor) {
      return [
        n[rootIdx] + 'm',                    // i
        n[(rootIdx + 2) % 12] + 'dim',       // ii°
        n[(rootIdx + 3) % 12],               // III
        n[(rootIdx + 5) % 12] + 'm',         // iv
        n[(rootIdx + 7) % 12] + 'm',         // v (or V)
        n[(rootIdx + 8) % 12],               // VI
        n[(rootIdx + 10) % 12],              // VII
      ];
    } else {
      return [
        n[rootIdx],                          // I
        n[(rootIdx + 2) % 12] + 'm',         // ii
        n[(rootIdx + 4) % 12] + 'm',         // iii
        n[(rootIdx + 5) % 12],               // IV
        n[(rootIdx + 7) % 12],               // V
        n[(rootIdx + 9) % 12] + 'm',         // vi
        n[(rootIdx + 11) % 12] + 'dim',      // vii°
      ];
    }
  }

  // ==================== HMM SMOOTHING (Viterbi) ====================

  buildHMMTransitionMatrix() {
    const notes = this.noteNames;
    const matrix = {};
    
    // Build transition probabilities for each key
    notes.forEach((root, i) => {
      const I = notes[i];
      const ii = notes[(i + 2) % 12] + 'm';
      const iii = notes[(i + 4) % 12] + 'm';
      const IV = notes[(i + 5) % 12];
      const V = notes[(i + 7) % 12];
      const vi = notes[(i + 9) % 12] + 'm';
      const vii = notes[(i + 11) % 12] + 'dim';
      
      // Common progressions with probabilities
      const progressions = {
        [I]: { [I]: 0.15, [IV]: 0.25, [V]: 0.25, [vi]: 0.15, [ii]: 0.1, [iii]: 0.05 },
        [ii]: { [V]: 0.4, [IV]: 0.2, [vii]: 0.1, [I]: 0.15, [vi]: 0.1 },
        [iii]: { [vi]: 0.3, [IV]: 0.25, [ii]: 0.2, [I]: 0.15 },
        [IV]: { [I]: 0.25, [V]: 0.3, [vi]: 0.2, [ii]: 0.15, [IV]: 0.1 },
        [V]: { [I]: 0.5, [vi]: 0.2, [IV]: 0.15, [V]: 0.1 },
        [vi]: { [IV]: 0.25, [ii]: 0.2, [V]: 0.2, [I]: 0.15, [iii]: 0.1, [vi]: 0.1 },
      };
      
      for (const [from, tos] of Object.entries(progressions)) {
        if (!matrix[from]) matrix[from] = {};
        for (const [to, prob] of Object.entries(tos)) {
          matrix[from][to] = prob;
        }
      }
    });
    
    return matrix;
  }

  viterbiSmooth(chordScores) {
    const chords = Object.keys(chordScores);
    
    // Initialize Viterbi states
    if (!this._viterbiStates || this._viterbiStates.length === 0) {
      this._viterbiStates = [chordScores];
      const best = this.getBestChord(chordScores);
      this._viterbiProbs = { [best.chord]: best.score };
      return { chord: best.chord, confidence: best.score };
    }
    
    // Compute new probabilities
    const newProbs = {};
    
    for (const chord of chords) {
      const emission = chordScores[chord] || 0.001;
      let maxProb = 0;
      
      for (const prevChord of Object.keys(this._viterbiProbs)) {
        const prevProb = this._viterbiProbs[prevChord];
        const trans = this.transitionMatrix[prevChord]?.[chord] || 0.02;
        const prob = prevProb * trans * emission;
        if (prob > maxProb) {
          maxProb = prob;
        }
      }
      
      newProbs[chord] = maxProb;
    }
    
    // Normalize
    const total = Object.values(newProbs).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const chord of chords) {
        newProbs[chord] /= total;
      }
    }
    
    this._viterbiProbs = newProbs;
    this._viterbiStates.push(chordScores);
    if (this._viterbiStates.length > 5) {
      this._viterbiStates.shift();
    }
    
    // Get best chord
    let bestChord = null;
    let bestProb = 0;
    for (const [chord, prob] of Object.entries(newProbs)) {
      if (prob > bestProb) {
        bestProb = prob;
        bestChord = chord;
      }
    }
    
    // Combine HMM probability with raw score
    const rawScore = chordScores[bestChord] || 0;
    const confidence = rawScore * 0.7 + bestProb * 0.3;
    
    return { chord: bestChord, confidence };
  }

  getBestChord(scores) {
    let best = { chord: null, score: 0 };
    for (const [chord, score] of Object.entries(scores)) {
      if (score > best.score) {
        best = { chord, score };
      }
    }
    return best;
  }

  // ==================== CHORD HANDLING ====================

  handleChordDetection(chord, confidence, isOnset, bassNote) {
    const now = Date.now();
    
    this.chordHistory.push({ chord, confidence, time: now, isOnset, bassNote });
    while (this.chordHistory.length > this.historySize) {
      this.chordHistory.shift();
    }
    
    const consensus = this.getConsensusChord();
    if (!consensus) return;
    
    const timeSinceLastChange = now - this.lastChordTime;
    const isDifferent = consensus.chord !== this.lastChord;
    const isConfident = consensus.confidence > 0.45;
    const hasEnoughTime = timeSinceLastChange >= this.minChordDuration;
    
    if (isDifferent && isConfident) {
      if (!hasEnoughTime && !isOnset) {
        this.pendingChordChange = { chord: consensus.chord, confidence: consensus.confidence };
        return;
      }
      
      if (hasEnoughTime || isOnset) {
        this.emitChord(consensus.chord, consensus.confidence);
      }
    }
    
    if (isOnset && this.pendingChordChange) {
      this.emitChord(this.pendingChordChange.chord, this.pendingChordChange.confidence);
      this.pendingChordChange = null;
    }
  }

  getConsensusChord() {
    if (this.chordHistory.length < 3) return null;
    
    const recentWindow = 500;
    const now = Date.now();
    const weights = {};
    let totalWeight = 0;
    
    this.chordHistory.forEach(entry => {
      const age = now - entry.time;
      if (age > recentWindow) return;
      
      let weight = Math.exp(-age / 150) * entry.confidence;
      if (entry.isOnset) weight *= 1.5;
      
      weights[entry.chord] = (weights[entry.chord] || 0) + weight;
      totalWeight += weight;
    });
    
    if (totalWeight === 0) return null;
    
    let bestChord = null;
    let bestWeight = 0;
    
    for (const [chord, weight] of Object.entries(weights)) {
      if (weight > bestWeight) {
        bestWeight = weight;
        bestChord = chord;
      }
    }
    
    const ratio = bestWeight / totalWeight;
    if (ratio < 0.35) return null;
    
    return { chord: bestChord, confidence: ratio };
  }

  emitChord(chord, confidence) {
    this.lastChord = chord;
    this.lastChordTime = Date.now();
    console.log(`ChordSense: ► ${chord} (${Math.round(confidence * 100)}%)`);
    this.onChordDetected(chord, confidence);
  }

  onChordDetected(chord, confidence) {
    // Override in offscreen.js
  }
}

export default ChordDetector;
