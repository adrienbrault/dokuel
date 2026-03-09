export function CalendarHeatmap({
  data,
  days,
  today,
}: {
  data: Map<string, number>;
  days: number;
  today?: string | undefined;
}) {
  const todayDate = today ? new Date(today) : new Date();
  const cellSize = 10;
  const gap = 2;
  const cols = Math.ceil(days / 7);
  const width = cols * (cellSize + gap);
  const height = 7 * (cellSize + gap);
  const maxCount = Math.max(1, ...data.values());

  const cells: { x: number; y: number; date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayIndex = days - 1 - i;
    const col = Math.floor(dayIndex / 7);
    const row = dayIndex % 7;
    cells.push({
      x: col * (cellSize + gap),
      y: row * (cellSize + gap),
      date: dateStr,
      count: data.get(dateStr) ?? 0,
    });
  }

  return (
    <svg width={width} height={height} role="img" aria-label="Activity heatmap">
      {cells.map(({ x, y, date, count }) => (
        <rect
          key={date}
          x={x}
          y={y}
          width={cellSize}
          height={cellSize}
          rx={2}
          className={count > 0 ? "fill-accent" : "fill-bg-raised"}
          opacity={count > 0 ? 0.3 + 0.7 * (count / maxCount) : undefined}
        />
      ))}
    </svg>
  );
}
