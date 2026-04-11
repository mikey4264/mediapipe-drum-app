import { audioContext, addAudioSource } from "../webRTC/audioManagement/audioContext.js";
import { getKitById } from "./drumKits.js";
import { PitchShifter } from "soundtouchjs";

/**
 * DrumLoopPlayer - Precise drum loop playback using Web Audio API scheduling
 *
 * Uses "look ahead" scheduling to have accurate timing:
 * - js timer checks upcoming notes
 * - Web audio API schedules exact playback times
 */
class DrumLoopPlayer {
    constructor() {
        // timing config
        this.bpm = 90;
        this.currentBeat = 0;
        this.isPlaying = false;
        this.scheduleAheadTime = 0.1; // Look ahead 100ms
        this.scheduleInterval = 25; // Check every 25ms
        this.nextNoteTime = 0; // When the next note is due 
        this.timerID = null;

        // volume
        this.gainNode = audioContext.createGain();
        this.gainNode.gain.value = 0.7; // dfault 70% 
        this.gainNode.connect(audioContext.destination);

        this.currentPatternIndex = 0;
        this.currentKitId = 'kit2'; // Default to kit2 (808 Classic)

        // loop definitions
        this.patterns = {
            simple: {
                name: "Simple Rock",
                beats: 4,
                pattern: [
                    { beat: 0, sounds: ["kick", "hihat"] },
                    { beat: 1, sounds: ["hihat"] },
                    { beat: 2, sounds: ["snare", "hihat"] },
                    { beat: 3, sounds: ["hihat"] }
                ]
            },
            medium: {
                name: "Rock Beat",
                beats: 8,
                pattern: [
                    { beat: 0, sounds: ["kick", "hihat"] },
                    { beat: 1, sounds: ["hihat"] },
                    { beat: 2, sounds: ["snare", "hihat"] },
                    { beat: 3, sounds: ["hihat"] },
                    { beat: 4, sounds: ["kick", "hihat"] },
                    { beat: 5, sounds: ["hihat"] },
                    { beat: 6, sounds: ["snare", "hihat"] },
                    { beat: 7, sounds: ["hihat"] }
                ]
            },
            complex: {
                name: "Funk Groove",
                beats: 16,
                pattern: [
                    { beat: 0, sounds: ["kick", "hihat"] },
                    { beat: 1, sounds: ["hihat"] },
                    { beat: 2, sounds: ["kick"] },
                    { beat: 3, sounds: ["hihat"] },
                    { beat: 4, sounds: ["snare", "hihat"] },
                    { beat: 5, sounds: ["hihat"] },
                    { beat: 6, sounds: ["kick", "hihat"] },
                    { beat: 7, sounds: [] }, // Rest
                    { beat: 8, sounds: ["kick", "hihat"] },
                    { beat: 9, sounds: ["hihat"] },
                    { beat: 10, sounds: ["kick", "crash"] },
                    { beat: 11, sounds: ["hihat"] },
                    { beat: 12, sounds: ["snare", "hihat"] },
                    { beat: 13, sounds: ["kick"] },
                    { beat: 14, sounds: ["snare", "hihat"] },
                    { beat: 15, sounds: ["hihat"] }
                ]
            }
        };
        this.soundBuffers = new Map();
        this.preloadSounds();

        // Vocoder (time-stretch) mode state
        this.mode = "pattern"; // "pattern" or "vocoder"
        this.loopBuffer = null; // decoded AudioBuffer of the WAV/MP3 loop
        this.shifter = null;   // SoundTouch PitchShifter instance
        this.originalBpm = 120; // BPM the loop file was recorded at
        this.loopFilePath = "/loops/drum-loop-120bpm.mp3";
        this.preloadLoop();
    }

    // Fetch and decode the pre-recorded loop file for vocoder mode
    async preloadLoop() {
        try {
            const response = await fetch(this.loopFilePath);
            const arrayBuffer = await response.arrayBuffer();
            this.loopBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error("Failed to load loop file:", e);
        }
    }

 //Preload all drum sounds for the current kit into memory for instant playback without fetch delays
    async preloadSounds() {
        const kit = getKitById(this.currentKitId);
        if (!kit) return;

        this.soundBuffers.clear();
        const soundNames = ['kick', 'snare', 'hihat', 'crash'];
        const loadPromises = soundNames.map(async (soundName) => {
            const path = kit.sounds[soundName];
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            this.soundBuffers.set(soundName, audioBuffer);
        });

        await Promise.all(loadPromises);
    }


