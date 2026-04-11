# MediaPipe Drum App

**A real-time virtual drum kit you play with your hands — powered by gesture recognition and tempo synchronisation.**

Play drums using hand gestures tracked by your webcam. A background drum loop listens to your tempo and gradually syncs up to match you, creating a live jam session with a virtual drummer that adapts to your rhythm.

## What It Does

- **Gesture-based drumming** — MediaPipe Holistic tracks your hands in real-time. Move your hands into trigger zones on screen to hit drums. No controllers, no MIDI — just a webcam.
- **Smart tempo sync** — A beat-grid hypothesis testing algorithm detects your BPM in real-time, then a Kuramoto oscillator model gradually syncs the background loop to your tempo. It converges within 5–13 seconds.
- **6 drum kits** — Original, 808 Classic, Acoustic Rock, Electro, Lo-Fi, and Heavy. User and loop can use different kits for clarity.
- **Keyboard mode** — Don't have a webcam? Play with A, S, D, F keys instead.

## Tech Stack

`Vite` · `Vanilla JavaScript` · `Tailwind CSS` · `Web Audio API` · `MediaPipe Holistic` · `SoundTouchJS`

## How It Works (Under the Hood)

1. **Tempo Detection** — Analyses inter-onset intervals using beat-grid hypothesis testing across 40–180 BPM in 2 BPM steps. Uses subdivision disambiguation, EMA smoothing (α = 0.25), and jump clamping at 15 BPM to avoid wild fluctuations.
2. **Kuramoto Synchronisation** — The background loop's phase is coupled to the user's detected tempo using sinusoidal coupling (K = 0.7) at 100ms intervals. The loop gradually speeds up or slows down to lock in with the player.
3. **Audio Scheduling** — Drum loop playback uses Web Audio API look-ahead scheduling to prevent timer drift, supporting 40–200 BPM across three rhythm patterns (simple, rock, funk groove).

## Quick Start

```bash
# Clone the repo
git clone https://github.com/mikey4264/mediapipe-drum-app.git
cd mediapipe-drum-app/mediapipe-main

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open `http://localhost:5173` in Chrome or Edge with a webcam connected.

## Requirements

- Node.js v18+
- Modern browser with webcam support (Chrome/Edge recommended)
- Internet connection on first load (MediaPipe models loaded from CDN)

## Project Context

Built as a final-year project at Maynooth University (2025–2026), supervised by Dr. Joseph Timoney. Extended from an existing drum application by adding real-time tempo detection, Kuramoto-based synchronisation, multiple drum kits, and time-stretching via SoundTouchJS (WSOLA).

---

*Built by Michael Redmond — BSc Software Engineering, Maynooth University*
