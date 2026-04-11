import { loopPlayer } from "./loopPlayer.js";
//Initialize drum loop controls for a page

export function initializeLoopControls(options = {}) {
    const loopStartButton = document.getElementById("loopStartButton");
    const loopStopButton = document.getElementById("loopStopButton");
    const patternSelect = document.getElementById("patternSelect");
    const bpmSlider = document.getElementById("bpmSlider");
    const bpmValue = document.getElementById("bpmValue");
    const loopVolumeSlider = document.getElementById("loopVolumeSlider");
    const loopVolumeValue = document.getElementById("loopVolumeValue");
    const beatIndicator = document.getElementById("beatIndicator");
    const beatDotsContainer = document.getElementById("beatDots");

    // Loop Buttons
    loopStartButton.addEventListener("click", () => {
        loopPlayer.start();
        loopStartButton.classList.add("hidden");
        loopStopButton.classList.remove("hidden");
    });

    loopStopButton.addEventListener("click", () => {
        loopPlayer.stop();
        loopStopButton.classList.add("hidden");
        loopStartButton.classList.remove("hidden");
    });

    // Loop mode select
    const loopModeSelect = document.getElementById("loopModeSelect");
    if (loopModeSelect) {
        loopModeSelect.addEventListener("change", (e) => {
            loopPlayer.setMode(e.target.value);
            const isVocoder = e.target.value === "vocoder";
            if (patternSelect) patternSelect.disabled = isVocoder;
        });
    }

    // pattern selector
    if (patternSelect) {
        patternSelect.addEventListener("change", (e) => {
            loopPlayer.setPattern(parseInt(e.target.value));
            buildBeatDots(); // Rebuild dots when pattern changes
        });
    }

    //BPM & volumn sliders
    if (bpmSlider && bpmValue) {
        bpmSlider.addEventListener("input", (e) => {
            const bpm = parseInt(e.target.value);
            loopPlayer.setBPM(bpm);
            bpmValue.textContent = bpm;
        });
    }
    if (loopVolumeSlider && loopVolumeValue) {
        loopVolumeSlider.addEventListener("input", (e) => {
            const volume = parseInt(e.target.value) / 100;
            loopPlayer.setVolume(volume);
            loopVolumeValue.textContent = `${e.target.value}%`;
        });
    }
    // Create one dot element per beat in the current pattern
    function buildBeatDots() {
        if (!beatDotsContainer) return;

        beatDotsContainer.innerHTML = "";
        const pattern = loopPlayer.getCurrentPattern();

        for (let i = 0; i < pattern.beats; i++) {
            const dot = document.createElement("div");
            dot.style.cssText = "width:12px; height:12px; border-radius:50%; background:#d1d5db; transition: all 0.1s;";
            beatDotsContainer.appendChild(dot);
        }
    }

    // Highlight the active beat's dot 
    function updateBeatDots() {
        if (!beatDotsContainer) return;

        const dots = beatDotsContainer.children;
        if (dots.length === 0) return;

        const activeBeat = loopPlayer.currentBeat;

        for (let i = 0; i < dots.length; i++) {
            if (i === activeBeat) {
                // Active
                dots[i].style.background = "#3b82f6";
                dots[i].style.transform = "scale(1.4)";
            } else {
                // Inactive dot
                dots[i].style.background = "#d1d5db";
                dots[i].style.transform = "scale(1)";
            }
        }
    }
    buildBeatDots();

    //Beat indicator + dots update
    if (beatIndicator) {
        setInterval(() => {
            if (loopPlayer.isPlaying) {
                const pattern = loopPlayer.getCurrentPattern();
                const currentBeat = loopPlayer.currentBeat + 1; // 1-indexed for display
                beatIndicator.textContent = `${currentBeat} / ${pattern.beats}`;
                updateBeatDots();
            }
        }, 50);
    }
}
