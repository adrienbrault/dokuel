let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined")
    return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, volume = 0.1) {
  const ctx = getContext();
  if (!ctx || !getSoundEnabled()) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.value = frequency;
  osc.type = "sine";
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

const STORAGE_KEY = "sudoku_sound";

export function getSoundEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export const sounds = {
  place: () => playTone(800, 0.08),
  erase: () => playTone(400, 0.08),
  note: () => playTone(600, 0.05, 0.05),
  conflict: () => {
    playTone(200, 0.15);
    setTimeout(() => playTone(180, 0.15), 100);
  },
  complete: () => {
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      setTimeout(() => playTone(notes[i], 0.2, 0.08), i * 100);
    }
  },
};
