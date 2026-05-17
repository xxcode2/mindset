# Mindset

> Bet on what you believe.

**Non-custodial parimutuel prediction markets on Base — runs as a Farcaster Mini App and a standalone website from the same codebase.**

```
contracts/   Solidity (Hardhat) — PredictionMarket.sol, 7/7 tests passing
frontend/    Next.js 14 + wagmi v2 + Farcaster Mini App SDK + Tailwind
```

---

## Trust model — read this first

This is a **non-custodial** application. The dev (you) does **not** hold user funds.

- Funds are locked inside the `PredictionMarket` smart contract.
- The contract has **no owner, no admin, no upgrade path, no emergency withdraw**.
- `feeRecipient` is set in the constructor and **immutable** forever.
- The 1% protocol fee comes only from the **losing pool** — winners always get their full stake back plus a proportional share.
- **Safety net**: if a market's resolver does not resolve within 7 days after close time, **anyone** can call `markInvalid()`, and bettors then call `refund()` to get their stake back.

The remaining risk is the usual smart contract risk. We start on **Base Sepolia testnet** to learn safely.

---

## How parimutuel works

```
Market: "Will BTC > $200k by Dec 31, 2026?"

  YES pool: 2 ETH (alice 1, carol 1)
  NO  pool: 4 ETH (bob 4)
  ──────────────────────────────────
  Resolved: YES

  Fee = 1% of losing pool = 0.04 ETH → feeRecipient
  Distributable = 2 + 4 − 0.04 = 5.96 ETH

  alice payout = 1/2 × 5.96 = 2.98 ETH    (1 ETH back + 1.98 winnings)
  carol payout = 1/2 × 5.96 = 2.98 ETH
  bob          = 0
```

Everyone on the winning side gets back their stake plus a slice of the losers' stakes — no order books, no AMM, no liquidity bootstrapping required.

---

## Quick start (local)

```bash
# 1. Contracts
cd contracts
npm install
npm test            # expect 7 passing

# 2. Frontend
cd ../frontend
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_CONTRACT_ADDRESS after deploying (see below)
npm run dev
# open http://localhost:3000
```

---

## Deploy to Base Sepolia (testnet)

### 1. Get a wallet & testnet ETH

