# � PracticePal - Music Practice Tools

A Chrome extension that helps musicians practice by slowing down music, looping sections, and detecting chords — all from your browser.

## Features

- **Playback Speed Control** — Slow down or speed up any audio (0.25x – 2x) with fine 0.05x steps
- **A-B Loop** — Set start/end points to loop difficult sections
- **Metronome** — Built-in metronome with BPM detection and tap tempo
- **Chord Detection (Beta)** — Real-time chord recognition using HPCP analysis and HMM smoothing
- **Floating Overlay** — On-page overlay showing chords and controls without leaving the tab
- **Works Everywhere** — YouTube, Spotify Web, SoundCloud, or any page with audio

## Installation

### From Source (Developer Mode)

1. Clone this repo
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder
5. The PracticePal icon appears in your toolbar

### Usage

1. Play music on any website (e.g. YouTube)
2. Click the PracticePal icon
3. Adjust speed, set loops, or start chord detection

## Project Structure

```
├── manifest.json                   # Extension manifest (MV3)
├── src/
│   ├── audio/
│   │   ├── chord-detector.js       # HPCP + HMM chord detection
│   │   ├── metronome.js            # Metronome with AudioContext
│   │   ├── offscreen.html          # Offscreen document for audio capture
│   │   ├── offscreen.js            # Offscreen audio capture logic
│   │   └── sample-collector-worklet.js  # AudioWorklet processor
│   ├── background/
│   │   └── service-worker.js       # Background service worker
│   ├── content/
│   │   └── content-script.js       # Page-injected script (overlay + speed)
│   ├── icons/                      # Extension icons (16/48/128 PNG)
│   ├── popup/
│   │   ├── popup.html              # Popup UI
│   │   ├── popup.css               # Popup styles
│   │   └── popup.js                # Popup logic
│   └── styles/
│       └── content.css             # Overlay styles
└── README.md
```

## How It Works

1. **Audio Capture** — Uses Chrome's `tabCapture` API via an offscreen document to capture tab audio
2. **Chord Detection** — Harmonic Pitch Class Profile (HPCP) extraction with HMM-based chord smoothing (Essentia.js-inspired algorithms in pure JS)
3. **Audio Processing** — AudioWorklet-based sample collection for low-latency processing
4. **Speed Control** — Adjusts `HTMLMediaElement.playbackRate` on the page via content script
5. **A-B Loop** — Monitors `currentTime` and seeks back to loop start when the end point is reached

## Tech Stack

- Chrome Extension Manifest V3
- Web Audio API (AnalyserNode, AudioWorklet, AudioContext)
- Pure JavaScript — no external dependencies
- Offscreen Documents API for background audio processing

## License

MIT
