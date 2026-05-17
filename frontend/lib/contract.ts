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

export const PRICE_RESOLVER_ADDRESS = (process.env.NEXT_PUBLIC_PRICE_RESOLVER_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

// Category enum: Custom=0, Price=1, Sports=2, Politics=3, Social=4, Crypto=5
export const CATEGORIES = ["Custom", "Price", "Sports", "Politics", "Social", "Crypto"] as const;
export type CategoryIndex = 0 | 1 | 2 | 3 | 4 | 5;

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
      { name: "category", type: "uint8" },
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
          { name: "category", type: "uint8" },
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
  category: CategoryIndex;
};

export const OUTCOME_LABEL = ["open", "resolved", "resolved", "invalid"] as const;

/** Maps a market struct to the visible status used by filters: open / closed / resolved / invalid. */
export function statusFromMarket(m: Market): "open" | "closed" | "resolved" | "invalid" {
  if (m.outcome === 1 || m.outcome === 2) return "resolved";
  if (m.outcome === 3) return "invalid";
  // outcome === 0 (Unresolved) — open if before closeTime, else closed
  return Date.now() / 1000 < Number(m.closeTime) ? "open" : "closed";
}

// ───────────────────── ChainlinkPriceResolver ABI ──────────────────────────

export const priceResolverAbi = [
  {
    type: "function",
    name: "registerCondition",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "feed", type: "address" },
      { name: "comparator", type: "uint8" },
      { name: "threshold", type: "int256" },
      { name: "maxStaleness", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveMarket",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "previewResolution",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "yesWon", type: "bool" },
      { name: "priceObserved", type: "int256" },
      { name: "updatedAt", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previewPrice",
    inputs: [{ name: "feed", type: "address" }],
    outputs: [
      { name: "price", type: "int256" },
      { name: "decimals_", type: "uint8" },
      { name: "updatedAt", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "conditions",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "feed", type: "address" },
      { name: "comparator", type: "uint8" },
      { name: "threshold", type: "int256" },
      { name: "maxStaleness", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

// Comparator enum: GreaterThan=0, GreaterOrEqual=1, LessThan=2, LessOrEqual=3
export const COMPARATORS = ["Greater than", "Greater or equal", "Less than", "Less or equal"] as const;
export type ComparatorIndex = 0 | 1 | 2 | 3;

// ───────────────────── Chainlink Price Feed Catalog ────────────────────────
// These are the known feeds deployed by Chainlink. The frontend uses these
// to auto-fill the "feed" field when a user creates a Price-category market.

export type FeedInfo = {
  name: string;
  symbol: string;
  decimals: number;
  base: { mainnet: `0x${string}`; sepolia: `0x${string}` | null };
};

export const PRICE_FEEDS: FeedInfo[] = [
  {
    name: "BTC / USD",
    symbol: "BTC",
    decimals: 8,
    base: {
      mainnet: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
      sepolia: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
    },
  },
  {
    name: "ETH / USD",
    symbol: "ETH",
    decimals: 8,
    base: {
      mainnet: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
      sepolia: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    },
  },
  {
    name: "SOL / USD",
    symbol: "SOL",
    decimals: 8,
    base: {
      mainnet: "0xDa5Fd22F9382e57534fEdA4fF544878aa1cf401f",
      sepolia: null, // not available on Base Sepolia — use ETH or BTC for testnet
    },
  },
  {
    name: "LINK / USD",
    symbol: "LINK",
    decimals: 8,
    base: {
      mainnet: "0x17CAb8FE31E32f08326e5E27412894e49B0f9D65",
      sepolia: "0xb113F5A928BCfF189C998ab20d753a47F9dE5A61",
    },
  },
];

/** Get the feed address for the current chain. Returns null if not available. */
export function getFeedAddress(feed: FeedInfo): `0x${string}` | null {
  return CHAIN_ID === 8453 ? feed.base.mainnet : feed.base.sepolia;
}
