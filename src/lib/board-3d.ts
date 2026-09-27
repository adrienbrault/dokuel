const STORAGE_KEY = "sudoku_board_3d";

const listeners = new Set<() => void>();

/** The 3D board is on by default; only an explicit "off" disables it. */
export function getBoard3DEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setBoard3DEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // localStorage not available: the choice lasts for this page only.
  }
  for (const listener of listeners) listener();
}

export function subscribeBoard3D(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let webglSupport: boolean | null = null;

/**
 * Whether this browser can draw the WebGL board. Checked once: the
 * probe context is thrown away, and browsers cap live contexts.
 */
export function supportsWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  // jsdom and very old browsers have no WebGL2 at all; bail before
  // touching canvas.getContext, which jsdom reports as unimplemented.
  if (typeof WebGL2RenderingContext === "undefined") {
    webglSupport = false;
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    webglSupport = gl !== null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}
