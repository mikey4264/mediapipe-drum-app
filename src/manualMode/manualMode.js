import { addAudioSource } from "../webRTC/audioManagement/audioContext.js";
import { initializeLoopControls } from "../mediapipe/loopControls.js";
import { tempoDetector } from "../mediapipe/tempoDetector.js";
import { kuramotoSync } from "../mediapipe/kuramoto.js";
import { loopPlayer } from "../mediapipe/loopPlayer.js";
import { getKitById } from "../mediapipe/drumKits.js";

const exitButton = document.querySelector("#exitButton");
const tempoStatusEl = document.getElementById("tempoStatus");
const tempoBPMEl = document.getElementById("tempoBPM");
const resetTempoButton = document.getElementById("resetTempoButton");
const loopBPMValueEl = document.getElementById("loopBPMValue");
const syncToggleButton = document.getElementById("syncToggle");
const syncStatusEl = document.getElementById("syncStatus");

// Sync mode state
let syncEnabled = false;
let syncIntervalID = null;
const SYNC_INTERVAL_MS = 100;

let currentUserKitId = 'kit1'; // Default to kit1 (Original)

// Drum config mapping keyboard keys to sounds
const DRUMS = {
  a: {
    id: "drum-hihat",
    soundName: "hihat",
    name: "Hi-Hat",
  },
  s: {
    id: "drum-cymbal",
    soundName: "crash",
    name: "Cymbal",
  },
  d: {
    id: "drum-snare",
    soundName: "snare",
    name: "Snare",
  },
  f: {
    id: "drum-kick",
    soundName: "kick",
    name: "Kick",
  },
};

// Track pressed keys to stop repeated triggering
const pressedKeys = new Set();

// Update tempo display UI
function updateTempoDisplay() {
  if (tempoDetector.isTempoReady()) {
    const bpm = tempoDetector.getBPM();
    if (bpm !== null) {
      // Update BPM display & status message
      tempoBPMEl.textContent = Math.round(bpm);
      tempoBPMEl.classList.remove("text-gray-400");
      tempoBPMEl.classList.add("text-green-600");
      tempoStatusEl.textContent = "Tempo detected!";
      tempoStatusEl.classList.remove("text-gray-600");
      tempoStatusEl.classList.add("text-green-700");
    }
  } else {
    // not readyu
    tempoBPMEl.textContent = "--";
    tempoBPMEl.classList.remove("text-green-600");
    tempoBPMEl.classList.add("text-gray-400");
    tempoStatusEl.textContent = "Keep playing...";
    tempoStatusEl.classList.remove("text-green-700");
    tempoStatusEl.classList.add("text-gray-600");
  }

  // Update confidence ring — progress from 0 (empty) to 1 (full)
  const tempoRing = document.getElementById("tempoRing");
  if (tempoRing) {
    const circumference = 263.9; // 2 * PI * 42 (radius)
    const progress = tempoDetector.getProgress();
    tempoRing.style.strokeDashoffset = circumference * (1 - progress);
  }
}

// Timing feedback colours for drum pad border
const TIMING_COLORS = {
  onBeat: "#22c55e",  
  close: "#eab308",   
  offBeat: "#ef4444", 
};

// Play sound with visual feedback
function playDrum(drumKey) {
  const drum = DRUMS[drumKey];
  if (!drum) return;

  try {
    // Get current kit
    const kit = getKitById(currentUserKitId);
    if (kit && kit.sounds[drum.soundName]) {
      addAudioSource(kit.sounds[drum.soundName]);
    }

    // Record hit timestamp for tempo detection
    tempoDetector.recordHit(Date.now());

    updateTempoDisplay();

    const drumPad = document.getElementById(drum.id);
    if (drumPad) {
      drumPad.classList.add("scale-95", "brightness-110");

      // Timing feedback — colour the border based on beat accuracy
      const timing = loopPlayer.getTimingOffset();
      if (timing !== null) {
        const off = Math.abs(timing);
        let color;
        if (off < 0.25) color = TIMING_COLORS.onBeat;
        else if (off < 0.4) color = TIMING_COLORS.close;
        else color = TIMING_COLORS.offBeat;
        drumPad.style.boxShadow = `0 0 12px 3px ${color}`;
      }

      setTimeout(() => {
        drumPad.classList.remove("scale-95", "brightness-110");
        drumPad.style.boxShadow = "";
      }, 150);
    }
  } catch (error) {
    console.error(`Error playing ${drum.name}:`, error);
  }
}

// Keyboard event listeners
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  // Prevent repeated triggering when key is held down
  if (pressedKeys.has(key)) return;

  if (DRUMS[key]) {
    pressedKeys.add(key);
    playDrum(key);
  }
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  pressedKeys.delete(key);
});

// Click event listeners for drum pads
Object.entries(DRUMS).forEach(([key, drum]) => {
  const drumPad = document.getElementById(drum.id);
  if (drumPad) {
    drumPad.addEventListener("click", () => {
      playDrum(key);
    });
  }
});

//loop controls
initializeLoopControls();

// sync control functions
function startSync() {
  if (syncEnabled) return;

  syncEnabled = true;
  syncIntervalID = setInterval(() => {
    performSyncAdjustment();
  }, SYNC_INTERVAL_MS);

  // disable manual bpm slider when sync is active
  const bpmSlider = document.getElementById("bpmSlider");
  if (bpmSlider) {
    bpmSlider.disabled = true;
    bpmSlider.classList.add("opacity-50", "cursor-not-allowed");
  }

  updateSyncUI();
}

