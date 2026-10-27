import type { Opportunity } from "./types";

export type Venue = "HSKSWAP" | "BINANCE" | "COINBASE";

export interface VenueQuote {
  venue: Venue;
  symbol: string;
  bid: number;
  ask: number;
  observedAt: number;
  quoteCurrency: "USD" | "USDC" | "USDT";
}

export interface FeedHealth {
  venue: Venue;
  status: "HEALTHY" | "STALE" | "INVALID";
  ageSeconds: number;
  reason?: string;
}

export interface CurrencyRate {
  usd: number;
  observedAt: number;
}

export function assessFeedHealth(quote: VenueQuote, now = Date.now(), maxAgeSeconds = 15): FeedHealth {
  const ageSeconds = Number.isFinite(quote.observedAt) && Number.isFinite(now)
    ? Math.max(0, Math.floor((now - quote.observedAt) / 1000)) : 0;
  if (!Number.isFinite(now) || !Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0
    || !Number.isFinite(quote.observedAt) || quote.observedAt > now + 1_000
    || !Number.isFinite(quote.bid) || !Number.isFinite(quote.ask)
    || quote.bid <= 0 || quote.ask <= 0 || quote.ask < quote.bid) {
    return { venue: quote.venue, status: "INVALID", ageSeconds, reason: "Invalid quote or timestamp" };
  }
  if (ageSeconds > maxAgeSeconds) return { venue: quote.venue, status: "STALE", ageSeconds, reason: "Quote exceeds freshness policy" };
  return { venue: quote.venue, status: "HEALTHY", ageSeconds };
}

/**
 * Produces a paper-only cross-venue candidate. The result deliberately contains
 * no executable CEX instruction; CEX execution is out of scope for v1.
 */
export function buildSpreadOpportunity(input: {
  symbol: string;
  hskSwap: VenueQuote;
  cex: VenueQuote;
  liquidityUsd: number;
  priceImpactBps: number;
  slippageBps: number;
  quoteUsdRates?: Partial<Record<VenueQuote["quoteCurrency"], CurrencyRate>>;
  now?: number;
}): Opportunity {
  const now = input.now ?? Date.now();
  const hskHealth = assessFeedHealth(input.hskSwap, now);
  const cexHealth = assessFeedHealth(input.cex, now);
  const feedAgeSeconds = Math.max(hskHealth.ageSeconds, cexHealth.ageSeconds);
  const targetBase = input.symbol.split("/")[0]?.trim().toUpperCase();
  const hskBase = input.hskSwap.symbol.split("/")[0]?.trim().toUpperCase();
  const cexBase = input.cex.symbol.split("/")[0]?.trim().toUpperCase();
  const hskSymbolQuote = input.hskSwap.symbol.split("/")[1]?.trim().toUpperCase();
  const cexSymbolQuote = input.cex.symbol.split("/")[1]?.trim().toUpperCase();
  const comparableBase = Boolean(targetBase && targetBase === hskBase && targetBase === cexBase
    && hskSymbolQuote === input.hskSwap.quoteCurrency && cexSymbolQuote === input.cex.quoteCurrency);
  const sameQuote = input.hskSwap.quoteCurrency === input.cex.quoteCurrency;
  const rateFor = (currency: VenueQuote["quoteCurrency"]): number | undefined => {
    if (sameQuote || currency === "USD") return 1;
    const rate = input.quoteUsdRates?.[currency];
    if (!rate || !Number.isFinite(rate.usd) || rate.usd <= 0
      || !Number.isFinite(rate.observedAt) || rate.observedAt > now + 1_000
      || now - rate.observedAt > 15_000) return undefined;
    return rate.usd;
  };
  const hskRate = rateFor(input.hskSwap.quoteCurrency);
  const cexRate = rateFor(input.cex.quoteCurrency);
  const comparableQuotes = Number.isFinite(hskRate) && Number.isFinite(cexRate)
    && (hskRate ?? 0) > 0 && (cexRate ?? 0) > 0;
  const validCosts = [input.liquidityUsd, input.priceImpactBps, input.slippageBps].every(
    (value) => Number.isFinite(value) && value >= 0
  );
  const healthy = hskHealth.status === "HEALTHY" && cexHealth.status === "HEALTHY"
    && comparableBase && comparableQuotes && validCosts;
  const hskBid = input.hskSwap.bid * (hskRate ?? 0);
  const hskAsk = input.hskSwap.ask * (hskRate ?? 0);
  const cexBid = input.cex.bid * (cexRate ?? 0);
  const cexAsk = input.cex.ask * (cexRate ?? 0);
  const buyOnHsk = hskAsk < cexBid;
  const grossEdgeBps = healthy ? buyOnHsk
    ? ((cexBid - hskAsk) / hskAsk) * 10_000
    : ((hskBid - cexAsk) / cexAsk) * 10_000 : 0;
  const validEdge = Number.isFinite(grossEdgeBps) && grossEdgeBps > 0;
  const confidence = healthy && validEdge
    ? Math.max(0, Math.min(99, Math.round(55 + grossEdgeBps / 12 - input.priceImpactBps / 8))) : 0;
  const blockedReason = hskHealth.reason ?? cexHealth.reason
    ?? (!comparableBase ? "base asset or quote metadata mismatch" : !comparableQuotes ? "quote currencies need fresh USD conversion rates" : !validCosts ? "invalid liquidity or cost estimate" : "no valid positive spread");
  return {
    id: `spread-${input.symbol}-${Math.floor(now / 1000)}`,
    symbol: input.symbol,
    kind: "spread",
    side: buyOnHsk ? "BUY" : "SELL",
    confidence,
    expectedEdgeBps: validEdge ? Math.round(grossEdgeBps) : 0,
    priceImpactBps: input.priceImpactBps,
    slippageBps: input.slippageBps,
    liquidityUsd: input.liquidityUsd,
    feedAgeSeconds,
    rationale: healthy && validEdge
      ? `Estimate: ${buyOnHsk ? "buy HSKSwap / sell CEX" : "sell HSKSwap / buy CEX"} spread using comparable quotes.`
      : `Blocked candidate: ${blockedReason}.`
  };
}

