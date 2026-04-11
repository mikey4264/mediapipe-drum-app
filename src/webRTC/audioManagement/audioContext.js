// File used for webRTC demo and mediapipe demo

const audioContext = new AudioContext();
const masterGainNode = audioContext.createGain();
masterGainNode.connect(audioContext.destination);

const destination = audioContext.createMediaStreamDestination();
masterGainNode.connect(destination);

async function addAudioSource(url) {
    // Resume the AudioContext if the browser suspended it due to inactivity.
    // This prevents sounds queuing up silently and all playing at once.
    if (audioContext.state === "suspended") {
        await audioContext.resume();
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Audio file download failed");
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    const individualGainNode = audioContext.createGain();
    source.connect(individualGainNode);
    individualGainNode.connect(masterGainNode);

    source.start();
    return source;
}

export {audioContext, destination, addAudioSource};
