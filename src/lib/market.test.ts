import { describe, expect, it } from "vitest";
import { assessFeedHealth, buildSpreadOpportunity } from "./market";

const now = 1_700_000_000_000;

describe("market normalization", () => {
  it("marks malformed book sides invalid", () => {
    expect(assessFeedHealth({ venue: "BINANCE", symbol: "WHSK/USDT", bid: 10, ask: 9, observedAt: now, quoteCurrency: "USDT" }, now).status).toBe("INVALID");
  });
  it("creates a buy-on-HSK paper opportunity from a positive spread", () => {
    const candidate = buildSpreadOpportunity({
      symbol: "WHSK/USDC",
      hskSwap: { venue: "HSKSWAP", symbol: "WHSK/USDC", bid: 9.95, ask: 10, observedAt: now - 1000, quoteCurrency: "USDC" },
      cex: { venue: "BINANCE", symbol: "WHSK/USDT", bid: 10.4, ask: 10.45, observedAt: now - 2000, quoteCurrency: "USDT" },
      liquidityUsd: 30_000, priceImpactBps: 20, slippageBps: 30,
      quoteUsdRates: { USDC: { usd: 1, observedAt: now }, USDT: { usd: 1, observedAt: now } }, now
    });
    expect(candidate.side).toBe("BUY");
    expect(candidate.expectedEdgeBps).toBe(400);
    expect(candidate.confidence).toBeGreaterThan(0);
  });
  it("fails closed when either quote is stale", () => {
    const candidate = buildSpreadOpportunity({
      symbol: "WHSK/USDC",
      hskSwap: { venue: "HSKSWAP", symbol: "WHSK/USDC", bid: 10, ask: 10.1, observedAt: now - 20_000, quoteCurrency: "USDC" },
      cex: { venue: "COINBASE", symbol: "WHSK/USD", bid: 10.4, ask: 10.5, observedAt: now, quoteCurrency: "USD" },
      liquidityUsd: 30_000, priceImpactBps: 20, slippageBps: 30, now
    });
    expect(candidate.confidence).toBe(0);
    expect(candidate.rationale).toContain("Blocked");
  });
  it("does not assume stablecoin quote currencies are interchangeable", () => {
    const candidate = buildSpreadOpportunity({
      symbol: "WHSK/USDC",
      hskSwap: { venue: "HSKSWAP", symbol: "WHSK/USDC", bid: 9.9, ask: 10, observedAt: now, quoteCurrency: "USDC" },
      cex: { venue: "BINANCE", symbol: "WHSK/USDT", bid: 10.4, ask: 10.5, observedAt: now, quoteCurrency: "USDT" },
      liquidityUsd: 30_000, priceImpactBps: 20, slippageBps: 30, now
    });
    expect(candidate.confidence).toBe(0);
    expect(candidate.rationale).toContain("conversion rates");
  });
  it("rejects a stale currency conversion even when venue quotes are fresh", () => {
    const candidate = buildSpreadOpportunity({
      symbol: "WHSK/USDC",
      hskSwap: { venue: "HSKSWAP", symbol: "WHSK/USDC", bid: 9.9, ask: 10, observedAt: now, quoteCurrency: "USDC" },
      cex: { venue: "BINANCE", symbol: "WHSK/USDT", bid: 10.4, ask: 10.5, observedAt: now, quoteCurrency: "USDT" },
      quoteUsdRates: { USDC: { usd: 1, observedAt: now - 16_000 }, USDT: { usd: 1, observedAt: now } },
      liquidityUsd: 30_000, priceImpactBps: 20, slippageBps: 30, now
    });
    expect(candidate.confidence).toBe(0);
  });
});
