import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Invite } from "../hooks/usePresence.ts";
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
  onAddFriend: vi.fn(),
  onRemoveFriend: vi.fn(),
  onInviteFriend: vi.fn(),
  onJoinInvite: vi.fn(),
};

describe("FriendsList", () => {
  it("renders the player's friend code", () => {
    render(<FriendsList {...defaultProps} />);
    expect(screen.getByText("me123")).toBeInTheDocument();
  });

  it("adds friend via input", () => {
    const onAddFriend = vi.fn();
    render(<FriendsList {...defaultProps} onAddFriend={onAddFriend} />);

    const input = screen.getByLabelText("Friend code input");
    fireEvent.change(input, { target: { value: "abc456" } });
    fireEvent.click(screen.getByText("Add"));

    expect(onAddFriend).toHaveBeenCalledWith("abc456");
  });

  it("does not add own code as friend", () => {
    const onAddFriend = vi.fn();
    render(<FriendsList {...defaultProps} onAddFriend={onAddFriend} />);

    const input = screen.getByLabelText("Friend code input");
    fireEvent.change(input, { target: { value: "me123" } });

    const addButton = screen.getByText("Add");
    expect(addButton).toBeDisabled();
  });

  it("shows friends with online/offline status", () => {
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

    expect(screen.getByText("Bold Lion")).toBeInTheDocument();
    expect(screen.getByText("Clever Fox")).toBeInTheDocument();

    // Online friend should have green dot
    const onlineDot = screen.getByLabelText("Online");
    expect(onlineDot).toBeInTheDocument();

    // Offline friend should have gray dot
    const offlineDot = screen.getByLabelText("Offline");
    expect(offlineDot).toBeInTheDocument();
  });

  it("shows invite button only for online friends", () => {
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

    expect(screen.getByLabelText("Invite Bold Lion")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Invite Clever Fox"),
    ).not.toBeInTheDocument();
  });

  it("calls onInviteFriend when invite button clicked", () => {
    const onInviteFriend = vi.fn();
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

    fireEvent.click(screen.getByLabelText("Invite Bold Lion"));
    expect(onInviteFriend).toHaveBeenCalledWith("friend1");
  });

  it("shows pending invites with join button", () => {
    const invites = [makeInvite("friend1", "Bold Lion")];

    render(<FriendsList {...defaultProps} pendingInvites={invites} />);

    expect(screen.getByText("Bold Lion")).toBeInTheDocument();
    expect(screen.getByText("invited you")).toBeInTheDocument();
    expect(screen.getByLabelText("Join Bold Lion's game")).toBeInTheDocument();
  });

  it("calls onJoinInvite when join button clicked", () => {
    const onJoinInvite = vi.fn();
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
    const onRemoveFriend = vi.fn();
    const friends = [makeFriend("friend1", "Bold Lion")];

    render(
      <FriendsList
        {...defaultProps}
        friends={friends}
        onRemoveFriend={onRemoveFriend}
      />,
    );

    fireEvent.click(screen.getByLabelText("Remove Bold Lion"));
    expect(onRemoveFriend).toHaveBeenCalledWith("friend1");
  });

  it("shows empty state when no friends", () => {
    render(<FriendsList {...defaultProps} />);
    expect(
      screen.getByText("Share your code with a friend to get started."),
    ).toBeInTheDocument();
  });
});
