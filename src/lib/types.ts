export type Side = "BUY" | "SELL";
export type StrategyKind = "signal" | "spread";
export type RiskVerdict = "APPROVE" | "BLOCK" | "REVIEW";

export interface RiskProfile {
  maxTradePct: number;
  maxAssetPct: number;
  maxDailyLossPct: number;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  maxFeedAgeSeconds: number;
  minLiquidityUsd: number;
}

export interface Opportunity {
  id: string;
  symbol: string;
  kind: StrategyKind;
  side: Side;
  confidence: number;
  expectedEdgeBps: number;
  priceImpactBps: number;
  slippageBps: number;
  liquidityUsd: number;
  feedAgeSeconds: number;
  rationale: string;
}

export interface RiskDecision {
  verdict: RiskVerdict;
  reasons: string[];
  maxNotionalUsd: number;
}

export interface RiskContext {
  equityUsd: number;
  dailyPnlUsd: number;
  assetExposureUsd: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  averageEntry: number;
  markPrice: number;
}

export interface StrategyDraft {
  id: string;
  name: string;
  kind: StrategyKind;
  status: "DRAFT" | "PAPER" | "PAUSED";
  hypothesis: string;
  createdAt: string;
}
