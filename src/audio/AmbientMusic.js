// Procedural Web Audio Ambient Music Synthesizer

export const AMBIENT_TRACKS = [
    { 
        name: "Spirited Winds", 
        chords: [
            [174.61, 220.00, 261.63, 329.63], // Fmaj7
            [196.00, 246.94, 293.66, 349.23], // G7
            [164.81, 196.00, 246.94, 293.66], // Em7
            [220.00, 261.63, 329.63, 392.00]  // Am7
        ],
        speed: 2400, stepSpeed: 300, padOsc: 'triangle', leadOsc: 'sine'
    },
    { 
        name: "Summer Clouds", 
        chords: [
            [261.63, 329.63, 392.00, 493.88], // Cmaj7
            [196.00, 246.94, 293.66, 392.00], // G
            [220.00, 261.63, 329.63, 392.00], // Am7
            [174.61, 220.00, 261.63, 329.63]  // Fmaj7
        ],
        speed: 3200, stepSpeed: 400, padOsc: 'sawtooth', leadOsc: 'triangle'
    },
    { 
        name: "Evening Whispers", 
        chords: [
            [220.00, 261.63, 329.63, 493.88], // Am9
            [174.61, 220.00, 261.63, 392.00], // Fmaj9
            [261.63, 329.63, 392.00, 493.88], // Cmaj7
            [164.81, 207.65, 246.94, 293.66]  // E7
        ],
        speed: 2800, stepSpeed: 350, padOsc: 'sine', leadOsc: 'sine'
    },
    { 
        name: "Wandering Spirits", 
        chords: [
            [261.63, 329.63, 392.00, 523.25], // C
            [174.61, 220.00, 261.63, 349.23], // F
            [196.00, 246.94, 293.66, 392.00], // G
            [220.00, 261.63, 329.63, 440.00]  // Am
        ],
        speed: 2000, stepSpeed: 250, padOsc: 'triangle', leadOsc: 'triangle'
    },
    { 
        name: "Star Ocean", 
        chords: [
            [293.66, 369.99, 440.00, 554.37], // Dmaj7
            [220.00, 277.18, 329.63, 415.30], // Amaj7
            [246.94, 293.66, 369.99, 440.00], // Bm7
            [196.00, 246.94, 293.66, 369.99]  // Gmaj7
        ],
        speed: 4000, stepSpeed: 500, padOsc: 'sine', leadOsc: 'triangle'
    },
    { 
        name: "Floating Islands", 
        chords: [
            [207.65, 261.63, 311.13, 392.00], // Abmaj7
            [233.08, 293.66, 349.23, 440.00], // Bbmaj7
            [261.63, 329.63, 392.00, 493.88], // Cmaj7
            [261.63, 329.63, 392.00, 493.88]  // Cmaj7
        ],
        speed: 4500, stepSpeed: 500, padOsc: 'triangle', leadOsc: 'sine'
    },
    { 
        name: "Mystic Journey", 
        chords: [
            [196.00, 233.08, 293.66, 349.23], // Gm7
            [174.61, 220.00, 261.63, 329.63], // Fmaj7
            [155.56, 196.00, 233.08, 293.66], // Ebmaj7
            [146.83, 185.00, 220.00, 293.66]  // D7
        ],
        speed: 3600, stepSpeed: 450, padOsc: 'sine', leadOsc: 'triangle'
    },
    { 
        name: "Gentle Breeze", 
        chords: [
            [329.63, 415.30, 493.88, 622.25], // Emaj7
            [277.18, 349.23, 415.30, 554.37], // Dbmaj7
            [246.94, 311.13, 369.99, 493.88], // Bmaj7
            [220.00, 277.18, 329.63, 440.00]  // Amaj7
        ],
        speed: 3000, stepSpeed: 300, padOsc: 'sine', leadOsc: 'sine'
    }
];

export class AmbientMusicEngine {
    constructor(isLowGfx = false) {
        this.isLowGfx = isLowGfx;
        this.audioCtx = null;
        this.musicGain = null;
        this.reverbNode = null;
        this.isPlaying = false;
        this.currentTrack = 0;
        this.nextNoteTime = 0;
        this.timerID = null;
        this.chordIndex = 0;
        this.sequenceTime = 0;
        this.arpIndex = 0;
        
        this.arpPatterns = [
            [0, 1, 2, 3, 2, 1],
            [0, 2, 1, 3, 2, 3],
            [0, 1, 2, 1],
            [1, 2, 3, 2]
        ];
    }

