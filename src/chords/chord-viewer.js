// ===== CHORD VIEWER OVERLAY =====
// Full-featured guitar chord reference with diatonic system, diagrams, and audio

window.ChordViewer = class ChordViewer {
  constructor() {
    this.overlay = null;
    this.synth = new GuitarSynth();
    this.selectedKey = 'C';
    this.selectedScale = 'major';
    this.selectedRoot = 'C';
    this.selectedType = 'maj';
    this.selectedVoicingIdx = 0;
    this.displayMode = 'notes'; // 'notes' | 'degrees' | 'intervals'
    this.voicings = [];
    this.isVisible = false;
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show() {
    if (!this.overlay) this.createOverlay();
    this.overlay.classList.add('cv-visible');
    this.isVisible = true;
    this.updateAll();
  }

  hide() {
    if (this.overlay) this.overlay.classList.remove('cv-visible');
    this.isVisible = false;
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'chord-viewer-overlay';
    this.overlay.innerHTML = `
      <div class="cv-container">
        <div class="cv-header">
          <span class="cv-title">🎸 Guitar Chords</span>
          <button class="cv-close" title="Close">×</button>
        </div>

        <div class="cv-body">
          <div class="cv-section">
            <label class="cv-label">Key</label>
            <div class="cv-key-selector"></div>
          </div>

          <div class="cv-section">
            <label class="cv-label">Scale</label>
            <div class="cv-scale-selector"></div>
          </div>

          <div class="cv-section">
            <label class="cv-label">Diatonic Chords</label>
            <div class="cv-diatonic-row"></div>
          </div>

          <div class="cv-section">
            <label class="cv-label">Chord Type</label>
            <div class="cv-type-selector"></div>
          </div>

          <div class="cv-section">
            <label class="cv-label">Voicing</label>
            <div class="cv-voicing-selector"></div>
          </div>

          <div class="cv-section cv-diagram-section">
            <div class="cv-diagram-top">
              <div class="cv-chord-title"></div>
              <div class="cv-chord-context"></div>
              <div class="cv-display-mode">
                <button class="cv-mode-btn active" data-mode="notes" title="Note names">ABC</button>
                <button class="cv-mode-btn" data-mode="degrees" title="Scale degrees">123</button>
                <button class="cv-mode-btn" data-mode="intervals" title="Intervals">IV</button>
              </div>
            </div>
            <div class="cv-diagram-container"></div>
            <div class="cv-play-buttons">
              <button class="cv-play-strum" title="Strum chord">🔊 Strum</button>
              <button class="cv-play-arpeggio" title="Play arpeggio">♩ Arpeggio</button>
              <button class="cv-show-fretboard" title="Show full fretboard scale map">🎸 Scale Map</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.setupEvents();
    this.buildSelectors();
  }

  setupEvents() {
    // Close
    this.overlay.querySelector('.cv-close').addEventListener('click', () => this.hide());

    // Dragging
    const header = this.overlay.querySelector('.cv-header');
    let isDragging = false, offsetX = 0, offsetY = 0;
    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = this.overlay.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      header.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      this.overlay.style.left = (e.clientX - offsetX) + 'px';
      this.overlay.style.top = (e.clientY - offsetY) + 'px';
      this.overlay.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'grab';
    });

    // Display mode
    this.overlay.querySelectorAll('.cv-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.overlay.querySelectorAll('.cv-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.displayMode = btn.dataset.mode;
        this.renderDiagram();
      });
    });

    // Play buttons
    this.overlay.querySelector('.cv-play-strum').addEventListener('click', () => {
      const v = this.voicings[this.selectedVoicingIdx];
      if (v) this.synth.playChord(v.notes);
    });
    this.overlay.querySelector('.cv-play-arpeggio').addEventListener('click', () => {
      const v = this.voicings[this.selectedVoicingIdx];
      if (v) this.synth.playArpeggio(v.notes);
    });

    // Fretboard view
    this.overlay.querySelector('.cv-show-fretboard').addEventListener('click', () => this.toggleFretboard());
  }

  buildSelectors() {
    // Key selector — show enharmonic names for sharps/flats
    const DISPLAY_NAMES = {
      'C': 'C', 'C#': 'Db/C#', 'D': 'D', 'D#': 'Eb/D#', 'E': 'E', 'F': 'F',
      'F#': 'F#/Gb', 'G': 'G', 'G#': 'Ab/G#', 'A': 'A', 'A#': 'Bb/A#', 'B': 'B'
    };
    const keyContainer = this.overlay.querySelector('.cv-key-selector');
    ChordData.NOTES.forEach(note => {
      const btn = document.createElement('button');
      btn.className = 'cv-key-btn' + (note === this.selectedKey ? ' active' : '');
      btn.textContent = DISPLAY_NAMES[note] || note;
      btn.addEventListener('click', () => {
        this.selectedKey = note;
        this.selectedRoot = note;
        this.selectedVoicingIdx = 0;
        keyContainer.querySelectorAll('.cv-key-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateDiatonic();
        this.updateVoicings();
      });
      keyContainer.appendChild(btn);
    });

    // Scale selector
    const scaleContainer = this.overlay.querySelector('.cv-scale-selector');
    Object.entries(ChordData.SCALES).forEach(([key, val]) => {
      const btn = document.createElement('button');
      btn.className = 'cv-scale-btn' + (key === this.selectedScale ? ' active' : '');
      btn.textContent = val.name;
      btn.addEventListener('click', () => {
        this.selectedScale = key;
        scaleContainer.querySelectorAll('.cv-scale-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateDiatonic();
        if (this.fretboardOverlay) this.renderFretboard();
      });
      scaleContainer.appendChild(btn);
    });

    // Chord type selector
    const typeContainer = this.overlay.querySelector('.cv-type-selector');
    const commonTypes = ['maj', 'min', '7', 'maj7', 'm7', 'dim', 'aug', 'sus2', 'sus4',
                         'dim7', 'm7b5', '6', 'm6', '9', 'maj9', 'm9', 'add9', '7sus4',
                         '7b9', '7#9', 'aug7', '11', '13'];
    commonTypes.forEach(type => {
      const info = ChordData.CHORD_TYPES[type];
      if (!info) return;
      const btn = document.createElement('button');
      btn.className = 'cv-type-btn' + (type === this.selectedType ? ' active' : '');
      btn.textContent = info.symbol || info.name;
      btn.title = info.name;
      btn.dataset.type = type;
      btn.addEventListener('click', () => {
        this.selectedType = type;
        this.selectedVoicingIdx = 0;
        typeContainer.querySelectorAll('.cv-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateVoicings();
      });
      typeContainer.appendChild(btn);
    });
  }

  updateAll() {
    this.updateDiatonic();
    this.updateVoicings();
  }

  // Highlight chord types that are diatonic for the current root in the current key
  updateTypeHighlights() {
    const chords = ChordData.getDiatonicChords(this.selectedKey, this.selectedScale);
    // Collect all diatonic types for the selected root (triad + tensions)
    const diatonicTypes = new Set();
    chords.forEach(chord => {
      if (chord.root === this.selectedRoot) {
        diatonicTypes.add(chord.triad);
        if (chord.tensions) chord.tensions.forEach(t => diatonicTypes.add(t));
      }
    });
    this.overlay.querySelectorAll('.cv-type-btn').forEach(btn => {
      const type = btn.dataset.type;
      if (diatonicTypes.size > 0 && !diatonicTypes.has(type)) {
        btn.classList.add('cv-type-dim');
      } else {
        btn.classList.remove('cv-type-dim');
      }
    });
  }

  updateDiatonic() {
    const container = this.overlay.querySelector('.cv-diatonic-row');
    container.innerHTML = '';
    const chords = ChordData.getDiatonicChords(this.selectedKey, this.selectedScale);
    chords.forEach(chord => {
      const btn = document.createElement('button');
      btn.className = 'cv-diatonic-btn';
      if (chord.root === this.selectedRoot && chord.triad === this.selectedType) {
        btn.classList.add('active');
      }
      // Mark relative minor (vi in major) or relative major (III in minor)
      let relLabel = '';
      if (this.selectedScale === 'major' && chord.degree === 6) {
        relLabel = '<span class="cv-rel-badge">Rel min</span>';
      } else if (this.selectedScale !== 'major' && chord.degree === 3) {
        relLabel = '<span class="cv-rel-badge">Rel maj</span>';
      }
      btn.innerHTML = `${relLabel}<span class="cv-numeral">${chord.numeral}</span><span class="cv-diatonic-name">${chord.root}${ChordData.CHORD_TYPES[chord.triad]?.symbol || ''}</span>`;
      btn.addEventListener('click', () => {
        this.selectedRoot = chord.root;
        this.selectedType = chord.triad;
        this.selectedVoicingIdx = 0;
        // Update key selector highlight
        this.overlay.querySelectorAll('.cv-key-btn').forEach(b => {
          b.classList.toggle('active', b.textContent === this.selectedKey);
        });
        // Update type selector highlight
        this.overlay.querySelectorAll('.cv-type-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.type === this.selectedType);
        });
        container.querySelectorAll('.cv-diatonic-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateTypeHighlights();
        this.updateVoicings();
      });

      // Tension dropdown on long press / right click
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showTensionMenu(chord, btn);
      });

      container.appendChild(btn);
    });
  }

  showTensionMenu(chord, anchorBtn) {
    // Remove existing menu
    this.overlay.querySelectorAll('.cv-tension-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'cv-tension-menu';

    const tensions = chord.tensions || ['maj'];
    tensions.forEach(t => {
      const info = ChordData.CHORD_TYPES[t];
      if (!info) return;
      const item = document.createElement('button');
      item.className = 'cv-tension-item';
      item.textContent = `${chord.root}${info.symbol}`;
      item.addEventListener('click', () => {
        this.selectedRoot = chord.root;
        this.selectedType = t;
        this.selectedVoicingIdx = 0;
        this.overlay.querySelectorAll('.cv-type-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.type === t);
        });
        menu.remove();
        this.updateVoicings();
      });
      menu.appendChild(item);
    });

    anchorBtn.style.position = 'relative';
    anchorBtn.appendChild(menu);

    // Close on click outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  updateChordContext() {
    const el = this.overlay.querySelector('.cv-chord-context');
    if (!el) return;
    const contexts = ChordData.findChordContext(this.selectedRoot, this.selectedType);
    if (contexts.length === 0) {
      el.textContent = '';
      return;
    }
    // Prioritize: show major scale context first, then current scale
    const DISPLAY_NAMES = {
      'C#': 'Db/C#', 'D#': 'Eb/D#', 'F#': 'F#/Gb', 'G#': 'Ab/G#', 'A#': 'Bb/A#'
    };
    const displayKey = (k) => DISPLAY_NAMES[k] || k;
    // Sort: major first, then the currently selected scale, then others
    const sorted = contexts.sort((a, b) => {
      if (a.scaleKey === 'major' && b.scaleKey !== 'major') return -1;
      if (b.scaleKey === 'major' && a.scaleKey !== 'major') return 1;
      if (a.scaleKey === this.selectedScale) return -1;
      if (b.scaleKey === this.selectedScale) return 1;
      return 0;
    });
    // Show top 3 contexts
    const items = sorted.slice(0, 3).map(c => 
      `<span class="cv-ctx-item">${c.numeral} of ${displayKey(c.key)} ${c.scale}</span>`
    );
    el.innerHTML = items.join('');
  }

  updateVoicings() {
    this.voicings = ChordData.getVoicings(this.selectedRoot, this.selectedType);
    const container = this.overlay.querySelector('.cv-voicing-selector');
    container.innerHTML = '';

    if (this.voicings.length === 0) {
      container.innerHTML = '<span class="cv-no-voicing">No voicings available</span>';
      this.renderDiagram();
      if (this.fretboardOverlay) this.renderFretboard();
      return;
    }

    this.voicings.forEach((v, i) => {
      const btn = document.createElement('button');
      btn.className = 'cv-voicing-btn' + (i === this.selectedVoicingIdx ? ' active' : '');
      const minFret = Math.min(...v.frets.filter(f => f > 0), ...v.frets.filter(f => f === 0));
      btn.textContent = `Pos ${i + 1}`;
      btn.title = `${v.label} (fret ${minFret})`;
      btn.addEventListener('click', () => {
        this.selectedVoicingIdx = i;
        container.querySelectorAll('.cv-voicing-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderDiagram();
      });
      container.appendChild(btn);
    });

    this.renderDiagram();
    this.updateTypeHighlights();
    if (this.fretboardOverlay) this.renderFretboard();
  }

  renderDiagram() {
    const container = this.overlay.querySelector('.cv-diagram-container');
    const titleEl = this.overlay.querySelector('.cv-chord-title');
    const v = this.voicings[this.selectedVoicingIdx];

    if (!v) {
      container.innerHTML = '<div class="cv-no-voicing">Select a chord</div>';
      titleEl.textContent = '';
      return;
    }

    const typeInfo = ChordData.CHORD_TYPES[this.selectedType];
    titleEl.textContent = `${this.selectedRoot}${typeInfo?.symbol || ''} — ${v.label}`;

    // Update harmonic context
    this.updateChordContext();

    // Calculate diagram range
    const playedFrets = v.frets.filter(f => f > 0);
    let startFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 1;
    if (startFret <= 2) startFret = 1; // show open position
    const numFrets = 5;
    const showOpen = startFret === 1;

    // SVG dimensions
    const svgW = 200, svgH = 260;
    const marginLeft = 45, marginRight = 20;
    const marginTop = 35, marginBottom = 40;
    const diagramW = svgW - marginLeft - marginRight;
    const diagramH = svgH - marginTop - marginBottom;
    const stringSpacing = diagramW / 5;
    const fretSpacing = diagramH / numFrets;

    let svg = `<svg class="cv-chord-svg" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<style>
      .cv-string { stroke: #999; stroke-width: 1; }
      .cv-fret { stroke: #666; stroke-width: 1; }
      .cv-nut { stroke: #fff; stroke-width: 3; }
      .cv-dot { cursor: pointer; }
      .cv-dot circle { fill: #4CAF50; stroke: #fff; stroke-width: 1.5; }
      .cv-dot text { fill: #fff; font-size: 9px; font-weight: 600; text-anchor: middle; dominant-baseline: central; font-family: sans-serif; }
      .cv-open { fill: none; stroke: #4CAF50; stroke-width: 1.5; }
      .cv-mute { stroke: #f44336; stroke-width: 2; }
      .cv-fret-num { fill: #888; font-size: 10px; text-anchor: end; dominant-baseline: central; font-family: sans-serif; }
      .cv-root circle { fill: #FF9800; }
      .cv-barre { fill: rgba(76, 175, 80, 0.3); stroke: #4CAF50; stroke-width: 1.5; rx: 8; }
    </style>`;

    // Nut (thick line at top if showing open position)
    if (showOpen) {
      svg += `<line class="cv-nut" x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft + diagramW}" y2="${marginTop}"/>`;
    } else {
      // Show start fret number
      svg += `<text class="cv-fret-num" x="${marginLeft - 8}" y="${marginTop + fretSpacing / 2}">${startFret}</text>`;
    }

    // Fret lines
    for (let f = 0; f <= numFrets; f++) {
      const y = marginTop + f * fretSpacing;
      svg += `<line class="cv-fret" x1="${marginLeft}" y1="${y}" x2="${marginLeft + diagramW}" y2="${y}"/>`;
    }

    // Strings
    for (let s = 0; s < 6; s++) {
      const x = marginLeft + s * stringSpacing;
      svg += `<line class="cv-string" x1="${x}" y1="${marginTop}" x2="${x}" y2="${marginTop + diagramH}"/>`;
    }

    // Check for barre chord (same fret on multiple strings at the lowest fret)
    const minPlayedFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
    const barreStrings = [];
    if (minPlayedFret > 0) {
      v.frets.forEach((f, i) => { if (f === minPlayedFret) barreStrings.push(i); });
    }
    if (barreStrings.length >= 2) {
      const firstStr = Math.min(...barreStrings);
      const lastStr = Math.max(...barreStrings);
      const barreY = marginTop + (minPlayedFret - startFret + 0.5) * fretSpacing;
      const x1 = marginLeft + firstStr * stringSpacing;
      const x2 = marginLeft + lastStr * stringSpacing;
      svg += `<rect class="cv-barre" x="${x1 - 6}" y="${barreY - 8}" width="${x2 - x1 + 12}" height="16"/>`;
    }

    // Dots, opens, mutes
    for (let s = 0; s < 6; s++) {
      const x = marginLeft + s * stringSpacing;
      const fret = v.frets[s];

      if (fret < 0) {
        // Muted
        const y = marginTop - 14;
        svg += `<g class="cv-mute">
          <line x1="${x - 5}" y1="${y - 5}" x2="${x + 5}" y2="${y + 5}"/>
          <line x1="${x + 5}" y1="${y - 5}" x2="${x - 5}" y2="${y + 5}"/>
        </g>`;
      } else if (fret === 0) {
        // Open string
        const y = marginTop - 14;
        const noteInfo = v.notes[s];
        const label = this.getDotLabel(noteInfo, s);
        svg += `<g class="cv-dot" data-string="${s}" data-freq="${noteInfo?.freq || 0}">
          <circle cx="${x}" cy="${y}" r="8" class="cv-open" style="fill:rgba(76,175,80,0.15)"/>
          <text x="${x}" y="${y}" font-size="7">${label}</text>
        </g>`;
      } else {
        // Fretted note
        const y = marginTop + (fret - startFret + 0.5) * fretSpacing;
        if (y >= marginTop && y <= marginTop + diagramH + 5) {
          const noteInfo = v.notes[s];
          const isRoot = noteInfo && noteInfo.intervalSemitones === 0;
          const label = this.getDotLabel(noteInfo, s);
          svg += `<g class="cv-dot ${isRoot ? 'cv-root' : ''}" data-string="${s}" data-freq="${noteInfo?.freq || 0}">
            <circle cx="${x}" cy="${y}" r="11"/>
            <text x="${x}" y="${y}">${label}</text>
          </g>`;
        }
      }
    }

    // String labels at bottom (string numbers)
    for (let s = 0; s < 6; s++) {
      const x = marginLeft + s * stringSpacing;
      svg += `<text x="${x}" y="${svgH - 8}" style="fill:#555;font-size:9px;text-anchor:middle;font-family:sans-serif;">${6 - s}</text>`;
    }

    svg += '</svg>';
    container.innerHTML = svg;

    // Add click handlers for individual notes
    container.querySelectorAll('.cv-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const freq = parseFloat(dot.dataset.freq);
        if (freq > 0) this.synth.pluck(freq);
      });
    });
  }

  getDotLabel(noteInfo, stringIdx) {
    if (!noteInfo) return '';
    switch (this.displayMode) {
      case 'notes': return noteInfo.note || '';
      case 'degrees': return ChordData.getScaleDegree(
        ChordData.noteIndex(this.selectedKey),
        ChordData.noteIndex(noteInfo.note),
        this.selectedScale
      );
      case 'intervals': return noteInfo.interval || '';
      default: return noteInfo.note || '';
    }
  }

  // ==================== FRETBOARD SCALE MAP ====================

  toggleFretboard() {
    if (this.fretboardOverlay) {
      this.fretboardOverlay.remove();
      this.fretboardOverlay = null;
      return;
    }
    this.showFretboard();
  }

  showFretboard() {
    if (this.fretboardOverlay) this.fretboardOverlay.remove();

    this.fretboardOverlay = document.createElement('div');
    this.fretboardOverlay.id = 'fretboard-overlay';
    this.fretboardOverlay.innerHTML = `
      <div class="fb-container">
        <div class="fb-header">
          <span class="fb-title"></span>
          <div class="fb-controls">
            <div class="fb-display-mode">
              <button class="fb-mode-btn active" data-mode="notes">ABC</button>
              <button class="fb-mode-btn" data-mode="degrees">123</button>
              <button class="fb-mode-btn" data-mode="intervals">IV</button>
            </div>
            <label class="fb-toggle-label"><input type="checkbox" class="fb-chord-toggle" checked> Chord/Arpeggio</label>
            <button class="fb-close" title="Close">&times;</button>
          </div>
        </div>
        <div class="fb-body"></div>
      </div>
    `;

    document.body.appendChild(this.fretboardOverlay);
    this.fretboardOverlay.classList.add('fb-visible');

    // Events
    this.fretboardOverlay.querySelector('.fb-close').addEventListener('click', () => {
      this.fretboardOverlay.remove();
      this.fretboardOverlay = null;
    });

    this.fretboardOverlay.querySelectorAll('.fb-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.fretboardOverlay.querySelectorAll('.fb-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.fbDisplayMode = btn.dataset.mode;
        this.renderFretboard();
      });
    });

    this.fretboardOverlay.querySelector('.fb-chord-toggle').addEventListener('change', () => {
      this.renderFretboard();
    });

    // Dragging
    const header = this.fretboardOverlay.querySelector('.fb-header');
    let isDragging = false, offsetX = 0, offsetY = 0;
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, input, label')) return;
      isDragging = true;
      const rect = this.fretboardOverlay.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      this.fretboardOverlay.style.left = (e.clientX - offsetX) + 'px';
      this.fretboardOverlay.style.top = (e.clientY - offsetY) + 'px';
      this.fretboardOverlay.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => isDragging = false);

    this.fbDisplayMode = this.displayMode;
    // Sync active mode button
    this.fretboardOverlay.querySelectorAll('.fb-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === this.fbDisplayMode);
    });
    this.renderFretboard();
  }

  renderFretboard() {
    if (!this.fretboardOverlay) return;

    const body = this.fretboardOverlay.querySelector('.fb-body');
    const titleEl = this.fretboardOverlay.querySelector('.fb-title');
    const showChordTones = this.fretboardOverlay.querySelector('.fb-chord-toggle').checked;

    const keyIdx = ChordData.noteIndex(this.selectedKey);
    const scale = ChordData.SCALES[this.selectedScale];
    if (!scale) return;

    const scaleNotes = new Set(scale.steps.map(s => (keyIdx + s) % 12));

    // Chord tones (intervals of selected chord type)
    const chordType = ChordData.CHORD_TYPES[this.selectedType];
    const chordToneSet = new Set();
    if (chordType && showChordTones) {
      const rootIdx = ChordData.noteIndex(this.selectedRoot);
      chordType.intervals.forEach(iv => chordToneSet.add((rootIdx + (iv % 12)) % 12));
    }

    const DISPLAY_NAMES = {
      'C': 'C', 'C#': 'Db/C#', 'D': 'D', 'D#': 'Eb/D#', 'E': 'E', 'F': 'F',
      'F#': 'F#/Gb', 'G': 'G', 'G#': 'Ab/G#', 'A': 'A', 'A#': 'Bb/A#', 'B': 'B'
    };
    const scaleName = scale.name;
    const keyDisplay = DISPLAY_NAMES[this.selectedKey] || this.selectedKey;
    let title = `${keyDisplay} ${scaleName}`;
    if (showChordTones && chordType) {
      title += ` — ${this.selectedRoot}${chordType.symbol} tones highlighted`;
    }
    titleEl.textContent = title;

    const numFrets = 15;
    const numStrings = 6;
    // SVG horizontal fretboard
    const fretW = 52, nutW = 30;
    const stringSpacing = 24;
    const svgW = nutW + numFrets * fretW + 20;
    const svgH = (numStrings - 1) * stringSpacing + 60;
    const topMargin = 30;
    const leftMargin = nutW + 10;

    let svg = `<svg class="fb-svg" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<style>
      .fb-fret-line { stroke: #555; stroke-width: 1; }
      .fb-nut-line { stroke: #fff; stroke-width: 3; }
      .fb-string-line { stroke: #888; stroke-width: 1; }
      .fb-dot { cursor: pointer; }
      .fb-dot circle { stroke: #fff; stroke-width: 1; }
      .fb-dot text { fill: #fff; font-size: 8px; font-weight: 600; text-anchor: middle; dominant-baseline: central; font-family: sans-serif; }
      .fb-fret-num { fill: #555; font-size: 9px; text-anchor: middle; font-family: sans-serif; }
      .fb-string-label { fill: #888; font-size: 10px; text-anchor: end; dominant-baseline: central; font-family: sans-serif; }
      .fb-inlay { fill: rgba(255,255,255,0.06); }
    </style>`;

    // Nut
    svg += `<line class="fb-nut-line" x1="${leftMargin}" y1="${topMargin}" x2="${leftMargin}" y2="${topMargin + (numStrings - 1) * stringSpacing}"/>`;

    // Fret lines
    for (let f = 1; f <= numFrets; f++) {
      const x = leftMargin + f * fretW;
      svg += `<line class="fb-fret-line" x1="${x}" y1="${topMargin}" x2="${x}" y2="${topMargin + (numStrings - 1) * stringSpacing}"/>`;
    }

    // Strings (horizontal)
    for (let s = 0; s < numStrings; s++) {
      const y = topMargin + s * stringSpacing;
      svg += `<line class="fb-string-line" x1="${leftMargin}" y1="${y}" x2="${leftMargin + numFrets * fretW}" y2="${y}"/>`;
    }

    // String labels (e B G D A E — top to bottom, high to low)
    const stringNames = ['e', 'B', 'G', 'D', 'A', 'E'];
    for (let s = 0; s < numStrings; s++) {
      const y = topMargin + s * stringSpacing;
      svg += `<text class="fb-string-label" x="${leftMargin - 8}" y="${y}">${stringNames[s]}</text>`;
    }

    // Fret numbers
    const inlayFrets = [3, 5, 7, 9, 12, 15];
    for (let f = 1; f <= numFrets; f++) {
      const x = leftMargin + (f - 0.5) * fretW;
      if (inlayFrets.includes(f)) {
        svg += `<text class="fb-fret-num" x="${x}" y="${topMargin + (numStrings - 1) * stringSpacing + 18}" style="fill:#888;font-weight:600">${f}</text>`;
        // Inlay dot
        if (f !== 12) {
          svg += `<circle class="fb-inlay" cx="${x}" cy="${topMargin + 2.5 * stringSpacing}" r="4"/>`;
        } else {
          svg += `<circle class="fb-inlay" cx="${x}" cy="${topMargin + 1.5 * stringSpacing}" r="4"/>`;
          svg += `<circle class="fb-inlay" cx="${x}" cy="${topMargin + 3.5 * stringSpacing}" r="4"/>`;
        }
      } else {
        svg += `<text class="fb-fret-num" x="${x}" y="${topMargin + (numStrings - 1) * stringSpacing + 18}">${f}</text>`;
      }
    }

    // Notes on fretboard (flip: visual row 0 = string 5 (high e), row 5 = string 0 (low E))
    for (let s = 0; s < numStrings; s++) {
      const actualString = numStrings - 1 - s; // flip so low E is at bottom
      for (let f = 0; f <= numFrets; f++) {
        const noteIdx = (ChordData.TUNING[actualString] + f) % 12;
        const isInScale = scaleNotes.has(noteIdx);
        if (!isInScale) continue;

        const isRoot = noteIdx === keyIdx;
        const isChordTone = chordToneSet.has(noteIdx);
        const isChordRoot = showChordTones && noteIdx === ChordData.noteIndex(this.selectedRoot);

        const y = topMargin + s * stringSpacing;
        let x;
        if (f === 0) {
          x = leftMargin - 0; // on the nut
        } else {
          x = leftMargin + (f - 0.5) * fretW;
        }

        // Color: chord root = orange, chord tone = blue, scale root = bright green, scale = green
        let fill, r;
        if (isChordRoot) {
          fill = '#FF9800'; r = 9;
        } else if (isChordTone) {
          fill = '#2196F3'; r = 9;
        } else if (isRoot) {
          fill = '#4CAF50'; r = 9;
        } else {
          fill = 'rgba(76,175,80,0.4)'; r = 7;
        }

        // Label
        const noteName = ChordData.NOTES[noteIdx];
        let label = noteName;
        if (this.fbDisplayMode === 'degrees') {
          label = ChordData.getScaleDegree(keyIdx, noteIdx, this.selectedScale);
        } else if (this.fbDisplayMode === 'intervals') {
          label = ChordData.getInterval(keyIdx, noteIdx);
        }

        const freq = ChordData.noteFrequency(actualString, f);
        svg += `<g class="fb-dot" data-freq="${freq}">`;
        svg += `<circle cx="${x}" cy="${y}" r="${r}" style="fill:${fill}"/>`;
        svg += `<text x="${x}" y="${y}">${label}</text>`;
        svg += `</g>`;
      }
    }

    svg += '</svg>';
    body.innerHTML = svg;

    // Click to play note
    body.querySelectorAll('.fb-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const freq = parseFloat(dot.dataset.freq);
        if (freq > 0) this.synth.pluck(freq);
      });
    });
  }
};
