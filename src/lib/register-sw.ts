/** Shape of the `registerSW` helper from `virtual:pwa-register`. */
export type RegisterSW = (options: { immediate: boolean }) => unknown;

/**
 * Registers the generated service worker, if the browser has one.
 *
 * Takes the registrar as an argument so the caller owns the import of
 * the plugin's virtual module: this file stays importable from unit
 * tests, where that module does not exist.
 *
 * jsdom ships no `navigator.serviceWorker`, and neither do older or
 * privacy-hardened browsers, so support is checked rather than assumed.
 * Returns whether registration was attempted.
 */
export function registerServiceWorker(registerSW: RegisterSW): boolean {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  registerSW({ immediate: true });
  return true;
}
