// ChordSense - Content Script
// Injects UI overlay and controls playback speed

// Prevent multiple initializations
if (window.chordSenseInitialized) {
  // Already initialized, just show the overlay
  if (window.chordSenseOverlay) {
    window.chordSenseOverlay.show();
  }
} else {
  window.chordSenseInitialized = true;

class ChordSenseOverlay {
  constructor() {
    this.overlay = null;
    this.isVisible = false;
    this.currentSpeed = 1.0;
    this.loopStart = null;
    this.loopEnd = null;
    this.isLooping = false;
    this.currentUrl = window.location.href;
    this.transposeSemitones = 0;
    this.isDetecting = false;
    
    // Pitch shift state
    this.pitchAudioContext = null;
    this.pitchSourceNode = null;
    this.pitchShifterNode = null;
    
    // Metronome state
    this.metronome = null;
    this.isMetronomePlaying = false;
    this.metronomeBPM = 120;
    this.tapTimes = [];
    
    this.init();
  }

  init() {
    this.createOverlay();
    this.setupMessageListener();
    this.setupMediaObserver();
    this.setupNavigationObserver();
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'chordsense-overlay';
    this.overlay.innerHTML = `
      <div class="cs-container">
        <div class="cs-header">
          <span class="cs-logo">� PracticePal</span>
          <div class="cs-header-actions">
            <button class="cs-restart" title="Restart Detection">🔄</button>
            <button class="cs-close" title="Close">×</button>
          </div>
        </div>
        
        <div class="cs-controls">
          <div class="cs-speed-control">
            <label>Speed: <span class="cs-speed-value">1.0x</span></label>
            <input type="range" class="cs-speed-slider" min="0.25" max="2" step="0.05" value="1">
            <div class="cs-speed-presets">
              <button data-speed="0.5">0.5x</button>
              <button data-speed="0.75">0.75x</button>
              <button data-speed="1" class="active">1x</button>
              <button data-speed="1.25">1.25x</button>
            </div>
          </div>
          
          <div class="cs-loop-control">
            <button class="cs-loop-start" title="Set loop start">A</button>
            <button class="cs-loop-end" title="Set loop end">B</button>
            <button class="cs-loop-clear" title="Clear loop">✕</button>
          </div>
          
          <div class="cs-transpose-control">
            <div class="cs-transpose-header">
              <span class="cs-transpose-label">Transpose</span>
              <span class="cs-transpose-display">0 st</span>
            </div>
            <div class="cs-transpose-row">
              <button class="cs-transpose-down" title="Down 1 semitone">−</button>
              <div class="cs-transpose-presets">
                <button data-semitones="-3">−3</button>
                <button data-semitones="-1">−1</button>
                <button data-semitones="0" class="active">0</button>
                <button data-semitones="1">+1</button>
                <button data-semitones="3">+3</button>
              </div>
              <button class="cs-transpose-up" title="Up 1 semitone">+</button>
            </div>
          </div>
          
          <div class="cs-metronome-control">
            <div class="cs-metronome-header">
              <span class="cs-metronome-label">Metronome</span>
              <span class="cs-bpm-display">-- BPM</span>
            </div>
            <div class="cs-metronome-row">
              <button class="cs-bpm-down" title="Decrease BPM">−</button>
              <input type="number" class="cs-bpm-input" min="30" max="300" value="120">
              <button class="cs-bpm-up" title="Increase BPM">+</button>
              <button class="cs-metronome-toggle" title="Start/Stop Metronome">▶</button>
            </div>
            <div class="cs-metronome-actions">
              <button class="cs-detect-bpm" title="Detect BPM from video">🎯 Detect</button>
              <button class="cs-tap-tempo" title="Tap to set tempo">👆 Tap</button>
            </div>
          </div>
          
          <div class="cs-chord-section">
            <div class="cs-chord-header">
              <span class="cs-chord-label">Chord</span>
              <div class="cs-chord-right">
                <div class="cs-current-chord">
                  <span class="cs-chord-name">-</span>
                  <span class="cs-chord-type"></span>
                </div>
                <button class="cs-chord-toggle" title="Start/Stop Chord Detection">▶</button>
              </div>
            </div>
            <div class="cs-chord-diagram"></div>
            <div class="cs-confidence">
              <div class="cs-confidence-bar"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.setupOverlayEvents();
  }

  setupOverlayEvents() {
    this.overlay.querySelector('.cs-close').addEventListener('click', () => this.hide());
    this.overlay.querySelector('.cs-restart').addEventListener('click', () => this.restartDetection());
    this.overlay.querySelector('.cs-chord-toggle').addEventListener('click', () => this.toggleChordDetection());

    const speedSlider = this.overlay.querySelector('.cs-speed-slider');
    speedSlider.addEventListener('input', (e) => this.setSpeed(parseFloat(e.target.value)));

    this.overlay.querySelectorAll('.cs-speed-presets button').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        speedSlider.value = speed;
        this.setSpeed(speed);
        this.overlay.querySelectorAll('.cs-speed-presets button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    this.overlay.querySelector('.cs-loop-start').addEventListener('click', () => this.setLoopStart());
    this.overlay.querySelector('.cs-loop-end').addEventListener('click', () => this.setLoopEnd());
    this.overlay.querySelector('.cs-loop-clear').addEventListener('click', () => this.clearLoop());

    // Transpose controls
    this.overlay.querySelector('.cs-transpose-down').addEventListener('click', () => this.setTranspose(this.transposeSemitones - 1));
    this.overlay.querySelector('.cs-transpose-up').addEventListener('click', () => this.setTranspose(this.transposeSemitones + 1));
    this.overlay.querySelectorAll('.cs-transpose-presets button').forEach(btn => {
      btn.addEventListener('click', () => this.setTranspose(parseInt(btn.dataset.semitones)));
    });

    // Metronome controls
    this.overlay.querySelector('.cs-metronome-toggle').addEventListener('click', () => this.toggleMetronome());
    this.overlay.querySelector('.cs-bpm-input').addEventListener('change', (e) => this.setMetronomeBPM(parseInt(e.target.value)));
    this.overlay.querySelector('.cs-bpm-up').addEventListener('click', () => this.adjustBPM(5));
    this.overlay.querySelector('.cs-bpm-down').addEventListener('click', () => this.adjustBPM(-5));
    this.overlay.querySelector('.cs-detect-bpm').addEventListener('click', () => this.detectBPM());
    this.overlay.querySelector('.cs-tap-tempo').addEventListener('click', () => this.tapTempo());

    this.makeDraggable();
  }

  makeDraggable() {
    const header = this.overlay.querySelector('.cs-header');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.overlay.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      this.overlay.style.left = `${initialX + e.clientX - startX}px`;
      this.overlay.style.top = `${initialY + e.clientY - startY}px`;
      this.overlay.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => isDragging = false);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Content Script: Received message', message.type);
      switch (message.type) {
        case 'PING':
          sendResponse({ pong: true });
          return true;
        case 'CHORD_UPDATE':
          console.log('Content Script: Updating chord to', message.chord);
          this.updateChord(message.chord, message.confidence);
          break;
        case 'SET_SPEED':
          this.setSpeed(message.speed);
          break;
        case 'SHOW_OVERLAY':
          this.show();
          break;
        case 'HIDE_OVERLAY':
          this.hide();
          break;
        case 'TOGGLE_OVERLAY':
          this.toggle();
          break;
        case 'GET_CURRENT_TIME':
          const media = this.getActiveMedia();
          sendResponse({ currentTime: media ? media.currentTime : 0 });
          return true;
        case 'SET_LOOP':
          if (message.loopStart === null && message.loopEnd === null) {
            this.clearLoop();
          } else {
            this.loopStart = message.loopStart;
            this.loopEnd = message.loopEnd;
            this.updateLoopButtons();
            this.checkLoopReady();
          }
          break;
        case 'BPM_UPDATE':
          this.setMetronomeBPM(message.bpm);
          break;
        case 'SET_TRANSPOSE':
          this.setTranspose(message.semitones);
          break;
      }
    });
  }

  setupMediaObserver() {
    this.mediaElements = [];
    const findMedia = () => {
      this.mediaElements = [...document.querySelectorAll('video, audio')];
    };
    findMedia();
    
    new MutationObserver(findMedia).observe(document.body, { childList: true, subtree: true });
  }

  setupNavigationObserver() {
    // Detect SPA navigation (YouTube, etc.)
    const checkUrlChange = () => {
      if (window.location.href !== this.currentUrl) {
        this.currentUrl = window.location.href;
        this.onNavigate();
      }
    };

    // Listen for popstate (back/forward)
    window.addEventListener('popstate', checkUrlChange);
    
    // Listen for YouTube-style navigation
    window.addEventListener('yt-navigate-finish', () => this.onNavigate());
    
    // Periodic check for pushState navigation
    setInterval(checkUrlChange, 1000);
  }

  onNavigate() {
    console.log('ChordSense: Navigation detected, resetting state');
    // Reset loop points
    this.clearLoop();
    // Reset speed to 1x
    this.setSpeed(1.0);
    // Reset transpose (bypass pitch shifter, keep audio graph alive)
    this.setTranspose(0);
    this.overlay.querySelectorAll('.cs-speed-presets button').forEach(b => b.classList.remove('active'));
    this.overlay.querySelector('.cs-speed-presets button[data-speed="1"]')?.classList.add('active');
    // Reset chord display
    this.overlay.querySelector('.cs-chord-name').textContent = '-';
    this.overlay.querySelector('.cs-chord-type').textContent = '';
    this.overlay.querySelector('.cs-confidence-bar').style.width = '0%';
    // Re-find media elements
    this.mediaElements = [...document.querySelectorAll('video, audio')];
    // Auto restart detection if overlay is visible
    if (this.isVisible) {
      setTimeout(() => this.restartDetection(), 500);
    }
  }

  toggleChordDetection() {
    if (this.isDetecting) {
      this.stopChordDetection();
    } else {
      this.startChordDetection();
    }
  }

  startChordDetection() {
    this.overlay.querySelector('.cs-chord-name').textContent = '...';
    this.overlay.querySelector('.cs-chord-type').textContent = '';
    chrome.runtime.sendMessage({ type: 'START_DETECTION' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Start detection failed:', chrome.runtime.lastError.message);
        this.overlay.querySelector('.cs-chord-name').textContent = '!';
        this.overlay.querySelector('.cs-chord-type').textContent = 'Error';
        return;
      }
      if (response?.success) {
        this.isDetecting = true;
        this.updateChordToggleButton();
      }
    });
  }

  stopChordDetection() {
    chrome.runtime.sendMessage({ type: 'STOP_DETECTION' }, () => {
      this.isDetecting = false;
      this.updateChordToggleButton();
      this.overlay.querySelector('.cs-chord-name').textContent = '-';
      this.overlay.querySelector('.cs-chord-type').textContent = '';
      this.overlay.querySelector('.cs-confidence-bar').style.width = '0%';
      const diagram = this.overlay.querySelector('.cs-chord-diagram');
      if (diagram) diagram.innerHTML = '';
    });
  }

  updateChordToggleButton() {
    const btn = this.overlay.querySelector('.cs-chord-toggle');
    if (this.isDetecting) {
      btn.textContent = '⏹';
      btn.classList.add('active');
    } else {
      btn.textContent = '▶';
      btn.classList.remove('active');
    }
  }

  restartDetection() {
    console.log('ChordSense: Restarting detection...');
    this.overlay.querySelector('.cs-chord-name').textContent = '...';
    this.overlay.querySelector('.cs-chord-type').textContent = '';
    chrome.runtime.sendMessage({ type: 'RESTART_DETECTION' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Restart failed:', chrome.runtime.lastError.message);
        this.overlay.querySelector('.cs-chord-name').textContent = '!';
        this.overlay.querySelector('.cs-chord-type').textContent = 'Click restart';
      } else if (response?.success) {
        console.log('Detection restarted');
        this.isDetecting = true;
        this.updateChordToggleButton();
      }
    });
  }

  setSpeed(speed) {
    this.currentSpeed = speed;
    this.overlay.querySelector('.cs-speed-value').textContent = `${speed.toFixed(2)}x`;
    this.overlay.querySelector('.cs-speed-slider').value = speed;
    
    // Speed is always controlled via playbackRate with preservesPitch = true
    // Pitch shifting is handled separately by the AudioWorklet
    this.mediaElements.forEach(media => {
      media.preservesPitch = true;
      media.playbackRate = speed;
    });
    const ytVideo = document.querySelector('video.html5-main-video');
    if (ytVideo) {
      ytVideo.preservesPitch = true;
      ytVideo.playbackRate = speed;
    }
  }

  setTranspose(semitones) {
    // Clamp to ±12 semitones (1 octave)
    semitones = Math.max(-12, Math.min(12, semitones));
    this.transposeSemitones = semitones;
    
    // Update overlay UI
    const display = this.overlay.querySelector('.cs-transpose-display');
    if (display) {
      const prefix = semitones > 0 ? '+' : '';
      display.textContent = `${prefix}${semitones} st`;
    }
    this.overlay.querySelectorAll('.cs-transpose-presets button').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.semitones) === semitones);
    });
    
    // Apply pitch shift via AudioWorklet (independent of speed)
    const media = this.getActiveMedia();
    if (media) {
      this.applyPitchShift(media, semitones);
    }
  }

  async applyPitchShift(media, semitones) {
    const pitchFactor = Math.pow(2, semitones / 12);

    if (semitones === 0) {
      // Bypass: route source directly to destination (no pitch shift)
      if (this.pitchSourceNode && this.pitchSourceMedia === media) {
        if (this.pitchShifterNode) {
          this.pitchSourceNode.disconnect();
          this.pitchShifterNode.disconnect();
          this.pitchSourceNode.connect(this.pitchAudioContext.destination);
          this.pitchShifterNode = null;
        }
      }
      media.preservesPitch = true;
      media.playbackRate = this.currentSpeed;
      return;
    }

    // If audio graph already set up for this media, just update the parameter
    if (this.pitchAudioContext && this.pitchSourceMedia === media) {
      if (this.pitchShifterNode) {
        // Already have a shifter — just update the pitch
        this.pitchShifterNode.parameters.get('pitchFactor').value = pitchFactor;
        console.log('PracticePal: Updated pitchFactor to', pitchFactor);
      } else {
        // Source exists but shifter was bypassed — re-insert it
        await this.insertPitchShifter(pitchFactor);
      }
      return;
    }

    // First time setup — capture the media element
    try {
      // Create AudioContext
      this.pitchAudioContext = new AudioContext();

      // Resume if suspended (autoplay policy)
      if (this.pitchAudioContext.state === 'suspended') {
        await this.pitchAudioContext.resume();
      }

      // Load the pitch shifter worklet
      const workletUrl = chrome.runtime.getURL('src/audio/pitch-shifter-worklet.js');
      await this.pitchAudioContext.audioWorklet.addModule(workletUrl);

      // Create source from media element (can only be done ONCE per element)
      this.pitchSourceNode = this.pitchAudioContext.createMediaElementSource(media);
      this.pitchSourceMedia = media;

      // Insert the pitch shifter
      await this.insertPitchShifter(pitchFactor);

      // Keep playbackRate controlling speed only
      media.preservesPitch = true;
      media.playbackRate = this.currentSpeed;
    } catch (err) {
      console.warn('PracticePal: Failed to set up pitch shifter', err);
      // Fallback: if createMediaElementSource fails (element already captured),
      // try to reuse the existing audio graph
      if (err.name === 'InvalidStateError' && this.pitchAudioContext) {
        this.pitchAudioContext.close().catch(() => {});
        this.pitchAudioContext = null;
      }
    }
  }

  async insertPitchShifter(pitchFactor) {
    // Disconnect source from wherever it's connected
    this.pitchSourceNode.disconnect();

    // Create pitch shifter node
    this.pitchShifterNode = new AudioWorkletNode(
      this.pitchAudioContext, 'pitch-shifter-processor'
    );

    // Error handling — detect if worklet fails silently
    this.pitchShifterNode.onprocessorerror = (e) => {
      console.error('PracticePal: Pitch shifter processor error', e);
    };

    // Set pitch factor via .value (more reliable than setValueAtTime for immediate changes)
    this.pitchShifterNode.parameters.get('pitchFactor').value = pitchFactor;

    // Connect: source → pitch shifter → destination
    this.pitchSourceNode.connect(this.pitchShifterNode);
    this.pitchShifterNode.connect(this.pitchAudioContext.destination);

    console.log('PracticePal: Pitch shifter connected, pitchFactor =', pitchFactor);
  }

  disconnectPitchShift() {
    if (this.pitchShifterNode) {
      this.pitchShifterNode.disconnect();
      this.pitchShifterNode = null;
    }
    if (this.pitchSourceNode) {
      // Don't disconnect source — just route to destination directly
      try {
        this.pitchSourceNode.disconnect();
        if (this.pitchAudioContext) {
          this.pitchSourceNode.connect(this.pitchAudioContext.destination);
        }
      } catch (e) { /* already disconnected */ }
    }
    // Do NOT close the AudioContext — the MediaElementSource is permanently bound to it.
    // Closing it would make the media element silent permanently.
  }

  setLoopStart() {
    const media = this.getActiveMedia();
    if (media) {
      this.loopStart = media.currentTime;
      this.overlay.querySelector('.cs-loop-start').classList.add('active');
      this.checkLoopReady();
    }
  }

  setLoopEnd() {
    const media = this.getActiveMedia();
    if (media) {
      this.loopEnd = media.currentTime;
      this.overlay.querySelector('.cs-loop-end').classList.add('active');
      this.checkLoopReady();
    }
  }

  checkLoopReady() {
    if (this.loopStart !== null && this.loopEnd !== null && this.loopStart < this.loopEnd) {
      this.startLooping();
    } else {
      this.isLooping = false;
    }
  }

  startLooping() {
    this.isLooping = true;
    const media = this.getActiveMedia();
    if (media) {
      const checkLoop = () => {
        if (!this.isLooping) return;
        // Check if loop points are still valid
        if (this.loopStart === null || this.loopEnd === null) return;
        if (media.currentTime >= this.loopEnd) {
          media.currentTime = this.loopStart;
        }
        requestAnimationFrame(checkLoop);
      };
      checkLoop();
    }
  }

  clearLoop() {
    this.loopStart = null;
    this.loopEnd = null;
    this.isLooping = false;
    this.overlay.querySelector('.cs-loop-start').classList.remove('active');
    this.overlay.querySelector('.cs-loop-end').classList.remove('active');
  }

  // ==================== METRONOME ====================

  initMetronome() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  toggleMetronome() {
    this.initMetronome();
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    this.isMetronomePlaying = !this.isMetronomePlaying;
    const btn = this.overlay.querySelector('.cs-metronome-toggle');
    
    if (this.isMetronomePlaying) {
      btn.textContent = '⏹';
      btn.classList.add('active');
      this.startMetronome();
    } else {
      btn.textContent = '▶';
      btn.classList.remove('active');
      this.stopMetronome();
    }
  }

  startMetronome() {
    if (this.metronomeInterval) {
      clearInterval(this.metronomeInterval);
    }
    
    const intervalMs = 60000 / this.metronomeBPM;
    this.beatCount = 0;
    
    this.playClick(true);
    
    this.metronomeInterval = setInterval(() => {
      this.beatCount = (this.beatCount + 1) % 4;
      this.playClick(this.beatCount === 0);
    }, intervalMs);
  }

  stopMetronome() {
    if (this.metronomeInterval) {
      clearInterval(this.metronomeInterval);
      this.metronomeInterval = null;
    }
  }

  playClick(isDownbeat = false) {
    if (!this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.frequency.value = isDownbeat ? 1000 : 800;
    osc.type = 'sine';
    
    const clickDuration = 0.03;
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + clickDuration);
    
    osc.start(now);
    osc.stop(now + clickDuration);
  }

  setMetronomeBPM(bpm) {
    this.metronomeBPM = Math.max(30, Math.min(300, bpm));
    this.overlay.querySelector('.cs-bpm-input').value = this.metronomeBPM;
    this.overlay.querySelector('.cs-bpm-display').textContent = `${this.metronomeBPM} BPM`;
    
    if (this.isMetronomePlaying) {
      this.stopMetronome();
      this.startMetronome();
    }
  }

  adjustBPM(delta) {
    this.setMetronomeBPM(this.metronomeBPM + delta);
  }

  detectBPM() {
    const bpmDisplay = this.overlay.querySelector('.cs-bpm-display');
    bpmDisplay.textContent = 'Detecting...';
    
    // Check if detection is running
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
      if (!status?.isCapturing) {
        // Start detection first
        bpmDisplay.textContent = 'Starting...';
        chrome.runtime.sendMessage({ type: 'RESTART_DETECTION' }, () => {
          // Wait for BPM energy to accumulate (~4s)
          bpmDisplay.textContent = 'Listening...';
          setTimeout(() => this.tryGetBPM(0), 4000);
        });
      } else {
        // Detection already running, try to get BPM
        this.tryGetBPM(0);
      }
    });
  }

  tryGetBPM(attempt) {
    const bpmDisplay = this.overlay.querySelector('.cs-bpm-display');
    
    chrome.runtime.sendMessage({ type: 'GET_BPM' }, (response) => {
      if (response && response.bpm > 0) {
        this.setMetronomeBPM(response.bpm);
      } else if (attempt < 10) {
        bpmDisplay.textContent = `Listening${'.'.repeat((attempt % 3) + 1)}`;
        setTimeout(() => this.tryGetBPM(attempt + 1), 1500);
      } else {
        bpmDisplay.textContent = 'No beat detected';
        setTimeout(() => {
          bpmDisplay.textContent = `${this.metronomeBPM} BPM`;
        }, 2000);
      }
    });
  }

  tapTempo() {
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
        this.setMetronomeBPM(bpm);
      }
    }
    
    // Visual feedback
    const btn = this.overlay.querySelector('.cs-tap-tempo');
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 100);
  }

  updateLoopButtons() {
    // Update overlay buttons to reflect loop state from popup
    if (this.loopStart !== null) {
      this.overlay.querySelector('.cs-loop-start').classList.add('active');
    } else {
      this.overlay.querySelector('.cs-loop-start').classList.remove('active');
    }
    if (this.loopEnd !== null) {
      this.overlay.querySelector('.cs-loop-end').classList.add('active');
    } else {
      this.overlay.querySelector('.cs-loop-end').classList.remove('active');
    }
  }

  getActiveMedia() {
    const playing = this.mediaElements.find(m => !m.paused);
    if (playing) return playing;
    const ytVideo = document.querySelector('video.html5-main-video');
    if (ytVideo) return ytVideo;
    return this.mediaElements[0];
  }

  updateChord(chord, confidence) {
    if (!chord) return;
    
    const chordName = this.overlay.querySelector('.cs-chord-name');
    const confidenceBar = this.overlay.querySelector('.cs-confidence-bar');
    
    const match = chord.match(/^([A-G][#b]?)(.*)$/);
    if (match) {
      chordName.textContent = match[1];
      this.overlay.querySelector('.cs-chord-type').textContent = match[2] || 'maj';
    } else {
      chordName.textContent = chord;
    }
    
    confidenceBar.style.width = `${confidence * 100}%`;
    this.updateChordDiagram(chord);
  }

  updateChordDiagram(chord) {
    const diagram = this.overlay.querySelector('.cs-chord-diagram');
    const chordData = CHORD_DIAGRAMS[chord];
    
    if (chordData) {
      diagram.innerHTML = this.generateChordSVG(chordData);
    } else {
      diagram.innerHTML = '<span class="cs-no-diagram">No diagram</span>';
    }
  }

  generateChordSVG(chordData) {
    const { frets } = chordData;
    return `
      <svg class="cs-chord-svg" viewBox="0 0 100 120">
        <rect x="10" y="20" width="80" height="90" fill="none" stroke="#666" stroke-width="1"/>
        ${[0,1,2,3,4,5].map(i => `<line x1="${10 + i*16}" y1="20" x2="${10 + i*16}" y2="110" stroke="#999" stroke-width="1"/>`).join('')}
        ${[0,1,2,3,4].map(i => `<line x1="10" y1="${20 + i*22.5}" x2="90" y2="${20 + i*22.5}" stroke="#666" stroke-width="${i === 0 ? 3 : 1}"/>`).join('')}
        ${frets.map((fret, string) => {
          if (fret === 0) return `<circle cx="${10 + string*16}" cy="10" r="4" fill="none" stroke="#fff" stroke-width="2"/>`;
          if (fret === -1) return `<text x="${10 + string*16}" y="14" text-anchor="middle" fill="#ff4444" font-size="12">×</text>`;
          return `<circle cx="${10 + string*16}" cy="${20 + (fret-0.5)*22.5}" r="7" fill="#4CAF50"/>`;
        }).join('')}
      </svg>
    `;
  }

  show() { this.overlay.classList.add('cs-visible'); this.isVisible = true; }
  hide() { this.overlay.classList.remove('cs-visible'); this.isVisible = false; }
  toggle() { this.isVisible ? this.hide() : this.show(); }
}

const CHORD_DIAGRAMS = {
  'C': { frets: [-1, 3, 2, 0, 1, 0] },
  'D': { frets: [-1, -1, 0, 2, 3, 2] },
  'Dm': { frets: [-1, -1, 0, 2, 3, 1] },
  'E': { frets: [0, 2, 2, 1, 0, 0] },
  'Em': { frets: [0, 2, 2, 0, 0, 0] },
  'F': { frets: [1, 3, 3, 2, 1, 1] },
  'G': { frets: [3, 2, 0, 0, 0, 3] },
  'A': { frets: [-1, 0, 2, 2, 2, 0] },
  'Am': { frets: [-1, 0, 2, 2, 1, 0] },
  'Am7': { frets: [-1, 0, 2, 0, 1, 0] },
  'B': { frets: [-1, 2, 4, 4, 4, 2] },
  'Bm': { frets: [-1, 2, 4, 4, 3, 2] },
  'C7': { frets: [-1, 3, 2, 3, 1, 0] },
  'D7': { frets: [-1, -1, 0, 2, 1, 2] },
  'E7': { frets: [0, 2, 0, 1, 0, 0] },
  'G7': { frets: [3, 2, 0, 0, 0, 1] },
  'A7': { frets: [-1, 0, 2, 0, 2, 0] }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.chordSenseOverlay = new ChordSenseOverlay();
  });
} else {
  window.chordSenseOverlay = new ChordSenseOverlay();
}

} // End of initialization guard
