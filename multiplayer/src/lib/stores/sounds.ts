// Sound effects manager using Web Audio API
import { writable, get } from 'svelte/store';

export const soundEnabled = writable(true);
export const soundVolume = writable(0.5);

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volumeMultiplier: number = 1) {
  if (!get(soundEnabled)) return;

  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    const volume = get(soundVolume) * volumeMultiplier;
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Sound playback failed:', e);
  }
}

function playNoise(duration: number, volumeMultiplier: number = 1) {
  if (!get(soundEnabled)) return;

  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const gainNode = ctx.createGain();
    const volume = get(soundVolume) * volumeMultiplier * 0.3;
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start();
  } catch (e) {
    console.warn('Sound playback failed:', e);
  }
}

export const sounds = {
  // Card selected/deselected - soft click
  cardSelect: () => {
    playTone(800, 0.05, 'sine', 0.3);
  },

  // Card played - satisfying snap
  cardPlay: () => {
    playNoise(0.08, 0.5);
    playTone(400, 0.1, 'triangle', 0.4);
  },

  // Pass turn - subtle whoosh
  pass: () => {
    playTone(300, 0.15, 'sine', 0.2);
    setTimeout(() => playTone(200, 0.1, 'sine', 0.15), 50);
  },

  // Your turn - attention chime
  yourTurn: () => {
    playTone(523, 0.15, 'sine', 0.5); // C5
    setTimeout(() => playTone(659, 0.15, 'sine', 0.5), 100); // E5
    setTimeout(() => playTone(784, 0.2, 'sine', 0.5), 200); // G5
  },

  // Win - triumphant fanfare
  win: () => {
    playTone(523, 0.2, 'sine', 0.6); // C5
    setTimeout(() => playTone(659, 0.2, 'sine', 0.6), 150); // E5
    setTimeout(() => playTone(784, 0.2, 'sine', 0.6), 300); // G5
    setTimeout(() => playTone(1047, 0.4, 'sine', 0.7), 450); // C6
  },

  // Lose - gentle descending
  lose: () => {
    playTone(400, 0.2, 'sine', 0.3);
    setTimeout(() => playTone(350, 0.2, 'sine', 0.25), 150);
    setTimeout(() => playTone(300, 0.3, 'sine', 0.2), 300);
  },

  // Game start - ready chime
  gameStart: () => {
    playTone(440, 0.1, 'sine', 0.4); // A4
    setTimeout(() => playTone(554, 0.1, 'sine', 0.4), 100); // C#5
    setTimeout(() => playTone(659, 0.15, 'sine', 0.5), 200); // E5
  },

  // Timer warning - urgent beep
  timerWarning: () => {
    playTone(880, 0.1, 'square', 0.3);
  },

  // Timer critical - faster beeps
  timerCritical: () => {
    playTone(1000, 0.08, 'square', 0.4);
  },

  // Chat message received
  chatMessage: () => {
    playTone(600, 0.08, 'sine', 0.2);
    setTimeout(() => playTone(800, 0.08, 'sine', 0.2), 60);
  },

  // Error/invalid action
  error: () => {
    playTone(200, 0.15, 'sawtooth', 0.3);
  }
};

// Initialize audio context on first user interaction
export function initAudio() {
  if (audioContext) return;

  const init = () => {
    getAudioContext();
    document.removeEventListener('click', init);
    document.removeEventListener('keydown', init);
  };

  document.addEventListener('click', init);
  document.addEventListener('keydown', init);
}
