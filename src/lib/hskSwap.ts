/**
 * HSKSwap constants are isolated here so the data adapter can be moved server-side
 * without leaking execution or database concerns into the UI.
 */
export const HSKSWAP = {
  mainnet: {
    chainId: 177,
    rpcUrl: "https://mainnet.hsk.xyz",
    subgraphUrl: "https://graphnode.hashkeychain.net/subgraphs/name/hskswap",
    factory: "0x972cA9D1662F5e029cD18327D29026532E84c742",
    swapRouter02: "0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3",
    quoterV2: "0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD",
    wrappedHsk: "0xB210D2120d57b758EE163cFfb43e73728c471Cf1"
  },
  testnet: { chainId: 133, rpcUrl: "https://testnet.hsk.xyz" }
} as const;

export interface PoolSnapshot {
  id: string;
  token0: { id: string; symbol: string; decimals: number };
  token1: { id: string; symbol: string; decimals: number };
  totalValueLockedUSD: number;
  volumeUSD: number;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid HSKSwap pool response");
  return value as Record<string, unknown>;
}

function token(value: unknown): PoolSnapshot["token0"] {
  const raw = record(value);
  const decimals = Number(raw.decimals);
  if (typeof raw.id !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(raw.id)
    || typeof raw.symbol !== "string" || raw.symbol.length === 0 || raw.symbol.length > 40
    || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Invalid HSKSwap token metadata");
  }
  return { id: raw.id, symbol: raw.symbol, decimals };
}

function pool(value: unknown): PoolSnapshot {
  const raw = record(value);
  const totalValueLockedUSD = Number(raw.totalValueLockedUSD);
  const volumeUSD = Number(raw.volumeUSD);
  if (typeof raw.id !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(raw.id)
    || !Number.isFinite(totalValueLockedUSD) || totalValueLockedUSD < 0
    || !Number.isFinite(volumeUSD) || volumeUSD < 0) {
    throw new Error("Invalid HSKSwap pool values");
  }
  return { id: raw.id, token0: token(raw.token0), token1: token(raw.token1), totalValueLockedUSD, volumeUSD };
}

const topPoolsQuery = `query HorizonTopPools {
  pools(first: 30, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id volumeUSD totalValueLockedUSD
    token0 { id symbol decimals }
    token1 { id symbol decimals }
  }
}`;

/** Must be called by a server-side market-data worker in production. */
export async function fetchTopPools(fetcher: typeof fetch = fetch): Promise<PoolSnapshot[]> {
  const response = await fetcher(HSKSWAP.mainnet.subgraphUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: topPoolsQuery })
  });
  if (!response.ok) throw new Error(`HSKSwap subgraph returned ${response.status}`);
  const payload = record(await response.json());
  if (Array.isArray(payload.errors) && payload.errors.length) throw new Error("HSKSwap subgraph reported an error");
  const data = record(payload.data);
  if (!Array.isArray(data.pools)) throw new Error("HSKSwap subgraph omitted pools");
  return data.pools.map(pool);
}
