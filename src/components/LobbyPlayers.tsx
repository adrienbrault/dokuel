import { useEffect, useRef, useState } from "react";
import { MAX_ROOM_PLAYERS } from "../lib/constants.ts";
import type { RoomState, Team } from "../lib/types.ts";

type LobbyPlayersProps = {
  roomState: RoomState;
  playerId?: string | undefined;
  onRename?: ((name: string) => void) | undefined;
  onTeamChange?: ((team: Team) => void) | undefined;
};

const TEAMS: Team[] = ["a", "b"];

function teamLabel(team: Team): string {
  return `Team ${team.toUpperCase()}`;
}

/** Who is in the lobby, with our own name editable inline. */
export function LobbyPlayers({
  roomState,
  playerId,
  onRename,
  onTeamChange,
}: LobbyPlayersProps) {
  const teams = roomState.mode === "teams";
  const myTeam = roomState.players.find((p) => p.id === playerId)?.team;
  const waiting = roomState.players.length < 2;
  const openSeats = MAX_ROOM_PLAYERS - roomState.players.length;
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingName]);

  function startEditing(currentName: string) {
    setNameInput(currentName);
    setEditingName(true);
  }

  function commitName() {
    const trimmed = nameInput.trim();
    if (trimmed && onRename) {
      onRename(trimmed);
    }
    setEditingName(false);
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <h3 className="label tracking-wide">Players</h3>
      {roomState.players.map((player) => {
        const isMe = player.id === playerId;
        return (
          <div
            key={player.id}
            className="card flex items-center gap-3 px-4 py-3"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: player.color }}
            />
            {isMe && editingName ? (
              <input
                ref={inputRef}
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                maxLength={24}
                className="font-medium text-text-primary bg-transparent border-b-2 border-accent outline-none min-w-0 flex-1"
              />
            ) : (
              <button
                type="button"
                className={`font-medium text-text-primary text-left truncate ${isMe ? "cursor-pointer hover:underline decoration-accent decoration-2 underline-offset-2" : "cursor-default"}`}
                onClick={() => {
                  if (isMe) startEditing(player.name);
                }}
                title={isMe ? "Click to change name" : undefined}
              >
                {player.name}
              </button>
            )}
            {isMe && !editingName && (
              <button
                type="button"
                className="text-xs text-text-muted hover:text-accent shrink-0 touch-manipulation"
                onClick={() => startEditing(player.name)}
                title="Edit name"
              >
                Edit
              </button>
            )}
            <span className="flex gap-2 shrink-0 ml-auto text-xs text-text-muted">
              {teams && (
                <span className="font-semibold text-text-secondary">
                  {player.team ? teamLabel(player.team) : "No team"}
                </span>
              )}
              {player.id === roomState.hostId && <span>Host</span>}
            </span>
          </div>
        );
      })}
      {teams && onTeamChange && myTeam !== undefined && (
        <div
          role="radiogroup"
          aria-label="Your team"
          className="grid grid-cols-2 gap-2"
        >
          {TEAMS.map((team) => (
            <button
              key={team}
              type="button"
              role="radio"
              aria-checked={myTeam === team}
              className={`btn btn-md ${myTeam === team ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onTeamChange(team)}
            >
              {teamLabel(team)}
            </button>
          ))}
        </div>
      )}
      {waiting && (
        <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border-default animate-pulse">
          <span className="text-sm text-text-muted">Waiting for opponent</span>
          <span className="flex gap-0.5" aria-hidden="true">
            <span
              className="w-1 h-1 rounded-full bg-text-muted animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1 h-1 rounded-full bg-text-muted animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1 h-1 rounded-full bg-text-muted animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        </div>
      )}
      {!waiting && openSeats > 0 && (
        <div className="flex items-center justify-center py-3 rounded-xl border-2 border-dashed border-border-default">
          <span className="text-sm text-text-muted">
            Room for {openSeats} more {openSeats === 1 ? "player" : "players"}
          </span>
        </div>
      )}
    </div>
  );
}
