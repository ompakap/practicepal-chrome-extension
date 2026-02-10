// ChordSense - Offscreen Document Script

import { ChordDetector } from './chord-detector.js';

let detector = null;
let mediaStream = null;

// Signal that offscreen document is ready
console.log('ChordSense: Offscreen document loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_CAPTURE':
      startCapture(message.streamId, message.tabId)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async response
    case 'STOP_CAPTURE':
      stopCapture();
      sendResponse({ success: true });
      return true;
    case 'PING':
      sendResponse({ ready: true });
      return true;
    case 'GET_CURRENT_BPM':
      sendResponse({ bpm: detector ? detector.getBPM() : 0 });
      return true;
  }
});

async function startCapture(streamId, tabId) {
  console.log('ChordSense Offscreen: Starting capture with streamId', streamId);
  try {
    // Use constraints that enable audio processing
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        },
        optional: []
      }
    });
    
    const audioTracks = mediaStream.getAudioTracks();
    console.log('ChordSense Offscreen: Got media stream', audioTracks.length, 'audio tracks');
    
    // Log track settings
    if (audioTracks.length > 0) {
      const settings = audioTracks[0].getSettings();
      console.log('ChordSense Offscreen: Track settings:', JSON.stringify(settings));
      
      // Check if track has data by listening to events
      audioTracks[0].onmute = () => console.log('ChordSense: Track muted');
      audioTracks[0].onunmute = () => console.log('ChordSense: Track unmuted');
      audioTracks[0].onended = () => console.log('ChordSense: Track ended');
    }

    detector = new ChordDetector();
    detector.onChordDetected = (chord, confidence) => {
      console.log('ChordSense Offscreen: Sending chord', chord);
      chrome.runtime.sendMessage({
        type: 'CHORD_DETECTED',
        chord: chord,
        confidence: confidence
      }).catch((err) => {
        console.warn('ChordSense: Failed to send chord', err);
      });
    };
    
    detector.onBPMDetected = (bpm) => {
      console.log('ChordSense Offscreen: BPM detected', bpm);
      chrome.runtime.sendMessage({
        type: 'BPM_DETECTED',
        bpm: bpm
      }).catch(() => {});
    };

    await detector.start(mediaStream);
    console.log('ChordSense: Audio capture started successfully');
  } catch (error) {
    console.error('ChordSense: Failed to start capture', error);
    throw error; // Rethrow to send error response
  }
}

function stopCapture() {
  if (detector) {
    detector.stop();
    detector = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  console.log('ChordSense: Audio capture stopped');
}
