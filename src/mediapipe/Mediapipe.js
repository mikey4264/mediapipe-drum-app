import {playSound} from "./audioPlayback.js";
import {initializeLoopControls} from "./loopControls.js";
import {tempoDetector} from "./tempoDetector.js";
import {kuramotoSync} from "./kuramoto.js";
import {loopPlayer} from "./loopPlayer.js";
import {getKitById} from "./drumKits.js";

const videoElement = document.createElement("video"); // Hidden video element
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");
const startButton = document.getElementById("startButton");
const saveButton = document.getElementById("saveButton");
const loadButton = document.getElementById("loadButton");
const statusMessage = document.getElementById("statusMessage");
const exitButton = document.querySelector("#exitButton");
const cancelButton = document.querySelector("#cancelButton");

// Tempo display elements
const tempoStatusEl = document.getElementById("tempoStatus");
const tempoBPMEl = document.getElementById("tempoBPM");
const resetTempoButton = document.getElementById("resetTempoButton");
const loopBPMValueEl = document.getElementById("loopBPMValue");

// Sync mode elements (bpm slider declared later around 455)
const syncToggleButton = document.getElementById("syncToggle");
const syncStatusEl = document.getElementById("syncStatus");
let syncEnabled = false;
let syncIntervalID = null;

// Sync frequency is 10 update per sec for gradual transitions
const SYNC_INTERVAL_MS = 100;

let isConfigMode = false;
let cameraRunning = false;
let holistic = null;
let camera = null;

let currentUserKitId = 'kit1'; 

// Fixed box positions
let BOXES = [
    {
        x: 100,
        y: 350,
        width: 150,
        height: 150,
        color: "yellow",
        soundName: "hihat",
        lastTrigger: 0,
        img: "/Images/hihat.svg",
    },
    {
        x: 1030,
        y: 350,
        width: 150,
        height: 150,
        color: "green",
        soundName: "crash",
        lastTrigger: 0,
        img: "/Images/cymbals.svg",
    },
    {
        x: 380,
        y: 470,
        width: 150,
        height: 150,
        color: "blue",
        soundName: "snare",
        lastTrigger: 0,
        img: "/Images/snare.svg",
    },
    {
        x: 750,
        y: 470,
        width: 150,
        height: 150,
        color: "purple",
        soundName: "kick",
        lastTrigger: 0,
        img: "/Images/kick.svg",
    },
];

// Preload images for each box and set the `ready` flag once the image is loaded
BOXES.forEach((box) => {
    const img = new Image();
    img.onload = function () {
        box.ready = true;
    };
    img.src = box.img;
    box.img = img;
    // Track whether each finger is currently inside this box (for enter/exit detection)
    box.leftInside = false;
    box.rightInside = false;
});

const COOLDOWN = 175; // 175ms cooldown — allows fast drumming while preventing double-triggers

// Hit flash config
const HIT_FLASH_DURATION = 300; // ms for the flash to fade out
const FLASH_COLORS = {
    yellow: "rgba(250, 204, 21,",  // hi-hat
    green:  "rgba(74, 222, 128,",  // crash
    blue:   "rgba(96, 165, 250,",  // snare
    purple: "rgba(192, 132, 252,", // kick
};

// Timing feedback colours (used when loop is playing)
const TIMING_ON_BEAT = "rgba(74, 222, 128,";    // green — on beat
const TIMING_CLOSE = "rgba(250, 204, 21,";       // yellow — slightly off
const TIMING_OFF_BEAT = "rgba(248, 113, 113,";   // red — way off

async function initializeHolistic() {
    if (holistic) {
        await holistic.close();
    }
    holistic = new Holistic({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
        },
    });

    await holistic.initialize();

    holistic.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        refineFaceLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
    });

    holistic.onResults(onResults);
}

async function initializeCamera() {
    if (camera) {
        await camera.stop();
    }
    camera = new Camera(videoElement, {
        onFrame: async () => {
            if (holistic) {
                await holistic.send({image: videoElement});
            }
        },
        width: 1280,
        height: 720,
    });
}

