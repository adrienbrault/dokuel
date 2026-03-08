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

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateRoomCode(): string {
  const num = Math.floor(Math.random() * 90 + 10); // 10–99
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${num}`;
}
