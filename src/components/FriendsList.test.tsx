import { describe, expect, it, jest } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ActiveGame, Invite } from "../hooks/usePresence.ts";
import type { Friend } from "../lib/friends.ts";
import { FriendsList } from "./FriendsList.tsx";

function makeFriend(playerId: string, name: string): Friend {
  return { playerId, name, addedAt: new Date().toISOString() };
}

function makeInvite(fromId: string, fromName: string): Invite {
  return {
    roomId: "test-room",
    fromId,
    fromName,
    difficulty: "medium",
    timestamp: Date.now(),
  };
}

const defaultProps = {
  playerId: "me123",
  friends: [] as Friend[],
  onlineFriendIds: new Set<string>(),
  pendingInvites: [] as Invite[],
  friendActiveGames: new Map<string, ActiveGame>(),
  onAddFriend: jest.fn(),
  onRemoveFriend: jest.fn(),
  onInviteFriend: jest.fn(),
  onJoinInvite: jest.fn(),
  onJoinGame: jest.fn(),
};

function expandFriendsList() {
  fireEvent.click(screen.getByLabelText("Toggle friends list"));
}

describe("FriendsList", () => {
  it("renders the player's friend code in copy button", () => {
    render(<FriendsList {...defaultProps} />);
    expect(screen.getByText("me123")).toBeInTheDocument();
  });

  it("shows copy button with code", () => {
    render(<FriendsList {...defaultProps} />);
    expect(screen.getByLabelText("Copy friend code")).toBeInTheDocument();
  });

  it("shows friends count button", () => {
    const friends = [makeFriend("friend1", "Bold Lion")];
    render(<FriendsList {...defaultProps} friends={friends} />);
    expect(screen.getByText("1 Friend")).toBeInTheDocument();
  });

  it("shows plural friends count", () => {
    const friends = [
      makeFriend("friend1", "Bold Lion"),
      makeFriend("friend2", "Clever Fox"),
    ];
    render(<FriendsList {...defaultProps} friends={friends} />);
    expect(screen.getByText("2 Friends")).toBeInTheDocument();
  });

  it("shows 'Add Friend' when no friends", () => {
    render(<FriendsList {...defaultProps} />);
    expect(screen.getByText("Add Friend")).toBeInTheDocument();
  });

  it("shows online count indicator", () => {
    const friends = [
      makeFriend("friend1", "Bold Lion"),
      makeFriend("friend2", "Clever Fox"),
    ];
    const onlineFriendIds = new Set(["friend1"]);
    render(
      <FriendsList
        {...defaultProps}
        friends={friends}
        onlineFriendIds={onlineFriendIds}
      />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("expands to show add friend input", () => {
    render(<FriendsList {...defaultProps} />);
    expandFriendsList();
    expect(screen.getByLabelText("Friend code input")).toBeInTheDocument();
  });

  it("adds friend via input", () => {
    const onAddFriend = jest.fn();
    render(<FriendsList {...defaultProps} onAddFriend={onAddFriend} />);
    expandFriendsList();

    const input = screen.getByLabelText("Friend code input");
    fireEvent.change(input, { target: { value: "abc456" } });
    fireEvent.click(screen.getByText("Add"));

    expect(onAddFriend).toHaveBeenCalledWith("abc456");
  });

  it("does not add own code as friend", () => {
    const onAddFriend = jest.fn();
    render(<FriendsList {...defaultProps} onAddFriend={onAddFriend} />);
    expandFriendsList();

    const input = screen.getByLabelText("Friend code input");
    fireEvent.change(input, { target: { value: "me123" } });

    const addButton = screen.getByText("Add");
    expect(addButton).toBeDisabled();
  });

  it("shows friends with online/offline status when expanded", () => {
    const friends = [
      makeFriend("friend1", "Bold Lion"),
      makeFriend("friend2", "Clever Fox"),
    ];
    const onlineFriendIds = new Set(["friend1"]);

    render(
      <FriendsList
        {...defaultProps}
        friends={friends}
        onlineFriendIds={onlineFriendIds}
      />,
    );
    expandFriendsList();

    expect(screen.getByText("Bold Lion")).toBeInTheDocument();
    expect(screen.getByText("Clever Fox")).toBeInTheDocument();

    const onlineDot = screen.getByLabelText("Online");
    expect(onlineDot).toBeInTheDocument();

    const offlineDot = screen.getByLabelText("Offline");
    expect(offlineDot).toBeInTheDocument();
  });

  it("shows invite button for all friends regardless of online status", () => {
    const friends = [
      makeFriend("friend1", "Bold Lion"),
      makeFriend("friend2", "Clever Fox"),
    ];
    const onlineFriendIds = new Set(["friend1"]);

    render(
      <FriendsList
        {...defaultProps}
        friends={friends}
        onlineFriendIds={onlineFriendIds}
      />,
    );
    expandFriendsList();

    expect(screen.getByLabelText("Invite Bold Lion")).toBeInTheDocument();
    expect(screen.getByLabelText("Invite Clever Fox")).toBeInTheDocument();
  });

  it("calls onInviteFriend when invite button clicked", () => {
    const onInviteFriend = jest.fn();
    const friends = [makeFriend("friend1", "Bold Lion")];
    const onlineFriendIds = new Set(["friend1"]);

    render(
      <FriendsList
        {...defaultProps}
        friends={friends}
        onlineFriendIds={onlineFriendIds}
        onInviteFriend={onInviteFriend}
      />,
    );
    expandFriendsList();

    fireEvent.click(screen.getByLabelText("Invite Bold Lion"));
    expect(onInviteFriend).toHaveBeenCalledWith("friend1");
  });

  it("shows pending invites without expanding", () => {
    const invites = [makeInvite("friend1", "Bold Lion")];

    render(<FriendsList {...defaultProps} pendingInvites={invites} />);

    expect(screen.getByText("Bold Lion")).toBeInTheDocument();
    expect(screen.getByText("invited you")).toBeInTheDocument();
    expect(screen.getByLabelText("Join Bold Lion's game")).toBeInTheDocument();
  });

  it("calls onJoinInvite when join button clicked", () => {
    const onJoinInvite = jest.fn();
    const invites = [makeInvite("friend1", "Bold Lion")];

    render(
      <FriendsList
        {...defaultProps}
        pendingInvites={invites}
        onJoinInvite={onJoinInvite}
      />,
    );

    fireEvent.click(screen.getByLabelText("Join Bold Lion's game"));
    expect(onJoinInvite).toHaveBeenCalledWith(invites[0]);
  });

  it("calls onRemoveFriend when remove button clicked", () => {
    const onRemoveFriend = jest.fn();
    const friends = [makeFriend("friend1", "Bold Lion")];

    render(
      <FriendsList
        {...defaultProps}
        friends={friends}
        onRemoveFriend={onRemoveFriend}
      />,
    );
    expandFriendsList();

    fireEvent.click(screen.getByLabelText("Remove Bold Lion"));
    expect(onRemoveFriend).toHaveBeenCalledWith("friend1");
  });

  it("shows empty state when expanded with no friends", () => {
    render(<FriendsList {...defaultProps} />);
    expandFriendsList();
    expect(
      screen.getByText("Share your code with a friend to get started."),
    ).toBeInTheDocument();
  });

  it("toggles expanded state on button click", () => {
    render(<FriendsList {...defaultProps} />);

    // Initially collapsed — no input visible
    expect(
      screen.queryByLabelText("Friend code input"),
    ).not.toBeInTheDocument();

    // Expand
    expandFriendsList();
    expect(screen.getByLabelText("Friend code input")).toBeInTheDocument();

    // Collapse
    expandFriendsList();
    expect(
      screen.queryByLabelText("Friend code input"),
    ).not.toBeInTheDocument();
  });

  it("shows friend active games with join button without expanding", () => {
    const friends = [makeFriend("friend1", "Bold Lion")];
    const friendActiveGames = new Map<string, ActiveGame>([
      [
        "friend1",
        {
          roomId: "game-room",
          difficulty: "hard",
          hostName: "Bold Lion",
          timestamp: Date.now(),
        },
      ],
    ]);

    render(
      <FriendsList
        {...defaultProps}
        friends={friends}
        friendActiveGames={friendActiveGames}
      />,
    );

    expect(screen.getByText("Bold Lion")).toBeInTheDocument();
    expect(screen.getByText("has an open game")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Join Bold Lion's game"),
    ).toBeInTheDocument();
  });

  it("calls onJoinGame when join active game button clicked", () => {
    const onJoinGame = jest.fn();
    const friends = [makeFriend("friend1", "Bold Lion")];
    const game: ActiveGame = {
      roomId: "game-room",
      difficulty: "hard",
      hostName: "Bold Lion",
      timestamp: Date.now(),
    };
    const friendActiveGames = new Map([["friend1", game]]);

    render(
      <FriendsList
        {...defaultProps}
        friends={friends}
        friendActiveGames={friendActiveGames}
        onJoinGame={onJoinGame}
      />,
    );

    fireEvent.click(screen.getByLabelText("Join Bold Lion's game"));
    expect(onJoinGame).toHaveBeenCalledWith(game);
  });
});