async function startApp() {
    if (cameraRunning) {
        console.warn("Application is already running.");
        return;
    }

    try {
        await initializeHolistic();
        await initializeCamera();
        await camera.start();
        cameraRunning = true;
        cancelButton.hidden = false;
    } catch (error) {
        console.error("Error starting application:", error);
        throw error;
    }
}

async function stopApp() {
    if (cameraRunning) {
        try {
            if (camera) {
                await camera.stop();
                camera = null;
            }
        } catch (error) {
            console.error("Error stopping camera:", error);
        }

        try {
            if (holistic) {
                await holistic.close();
                holistic = null;
            }
        } catch (error) {
            console.error("Error closing holistic:", error);
        }

        cameraRunning = false;
    }
}

initializeHolistic();
initializeCamera();

startButton.addEventListener("click", async () => {
    startButton.disabled = true;
    loadButton.disabled = true;
    saveButton.disabled = true;
    statusMessage.style.display = "none";

    try {
        await startApp();
        isConfigMode = false;
    } catch (error) {
        console.error("Error starting application:", error);
        startButton.disabled = false;
        loadButton.disabled = false;
        statusMessage.textContent = "Failed to start application. Please try again.";
        statusMessage.style.display = "block";
    }
});

loadButton.addEventListener("click", async () => {
    statusMessage.style.display = "block";
    statusMessage.textContent =
        "Configuration mode: Use hand gestures to move the boxes.";
    isConfigMode = true;
    startButton.disabled = true;
    saveButton.disabled = false;

    try {
        await startApp();
    } catch (error) {
        console.error("Error starting application:", error);
        loadButton.disabled = false;
        statusMessage.textContent = "Failed to start application. Please try again.";
    }
});

saveButton.addEventListener("click", () => {
    localStorage.setItem("boxConfig", JSON.stringify(BOXES));
    statusMessage.textContent =
        'Configuration saved! Click "Start Playing" to begin.';
    startButton.disabled = false;
    loadButton.disabled = false;
    saveButton.disabled = true;
    isConfigMode = false;
});

// Index fingertip is landmark 8 in the hand model
const HAND_INDEX_FINGERTIP = 8;

//Get fingertip positions from hand landmarks (accurate) with pose landmarks as fallback.
function getFingertips(results) {
    const xscale = canvasElement.width;
    const yscale = canvasElement.height;

    let left = null;
    let right = null;

    // Prefer hand landmarks (much more accurate fingertip tracking)
    if (results.rightHandLandmarks) {
        const tip = results.rightHandLandmarks[HAND_INDEX_FINGERTIP];
        left = { x: (1 - tip.x) * xscale, y: tip.y * yscale };
    }
    if (results.leftHandLandmarks) {
        const tip = results.leftHandLandmarks[HAND_INDEX_FINGERTIP];
        right = { x: (1 - tip.x) * xscale, y: tip.y * yscale };
    }

    // Fall back to pose landmarks if hand model didn't detect
    if (!left && results.poseLandmarks) {
        const p = results.poseLandmarks[POSE_LANDMARKS.RIGHT_INDEX];
        if (p) left = { x: (1 - p.x) * xscale, y: p.y * yscale };
    }
    if (!right && results.poseLandmarks) {
        const p = results.poseLandmarks[POSE_LANDMARKS.LEFT_INDEX];
        if (p) right = { x: (1 - p.x) * xscale, y: p.y * yscale };
    }

    return { left, right };
}

function onResults(results) {
    // Flip the image horizontally
    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-canvasElement.width, 0);
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
    );
    canvasCtx.restore();

    drawBoxes();

    const { left, right } = getFingertips(results);

    if (left || right) {
        if (isConfigMode) {
            moveBoxes(left, right);
        } else {
            checkAndPlaySound(left, right);
        }
    }

    drawLandmarks(results);
}

