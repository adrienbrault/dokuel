export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** Prose-friendly duration: "0:41", "4:32", "1:02:03". */
export function formatShortTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = String(totalSeconds % 60).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}:${secs}`;
  }
  return `${mins}:${secs}`;
}

/** "Bob", "Bob & Carol", "Bob, Carol & Dan". */
export function formatNameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
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
  const parts = isoDate.split("-");
  const monthIndex = Number.parseInt(parts[1] ?? "1", 10) - 1;
  const monthName = SHORT_MONTHS[monthIndex] ?? "Jan";
  return `${monthName} ${Number.parseInt(parts[2] ?? "1", 10)}`;
}
