// ChordSense - Background Service Worker
// Handles tab audio capture and communication with popup/content scripts

const STORAGE_KEY = 'chordsense_data';

// State management
let currentTabId = null;
let isCapturing = false;
let offscreenDocument = null;
let currentBPM = 0;

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('ChordSense installed!');
  await initializeStorage();
});

// Initialize storage with default values
async function initializeStorage() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (!data[STORAGE_KEY]) {
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        settings: {
          sensitivity: 0.7,
          displayMode: 'guitar',
          theme: 'dark'
        },
        chordHistory: []
      }
    });
  }
}

// Create offscreen document for audio processing
async function createOffscreenDocument() {
  if (offscreenDocument) return;
  
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
      offscreenDocument = true;
      return;
    }
    
    await chrome.offscreen.createDocument({
      url: 'src/audio/offscreen.html',
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification: 'Audio processing for chord detection'
    });
    offscreenDocument = true;
    
    // Wait for the offscreen document to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    if (!error.message.includes('already exists')) {
      console.error('Failed to create offscreen document:', error);
      throw error;
    }
    offscreenDocument = true;
  }
}

// Send message to offscreen document with retry
async function sendToOffscreen(message, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      if (response) {
        return true;
      }
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error.message);
    }
    
    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  console.error('Failed to send message to offscreen after retries');
  return false;
}

// Start capturing audio from tab
async function startCapture(tabId) {
  console.log('Service Worker: Starting capture for tab', tabId);

  try {
    console.log('Service Worker: Creating offscreen document...');
    await createOffscreenDocument();
    console.log('Service Worker: Offscreen document ready');
    
    console.log('Service Worker: Getting stream ID...');
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId
    });
    console.log('Service Worker: Got stream ID', streamId);

    console.log('Service Worker: Sending START_CAPTURE to offscreen...');
    const sent = await sendToOffscreen({
      type: 'START_CAPTURE',
      streamId: streamId,
      tabId: tabId
    });
    console.log('Service Worker: Message sent result', sent);
    
    if (!sent) {
      return { success: false, error: 'Failed to communicate with audio processor' };
    }

    currentTabId = tabId;
    isCapturing = true;

    console.log('Service Worker: Capture started successfully');
    return { success: true };
  } catch (error) {
    console.error('Capture failed:', error);
    return { success: false, error: error.message };
  }
}

// Stop capturing
async function stopCapture() {
  await sendToOffscreen({ type: 'STOP_CAPTURE' });
  isCapturing = false;
  currentTabId = null;
  return { success: true };
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_DETECTION':
      startCapture(message.tabId).then(sendResponse);
      return true;
      
    case 'STOP_DETECTION':
      stopCapture().then(sendResponse);
      return true;
      
    case 'RESTART_DETECTION':
      // Restart detection for the tab that sent the message or specified tab
      const restartTabId = message.tabId || sender.tab?.id;
      if (restartTabId) {
        stopCapture().then(() => {
          startCapture(restartTabId).then(sendResponse);
        });
      } else {
        // Try to get active tab
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) {
            stopCapture().then(() => {
              startCapture(tab.id).then(sendResponse);
            });
          } else {
            sendResponse({ success: false, error: 'No tab ID' });
          }
        });
      }
      return true;
      
    case 'GET_STATUS':
      sendResponse({
        isCapturing,
        currentTabId
      });
      return true;
      
    case 'CHORD_DETECTED':
      console.log('Service Worker: Received chord', message.chord);
      // Send to popup (might not exist if popup is closed)
      try {
        chrome.runtime.sendMessage({
          type: 'CHORD_UPDATE',
          chord: message.chord,
          confidence: message.confidence
        }).catch(() => {}); // Ignore if popup is closed
      } catch (e) {}
      
      // Send to content script (silently fail if not available)
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          type: 'CHORD_UPDATE',
          chord: message.chord,
          confidence: message.confidence
        }).catch(() => {
          // Ignore - content script not available on this page
        });
      }
      break;
      
    case 'SET_SPEED':
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          type: 'SET_SPEED',
          speed: message.speed
        }).catch(() => {});
      }
      sendResponse({ success: true });
      return true;
      
    case 'GET_BPM':
      // Try to get latest BPM from offscreen if available
      if (isCapturing && offscreenDocument) {
        chrome.runtime.sendMessage({ type: 'GET_CURRENT_BPM' }, (response) => {
          if (response && response.bpm > 0) {
            currentBPM = response.bpm;
          }
          sendResponse({ bpm: currentBPM });
        });
        return true;
      }
      sendResponse({ bpm: currentBPM });
      return true;
      
    case 'BPM_DETECTED':
      currentBPM = message.bpm;
      // Send to content script for overlay update
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          type: 'BPM_UPDATE',
          bpm: message.bpm
        }).catch(() => {});
      }
      break;
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.status === 'loading') {
    stopCapture();
  }
});

// Handle tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === currentTabId) {
    stopCapture();
  }
});