function drawLandmarks(results) {
    if (results.poseLandmarks) {
        // Flip the x coordinates for landmarks before drawing
        const flippedPoseLandmarks = results.poseLandmarks.map((landmark) => ({
            ...landmark,
            x: 1 - landmark.x,
        }));

        drawConnectors(canvasCtx, flippedPoseLandmarks, POSE_CONNECTIONS, {
            color: "#00FF00",
            lineWidth: 4,
        });
        drawLandmarks(canvasCtx, flippedPoseLandmarks, {
            color: "#FF0000",
            lineWidth: 2,
        });
    }

    if (results.faceLandmarks) {
        const flippedFaceLandmarks = results.faceLandmarks.map((landmark) => ({
            ...landmark,
            x: 1 - landmark.x,
        }));

        drawConnectors(canvasCtx, flippedFaceLandmarks, FACEMESH_TESSELATION, {
            color: "#C0C0C070",
            lineWidth: 1,
        });
    }

    if (results.leftHandLandmarks) {
        // Flip the x coordinates for landmarks before drawing
        const flippedLeftHandLandmarks = results.leftHandLandmarks.map(
            (landmark) => ({
                ...landmark,
                x: 1 - landmark.x,
            })
        );

        drawConnectors(canvasCtx, flippedLeftHandLandmarks, HAND_CONNECTIONS, {
            color: "#CC0000",
            lineWidth: 5,
        });
        drawLandmarks(canvasCtx, flippedLeftHandLandmarks, {
            color: "#00FF00",
            lineWidth: 2,
        });
    }

    if (results.rightHandLandmarks) {
        // Flip the x coordinates for landmarks before drawing
        const flippedRightHandLandmarks = results.rightHandLandmarks.map(
            (landmark) => ({
                ...landmark,
                x: 1 - landmark.x,
            })
        );

        drawConnectors(canvasCtx, flippedRightHandLandmarks, HAND_CONNECTIONS, {
            color: "#00CC00",
            lineWidth: 5,
        });
        drawLandmarks(canvasCtx, flippedRightHandLandmarks, {
            color: "#FF0000",
            lineWidth: 2,
        });
    }
}

function drawBoxes() {
    BOXES.forEach((box) => {
        if (box.ready) {
            canvasCtx.drawImage(box.img, box.x, box.y, box.width, box.height);
        } else {
            canvasCtx.fillStyle = box.color;
            canvasCtx.fillRect(box.x, box.y, box.width, box.height);
        }

        // Hit flash overlay — fades from 60% opacity to 0 over 300ms
        if (box.hitTime) {
            const elapsed = Date.now() - box.hitTime;
            if (elapsed < HIT_FLASH_DURATION) {
                const opacity = 0.6 * (1 - elapsed / HIT_FLASH_DURATION);

                // Use timing colour if loop is playing, otherwise drum colour
                let colorBase;
                if (box.hitTiming !== null) {
                    const off = Math.abs(box.hitTiming); // 0 = on beat, 0.5 = max off
                    if (off < 0.25) colorBase = TIMING_ON_BEAT;
                    else if (off < 0.4) colorBase = TIMING_CLOSE;
                    else colorBase = TIMING_OFF_BEAT;
                } else {
                    colorBase = FLASH_COLORS[box.color] || "rgba(255, 255, 255,";
                }

                canvasCtx.fillStyle = colorBase + opacity + ")";
                canvasCtx.fillRect(box.x, box.y, box.width, box.height);
            }
        }
    });
}

// Update tempo display ui
function updateTempoDisplay() {
    if (tempoDetector.isTempoReady()) {
        const bpm = tempoDetector.getBPM();
        if (bpm !== null) {
            tempoBPMEl.textContent = Math.round(bpm);
            tempoBPMEl.classList.remove("text-gray-500");
            tempoBPMEl.classList.add("text-cyan-400");
            tempoStatusEl.textContent = "Tempo detected!";
            tempoStatusEl.classList.remove("text-gray-400");
            tempoStatusEl.classList.add("text-cyan-300");
        }
    } else {
        // waiting state
        tempoBPMEl.textContent = "--";
        tempoBPMEl.classList.remove("text-cyan-400");
        tempoBPMEl.classList.add("text-gray-500");
        tempoStatusEl.textContent = "Keep playing...";
        tempoStatusEl.classList.remove("text-cyan-300");
        tempoStatusEl.classList.add("text-gray-400");
    }

    // Update confidence ring — progress from 0 (empty) to 1 (full)
    const tempoRing = document.getElementById("tempoRing");
    if (tempoRing) {
        const circumference = 263.9; // 2 * PI * 42 (radius)
        const progress = tempoDetector.getProgress();
        tempoRing.style.strokeDashoffset = circumference * (1 - progress);
    }
}

