// ===== GUITAR CHORD DATA LIBRARY =====
// Complete chord database with shapes, music theory, diatonic system

window.ChordData = (() => {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const ENHARMONIC = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

  // Guitar standard tuning: string 6(low E) to string 1(high E)
  // Note indices in chromatic scale (C=0)
  const TUNING = [4, 9, 2, 7, 11, 4]; // E A D G B E

  // Interval names from root
  const INTERVAL_NAMES = ['R', 'm2', 'M2', 'm3', 'M3', 'P4', 'b5', 'P5', '#5', 'M6', 'm7', 'M7'];
  // Extended interval names
  const EXT_INTERVAL_NAMES = { 0:'R', 1:'m2', 2:'M2/9', 3:'m3', 4:'M3', 5:'P4/11', 6:'b5', 7:'P5', 8:'#5', 9:'M6/13', 10:'m7', 11:'M7', 14:'9', 17:'11', 21:'13' };

  // ===== CHORD TYPES =====
  const CHORD_TYPES = {
    maj:    { name: 'Major',         intervals: [0,4,7],          symbol: '' },
    min:    { name: 'Minor',         intervals: [0,3,7],          symbol: 'm' },
    '7':    { name: 'Dominant 7',    intervals: [0,4,7,10],       symbol: '7' },
    maj7:   { name: 'Major 7',       intervals: [0,4,7,11],       symbol: 'maj7' },
    m7:     { name: 'Minor 7',       intervals: [0,3,7,10],       symbol: 'm7' },
    dim:    { name: 'Diminished',    intervals: [0,3,6],          symbol: 'dim' },
    aug:    { name: 'Augmented',     intervals: [0,4,8],          symbol: 'aug' },
    sus2:   { name: 'Suspended 2',   intervals: [0,2,7],          symbol: 'sus2' },
    sus4:   { name: 'Suspended 4',   intervals: [0,5,7],          symbol: 'sus4' },
    dim7:   { name: 'Diminished 7',  intervals: [0,3,6,9],        symbol: '°7' },
    m7b5:   { name: 'Half Dim',      intervals: [0,3,6,10],       symbol: 'ø7' },
    '6':    { name: 'Major 6',       intervals: [0,4,7,9],        symbol: '6' },
    m6:     { name: 'Minor 6',       intervals: [0,3,7,9],        symbol: 'm6' },
    '9':    { name: 'Dominant 9',    intervals: [0,4,7,10,14],    symbol: '9' },
    maj9:   { name: 'Major 9',       intervals: [0,4,7,11,14],    symbol: 'maj9' },
    m9:     { name: 'Minor 9',       intervals: [0,3,7,10,14],    symbol: 'm9' },
    add9:   { name: 'Add 9',         intervals: [0,4,7,14],       symbol: 'add9' },
    '7sus4':{ name: '7sus4',         intervals: [0,5,7,10],       symbol: '7sus4' },
    '7b9':  { name: '7 flat 9',      intervals: [0,4,7,10,13],    symbol: '7♭9' },
    '7#9':  { name: '7 sharp 9',     intervals: [0,4,7,10,15],    symbol: '7#9' },
    aug7:   { name: 'Aug 7',         intervals: [0,4,8,10],       symbol: '+7' },
    '11':   { name: 'Dominant 11',   intervals: [0,4,7,10,14,17], symbol: '11' },
    '13':   { name: 'Dominant 13',   intervals: [0,4,7,10,14,21], symbol: '13' },
  };

  // ===== SCALE DEFINITIONS =====
  const SCALES = {
    major:          { name: 'Major',          steps: [0,2,4,5,7,9,11] },
    natural_minor:  { name: 'Natural Minor',  steps: [0,2,3,5,7,8,10] },
    harmonic_minor: { name: 'Harmonic Minor', steps: [0,2,3,5,7,8,11] },
    melodic_minor:  { name: 'Melodic Minor',  steps: [0,2,3,5,7,9,11] },
  };

  // Diatonic chord qualities for each scale degree (with 7th extensions)
  const DIATONIC = {
    major: [
      { degree: 'I',    triad: 'maj', seventh: 'maj7', numeral: 'I' },
      { degree: 'ii',   triad: 'min', seventh: 'm7',   numeral: 'ii' },
      { degree: 'iii',  triad: 'min', seventh: 'm7',   numeral: 'iii' },
      { degree: 'IV',   triad: 'maj', seventh: 'maj7', numeral: 'IV' },
      { degree: 'V',    triad: 'maj', seventh: '7',    numeral: 'V' },
      { degree: 'vi',   triad: 'min', seventh: 'm7',   numeral: 'vi' },
      { degree: 'vii°', triad: 'dim', seventh: 'm7b5', numeral: 'vii°' },
    ],
    natural_minor: [
      { degree: 'i',    triad: 'min', seventh: 'm7',   numeral: 'i' },
      { degree: 'ii°',  triad: 'dim', seventh: 'm7b5', numeral: 'ii°' },
      { degree: 'III',  triad: 'maj', seventh: 'maj7', numeral: 'III' },
      { degree: 'iv',   triad: 'min', seventh: 'm7',   numeral: 'iv' },
      { degree: 'v',    triad: 'min', seventh: 'm7',   numeral: 'v' },
      { degree: 'VI',   triad: 'maj', seventh: 'maj7', numeral: 'VI' },
      { degree: 'VII',  triad: 'maj', seventh: '7',    numeral: 'VII' },
    ],
    harmonic_minor: [
      { degree: 'i',    triad: 'min', seventh: 'mMaj7', numeral: 'i' },
      { degree: 'ii°',  triad: 'dim', seventh: 'm7b5',  numeral: 'ii°' },
      { degree: 'III+', triad: 'aug', seventh: 'aug7',  numeral: 'III+' },
      { degree: 'iv',   triad: 'min', seventh: 'm7',    numeral: 'iv' },
      { degree: 'V',    triad: 'maj', seventh: '7',     numeral: 'V' },
      { degree: 'VI',   triad: 'maj', seventh: 'maj7',  numeral: 'VI' },
      { degree: 'vii°', triad: 'dim', seventh: 'dim7',  numeral: 'vii°' },
    ],
    melodic_minor: [
      { degree: 'i',    triad: 'min', seventh: 'mMaj7', numeral: 'i' },
      { degree: 'ii',   triad: 'min', seventh: 'm7',    numeral: 'ii' },
      { degree: 'III+', triad: 'aug', seventh: 'aug7',  numeral: 'III+' },
      { degree: 'IV',   triad: 'maj', seventh: '7',     numeral: 'IV' },
      { degree: 'V',    triad: 'maj', seventh: '7',     numeral: 'V' },
      { degree: 'vi°',  triad: 'dim', seventh: 'm7b5',  numeral: 'vi°' },
      { degree: 'vii°', triad: 'dim', seventh: 'm7b5',  numeral: 'vii°' },
    ],
  };

  // Tension extensions available per diatonic function
  const TENSIONS = {
    maj:  ['maj', 'maj7', 'maj9', '6', 'add9'],
    min:  ['min', 'm7', 'm9', 'm6'],
    '7':  ['maj', '7', '9', '13', '7sus4', '7b9', '7#9'],
    dim:  ['dim', 'dim7', 'm7b5'],
    aug:  ['aug', 'aug7'],
  };

  // ===== CHORD SHAPES (defined at base position, transposable) =====
  // Each shape: { frets: [s6,s5,s4,s3,s2,s1], rootStr: 0-5, label: string }
  // rootStr indicates which string carries the root note
  // All non-muted (-1) frets shift uniformly when transposing

  const SHAPES = {
    maj: [
      { frets: [0,2,2,1,0,0],     rootStr: 0, label: 'E shape' },
      { frets: [-1,0,2,2,2,0],    rootStr: 1, label: 'A shape' },
      { frets: [-1,3,2,0,1,0],    rootStr: 1, label: 'C shape' },
      { frets: [-1,-1,0,2,3,2],   rootStr: 2, label: 'D shape' },
      { frets: [3,2,0,0,0,3],     rootStr: 0, label: 'G shape' },
    ],
    min: [
      { frets: [0,2,2,0,0,0],     rootStr: 0, label: 'Em shape' },
      { frets: [-1,0,2,2,1,0],    rootStr: 1, label: 'Am shape' },
      { frets: [-1,-1,0,2,3,1],   rootStr: 2, label: 'Dm shape' },
    ],
    '7': [
      { frets: [0,2,0,1,0,0],     rootStr: 0, label: 'E7 shape' },
      { frets: [-1,0,2,0,2,0],    rootStr: 1, label: 'A7 shape' },
      { frets: [-1,-1,0,2,1,2],   rootStr: 2, label: 'D7 shape' },
    ],
    maj7: [
      { frets: [0,2,1,1,0,0],     rootStr: 0, label: 'Emaj7 shape' },
      { frets: [-1,0,2,1,2,0],    rootStr: 1, label: 'Amaj7 shape' },
      { frets: [-1,-1,0,2,2,2],   rootStr: 2, label: 'Dmaj7 shape' },
    ],
    m7: [
      { frets: [0,2,0,0,0,0],     rootStr: 0, label: 'Em7 shape' },
      { frets: [-1,0,2,0,1,0],    rootStr: 1, label: 'Am7 shape' },
      { frets: [-1,-1,0,2,1,1],   rootStr: 2, label: 'Dm7 shape' },
    ],
    dim: [
      { frets: [-1,0,1,2,1,-1],   rootStr: 1, label: 'A dim shape' },
      { frets: [-1,-1,0,1,3,1],   rootStr: 2, label: 'D dim shape' },
    ],
    aug: [
      { frets: [-1,0,3,2,2,1],    rootStr: 1, label: 'A aug shape' },
      { frets: [-1,-1,0,3,3,2],   rootStr: 2, label: 'D aug shape' },
    ],
    sus2: [
      { frets: [0,2,2,2,0,0],     rootStr: 0, label: 'E sus2 shape' },
      { frets: [-1,0,2,2,0,0],    rootStr: 1, label: 'A sus2 shape' },
    ],
    sus4: [
      { frets: [0,2,2,2,0,0],     rootStr: 0, label: 'E sus4 shape' },
      { frets: [-1,0,2,2,3,0],    rootStr: 1, label: 'A sus4 shape' },
      { frets: [-1,-1,0,2,3,3],   rootStr: 2, label: 'D sus4 shape' },
    ],
    dim7: [
      { frets: [-1,0,1,2,1,2],    rootStr: 1, label: 'A dim7 shape' },
      { frets: [-1,-1,0,1,0,1],   rootStr: 2, label: 'D dim7 shape' },
    ],
    m7b5: [
      { frets: [-1,0,1,0,1,-1],   rootStr: 1, label: 'A ø7 shape' },
      { frets: [-1,-1,0,1,1,1],   rootStr: 2, label: 'D ø7 shape' },
    ],
    '6': [
      { frets: [0,2,2,1,2,0],     rootStr: 0, label: 'E6 shape' },
      { frets: [-1,0,2,2,2,2],    rootStr: 1, label: 'A6 shape' },
    ],
    m6: [
      { frets: [0,2,2,0,2,0],     rootStr: 0, label: 'Em6 shape' },
      { frets: [-1,0,2,2,1,2],    rootStr: 1, label: 'Am6 shape' },
    ],
    '9': [
      { frets: [0,2,0,1,0,2],     rootStr: 0, label: 'E9 shape' },
      { frets: [-1,0,2,4,2,3],    rootStr: 1, label: 'A9 shape' },
    ],
    maj9: [
      { frets: [0,2,1,1,0,2],     rootStr: 0, label: 'Emaj9 shape' },
      { frets: [-1,0,2,1,2,2],    rootStr: 1, label: 'Amaj9 shape' },
    ],
    m9: [
      { frets: [0,2,0,0,0,2],     rootStr: 0, label: 'Em9 shape' },
      { frets: [-1,0,2,4,1,3],    rootStr: 1, label: 'Am9 shape' },
    ],
    add9: [
      { frets: [0,2,2,1,0,2],     rootStr: 0, label: 'Eadd9 shape' },
      { frets: [-1,0,2,2,2,2],    rootStr: 1, label: 'Aadd9 shape' },
    ],
    '7sus4': [
      { frets: [0,2,0,2,0,0],     rootStr: 0, label: 'E7sus4 shape' },
      { frets: [-1,0,2,0,3,0],    rootStr: 1, label: 'A7sus4 shape' },
    ],
    '7b9': [
      { frets: [0,2,0,1,0,1],     rootStr: 0, label: 'E7b9 shape' },
    ],
    '7#9': [
      { frets: [0,2,0,1,3,2],     rootStr: 0, label: 'E7#9 shape' },
    ],
    aug7: [
      { frets: [-1,0,3,0,2,1],    rootStr: 1, label: 'Aaug7 shape' },
    ],
    '11': [
      { frets: [0,2,0,2,0,0],     rootStr: 0, label: 'E11 shape' },
    ],
    '13': [
      { frets: [0,2,0,1,2,0],     rootStr: 0, label: 'E13 shape' },
    ],
  };

  // ===== HELPER FUNCTIONS =====

  function noteIndex(noteName) {
    const clean = noteName.replace(/[0-9]/g, '');
    let idx = NOTES.indexOf(clean);
    if (idx === -1) idx = NOTES.indexOf(ENHARMONIC[clean]);
    return idx >= 0 ? idx : 0;
  }

  function noteNameAt(stringIdx, fret) {
    if (fret < 0) return null;
    const idx = (TUNING[stringIdx] + fret) % 12;
    return NOTES[idx];
  }

  function noteFrequency(stringIdx, fret) {
    // Base frequencies for open strings: E2=82.41, A2=110, D3=146.83, G3=196, B3=246.94, E4=329.63
    const BASE_FREQ = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];
    return BASE_FREQ[stringIdx] * Math.pow(2, fret / 12);
  }

  // Transpose a shape to a target root note
  function transposeShape(shape, targetNoteIdx) {
    const rootNoteOfShape = (TUNING[shape.rootStr] + shape.frets[shape.rootStr]) % 12;
    const offset = (targetNoteIdx - rootNoteOfShape + 12) % 12;
    const newFrets = shape.frets.map(f => f < 0 ? -1 : f + offset);
    // Filter out shapes where frets go too high
    const maxFret = Math.max(...newFrets.filter(f => f >= 0));
    const minFret = Math.min(...newFrets.filter(f => f >= 0));
    if (maxFret > 17 || (maxFret - minFret) > 5) return null;
    return { frets: newFrets, rootStr: shape.rootStr, label: shape.label, baseFret: minFret };
  }

  // Get all voicings for a given root + chord type
  function getVoicings(rootNote, chordType) {
    const rootIdx = noteIndex(rootNote);
    const shapes = SHAPES[chordType];
    if (!shapes) return [];
    const voicings = [];
    for (const shape of shapes) {
      const v = transposeShape(shape, rootIdx);
      if (v) {
        // Add note info for each string
        v.notes = v.frets.map((f, i) => f < 0 ? null : {
          note: noteNameAt(i, f),
          freq: noteFrequency(i, f),
          interval: getInterval(rootIdx, (TUNING[i] + f) % 12),
          intervalSemitones: ((TUNING[i] + f) % 12 - rootIdx + 12) % 12,
          fret: f,
          string: i,
        });
        v.rootNote = rootNote;
        v.chordType = chordType;
        voicings.push(v);
      }
    }
    // Sort by position (lowest fret first)
    voicings.sort((a, b) => {
      const aMin = Math.min(...a.frets.filter(f => f > 0), 99);
      const bMin = Math.min(...b.frets.filter(f => f > 0), 99);
      return aMin - bMin;
    });
    return voicings;
  }

  function getInterval(rootIdx, noteIdx) {
    const semitones = (noteIdx - rootIdx + 12) % 12;
    return INTERVAL_NAMES[semitones];
  }

  function getScaleDegree(keyIdx, noteIdx, scaleType) {
    const scale = SCALES[scaleType];
    if (!scale) return '?';
    const semitones = (noteIdx - keyIdx + 12) % 12;
    const degreeIdx = scale.steps.indexOf(semitones);
    if (degreeIdx >= 0) return String(degreeIdx + 1);
    // Check for sharps/flats relative to scale
    const prevDegree = scale.steps.findIndex(s => s > semitones);
    if (prevDegree > 0) return `♭${prevDegree + 1}`;
    return `#${scale.steps.length}`;
  }

  // Get diatonic chords for a key + scale
  function getDiatonicChords(keyNote, scaleType) {
    const keyIdx = noteIndex(keyNote);
    const scale = SCALES[scaleType];
    const diatonic = DIATONIC[scaleType];
    if (!scale || !diatonic) return [];

    return diatonic.map((d, i) => {
      const rootIdx = (keyIdx + scale.steps[i]) % 12;
      const rootName = NOTES[rootIdx];
      return {
        root: rootName,
        numeral: d.numeral,
        triad: d.triad,
        seventh: d.seventh,
        degree: i + 1,
        tensions: TENSIONS[d.triad === 'dim' ? 'dim' : d.triad === 'aug' ? 'aug' : d.triad === 'min' ? 'min' : (d.seventh === '7' ? '7' : 'maj')],
      };
    });
  }

  // Get all available chord type keys
  function getChordTypeList() {
    return Object.entries(CHORD_TYPES).map(([key, val]) => ({
      key, name: val.name, symbol: val.symbol
    }));
  }

  // Find all diatonic contexts where a given root + type appears
  function findChordContext(root, type) {
    const results = [];
    for (const [scaleKey, scale] of Object.entries(SCALES)) {
      for (const keyNote of NOTES) {
        const chords = getDiatonicChords(keyNote, scaleKey);
        for (const ch of chords) {
          // Check triad, seventh, and all tensions
          const matchTriad = ch.triad === type;
          const matchSeventh = ch.seventh === type;
          const matchTension = ch.tensions && ch.tensions.includes(type);
          if (ch.root === root && (matchTriad || matchSeventh || matchTension)) {
            results.push({
              key: keyNote, scale: scale.name, scaleKey,
              numeral: ch.numeral, degree: ch.degree,
            });
            break; // one match per key+scale is enough
          }
        }
      }
    }
    return results;
  }

  return {
    NOTES, FLAT_NOTES, TUNING, CHORD_TYPES, SCALES, INTERVAL_NAMES,
    noteIndex, noteNameAt, noteFrequency,
    getVoicings, getInterval, getScaleDegree,
    getDiatonicChords, getChordTypeList, transposeShape, findChordContext,
  };
})();
