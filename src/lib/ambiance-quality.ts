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
