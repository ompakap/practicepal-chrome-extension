// PracticePal Popup Script

class ChordSensePopup {
  constructor() {
    this.isDetecting = false;
    this.currentSpeed = 1.0;
    this.loopStart = null;
    this.loopEnd = null;
    
    // Transpose state
    this.transposeSemitones = 0;
    
    // Metronome state
    this.audioContext = null;
    this.isMetronomePlaying = false;
    this.metronomeBPM = 120;
    this.metronomeInterval = null;
    this.beatCount = 0;
    this.tapTimes = [];
    
    this.init();
  }

  async init() {
    await this.loadStatus();
    this.setupEventListeners();
    this.setupMessageListener();
    // Ensure content script is loaded on current tab
    await this.ensureContentScript();
  }

  async ensureContentScript() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return false;
    }
    
    try {
      await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { type: 'PING' }, (response) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(response);
        });
      });
      return true;
    } catch (error) {
      // Inject content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content-script.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['src/styles/content.css']
        });
        await new Promise(r => setTimeout(r, 100));
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  async loadStatus() {
    const status = await this.sendMessage({ type: 'GET_STATUS' }) || { isCapturing: false };
    this.updateStatusUI(status);
    this.isDetecting = status.isCapturing;
    this.updateDetectionButton();
  }

  setupEventListeners() {
    document.getElementById('toggleDetection').addEventListener('click', () => this.toggleDetection());
    document.getElementById('showOverlay').addEventListener('click', () => this.showOverlay());

    const speedSlider = document.getElementById('speedSlider');
    speedSlider.addEventListener('input', (e) => this.setSpeed(parseFloat(e.target.value)));

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        speedSlider.value = speed;
        this.setSpeed(speed);
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.getElementById('donateBtn').addEventListener('click', () => this.openDonate());
    
    // Loop controls
    document.getElementById('loopStartBtn').addEventListener('click', () => this.setLoopStart());
    document.getElementById('loopEndBtn').addEventListener('click', () => this.setLoopEnd());
    document.getElementById('loopClearBtn').addEventListener('click', () => this.clearLoop());
    
    // Metronome controls
    document.getElementById('metronomeToggle').addEventListener('click', () => this.toggleMetronome());
    document.getElementById('bpmInput').addEventListener('change', (e) => this.setMetronomeBPM(parseInt(e.target.value)));
    document.getElementById('bpmUpBtn').addEventListener('click', () => this.adjustBPM(5));
    document.getElementById('bpmDownBtn').addEventListener('click', () => this.adjustBPM(-5));
    document.getElementById('detectBpmBtn').addEventListener('click', () => this.detectBPM());
    document.getElementById('tapTempoBtn').addEventListener('click', () => this.tapTempo());
    
    // Transpose controls
    document.getElementById('transposeUpBtn').addEventListener('click', () => this.setTranspose(this.transposeSemitones + 1));
    document.getElementById('transposeDownBtn').addEventListener('click', () => this.setTranspose(this.transposeSemitones - 1));
    document.getElementById('transposeResetBtn').addEventListener('click', () => this.setTranspose(0));
    document.querySelectorAll('.transpose-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setTranspose(parseInt(btn.dataset.semitones)));
    });
    
    document.getElementById('helpLink').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/ompakap/practicepal-chrome-extension/issues' });
    });

    document.getElementById('feedbackLink').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/practicepal/hklaflknikobmoaibaifaidbbfmhmogm/reviews' });
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      console.log('Popup: Received message', message.type);
      if (message.type === 'CHORD_UPDATE') {
        console.log('Popup: Updating chord to', message.chord);
        this.updateChord(message.chord, message.confidence);
      }
    });
  }

  async toggleDetection() {
    if (this.isDetecting) {
      await this.stopDetection();
    } else {
      await this.startDetection();
    }
  }

  async startDetection() {
    console.log('Popup: startDetection called');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.warn('Popup: No active tab');
      return false;
    }
    console.log('Popup: Starting detection for tab', tab.id);

    const result = await this.sendMessage({ type: 'START_DETECTION', tabId: tab.id });
    console.log('Popup: START_DETECTION result', result);

    if (!result) {
      console.warn('Could not start detection - no result');
      return false;
    }

    if (result.success) {
      console.log('Popup: Detection started successfully');
      this.isDetecting = true;
      this.updateDetectionButton();
      this.updateStatusUI({ isCapturing: true });
      this.showOverlay();
      return true;
    } else {
      console.warn('Detection error:', result.error);
      return false;
    }
  }

  async stopDetection() {
    await this.sendMessage({ type: 'STOP_DETECTION' });
    this.isDetecting = false;
    this.updateDetectionButton();
    this.updateStatusUI({ isCapturing: false });
    // Reset chord display
  }

  updateDetectionButton() {
    const btn = document.getElementById('toggleDetection');
    const btnIcon = btn.querySelector('.btn-icon');

    if (this.isDetecting) {
      btn.classList.add('active');
      btnIcon.textContent = '⏹';
    } else {
      btn.classList.remove('active');
      btnIcon.textContent = '▶';
    }
  }

  updateStatusUI(status) {
    // Status UI removed - functionality integrated into chord section
  }

  updateChord(chord, confidence) {
    const chordRoot = document.querySelector('.chord-root');
    const chordType = document.querySelector('.chord-type');
    const confidenceFill = document.getElementById('confidenceFill');

    const match = chord.match(/^([A-G][#b]?)(.*)$/);
    if (match) {
      chordRoot.textContent = match[1];
      chordType.textContent = match[2] || 'maj';
    } else {
      chordRoot.textContent = chord;
    }

    confidenceFill.style.width = `${confidence * 100}%`;
  }

  async setSpeed(speed) {
    this.currentSpeed = speed;
    document.getElementById('speedValue').textContent = `${speed.toFixed(2)}x`;
    
    // Ensure content script is loaded
    await this.ensureContentScript();
    
    // Send to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SET_SPEED', speed }, () => void chrome.runtime.lastError);
    }
  }

  async setTranspose(semitones) {
    semitones = Math.max(-12, Math.min(12, semitones));
    this.transposeSemitones = semitones;
    
    // Update UI
    const prefix = semitones > 0 ? '+' : '';
    document.getElementById('transposeValue').textContent = `${prefix}${semitones}`;
    document.getElementById('transposeSemitones').textContent = `${prefix}${semitones} st`;
    document.querySelectorAll('.transpose-preset-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.semitones) === semitones);
    });
    
    // Ensure content script is loaded
    await this.ensureContentScript();
    
    // Send to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SET_TRANSPOSE', semitones }, () => void chrome.runtime.lastError);
    }
  }

  async setLoopStart() {
    await this.ensureContentScript();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_TIME' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      this.loopStart = response.currentTime;
      document.getElementById('loopStartBtn').classList.add('active');
      this.updateLoopTime();
      this.sendLoopToContent();
    });
  }

  async setLoopEnd() {
    await this.ensureContentScript();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_TIME' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      this.loopEnd = response.currentTime;
      document.getElementById('loopEndBtn').classList.add('active');
      this.updateLoopTime();
      this.sendLoopToContent();
    });
  }

  clearLoop() {
    this.loopStart = null;
    this.loopEnd = null;
    document.getElementById('loopStartBtn').classList.remove('active');
    document.getElementById('loopEndBtn').classList.remove('active');
    document.getElementById('loopTime').textContent = '--:-- - --:--';
    this.sendLoopToContent();
  }

  updateLoopTime() {
    const formatTime = (seconds) => {
      if (seconds === null) return '--:--';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    document.getElementById('loopTime').textContent = 
      `${formatTime(this.loopStart)} - ${formatTime(this.loopEnd)}`;
  }

  async sendLoopToContent() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    chrome.tabs.sendMessage(tab.id, { 
      type: 'SET_LOOP', 
      loopStart: this.loopStart, 
      loopEnd: this.loopEnd 
    }, () => void chrome.runtime.lastError);
  }

  // ==================== METRONOME ====================

  initAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  toggleMetronome() {
    this.initAudio();
    this.isMetronomePlaying = !this.isMetronomePlaying;
    const btn = document.getElementById('metronomeToggle');
    const btnIcon = btn.querySelector('.btn-icon');
    
    if (this.isMetronomePlaying) {
      btnIcon.textContent = '⏹';
      btn.classList.add('active');
      this.startMetronome();
    } else {
      btnIcon.textContent = '▶';
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
    document.getElementById('bpmInput').value = this.metronomeBPM;
    document.getElementById('bpmDisplay').textContent = `${this.metronomeBPM} BPM`;
    
    if (this.isMetronomePlaying) {
      this.stopMetronome();
      this.startMetronome();
    }
  }

  adjustBPM(delta) {
    this.setMetronomeBPM(this.metronomeBPM + delta);
  }

  async detectBPM() {
    const bpmDisplay = document.getElementById('bpmDisplay');
    bpmDisplay.textContent = 'Detecting...';
    
    try {
      // Check if detection is already running
      const status = await this.sendMessage({ type: 'GET_STATUS' });
      console.log('detectBPM: status', status);
      
      if (!status?.isCapturing) {
        // Need to start detection first
        bpmDisplay.textContent = 'Starting...';
        
        // Start detection with a timeout
        const startPromise = this.startDetection();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        );
        
        try {
          const started = await Promise.race([startPromise, timeoutPromise]);
          console.log('detectBPM: startDetection result', started);
          
          if (!started) {
            bpmDisplay.textContent = 'Failed to start';
            setTimeout(() => {
              bpmDisplay.textContent = `${this.metronomeBPM} BPM`;
            }, 2000);
            return;
          }
        } catch (err) {
          console.error('detectBPM: start error', err);
          bpmDisplay.textContent = 'Timeout';
          setTimeout(() => {
            bpmDisplay.textContent = `${this.metronomeBPM} BPM`;
          }, 2000);
          return;
        }
        
        // Wait for BPM to accumulate (need several beats)
        bpmDisplay.textContent = 'Listening...';
        await new Promise(r => setTimeout(r, 5000));
      }
      
      // Try to get BPM multiple times
      let bpm = 0;
      for (let i = 0; i < 5; i++) {
        const response = await this.sendMessage({ type: 'GET_BPM' });
        console.log('detectBPM: GET_BPM response', response);
        if (response && response.bpm > 0) {
          bpm = response.bpm;
          break;
        }
        await new Promise(r => setTimeout(r, 1000));
        bpmDisplay.textContent = `Listening${'.'.repeat((i % 3) + 1)}`;
      }
      
      if (bpm > 0) {
        this.setMetronomeBPM(bpm);
      } else {
        bpmDisplay.textContent = 'No beat detected';
        setTimeout(() => {
          bpmDisplay.textContent = `${this.metronomeBPM} BPM`;
        }, 2000);
      }
    } catch (error) {
      console.error('detectBPM error:', error);
      bpmDisplay.textContent = 'Error';
      setTimeout(() => {
        bpmDisplay.textContent = `${this.metronomeBPM} BPM`;
      }, 2000);
    }
  }

  tapTempo() {
    const now = Date.now();
    const btn = document.getElementById('tapTempoBtn');
    
    // Clear old taps (more than 2 seconds gap)
    if (this.tapTimes.length > 0) {
      const lastTap = this.tapTimes[this.tapTimes.length - 1];
      if (now - lastTap > 2000) {
        this.tapTimes = [];
      }
    }
    
    this.tapTimes.push(now);
    
    // Visual feedback
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 100);
    
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
  }

  async showOverlay() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const restrictedPatterns = [
      'chrome://',
      'chrome-extension://',
      'chrome.google.com/webstore',
      'chromewebstore.google.com',
      'accounts.google.com',
      'about:',
      'edge://',
      'devtools://'
    ];
    if (!tab || !tab.url || restrictedPatterns.some(p => tab.url.startsWith(p) || tab.url.includes(p))) {
      console.warn('Cannot show overlay on this page — restricted by the browser.');
      return;
    }
    
    try {
      // Try to send message to existing content script
      await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { type: 'SHOW_OVERLAY' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      // Content script not loaded, inject it first
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content-script.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['src/styles/content.css']
        });
        // Wait a bit for script to initialize, then show overlay
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: 'SHOW_OVERLAY' }, () => {
            void chrome.runtime.lastError;
          });
        }, 100);
      } catch (injectError) {
        console.warn('Could not inject content script:', injectError);
      }
    }
  }

  openDonate() {
    chrome.tabs.create({ url: 'https://buymeacoffee.com/_orm' });
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Message error:', chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        console.warn('sendMessage error:', error);
        resolve(null);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => new ChordSensePopup());
