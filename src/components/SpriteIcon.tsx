const SPRITES = {
  assistTabs: "/ui-assets/sprites/assist-tabs.png",
  boardPatternTile: "/ui-assets/sprites/board-pattern-tile.png",
  dailyBadge: "/ui-assets/sprites/daily-badge.png",
  dokuelMark: "/ui-assets/sprites/dokuel-mark.png",
  duelBadge: "/ui-assets/sprites/duel-badge.png",
  emptyBoard: "/ui-assets/sprites/empty-board.png",
  eraseToken: "/ui-assets/sprites/erase-token.png",
  expertSpark: "/ui-assets/sprites/expert-spark.png",
  hintToken: "/ui-assets/sprites/hint-token.png",
  joinToken: "/ui-assets/sprites/join-token.png",
  mediumFlame: "/ui-assets/sprites/medium-flame.png",
  progressRibbon: "/ui-assets/sprites/progress-ribbon.png",
  roomCode: "/ui-assets/sprites/room-code.png",
  settingsToken: "/ui-assets/sprites/settings-token.png",
  soloToken: "/ui-assets/sprites/solo-token.png",
  statsToken: "/ui-assets/sprites/stats-token.png",
  streakToken: "/ui-assets/sprites/streak-token.png",
  undoToken: "/ui-assets/sprites/undo-token.png",
  victoryMedal: "/ui-assets/sprites/victory-medal.png",
} as const;

export type SpriteName = keyof typeof SPRITES;

type SpriteIconProps = {
  name: SpriteName;
  className: string;
};

export function SpriteIcon({ name, className }: SpriteIconProps) {
  return (
    <img
      src={SPRITES[name]}
      alt=""
      className={`block object-contain ${className}`}
      decoding="sync"
      loading="eager"
      aria-hidden="true"
    />
  );
}