1. Install [MetaMask](https://metamask.io/) (or any EVM wallet).
2. Create a **fresh wallet** for deployment — never use your main wallet.
3. Switch to Base Sepolia (chain ID **84532**).
4. Get free ETH from a faucet:
   - <https://www.alchemy.com/faucets/base-sepolia>
   - <https://faucet.quicknode.com/base/sepolia>

### 2. Configure

```bash
cd contracts
cp .env.example .env
```

Edit `.env`:

```
PRIVATE_KEY=0x<exported private key from your fresh test wallet>
FEE_RECIPIENT=0x<your wallet address — receives the 1% protocol fee>
BASESCAN_API_KEY=                # optional, for verification
```

> Never commit `.env`. It's already in `.gitignore`.

### 3. Deploy

```bash
npm run deploy:base-sepolia
```

You'll see:

```
PredictionMarket deployed to: 0xABC123...
```

### 4. Verify on BaseScan (optional but recommended)

```bash
npx hardhat verify --network baseSepolia 0xABC123... 0xFeeRecipient
```

### 5. Wire up the frontend

```bash
cd ../frontend
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0xABC123...     # from step 3
NEXT_PUBLIC_WC_PROJECT_ID=                   # free at https://cloud.walletconnect.com
NEXT_PUBLIC_APP_URL=http://localhost:3000    # set to your real URL once deployed
```

```bash
npm run dev
```

Open <http://localhost:3000>, connect a wallet on Base Sepolia, create a market with closeTime in 1 hour, and bet from a second wallet.

---

## Publish as a Farcaster Mini App

Mindset is built as a standard web app **plus** Farcaster Mini App metadata, so once you deploy the website you also get a Mini App for free.

### What's already wired

- `app/.well-known/farcaster.json/route.ts` — serves the Farcaster manifest.
- `app/layout.tsx` — emits both `fc:miniapp` and legacy `fc:frame` meta tags so the page is shareable as a rich card in Farcaster.
- `app/providers.tsx` — calls `sdk.actions.ready()` on mount to dismiss the Farcaster splash screen.
- `lib/wagmi.ts` — registers `farcasterMiniApp()` connector first; works out of the box inside a Farcaster client and silently falls through to MetaMask / Coinbase Wallet / WalletConnect on the open web.

### Steps to publish

1. **Deploy the website** (Vercel, Netlify, etc.) so it has a public HTTPS URL, e.g. `https://mindset.example.com`.
2. Update `NEXT_PUBLIC_APP_URL` in your hosting provider's env vars to that URL and redeploy.
3. Add brand assets to `frontend/public/`:
   - `icon.png` (200×200)
   - `og.png` (1200×800) — used as embed and social card image
   - `splash.png` (200×200) — shown while the mini app loads
4. **Sign your manifest**: open the [Farcaster manifest tool](https://farcaster.xyz/~/developers/mini-apps/manifest), enter your domain, sign with the FID that owns the app, and paste the resulting `accountAssociation` block (`header`, `payload`, `signature`) into `app/.well-known/farcaster.json/route.ts`. Redeploy.
5. **Test it**: paste your URL into the [Farcaster preview tool](https://farcaster.xyz/~/developers/mini-apps/preview) — you should see your splash, then your app.
6. **Cast it**: post the URL on Farcaster — it now renders as a rich Mini App card with an "Open Mindset" button.

---

## Contract surface

| Function                                                | Who           | Effect                                                |
| ------------------------------------------------------- | ------------- | ----------------------------------------------------- |
| `createMarket(string question, uint64 closeTime, address resolver)` | anyone | Register a new YES/NO market                       |
| `bet(uint256 marketId, bool yes) payable`               | anyone        | Take a side with ETH                                  |
| `resolve(uint256 marketId, bool yesWon)`                | resolver      | After close time, set the outcome; 1% fee goes to feeRecipient |
| `claim(uint256 marketId)`                               | winner        | Receive proportional payout from the pool             |
| `markInvalid(uint256 marketId)`                         | anyone        | After close + 7 days unresolved, mark for refunds     |
| `refund(uint256 marketId)`                              | bettor        | Get original stake back from an invalidated market    |
| `previewPayout(marketId, user, yesOutcome) view`        | anyone        | UI helper — previews payout for a hypothetical outcome|
| `impliedYesBps(marketId) view`                          | anyone        | UI helper — current implied probability of YES (0–10000) |

---

## Project layout

```
mindset/
├── contracts/
│   ├── contracts/PredictionMarket.sol
│   ├── scripts/deploy.ts
│   ├── test/PredictionMarket.test.ts
│   ├── hardhat.config.ts
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── .well-known/farcaster.json/route.ts   # Farcaster manifest
    │   ├── layout.tsx                             # fc:miniapp meta tags + global metadata
    │   ├── page.tsx
    │   ├── providers.tsx                          # wagmi + react-query + sdk.actions.ready()
    │   └── globals.css
    ├── components/
    │   ├── Hero.tsx
    │   ├── ConnectBar.tsx                         # works in Farcaster + web
    │   ├── HowItWorks.tsx
    │   ├── CreateMarket.tsx
    │   ├── MarketList.tsx
    │   └── MarketCard.tsx                         # bet, resolve, claim, refund UI
    ├── lib/
    │   ├── contract.ts                            # ABI + types
    │   ├── wagmi.ts                               # dual-mode connector setup
    │   └── utils.ts
    └── .env.example
```

---

## Going to mainnet (later)

When you're confident:

1. **Get a professional audit** of `PredictionMarket.sol`. Real money = real audit.
2. Choose a meaningful `feeRecipient` (a multisig or your DAO treasury). It is immutable at deploy.
3. Deploy with `npm run deploy:base`.
4. Update `NEXT_PUBLIC_CONTRACT_ADDRESS` to the mainnet address. Reorder chains in `lib/wagmi.ts` to put `base` first.
5. Sign and ship the Farcaster manifest with your real domain.

---

## Disclaimer

Educational project. Not audited. Not financial / betting advice. Prediction-market style betting may be regulated in your jurisdiction. Use testnet first.
