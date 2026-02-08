const Music = (function () {
    // ─── PRIVATE STATE ────────────────────────────────────────
    let audioCtx = null;
    let audioBuffer = null;
    let sourceNode = null;
    let gainNode = null;
    let enabled = false;
    let isLoaded = false;
    let isLoading = false;
    let loadError = null;

    // ─── PRIVATE HELPERS ──────────────────────────────────────
    async function loadAudio() {
        if (isLoaded || isLoading) return;
        isLoading = true;
        loadError = null;

        try {
            if (typeof MUSIC_DATA === 'undefined') {
                throw new Error('Music data not found (MUSIC_DATA undefined)');
            }

            // Decode Base64 string
            const binaryString = window.atob(MUSIC_DATA);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
            isLoaded = true;
            isLoading = false;
            console.log('Music loaded from embedded data');
            if (enabled) start();
        } catch (err) {
            console.error('Failed to load music:', err);
            loadError = err.message;
            isLoading = false;
        }
    }

    function start() {
        if (!audioCtx || !isLoaded || sourceNode) return;

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.loop = true;

        gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.6; // Adjust volume as needed

        sourceNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        sourceNode.start(0);
    }

    function stop() {
        if (sourceNode) {
            try {
                sourceNode.stop();
                sourceNode.disconnect();
                gainNode.disconnect();
            } catch (e) {
                // Ignore errors if already stopped
            }
            sourceNode = null;
            gainNode = null;
        }
    }

    // ─── PUBLIC API ───────────────────────────────────────────
    return {
        init: function (ctx) {
            audioCtx = ctx;
            // Preload the music file
            loadAudio();
        },

        toggle: function () {
            if (enabled) {
                stop();
                enabled = false;
            } else {
                enabled = true;
                if (isLoaded) {
                    start();
                } else {
                    loadAudio(); // Try loading again if not ready
                }
            }
            return enabled;
        },

        isEnabled: function () {
            return enabled;
        },

        getStatus: function () {
            if (loadError) return 'ERROR: ' + loadError; // Expose error details
            if (isLoading) return 'LOADING';
            if (isLoaded) return 'READY';
            return 'INIT';
        }
    };
})();
