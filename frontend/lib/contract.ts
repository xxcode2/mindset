export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

export const predictionMarketAbi = [
  {
    type: "constructor",
    inputs: [{ name: "_feeRecipient", type: "address" }],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "feeRecipient", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "nextMarketId", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "FEE_BPS", inputs: [], outputs: [{ type: "uint16" }], stateMutability: "view" },
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { name: "question", type: "string" },
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
    ],
    outputs: [],
    stateMutability: "payable",
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
          { name: "createdAt", type: "uint64" },
          { name: "closeTime", type: "uint64" },
          { name: "yesPool", type: "uint128" },
          { name: "noPool", type: "uint128" },
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

export type Outcome = 0 | 1 | 2 | 3; // Unresolved | Yes | No | Invalid

export type Market = {
  creator: `0x${string}`;
  resolver: `0x${string}`;
  question: string;
  createdAt: bigint;
  closeTime: bigint;
  yesPool: bigint;
  noPool: bigint;
  outcome: Outcome;
};

export const OUTCOME_LABEL = ["Open", "YES won", "NO won", "Invalid"] as const;
