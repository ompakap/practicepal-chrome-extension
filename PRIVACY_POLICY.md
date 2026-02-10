# Privacy Policy — PracticePal

**Last updated:** February 10, 2026

## Overview

PracticePal is a Chrome extension that helps musicians practice by controlling playback speed, looping sections, transposing pitch, and detecting chords on web pages with audio or video content.

## Data Collection

**PracticePal does NOT collect, store, transmit, or share any personal data or user information.**

Specifically:

- **No personal data** is collected (name, email, location, etc.)
- **No browsing history** is collected or tracked
- **No audio recordings** are stored or transmitted — all audio processing happens locally in your browser in real-time
- **No analytics or tracking** services are used
- **No data is sent to external servers** — the extension operates entirely offline
- **No cookies** are used
- **No user accounts** are required

## Permissions Used

PracticePal requests the following browser permissions, all used strictly for local functionality:

| Permission | Purpose |
|---|---|
| `activeTab` | Access the current tab to inject the practice overlay UI when you click the extension icon |
| `scripting` | Inject the content script that creates speed control, loop, transpose, and chord display UI |
| `tabCapture` | Capture audio from the current tab for real-time chord detection (processed locally) |
| `offscreen` | Create an offscreen document for audio analysis (chord detection) using Web Audio API |
| `storage` | Save your preferences (speed, transpose, metronome BPM) locally in Chrome |

## Local Processing

All audio processing — including chord detection, pitch shifting, and speed adjustment — happens entirely within your browser using the Web Audio API. No audio data ever leaves your device.

## Third-Party Services

PracticePal does not use any third-party services, APIs, or analytics tools.

## Remote Code

PracticePal does **not** use any remote code. All JavaScript code is bundled within the extension package.

## Changes to This Policy

If we update this privacy policy, changes will be posted here with an updated date.

## Contact

If you have questions about this privacy policy, please open an issue at:
https://github.com/ompakap/practicepal-chrome-extension/issues