function stopSync() {
  if (!syncEnabled) return;
  syncEnabled = false;

  if (syncIntervalID) {
    clearInterval(syncIntervalID);
    syncIntervalID = null;
  }

  // Reenable manual bpm slider
  const bpmSlider = document.getElementById("bpmSlider");
  if (bpmSlider) {
    bpmSlider.disabled = false;
    bpmSlider.classList.remove("opacity-50", "cursor-not-allowed");
  }

  updateSyncUI();
}

function performSyncAdjustment() {
  if (!tempoDetector.isTempoReady()) {
    return;
  }

  const userBPM = tempoDetector.getBPM();
  const currentLoopBPM = loopPlayer.getBPM();

  // calculate new BPM using Kuramoto algorithm
  const newBPM = kuramotoSync.calculateSync(currentLoopBPM, userBPM);

  if (newBPM !== null) {
    loopPlayer.setBPM(newBPM);

    const roundedBPM = Math.round(newBPM);
    loopBPMValueEl.textContent = roundedBPM;

    const bpmSlider = document.getElementById("bpmSlider");
    const bpmValue = document.getElementById("bpmValue");
    if (bpmSlider) {
      bpmSlider.value = roundedBPM;
    }
    if (bpmValue) {
      bpmValue.textContent = roundedBPM;
    }

    // Update sync status indicator
    updateSyncStatusIndicator(currentLoopBPM, userBPM);
  }
}

function updateSyncStatusIndicator(loopBPM, userBPM) {
  if (!syncStatusEl) return;

  const syncStatus = kuramotoSync.getSyncStatus(loopBPM, userBPM);

  // Remove status classes
  syncStatusEl.classList.remove(
    "text-green-600", "text-yellow-600", "text-red-600", "text-gray-400"
  );

  // Pick colour based on status
  let barColor = "#ef4444";
  if (syncStatus.status === 'synced') {
    syncStatusEl.textContent = "In Sync! ✓";
    syncStatusEl.classList.add("text-green-600");
    barColor = "#22c55e"; 
  } else if (syncStatus.status === 'syncing') {
    syncStatusEl.textContent = "Syncing...";
    syncStatusEl.classList.add("text-yellow-600");
    barColor = "#eab308"; 
  } else {
    syncStatusEl.textContent = "Out of Sync";
    syncStatusEl.classList.add("text-red-600");
  }

  // Update progress bar
  const syncProgressBar = document.getElementById("syncProgressBar");
  if (syncProgressBar) {
    const percentage = Math.max(0, 100 - (syncStatus.difference * 5));
    syncProgressBar.style.width = percentage + "%";
    syncProgressBar.style.backgroundColor = barColor;
  }

  // Update tempo ring colour to match sync status
  const tempoRing = document.getElementById("tempoRing");
  if (tempoRing) {
    tempoRing.style.stroke = barColor;
  }
}

function updateSyncUI() {
  if (!syncToggleButton) return;

  if (syncEnabled) {
    syncToggleButton.textContent = "Sync: ON";
    syncToggleButton.classList.remove("btn-primary");
    syncToggleButton.classList.add("btn-cancel");
  } else {
    syncToggleButton.textContent = "Sync to My Playing";
    syncToggleButton.classList.remove("btn-cancel");
    syncToggleButton.classList.add("btn-primary");

    // Clear sync status
    if (syncStatusEl) {
      syncStatusEl.textContent = "Sync disabled";
      syncStatusEl.classList.remove("text-green-600", "text-yellow-600", "text-red-600");
      syncStatusEl.classList.add("text-gray-400");
    }
  }
}

// sync toggle button 
if (syncToggleButton) {
  syncToggleButton.addEventListener("click", () => {
    if (syncEnabled) {
      stopSync();
    } else {
      startSync();
    }
  });
}

// Cleanup sync on page unload
window.addEventListener('beforeunload', () => {
  if (syncEnabled) {
    stopSync();
  }
});

// Reset tempo button handler
resetTempoButton.addEventListener("click", () => {
  if (syncEnabled) {
    stopSync();
  }

  // Reset tempo detector & loop to default BPM
  tempoDetector.reset();
  updateTempoDisplay();
  loopPlayer.setBPM(90);
  loopBPMValueEl.textContent = "90";
  const bpmSlider = document.getElementById("bpmSlider");
  if (bpmSlider) {
    bpmSlider.value = 90;
  }
});

// Sync loop BPM display with slider
const bpmSlider = document.getElementById("bpmSlider");
const bpmValue = document.getElementById("bpmValue");

if (bpmSlider) {
  bpmSlider.addEventListener("input", (e) => {
    loopBPMValueEl.textContent = e.target.value;
  });
  loopBPMValueEl.textContent = bpmSlider.value;
}

// Kit Selection Ctrls
const userKitSelect = document.getElementById("userKitSelect");
const loopKitSelect = document.getElementById("loopKitSelect");

if (userKitSelect) 
{
  userKitSelect.addEventListener("change", (e) => {
    currentUserKitId = e.target.value;
    const kit = getKitById(currentUserKitId);
    console.log(`Switched user kit to: ${kit ? kit.name : 'Unknown'}`);
  });
}
if (loopKitSelect) {
  loopKitSelect.addEventListener("change", async (e) => {
    const kitId = e.target.value;
    await loopPlayer.setKit(kitId);
    const kit = getKitById(kitId);
    console.log(`Switched loop kit to: ${kit ? kit.name : 'Unknown'}`);
  });
}
exitButton.addEventListener("click", () => {
  location.href = "/";
});
