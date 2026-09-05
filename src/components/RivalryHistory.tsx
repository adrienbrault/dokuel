import { formatTime } from "../lib/format.ts";
import {
  compareFriendReceipt,
  friendReceiptPath,
} from "../lib/friend-receipt.ts";
import { readRivalryHistory } from "../lib/rivalry.ts";

export function RivalryHistory() {
  const recent = readRivalryHistory().slice(0, 10);
  if (recent.length === 0) return null;
  return (
    <section
      aria-label="Saved friend comparisons"
      className="w-full flex flex-col gap-3"
    >
      <h3 className="label">Friend comparisons</h3>
      <ul className="card divide-y divide-border-default">
        {recent.map(({ receipt }) => {
          const result = compareFriendReceipt(receipt);
          const outcome =
            result.outcome === "practice"
              ? "Practice result"
              : result.outcome === "tie"
                ? "Same finish time"
                : `${receipt[result.outcome].name} finished first`;
          return (
            <li key={receipt.matchId}>
              <a
                href={friendReceiptPath(receipt)}
                className="block min-h-11 p-3 hover:bg-bg-inset rounded-xl"
              >
                <p className="font-medium text-sm">
                  {receipt.challenger.name} · {receipt.friend.name}
                </p>
                <p className="caption">
                  {formatTime(receipt.challenger.timeSeconds)} vs{" "}
                  {formatTime(receipt.friend.timeSeconds)} · {outcome}
                </p>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
