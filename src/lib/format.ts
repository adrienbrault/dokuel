export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  const monthIndex = Number.parseInt(month, 10) - 1;
  return `${SHORT_MONTHS[monthIndex]} ${Number.parseInt(day, 10)}`;
}
