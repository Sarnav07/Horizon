import { describe, expect, it } from "vitest";
import { approveStrategy, authorizeSimulation, pauseStrategy, resumeStrategy } from "./strategy";
import type { Opportunity, StrategyDraft } from "./types";

const draft: StrategyDraft = { id: "s", name: "Test", kind: "spread", status: "DRAFT", hypothesis: "test", createdAt: "2026-10-26T00:00:00Z" };
const candidate: Opportunity = { id: "c", symbol: "WHSK/USDC", kind: "spread", side: "BUY", confidence: 80, expectedEdgeBps: 300, priceImpactBps: 20, slippageBps: 20, liquidityUsd: 100_000, feedAgeSeconds: 1, rationale: "test" };

describe("strategy lifecycle", () => {
  it("requires a draft to be approved before it can simulate", () => {
    expect(authorizeSimulation(draft, candidate, false).allowed).toBe(false);
    expect(authorizeSimulation(approveStrategy(draft), candidate, false).allowed).toBe(true);
  });
  it("stops a paused strategy", () => expect(authorizeSimulation(pauseStrategy(approveStrategy(draft)), candidate, false).allowed).toBe(false));
  it("requires explicit resume before a paused strategy can simulate", () => {
    const paused = pauseStrategy(approveStrategy(draft));
    expect(authorizeSimulation(resumeStrategy(paused), candidate, false).allowed).toBe(true);
  });
  it("rejects a candidate of a different strategy kind", () => expect(authorizeSimulation(approveStrategy(draft), { ...candidate, kind: "signal" }, false).allowed).toBe(false));
});
