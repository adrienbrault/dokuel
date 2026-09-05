/**
 * The slice of the `registerSW` helper from `virtual:pwa-register` this
 * module uses: register now, say when a newer worker is waiting, and
 * hand back the function that lets it take over.
 */
export type RegisterSW = (options: {
  immediate: boolean;
  onNeedRefresh?: () => void;
}) => (reloadPage?: boolean) => unknown;

/**
 * Registers the generated service worker, if the browser has one.
 *
 * Takes the registrar as an argument so the caller owns the import of
 * the plugin's virtual module: this file stays importable from unit
 * tests, where that module does not exist.
 *
 * The worker is built in prompt mode, so a new deploy installs and then
 * waits. Letting it take over reloads the page, which mid-move or
 * mid-race would drop the player's board and WebRTC peer, so the
 * update is applied only when `isSafeToReload` says nothing is at
 * stake. Otherwise it keeps waiting and takes over on the next launch.
 *
 * jsdom ships no `navigator.serviceWorker`, and neither do older or
 * privacy-hardened browsers, so support is checked rather than assumed.
 * Returns whether registration was attempted.
 */
export function registerServiceWorker(
  registerSW: RegisterSW,
  isSafeToReload: () => boolean,
): boolean {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  let update: ((reloadPage?: boolean) => unknown) | null = null;
  update = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (isSafeToReload()) void update?.(true);
    },
  });
  return true;
}

/**
 * Only the menu screens are safe to reload under the player: no board,
 * no timer, no room. Every game route carries a path segment.
 */
export function onMenuScreen(): boolean {
  return window.location.pathname === "/";
}
