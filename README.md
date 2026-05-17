# Mindset

> Put your money where your mindset is.

A non-custodial habit commitment dApp on **Base**. Stake ETH on a habit, check in daily, hit your target — get every wei back. Miss the deadline — your stake is forwarded to a charity address fixed at deploy time.

```
contracts/   Solidity (Hardhat) — HabitStaking.sol
frontend/    Next.js 14 + wagmi v2 + RainbowKit + Tailwind
```

---

## Trust model — read this first

This is a **non-custodial** application. The dev (you) does **not** hold user funds.

- Funds are locked inside the `HabitStaking` smart contract.
- The contract has **no owner, no admin, no upgrade path, no emergency withdraw**.
- The charity address is set in the constructor and **immutable** forever.
- Source is open. Anyone can audit it before staking.

The risks that remain are the usual smart contract risks: bugs in the code itself. That's why we **start on Base Sepolia testnet** — fake ETH, zero financial risk, full learning.

---

## Quick start — local

### 1. Install

```bash
# contracts
cd contracts
npm install

# frontend (separate terminal)
cd frontend
npm install
```

### 2. Run contract tests

```bash
cd contracts
npm test
```

Expect 4 passing tests.

### 3. Deploy locally (optional)

```bash
cd contracts
npx hardhat node              # terminal A — local chain
# in terminal B
cp .env.example .env
# edit .env: set CHARITY_ADDRESS to any test address (e.g. account #1 from `npx hardhat node`)
# set PRIVATE_KEY to account #0's private key
npm run deploy:local
```

Copy the deployed address into `frontend/.env.local`:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_WC_PROJECT_ID=        # leave empty for local
```

Run frontend:

```bash
cd frontend
npm run dev
# open http://localhost:3000
```

---

## Deploy to Base Sepolia (testnet)

### 1. Get a wallet & testnet ETH

1. Install [MetaMask](https://metamask.io/).
2. Create a **fresh wallet** — never use your main wallet for deployment scripts.
3. Switch to Base Sepolia (chain ID **84532**). MetaMask will offer to add it the first time you connect.
4. Get free ETH from a faucet:
   - <https://www.alchemy.com/faucets/base-sepolia>
   - <https://faucet.quicknode.com/base/sepolia>

### 2. Configure the deployer

```bash
cd contracts
cp .env.example .env
```

Edit `.env`:

```
PRIVATE_KEY=0x<exported private key from your fresh test wallet>
CHARITY_ADDRESS=0x<any address you do NOT control — for testnet this can be any address>
BASESCAN_API_KEY=                # optional, only for verification
```

> Never commit `.env`. It's already in `.gitignore`.

### 3. Deploy

```bash
npm run deploy:base-sepolia
```

You'll see:

```
HabitStaking deployed to: 0xABC123...
```

### 4. (Optional) Verify on BaseScan

```bash
npx hardhat verify --network baseSepolia 0xABC123... 0xCharityAddress
```

### 5. Wire up the frontend

```bash
cd ../frontend
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0xABC123...     # from step 3
NEXT_PUBLIC_WC_PROJECT_ID=                   # get free at https://cloud.walletconnect.com
```

```bash
npm run dev
```

Open <http://localhost:3000>, connect MetaMask on Base Sepolia, create a habit with 0.001 ETH, and try check-in.

---

## How it works

### User journey

1. User connects wallet.
2. Calls `createHabit(description, durationDays, requiredCheckIns)` with ETH attached.
3. Each day during the active window, user calls `checkIn(habitId)` — one per UTC day max.
4. Once `checkInsCount >= requiredCheckIns`, user calls `claim(habitId)` and gets the full stake back.
5. If the deadline passes without hitting the target, **anyone** can call `forfeit(habitId)` — the stake is sent to the immutable charity address.

### Contract surface

| Function                                          | Who         | Effect                              |
| ------------------------------------------------- | ----------- | ----------------------------------- |
| `createHabit(string, uint32, uint32) payable`     | anyone      | Stake ETH, register a new habit     |
| `checkIn(uint256)`                                | habit owner | Mark today as checked-in            |
| `claim(uint256)`                                  | habit owner | If target met, receive full stake   |
| `forfeit(uint256)`                                | anyone      | After deadline + target unmet, send stake to charity |
| `getHabit(uint256) view`                          | anyone      | Read habit struct                   |
| `getUserHabits(address) view`                     | anyone      | List habit IDs for an address       |
| `canCheckInToday(uint256) view`                   | anyone      | Helper for UI                       |

---

## Going to mainnet (later)

When you're confident:

1. **Get a professional audit** of `HabitStaking.sol`. Real money = real audit.
2. Choose the actual charity: a known multisig or DAO treasury. Note: it's immutable at deploy.
3. Deploy with `npm run deploy:base-sepolia` swapped to a `base` network run, and ETH on Base mainnet.
4. Update `frontend/.env.local` with the new address and the `base` chain selected first in `wagmi.ts`.

---

## Project layout

```
mindset/
├── contracts/
│   ├── contracts/HabitStaking.sol       # the only contract
│   ├── scripts/deploy.ts                # deploy script
│   ├── test/HabitStaking.test.ts        # unit tests
│   ├── hardhat.config.ts
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── providers.tsx                # wagmi + RainbowKit + react-query
    │   └── globals.css
    ├── components/
    │   ├── Hero.tsx
    │   ├── HowItWorks.tsx
    │   ├── CreateHabit.tsx
    │   ├── HabitList.tsx
    │   └── HabitCard.tsx
    ├── lib/
    │   ├── contract.ts                  # ABI + address
    │   └── wagmi.ts                     # chain config
    └── .env.example
```

---

## Disclaimer

Educational project. Not audited. Not financial advice. Do not stake funds you cannot afford to lose. Use testnet first.
