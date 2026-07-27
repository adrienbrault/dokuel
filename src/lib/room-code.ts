const ADJECTIVES = [
  "red",
  "blue",
  "bold",
  "calm",
  "cool",
  "dark",
  "fast",
  "gold",
  "keen",
  "kind",
  "lazy",
  "loud",
  "mild",
  "neat",
  "pink",
  "pure",
  "rare",
  "safe",
  "slim",
  "soft",
  "tall",
  "tiny",
  "warm",
  "wild",
  "wise",
];

const NOUNS = [
  "bear",
  "bird",
  "cats",
  "deer",
  "dove",
  "duck",
  "fish",
  "frog",
  "goat",
  "hawk",
  "hare",
  "lamb",
  "lion",
  "lynx",
  "mole",
  "moth",
  "newt",
  "orca",
  "puma",
  "seal",
  "slug",
  "swan",
  "toad",
  "wasp",
  "wolf",
];

// No 0/1/i/l/o — codes get read aloud and hand-copied.
const SUFFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SUFFIX_LENGTH = 4;

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * word-word-xxxx: friendly enough to read to a friend, with a random
 * suffix that lifts the keyspace from 56k (enumerable, collision-prone)
 * to ~5×10^8. The room code doubles as the only credential for a room,
 * so guessability is joinability.
 */
export function generateRoomCode(): string {
  const bytes = new Uint32Array(SUFFIX_LENGTH);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (const b of bytes) {
    suffix += SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length];
  }
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${suffix}`;
}
