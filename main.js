const mediapipeButton = document.querySelector("#mediapipeButton");
const webRTCButton = document.querySelector("#webRTCButton");
const pitchShiftButton = document.querySelector("#pitchShiftButton");
const manualModeButton = document.querySelector("#manualModeButton");

mediapipeButton.addEventListener("click", () => {
  location.href = "src/mediapipe/Mediapipe.html";
});

webRTCButton.addEventListener("click", () => {
  location.href = "src/webRTC/webRTC.html";
});

pitchShiftButton.addEventListener("click", () => {
  location.href = "src/pitchShift/pitchShift.html";
});

manualModeButton.addEventListener("click", () => {
  location.href = "src/manualMode/manualMode.html";
});