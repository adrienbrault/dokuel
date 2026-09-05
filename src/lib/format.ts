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
  const parts = isoDate.split("-");
  const monthIndex = Number.parseInt(parts[1] ?? "1", 10) - 1;
  const monthName = SHORT_MONTHS[monthIndex] ?? "Jan";
  return `${monthName} ${Number.parseInt(parts[2] ?? "1", 10)}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-09" to "September 2026", the archive's section headings. */
export function formatMonthLabel(isoMonth: string): string {
  const [year, month] = isoMonth.split("-");
  const monthName = MONTHS[Number.parseInt(month ?? "1", 10) - 1] ?? "January";
  return `${monthName} ${year}`;
}
