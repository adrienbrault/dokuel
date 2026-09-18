/**
 * A set of nine symbols, one per digit, that can stand in for the
 * numerals on the board.
 *
 * Themes are chosen for how well nine members stay apart from each
 * other, not for how charming they are as a set: the board is read at
 * a glance, and pencil notes render these at roughly a third of a
 * cell. Themes whose members share one silhouette (round faces, balls)
 * are the ones that struggle there.
 */
export type EmojiTheme = {
  id: string;
  label: string;
  /** Index 0 is digit 1, index 8 is digit 9. */
  symbols: readonly string[];
};

export const EMOJI_THEMES: readonly EmojiTheme[] = [
  {
    id: "shapes",
    label: "Shapes",
    // The safest of the ten: nine flat discs that differ on hue alone,
    // so they survive note size where detailed themes turn to mush.
    symbols: ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪"],
  },
  {
    id: "fruit",
    label: "Fruit",
    symbols: ["🍎", "🍊", "🍋", "🍐", "🍇", "🍓", "🍑", "🍒", "🥝"],
  },
  {
    id: "animals",
    label: "Animals",
    symbols: ["🐶", "🐱", "🐭", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯"],
  },
  {
    id: "sea",
    label: "Sea",
    symbols: ["🐠", "🐙", "🦈", "🐳", "🦀", "🐡", "🦑", "🐚", "🦭"],
  },
  {
    id: "space",
    label: "Space",
    symbols: ["🌍", "🌙", "⭐", "☀️", "🪐", "🚀", "🛸", "☄️", "🌈"],
  },
  {
    id: "food",
    label: "Food",
    symbols: ["🍕", "🍔", "🌮", "🍣", "🍩", "🥐", "🍜", "🧀", "🥑"],
  },
  {
    id: "nature",
    label: "Nature",
    symbols: ["🌵", "🌻", "🍄", "🌲", "🌺", "🍁", "🌿", "🌷", "🌴"],
  },
  {
    id: "weather",
    label: "Weather",
    symbols: ["☀️", "🌧️", "⛄", "❄️", "🌈", "⚡", "🌪️", "🌊", "🔥"],
  },
  {
    id: "vehicles",
    label: "Vehicles",
    symbols: ["🚗", "🚌", "🚂", "✈️", "🚁", "🚢", "🚲", "🚜", "🛵"],
  },
  {
    id: "faces",
    label: "Faces",
    symbols: ["😀", "😎", "🤩", "😡", "🤢", "😴", "🤠", "🥳", "😱"],
  },
] as const;

export const DEFAULT_EMOJI_THEME = EMOJI_THEMES[0]!.id;

export function findEmojiTheme(id: string): EmojiTheme | null {
  return EMOJI_THEMES.find((t) => t.id === id) ?? null;
}
