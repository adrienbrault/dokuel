/** Encode JSON as compact UTF-8 base64url for links and local artifacts. */
export function encodeSharePayload(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** Decode a payload and let callers reject its shape with domain validation. */
export function decodeSharePayload(encoded: string): unknown {
  const padding =
    encoded.length % 4 === 0 ? "" : "=".repeat(4 - (encoded.length % 4));
  const binary = atob(
    encoded.replaceAll("-", "+").replaceAll("_", "/") + padding,
  );
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
