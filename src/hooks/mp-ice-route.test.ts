import { describe, expect, it } from "vitest";
import { selectedIceRoute } from "./mp-ice-route.ts";

function report(...entries: Record<string, unknown>[]): RTCStatsReport {
  return new Map(
    entries.map((entry) => [entry.id as string, entry]),
  ) as unknown as RTCStatsReport;
}

const LOCAL_RELAY = {
  id: "L1",
  type: "local-candidate",
  candidateType: "relay",
};
const LOCAL_HOST = { id: "L2", type: "local-candidate", candidateType: "host" };
const REMOTE_SRFLX = {
  id: "R1",
  type: "remote-candidate",
  candidateType: "srflx",
};

describe("selectedIceRoute", () => {
  it("follows the transport's selected pair (Chromium, Safari)", () => {
    expect(
      selectedIceRoute(
        report(
          { id: "T", type: "transport", selectedCandidatePairId: "P1" },
          {
            id: "P0",
            type: "candidate-pair",
            localCandidateId: "L2",
            remoteCandidateId: "R1",
            nominated: true,
            state: "succeeded",
          },
          {
            id: "P1",
            type: "candidate-pair",
            localCandidateId: "L1",
            remoteCandidateId: "R1",
          },
          LOCAL_RELAY,
          LOCAL_HOST,
          REMOTE_SRFLX,
        ),
      ),
    ).toEqual({ local: "relay", remote: "srflx" });
  });

  it("falls back to the pair flagged selected (Firefox)", () => {
    expect(
      selectedIceRoute(
        report(
          {
            id: "P1",
            type: "candidate-pair",
            localCandidateId: "L2",
            remoteCandidateId: "R1",
            selected: true,
          },
          LOCAL_HOST,
          REMOTE_SRFLX,
        ),
      ),
    ).toEqual({ local: "host", remote: "srflx" });
  });

  it("falls back to a nominated, succeeded pair", () => {
    expect(
      selectedIceRoute(
        report(
          {
            id: "P1",
            type: "candidate-pair",
            localCandidateId: "L1",
            remoteCandidateId: "R1",
            nominated: true,
            state: "succeeded",
          },
          LOCAL_RELAY,
          REMOTE_SRFLX,
        ),
      ),
    ).toEqual({ local: "relay", remote: "srflx" });
  });

  it("is null without a usable selected pair", () => {
    expect(
      selectedIceRoute(
        report({
          id: "P1",
          type: "candidate-pair",
          localCandidateId: "missing",
          remoteCandidateId: "R1",
          selected: true,
        }),
      ),
    ).toBeNull();
    expect(selectedIceRoute(report())).toBeNull();
  });
});