export async function fetchBinanceQuote(symbol: string, fetcher: typeof fetch = fetch): Promise<VenueQuote> {
  const [base, quote] = parsePair(symbol, ["USDC", "USDT"]);
  const response = await fetcher(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(base + quote)}`);
  if (!response.ok) throw new Error(`Binance returned ${response.status}`);
  const data = await response.json() as { bidPrice: string; askPrice: string };
  const result: VenueQuote = { venue: "BINANCE", symbol: `${base}/${quote}`, bid: Number(data.bidPrice), ask: Number(data.askPrice), observedAt: Date.now(), quoteCurrency: quote as "USDC" | "USDT" };
  if (assessFeedHealth(result).status === "INVALID") throw new Error("Binance returned an invalid quote");
  return result;
}

export async function fetchCoinbaseQuote(symbol: string, fetcher: typeof fetch = fetch): Promise<VenueQuote> {
  const [base, quote] = parsePair(symbol, ["USD", "USDC"]);
  const response = await fetcher(`https://api.exchange.coinbase.com/products/${encodeURIComponent(`${base}-${quote}`)}/ticker`);
  if (!response.ok) throw new Error(`Coinbase returned ${response.status}`);
  const data = await response.json() as { bid: string; ask: string; time: string };
  const result: VenueQuote = { venue: "COINBASE", symbol: `${base}/${quote}`, bid: Number(data.bid), ask: Number(data.ask), observedAt: Date.parse(data.time), quoteCurrency: quote as "USD" | "USDC" };
  if (assessFeedHealth(result).status !== "HEALTHY") throw new Error("Coinbase returned an invalid or stale quote");
  return result;
}

function parsePair(symbol: string, quotes: readonly string[]): [string, string] {
  const parts = symbol.toUpperCase().split("/");
  if (parts.length !== 2 || !/^[A-Z0-9]{2,20}$/.test(parts[0]) || !quotes.includes(parts[1])) {
    throw new Error(`Unsupported market pair: ${symbol}`);
  }
  return [parts[0], parts[1]];
}