    setAudioContext(ctx) {
        this.audioCtx = ctx;
    }

    createReverb() {
        if (!this.audioCtx) return null;
        const length = this.audioCtx.sampleRate * (this.isLowGfx ? 0.5 : 4); 
        const impulse = this.audioCtx.createBuffer(2, length, this.audioCtx.sampleRate);
        for (let i = 0; i < 2; i++) {
            const channel = impulse.getChannelData(i);
            for (let j = 0; j < length; j++) {
                channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 3);
            }
        }
        const convolver = this.audioCtx.createConvolver();
        convolver.buffer = impulse;
        return convolver;
    }

    playNote(freq, time, duration, oscType, isPad = false) {
        if (!this.audioCtx || !this.musicGain) return;
        const osc = this.audioCtx.createOscillator();
        const env = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();
        
        osc.type = oscType;
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        
        if (isPad) {
            filter.frequency.value = 600;
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.04, time + duration * 0.4);
            env.gain.linearRampToValueAtTime(0.001, time + duration);
        } else {
            filter.frequency.setValueAtTime(1200, time);
            filter.frequency.exponentialRampToValueAtTime(400, time + duration);
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.1, time + 0.05);
            env.gain.exponentialRampToValueAtTime(0.001, time + duration);
        }
        
        osc.connect(filter);
        filter.connect(env);
        env.connect(this.musicGain);
        
        osc.start(time);
        osc.stop(time + duration);
    }

    scheduleNotes() {
        if (!this.isPlaying || !this.audioCtx) return;
        const track = AMBIENT_TRACKS[this.currentTrack];
        
        if (this.nextNoteTime < this.audioCtx.currentTime - 0.5) {
            this.nextNoteTime = this.audioCtx.currentTime + 0.1;
        }
        
        while (this.nextNoteTime < this.audioCtx.currentTime + 0.2) {
            if (this.sequenceTime % track.speed === 0) {
                const chord = track.chords[this.chordIndex % track.chords.length];
                chord.forEach(freq => {
                    this.playNote(freq / 2, this.nextNoteTime, track.speed / 1000 * 1.5, track.padOsc, true);
                });
            }
            
            const chord = track.chords[this.chordIndex % track.chords.length];
            const pattern = this.arpPatterns[this.chordIndex % this.arpPatterns.length];
            
            if (this.sequenceTime % track.stepSpeed === 0) {
                const arpFreq = chord[pattern[this.arpIndex % pattern.length]] * 2;
                this.playNote(arpFreq, this.nextNoteTime, track.stepSpeed / 1000 * 2.0, track.leadOsc, false);
                this.arpIndex++;
                
                if (Math.random() > 0.7) {
                    const melFreq = chord[Math.floor(Math.random() * chord.length)] * 4;
                    this.playNote(melFreq, this.nextNoteTime, track.speed / 1000 * 0.8, track.leadOsc, false);
                }
            }
            
            this.nextNoteTime += track.stepSpeed / 1000;
            this.sequenceTime += track.stepSpeed;
            
            if (this.sequenceTime >= track.speed) {
                this.sequenceTime = 0;
                this.chordIndex++;
                this.arpIndex = 0;
            }
        }
        this.timerID = setTimeout(() => this.scheduleNotes(), 50);
    }

    toggle() {
        if (!this.audioCtx) return false;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        if (!this.musicGain) {
            this.musicGain = this.audioCtx.createGain();
            this.musicGain.gain.value = 0.5;
            this.reverbNode = this.createReverb();
            this.musicGain.connect(this.reverbNode);
            this.reverbNode.connect(this.audioCtx.destination);
            this.musicGain.connect(this.audioCtx.destination);
        }

        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this.sequenceTime = 0;
            this.chordIndex = 0;
            this.arpIndex = 0;
            this.nextNoteTime = this.audioCtx.currentTime + 0.1;
            this.scheduleNotes();
        } else {
            clearTimeout(this.timerID);
        }
        return this.isPlaying;
    }

    nextTrack() {
        this.currentTrack = (this.currentTrack + 1) % AMBIENT_TRACKS.length;
        this.sequenceTime = 0;
        this.chordIndex = 0;
        this.arpIndex = 0;
        if (this.audioCtx) {
            this.nextNoteTime = this.audioCtx.currentTime + 0.1;
        }
        return AMBIENT_TRACKS[this.currentTrack].name;
    }
}
