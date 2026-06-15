import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mediapipe: resolve(__dirname, 'src/mediapipe/Mediapipe.html'),
        webrtc: resolve(__dirname, 'src/webRTC/webRTC.html'),
        pitchshift: resolve(__dirname, 'src/pitchShift/pitchShift.html'),
        manualmode: resolve(__dirname, 'src/manualMode/manualMode.html')
      }
    }
  }
})