    // Change the drum kit used by loop player
    async setKit(kitId) {
        const kit = getKitById(kitId);
        if (!kit) {
            console.error(`Kit ${kitId} not found`);
            return;
        }

        console.log(`Switching loop kit to: ${kit.name}`);
        this.currentKitId = kitId;
        await this.preloadSounds();
    }

    playScheduledSound(soundName, time) {
        const buffer = this.soundBuffers.get(soundName);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNode);
        source.start(time);
    }


    //Calculate time between beats based on BPM
    getSecondPerBeat() {
        return 60.0 / this.bpm;
    }

    getCurrentPattern() {
        const patternKeys = Object.keys(this.patterns);
        return this.patterns[patternKeys[this.currentPatternIndex]];
    }

    nextBeat() {
        const pattern = this.getCurrentPattern();
        const secondsPerBeat = this.getSecondPerBeat();
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat = (this.currentBeat + 1) % pattern.beats;
    }

    // Schedule notes that need to play in the next scheduling window
    scheduleNote() {
        const pattern = this.getCurrentPattern();
        const beatData = pattern.pattern.find(p => p.beat === this.currentBeat);
        if (beatData && beatData.sounds.length > 0) {
            beatData.sounds.forEach(sound => {
                this.playScheduledSound(sound, this.nextNoteTime);
            });
        }

        this.nextBeat();
    }

    //Main scheduler function 
    scheduler() {
        while (this.nextNoteTime < audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote();
        }
        if (this.isPlaying) {
            this.timerID = setTimeout(() => this.scheduler(), this.scheduleInterval);
        }
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        if (this.mode === "vocoder") {
            this.startVocoder();
        } else {
            this.currentBeat = 0;
            this.nextNoteTime = audioContext.currentTime + 0.05;
            this.loopStartTime = this.nextNoteTime;
            this.scheduler();
        }
    }

    // Create a PitchShifter, set tempo ratio, connect to gain node, loop on end
    startVocoder() {
        if (!this.loopBuffer) return;
        const onEnd = () => {
            // Loop: destroy old shifter, start a new one
            this.stopVocoder();
            if (this.isPlaying) this.startVocoder();
        };
        this.shifter = new PitchShifter(audioContext, this.loopBuffer, 4096, onEnd);
        this.shifter.tempo = this.bpm / this.originalBpm;
        this.shifter.connect(this.gainNode);
    }

    stopVocoder() {
        if (this.shifter) {
            this.shifter.disconnect();
            this.shifter = null;
        }
    }

    stop() {
        this.isPlaying = false;
        if (this.mode === "vocoder") {
            this.stopVocoder();
        } else {
            if (this.timerID) {
                clearTimeout(this.timerID);
                this.timerID = null;
            }
            this.currentBeat = 0;
        }
    }

    setBPM(bpm) {
        this.bpm = Math.max(40, Math.min(200, bpm));
        // In vocoder mode, update the SoundTouch tempo ratio in real time
        if (this.mode === "vocoder" && this.shifter) {
            this.shifter.tempo = this.bpm / this.originalBpm;
        }
    }
    getBPM() {
        return this.bpm;
    }

    setVolume(volume) {
        this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }

    getVolume() {
        return this.gainNode.gain.value;
    }

    setPattern(index) {
        const patternKeys = Object.keys(this.patterns);
        if (index >= 0 && index < patternKeys.length) {
            const wasPlaying = this.isPlaying;

            if (wasPlaying) {
                this.stop();
            }

            this.currentPatternIndex = index;
            this.currentBeat = 0;

            if (wasPlaying) {
                this.start();
            }
        }
    }
    getPatternNames() {
        return Object.values(this.patterns).map(p => p.name);
    }

    setMode(mode) {
        if (mode === this.mode) return;
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.stop();
        this.mode = mode;
        if (wasPlaying) this.start();
    }

    // Returns how far the current moment is from the nearest beat
    // Result is -0.5 to 0.5 (fraction of one beat period)
    // 0 = exactly on beat, negative = early, positive = late
    // Uses loopStartTime as a fixed anchor so BPM jitter doesn't shift the grid
    getTimingOffset() {
        if (!this.isPlaying) return null;

        const now = audioContext.currentTime;
        const secPerBeat = this.getSecondPerBeat();
        // Time since the loop started, measured against a stable grid
        const elapsed = now - this.loopStartTime;
        // Where are we within the current beat? (0 to 1)
        const fraction = ((elapsed % secPerBeat) + secPerBeat) % secPerBeat / secPerBeat;
        // Convert to -0.5 to 0.5 (so 0 = on beat)
        return fraction <= 0.5 ? fraction : fraction - 1;
    }
}

// Create instance
const loopPlayer = new DrumLoopPlayer();

export { loopPlayer };
