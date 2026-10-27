import type { Opportunity, StrategyDraft } from "./types";

export interface SimulationAuthorization {
  allowed: boolean;
  reason: string;
}

export function approveStrategy(draft: StrategyDraft): StrategyDraft {
  if (draft.status !== "DRAFT") throw new Error("Only a draft strategy can be approved");
  return { ...draft, status: "PAPER" };
}

export function pauseStrategy(strategy: StrategyDraft): StrategyDraft {
  if (strategy.status !== "PAPER") throw new Error("Only an active paper strategy can be paused");
  return { ...strategy, status: "PAUSED" };
}

export function resumeStrategy(strategy: StrategyDraft): StrategyDraft {
  if (strategy.status !== "PAUSED") throw new Error("Only a paused strategy can be resumed");
  return { ...strategy, status: "PAPER" };
}

export function authorizeSimulation(strategy: StrategyDraft, candidate: Opportunity, globalPaused: boolean): SimulationAuthorization {
  if (globalPaused) return { allowed: false, reason: "The global paper engine is paused" };
  if (strategy.status !== "PAPER") return { allowed: false, reason: "This strategy is not user-approved for paper simulation" };
  if (strategy.kind !== candidate.kind) return { allowed: false, reason: "Candidate does not match the strategy type" };
  return { allowed: true, reason: "Strategy is user-approved for this paper simulation" };
}
