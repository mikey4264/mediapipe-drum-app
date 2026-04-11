//drum kit config defines all available drum kits with  file paths
const drumKits = [{
        id: 'kit1',
        name: 'Original',
        sounds: {
            kick: '/SoundsWav/kit1-original/kick.wav',
            snare: '/SoundsWav/kit1-original/snare.wav',
            hihat: '/SoundsWav/kit1-original/hihat.wav',
            crash: '/SoundsWav/kit1-original/crash.wav'
        }
    },
    {
        id: 'kit2',
        name: '808 Classic',
        sounds: {
            kick: '/SoundsWav/kit2-808/kick.wav',
            snare: '/SoundsWav/kit2-808/snare.wav',
            hihat: '/SoundsWav/kit2-808/hihat.wav',
            crash: '/SoundsWav/kit2-808/crash.wav'
        }
    },
    {
        id: 'kit3',
        name: 'Acoustic Rock',
        sounds: {
            kick: '/SoundsWav/kit3-acoustic/kick.wav',
            snare: '/SoundsWav/kit3-acoustic/snare.wav',
            hihat: '/SoundsWav/kit3-acoustic/hihat.wav',
            crash: '/SoundsWav/kit3-acoustic/crash.wav'
        }
    },
    {
        id: 'kit4',
        name: 'Electro Modern',
        sounds: {
            kick: '/SoundsWav/kit4-electro/kick.wav',
            snare: '/SoundsWav/kit4-electro/snare.wav',
            hihat: '/SoundsWav/kit4-electro/hihat.wav',
            crash: '/SoundsWav/kit4-electro/crash.wav'
        }
    },
    {
        id: 'kit5',
        name: 'Lo-Fi Vintage',
        sounds: {
            kick: '/SoundsWav/kit5-lofi/kick.wav',
            snare: '/SoundsWav/kit5-lofi/snare.wav',
            hihat: '/SoundsWav/kit5-lofi/hihat.wav',
            crash: '/SoundsWav/kit5-lofi/crash.wav'
        }
    },
    {
        id: 'kit6',
        name: 'Heavy Punch',
        sounds: {
            kick: '/SoundsWav/kit6-heavy/kick.wav',
            snare: '/SoundsWav/kit6-heavy/snare.wav',
            hihat: '/SoundsWav/kit6-heavy/hihat.wav',
            crash: '/SoundsWav/kit6-heavy/crash.wav'
        }
    }
];
function getKitById(kitId) {
    return drumKits.find(kit => kit.id === kitId) || null;
}
function getAllKits() {
    return drumKits;
}
export { drumKits, getKitById, getAllKits };