// PracticePal - Metronome Module
// Provides beat synchronization and visual/audio click

class Metronome {
  constructor() {
    this.audioContext = null;
    this.bpm = 120;
    this.isPlaying = false;
    this.intervalId = null;
    this.beatCount = 0;
    this.beatsPerMeasure = 4;
    this.volume = 0.5;
    
    // Callbacks
    this.onBeat = null;
    this.onMeasure = null;
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  setBPM(bpm) {
    this.bpm = Math.max(30, Math.min(300, bpm));
    if (this.isPlaying) {
      this.stop();
      this.start();
    }
  }

  getBPM() {
    return this.bpm;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setBeatsPerMeasure(beats) {
    this.beatsPerMeasure = Math.max(1, Math.min(12, beats));
    this.beatCount = 0;
  }

  start() {
    if (this.isPlaying) return;
    
    this.init();
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    this.isPlaying = true;
    this.beatCount = 0;
    
    const intervalMs = 60000 / this.bpm;
    
    // Play first beat immediately
    this.playClick(true);
    
    this.intervalId = setInterval(() => {
      this.beatCount = (this.beatCount + 1) % this.beatsPerMeasure;
      const isDownbeat = this.beatCount === 0;
      this.playClick(isDownbeat);
    }, intervalMs);
  }

  stop() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.beatCount = 0;
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this.isPlaying;
  }

  playClick(isDownbeat = false) {
    if (!this.audioContext || this.volume === 0) return;
    
    const now = this.audioContext.currentTime;
    
    // Create oscillator for click sound
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    // Higher pitch for downbeat
    osc.frequency.value = isDownbeat ? 1000 : 800;
    osc.type = 'sine';
    
    // Short click envelope
    const clickDuration = 0.03;
    gain.gain.setValueAtTime(this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + clickDuration);
    
    osc.start(now);
    osc.stop(now + clickDuration);
    
    // Fire callbacks
    if (this.onBeat) {
      this.onBeat(this.beatCount, isDownbeat);
    }
    if (isDownbeat && this.onMeasure) {
      this.onMeasure();
    }
  }

  // Tap tempo - call this on each tap
  tapTimes = [];
  
  tap() {
    const now = Date.now();
    
    // Clear old taps (more than 2 seconds gap)
    if (this.tapTimes.length > 0) {
      const lastTap = this.tapTimes[this.tapTimes.length - 1];
      if (now - lastTap > 2000) {
        this.tapTimes = [];
      }
    }
    
    this.tapTimes.push(now);
    
    // Keep last 8 taps
    if (this.tapTimes.length > 8) {
      this.tapTimes.shift();
    }
    
    // Need at least 2 taps
    if (this.tapTimes.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < this.tapTimes.length; i++) {
        totalInterval += this.tapTimes[i] - this.tapTimes[i - 1];
      }
      const avgInterval = totalInterval / (this.tapTimes.length - 1);
      const bpm = Math.round(60000 / avgInterval);
      
      if (bpm >= 30 && bpm <= 300) {
        this.setBPM(bpm);
        return bpm;
      }
    }
    
    return null;
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      bpm: this.bpm,
      volume: this.volume,
      beatsPerMeasure: this.beatsPerMeasure,
      currentBeat: this.beatCount
    };
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.PracticePalMetronome = Metronome;
}