function checkAndPlaySound(leftFinger, rightFinger) {
    const currentTime = Date.now();

    BOXES.forEach((box) => {
        const leftNowInside = leftFinger ? isPointInBox(leftFinger, box) : false;
        const rightNowInside = rightFinger ? isPointInBox(rightFinger, box) : false;

        // Trigger only on entry
        const leftEntered = leftNowInside && !box.leftInside;
        const rightEntered = rightNowInside && !box.rightInside;

        // Update tracked state for next frame
        box.leftInside = leftNowInside;
        box.rightInside = rightNowInside;

        if (
            (leftEntered || rightEntered) &&
            currentTime - box.lastTrigger > COOLDOWN
        ) {
            const kit = getKitById(currentUserKitId);
            if (kit && kit.sounds[box.soundName]) {
                playSound(kit.sounds[box.soundName]);
            } else {
                console.error(`Sound ${box.soundName} not found in kit ${currentUserKitId}`);
            }

            box.lastTrigger = currentTime;
            box.hitTime = currentTime; // for canvas flash effect
            box.hitTiming = loopPlayer.getTimingOffset(); // null if loop not playing

            // Record hit timestamp for tempo detection
            tempoDetector.recordHit(currentTime);
            updateTempoDisplay();
        }
    });
}

function moveBoxes(leftFinger, rightFinger) {
    const pointer = leftFinger || rightFinger; // Use whichever hand is available
    if (!pointer) return;

    BOXES.forEach((box) => {
        if (isPointInBox(pointer, box)) {
            // Calculate new position ensuring the box stays within canvas boundaries
            const newX = Math.max(
                0,
                Math.min(pointer.x - box.width / 2, canvasElement.width - box.width)
            );
            const newY = Math.max(
                0,
                Math.min(pointer.y - box.height / 2, canvasElement.height - box.height)
            );
            box.x = newX;
            box.y = newY;
        }
    });
}

function isPointInBox(point, box) {
    return (
        point.x >= box.x &&
        point.x <= box.x + box.width &&
        point.y >= box.y &&
        point.y <= box.y + box.height
    );
}

function clearCanvas() {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.fillStyle = "white";
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
}

cancelButton.addEventListener("click", async () => {
    await stopApp();
    clearCanvas();

    startButton.disabled = false;
    loadButton.disabled = false;
    saveButton.disabled = true;
    statusMessage.style.display = "none";
    cancelButton.hidden = true;
});

exitButton.addEventListener("click", () => {
    location.href = "/";
});

window.addEventListener('beforeunload', async () => {
    await stopApp();
});

// drum loop controls
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
        "text-green-400", "text-yellow-400", "text-red-400", "text-gray-400"
    );

    // Pick colour based on status
    let barColor = "#ef4444"; // red
    if (syncStatus.status === 'synced') {
        syncStatusEl.textContent = "In Sync! ✓";
        syncStatusEl.classList.add("text-green-400");
        barColor = "#22c55e"; // green
    } else if (syncStatus.status === 'syncing') {
        syncStatusEl.textContent = "Syncing...";
        syncStatusEl.classList.add("text-yellow-400");
        barColor = "#eab308"; // yellow
    } else {
        syncStatusEl.textContent = "Out of Sync";
        syncStatusEl.classList.add("text-red-400");
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
            syncStatusEl.classList.remove("text-green-400", "text-yellow-400", "text-red-400");
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

// Tempo Detection Controls
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
if (bpmSlider) {
    bpmSlider.addEventListener("input", (e) => {
        loopBPMValueEl.textContent = e.target.value;
    });
    // Initialize on load
    loopBPMValueEl.textContent = bpmSlider.value;
}

// Kit Selection Controls
const userKitSelect = document.getElementById("userKitSelect");
const loopKitSelect = document.getElementById("loopKitSelect");
if (userKitSelect) {
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