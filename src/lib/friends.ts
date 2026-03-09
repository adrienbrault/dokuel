export type Friend = {
  playerId: string;
  name: string;
  addedAt: string;
};

const STORAGE_KEY = "sudoku_friends";

export function getFriends(): Friend[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFriends(friends: Friend[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(friends));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

const MAX_FRIENDS = 20;

export function addFriend(playerId: string, name: string): Friend[] {
  const friends = getFriends();
  const now = new Date().toISOString();
  const existing = friends.find((f) => f.playerId === playerId);
  if (existing) {
    existing.name = name;
    existing.addedAt = now;
  } else {
    friends.push({ playerId, name, addedAt: now });
  }
  // Keep only the most recent MAX_FRIENDS entries
  const trimmed =
    friends.length > MAX_FRIENDS ? friends.slice(-MAX_FRIENDS) : friends;
  saveFriends(trimmed);
  return getFriends();
}

export function removeFriend(playerId: string): Friend[] {
  const friends = getFriends().filter((f) => f.playerId !== playerId);
  saveFriends(friends);
  return friends;
}

export function isFriend(playerId: string): boolean {
  return getFriends().some((f) => f.playerId === playerId);
}

// --- Pending outgoing invites (localStorage persistence) ---

export type PendingInvite = {
  targetPlayerId: string;
  roomId: string;
  fromId: string;
  fromName: string;
  difficulty: string;
  timestamp: number;
};

const PENDING_INVITES_KEY = "sudoku_pending_invites";

export function getPendingInvites(): PendingInvite[] {
  try {
    const raw = localStorage.getItem(PENDING_INVITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingInvites(invites: PendingInvite[]): void {
  try {
    localStorage.setItem(PENDING_INVITES_KEY, JSON.stringify(invites));
  } catch {
    // localStorage full or unavailable
  }
}

export function storePendingInvite(invite: PendingInvite): void {
  const invites = getPendingInvites().filter(
    (i) => i.targetPlayerId !== invite.targetPlayerId,
  );
  invites.push(invite);
  savePendingInvites(invites);
}

export function clearPendingInvite(targetPlayerId: string): void {
  const invites = getPendingInvites().filter(
    (i) => i.targetPlayerId !== targetPlayerId,
  );
  savePendingInvites(invites);
}

export function clearStalePendingInvites(maxAgeMs: number): void {
  const now = Date.now();
  const invites = getPendingInvites().filter(
    (i) => now - i.timestamp < maxAgeMs,
  );
  savePendingInvites(invites);
}
