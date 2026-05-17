export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const TOKEN_SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "USDC";
export const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS ?? 6);

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

const ZERO = "0x0000000000000000000000000000000000000000";
export const isContractConfigured =
  CONTRACT_ADDRESS.toLowerCase() !== ZERO && TOKEN_ADDRESS.toLowerCase() !== ZERO;

// ───────────────────── Prediction Market ABI ───────────────────────────────

export const predictionMarketAbi = [
  {
    type: "constructor",
    inputs: [
      { name: "_bettingToken", type: "address" },
      { name: "_feeRecipient", type: "address" },
    ],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "bettingToken", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "feeRecipient", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "nextMarketId", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { name: "question", type: "string" },
      { name: "description", type: "string" },
      { name: "closeTime", type: "uint64" },
      { name: "resolver", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "bet",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "yes", type: "bool" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolve",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "yesWon", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "markInvalid", inputs: [{ name: "marketId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "claim", inputs: [{ name: "marketId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "refund", inputs: [{ name: "marketId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  {
    type: "function",
    name: "getMarket",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "resolver", type: "address" },
          { name: "question", type: "string" },
          { name: "description", type: "string" },
          { name: "createdAt", type: "uint64" },
          { name: "closeTime", type: "uint64" },
          { name: "yesPool", type: "uint128" },
          { name: "noPool", type: "uint128" },
          { name: "yesBettors", type: "uint32" },
          { name: "noBettors", type: "uint32" },
          { name: "outcome", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserBets",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "yesBets",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "noBets",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasClaimed",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previewPayout",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user", type: "address" },
      { name: "yesOutcome", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "impliedYesBps",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [{ type: "uint16" }],
    stateMutability: "view",
  },
] as const;

// ───────────────────── ERC20 ABI (minimal, with faucet) ────────────────────

export const erc20Abi = [
  { type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  // Only present on MockUSDC
  { type: "function", name: "faucet", inputs: [], outputs: [], stateMutability: "nonpayable" },
] as const;

export type Outcome = 0 | 1 | 2 | 3; // Unresolved | Yes | No | Invalid

export type Market = {
  creator: `0x${string}`;
  resolver: `0x${string}`;
  question: string;
  description: string;
  createdAt: bigint;
  closeTime: bigint;
  yesPool: bigint;
  noPool: bigint;
  yesBettors: number;
  noBettors: number;
  outcome: Outcome;
};

export const OUTCOME_LABEL = ["open", "resolved", "resolved", "invalid"] as const;

/** Maps a market struct to the visible status used by filters: open / closed / resolved / invalid. */
export function statusFromMarket(m: Market): "open" | "closed" | "resolved" | "invalid" {
  if (m.outcome === 1 || m.outcome === 2) return "resolved";
  if (m.outcome === 3) return "invalid";
  // outcome === 0 (Unresolved) — open if before closeTime, else closed
  return Date.now() / 1000 < Number(m.closeTime) ? "open" : "closed";
}
