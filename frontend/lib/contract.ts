export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const habitStakingAbi = [
  {
    type: "constructor",
    inputs: [{ name: "_charityAddress", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "charityAddress",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextHabitId",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createHabit",
    inputs: [
      { name: "description", type: "string" },
      { name: "durationDays", type: "uint32" },
      { name: "requiredCheckIns", type: "uint32" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "checkIn",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claim",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "forfeit",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getHabit",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "description", type: "string" },
          { name: "stake", type: "uint256" },
          { name: "startTime", type: "uint64" },
          { name: "durationDays", type: "uint32" },
          { name: "requiredCheckIns", type: "uint32" },
          { name: "checkInsCount", type: "uint32" },
          { name: "lastCheckInDay", type: "uint32" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserHabits",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "canCheckInToday",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isExpired",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "HabitCreated",
    inputs: [
      { name: "habitId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "stake", type: "uint256", indexed: false },
      { name: "durationDays", type: "uint32", indexed: false },
      { name: "requiredCheckIns", type: "uint32", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export type HabitStatus = 0 | 1 | 2; // Active | Completed | Failed

export type Habit = {
  owner: `0x${string}`;
  description: string;
  stake: bigint;
  startTime: bigint;
  durationDays: number;
  requiredCheckIns: number;
  checkInsCount: number;
  lastCheckInDay: number;
  status: HabitStatus;
};
