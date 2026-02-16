// ===== GUITAR AUDIO SYNTHESIZER =====
// Plays guitar chord strums and single notes using Web Audio API

window.GuitarSynth = class GuitarSynth {
  constructor() {
    this.ctx = null;
  }

  ensureContext() {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play a single note
  playNote(frequency, duration = 1.0, startTime = 0) {
    const ctx = this.ensureContext();
    const now = ctx.currentTime + startTime;

    // Use two detuned oscillators for a richer sound
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.value = frequency;
    osc2.frequency.value = frequency * 1.003; // slight detune

    // Gain envelope: sharp attack, quick decay, sustain, release
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.005); // attack
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.08); // decay
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration); // release

    // Mix oscillators
    const mix = ctx.createGain();
    mix.gain.value = 0.5;

    osc1.connect(gain);
    osc2.connect(mix);
    mix.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  // Play a chord (strum all notes with slight delay)
  playChord(notes, direction = 'down') {
    const ctx = this.ensureContext();
    const strumDelay = 0.025; // 25ms between strings
    const duration = 2.0;

    // Filter out null/muted notes
    const playable = notes.filter(n => n && n.freq);
    if (direction === 'up') playable.reverse();

    playable.forEach((note, i) => {
      this.playNote(note.freq, duration - i * strumDelay, i * strumDelay);
    });
  }

  // Play arpeggio (notes one by one)
  playArpeggio(notes) {
    const playable = notes.filter(n => n && n.freq);
    const noteDelay = 0.2;
    playable.forEach((note, i) => {
      this.playNote(note.freq, 0.8, i * noteDelay);
    });
  }

  // Play a single string click (for interactive diagram)
  pluck(frequency) {
    this.playNote(frequency, 1.5, 0);
  }
};
