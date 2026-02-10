# 🎸 ChordSense - Real-time Chord Detection Chrome Extension

Detect chords from any audio playing in your browser. Slow down music, loop sections, and learn songs faster!

## Features

### Free Features
- ✅ Real-time chord detection (5 detections/day)
- ✅ Speed control (0.5x - 2x)
- ✅ Works on YouTube, Spotify Web, and any audio

### Premium Features ($4.99/month)
- 🔓 Unlimited chord detections
- 🔓 A-B Loop for practice
- 🔓 Chord timeline/history
- 🔓 Transpose chords
- 🔓 Export chord sheets to PDF
- 🔓 Fine speed control (0.1x steps)

## Installation

### Development Mode

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chord-sense` folder
5. The extension icon should appear in your toolbar!

### Test It

1. Go to YouTube and play a music video
2. Click the ChordSense icon in your toolbar
3. Click "Start Detection"
4. Watch chords appear in real-time!

## Project Structure

```
chord-sense/
├── manifest.json           # Extension configuration
├── src/
│   ├── background/
│   │   └── service-worker.js   # Background service worker
│   ├── content/
│   │   └── content-script.js   # Injected into pages
│   ├── popup/
│   │   ├── popup.html          # Popup UI
│   │   ├── popup.css           # Popup styles
│   │   └── popup.js            # Popup logic
│   ├── audio/
│   │   ├── offscreen.html      # Offscreen document
│   │   ├── offscreen.js        # Audio capture
│   │   └── chord-detector.js   # Chord detection algorithm
│   ├── styles/
│   │   └── content.css         # Overlay styles
│   └── icons/
│       ├── icon16.svg
│       ├── icon48.svg
│       └── icon128.svg
└── README.md
```

## How It Works

1. **Audio Capture**: Uses Chrome's `tabCapture` API to capture audio from the active tab
2. **Chord Detection**: Uses chroma feature extraction and template matching
3. **Display**: Shows detected chords in real-time via popup and page overlay

## Tech Stack

- Chrome Extension Manifest V3
- Web Audio API for audio processing
- Chroma feature extraction for chord detection
- Vanilla JavaScript (can be upgraded to Angular)

## Monetization

### Freemium Model
- Free: 5 chord detections per day
- Premium: $4.99/month or $29.99/year or $49.99 lifetime

### Payment Integration (TODO)
- Stripe for web payments
- Chrome Web Store payments (optional)

## Next Steps

1. [ ] Add proper PNG icons (convert from SVG)
2. [ ] Integrate Stripe for payments
3. [ ] Create landing page (chordsense.app)
4. [ ] Add more chord types detection
5. [ ] Improve detection accuracy
6. [ ] Add ukulele/piano chord diagrams
7. [ ] Submit to Chrome Web Store

## License

MIT License - Free to use and modify
