export type DeviceProfile = {
  devicePixelRatio: number;
  hardwareConcurrency: number;
  /** Touch-first device: a phone or tablet, on battery more often than not. */
  coarsePointer: boolean;
};

export type AmbianceQuality = {
  pixelRatio: number;
  bloom: boolean;
  /** MSAA samples on the post-processing target. */
  msaa: number;
  /** Dust particles drifting through the air. */
  motes: number;
  /** Floating digit tiles orbiting the board. */
  tiles: number;
  /** Frame cap while a board is on screen; menus always run at 60. */
  gameFps: number;
};

export function pickQuality(device: DeviceProfile): AmbianceQuality {
  const dpr = Math.max(1, device.devicePixelRatio || 1);
  if (device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 4) {
    return {
      pixelRatio: 1,
      bloom: false,
      msaa: 0,
      motes: 220,
      tiles: 24,
      gameFps: 30,
    };
  }
  if (device.coarsePointer) {
    return {
      pixelRatio: Math.min(dpr, 1.5),
      bloom: true,
      msaa: 0,
      motes: 420,
      tiles: 36,
      gameFps: 30,
    };
  }
  return {
    pixelRatio: Math.min(dpr, 2),
    bloom: true,
    msaa: 4,
    motes: 900,
    tiles: 56,
    gameFps: 60,
  };
}

const MIN_PIXEL_RATIO = 0.75;

/**
 * One notch cheaper, or null when there is nothing left to give up.
 * Resolution goes first: it scales every pass, bloom included, and
 * a soft backdrop hides it well. Bloom goes once resolution is at 1.
 */
export function degradeQuality(
  quality: AmbianceQuality,
): AmbianceQuality | null {
  if (quality.pixelRatio > 1) {
    return { ...quality, pixelRatio: Math.max(1, quality.pixelRatio - 0.5) };
  }
  if (quality.bloom) return { ...quality, bloom: false };
  if (quality.pixelRatio > MIN_PIXEL_RATIO) {
    return { ...quality, pixelRatio: MIN_PIXEL_RATIO };
  }
  return null;
}

/** Frames slower than this are hitches (GC, tab switch), not load. */
const HITCH_MS = 100;

/**
 * Watches frame times and says when the device cannot keep up: the
 * mean over a full window of frames must miss the budget. A single
 * hitch never counts, and the window restarts after each verdict so
 * the cheaper settings get a fair trial.
 */
export function createFrameMonitor({ budgetMs = 28, windowSize = 60 } = {}) {
  let total = 0;
  let count = 0;
  return {
    sample(frameMs: number): boolean {
      if (frameMs > HITCH_MS) return false;
      total += frameMs;
      count += 1;
      if (count < windowSize) return false;
      const slow = total / count > budgetMs;
      total = 0;
      count = 0;
      return slow;
    },
  };
}
