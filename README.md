# MINDSET

> Prediction markets on Farcaster.

Non-custodial parimutuel YES/NO prediction markets on **Base**. Take a side in any market with USDC. When the market resolves, winners split the entire pool — losing stakes top up the prize. The smart contract is the only custodian; there is no admin and no upgrade path.

```
contracts/   Solidity (Hardhat) — PredictionMarket.sol + MockUSDC.sol  · 8 tests passing
frontend/    Next.js 14 + wagmi v2 + Farcaster Mini App SDK + Tailwind
```

This repository deploys both:
- A **standalone web app** at any URL you host on (Vercel, Netlify, etc.)
- A **Farcaster Mini App** discoverable inside Farcaster clients, from the same codebase.

---

## Why parimutuel?

```
Market: "Will BTC > $200k by Dec 31, 2026?"

  YES pool: 200 USDC (alice 100, carol 100)
  NO  pool: 400 USDC (bob 400)
  ──────────────────────────────────────────
  Resolved: YES

  Fee = 1% of losing pool = 4 USDC → feeRecipient
  Distributable = 200 + 400 − 4 = 596 USDC

  alice payout = 100/200 × 596 = 298 USDC      (100 stake back + 198 winnings)
  carol payout = 100/200 × 596 = 298 USDC
  bob          = 0
```

Everyone on the winning side gets back their stake plus a slice of the losers' stakes — no order books, no AMM, no liquidity bootstrapping required.

---

## Trust model — read first

This is a **non-custodial** application. The dev (you) does **not** hold user funds.

- All bets and payouts pass through the `PredictionMarket` smart contract.
- The contract has **no owner, no admin, no upgrade path, no emergency withdraw**.
- `bettingToken` and `feeRecipient` are set in the constructor and **immutable** forever.
- The 1% protocol fee is taken only from the **losing pool**, so winners always receive their full stake back plus a proportional share of the losers' stakes.
- **Safety net**: if a market's resolver fails to settle within **7 days** of close, anyone can call `markInvalid()` — bettors then call `refund()` to recover their stake. Funds cannot get stuck.

The remaining risk is the usual smart-contract risk. Start on **Base Sepolia testnet** to learn safely before going to mainnet.

---

## Quick start (local)

```bash
# 1. Contracts
cd contracts
npm install
npm test            # expect 8 passing

# 2. Frontend
cd ../frontend
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_CONTRACT_ADDRESS + NEXT_PUBLIC_TOKEN_ADDRESS after deploying (see below)
npm run dev
# open http://localhost:3000
```

---

## Deploy to Base Sepolia (testnet)

### 1. Get a wallet & testnet ETH

1. Install [MetaMask](https://metamask.io/) or any EVM wallet.
2. Create a **fresh wallet** for deployment. Never use your main wallet for scripts.
3. Switch to **Base Sepolia** (chain ID `84532`).
4. Get free ETH from a faucet:
   - https://www.alchemy.com/faucets/base-sepolia
   - https://faucet.quicknode.com/base/sepolia

### 2. Configure

```bash
cd contracts
cp .env.example .env
```

Edit `.env`:

```
PRIVATE_KEY=0x<exported private key from your fresh test wallet>
FEE_RECIPIENT=0x<your wallet address — receives the 1% protocol fee>
BETTING_TOKEN=                # leave empty on testnet — script auto-deploys MockUSDC
BASESCAN_API_KEY=             # optional, for verification
```

> Never commit `.env`. It's already in `.gitignore`.

### 3. Deploy

```bash
npm run deploy:base-sepolia
```

The script deploys `MockUSDC` (since `BETTING_TOKEN` is empty), then `PredictionMarket`. Output:

```
MockUSDC:                 0xTOKEN...
PredictionMarket deployed to: 0xCONTRACT...
```

It also writes `contracts/deployments.json` for reference.

### 4. (Optional) Verify on BaseScan

```bash
npx hardhat verify --network baseSepolia 0xCONTRACT... 0xTOKEN... 0xFEE_RECIPIENT
```

### 5. Wire up the frontend

```bash
cd ../frontend
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0xCONTRACT...
NEXT_PUBLIC_TOKEN_ADDRESS=0xTOKEN...
NEXT_PUBLIC_TOKEN_SYMBOL=MUSDC          # MockUSDC on testnet, USDC on mainnet
NEXT_PUBLIC_TOKEN_DECIMALS=6
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_WC_PROJECT_ID=              # free at https://cloud.walletconnect.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

Open http://localhost:3000, connect a wallet on Base Sepolia, click **Faucet** in any market's bet panel to mint 10,000 test USDC, then create or bet.

---

## Publish as a Farcaster Mini App

Already wired:

- `app/.well-known/farcaster.json/route.ts` — serves the Mini App manifest.
- `app/layout.tsx` — emits `fc:miniapp` and legacy `fc:frame` meta tags so the page is shareable as a rich card in Farcaster.
- `app/providers.tsx` — calls `sdk.actions.ready()` on mount to dismiss the Farcaster splash screen.
- `lib/wagmi.ts` — registers the `farcasterMiniApp()` connector first; works inside a Farcaster client and silently falls through to MetaMask / Coinbase Wallet / WalletConnect on the open web.

### Steps

1. **Deploy the website** (Vercel, Netlify, etc.) so it has a public HTTPS URL, e.g. `https://mindset.example.com`.
2. Set `NEXT_PUBLIC_APP_URL` in your hosting provider's env vars to that URL and redeploy.
3. Add brand assets to `frontend/public/`:
   - `icon.png` (200×200)
   - `og.png` (1200×800) — used as embed and social card image
   - `splash.png` (200×200) — shown while the mini app loads
4. **Sign your manifest**: open the [Farcaster manifest tool](https://farcaster.xyz/~/developers/mini-apps/manifest), enter your domain, sign with the FID that owns the app, and paste the resulting `accountAssociation` block (`header`, `payload`, `signature`) into `app/.well-known/farcaster.json/route.ts`. Redeploy.
5. **Test it**: paste your URL into the [Farcaster preview tool](https://farcaster.xyz/~/developers/mini-apps/preview).
6. **Cast it**: post the URL on Farcaster — it now renders as a rich Mini App card with an "Open Mindset" button.

---

## Contract surface

| Function                                                | Who           | Effect |
| ------------------------------------------------------- | ------------- | ------ |
| `createMarket(string question, string description, uint64 closeTime, address resolver)` | anyone | Register a new YES/NO market |
| `bet(uint256 marketId, bool yes, uint256 amount)`       | anyone        | Take a side. Requires prior `approve()` on the betting token |
| `resolve(uint256 marketId, bool yesWon)`                | resolver      | After close time, set the outcome; 1% fee from losing pool goes to feeRecipient |
| `claim(uint256 marketId)`                               | winner        | Receive proportional payout from the pool |
| `markInvalid(uint256 marketId)`                         | anyone        | After close + 7 days unresolved, mark for refunds |
| `refund(uint256 marketId)`                              | bettor        | Get original stake back from an invalidated market |
| `previewPayout(marketId, user, yesOutcome) view`        | anyone        | Preview payout for a hypothetical outcome |
| `impliedYesBps(marketId) view`                          | anyone        | Implied probability of YES (0–10000 bps) |

---

## Project layout

```
mindset/
├── contracts/
│   ├── contracts/
│   │   ├── PredictionMarket.sol
│   │   └── MockUSDC.sol           # testnet faucet token (6 decimals)
│   ├── scripts/deploy.ts
│   ├── test/PredictionMarket.test.ts
│   └── hardhat.config.ts
└── frontend/
    ├── app/
    │   ├── .well-known/farcaster.json/route.ts   # Farcaster manifest
    │   ├── layout.tsx                             # fc:miniapp meta + fonts + providers
    │   ├── page.tsx                               # /  (Hero)
    │   ├── markets/page.tsx                       # /markets
    │   ├── markets/[id]/page.tsx                  # /markets/123
    │   ├── dashboard/page.tsx                     # /dashboard
    │   ├── create/page.tsx                        # /create
    │   ├── providers.tsx
    │   └── globals.css
    ├── components/
    │   ├── Navbar.tsx
    │   ├── Footer.tsx
    │   ├── ConnectButton.tsx
    │   ├── ParticlesBg.tsx
    │   ├── Toaster.tsx
    │   ├── MarketCard.tsx
    │   ├── BetPanel.tsx
    │   └── MarketActivity.tsx
    └── lib/
        ├── contract.ts            # ABIs, addresses, types, status helpers
        ├── wagmi.ts               # dual-mode connector setup (Farcaster + web)
        ├── hooks.ts               # useAllMarkets, useMarket
        ├── toast.ts               # tiny pub/sub toast bus
        └── utils.ts               # token/time formatters
```

---

## Going to mainnet (later)

When you're confident:

1. **Get a professional audit** of `PredictionMarket.sol`. Real money = real audit.
2. Use **real USDC on Base** by setting `BETTING_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base mainnet USDC).
3. Choose a meaningful `feeRecipient` (multisig or DAO treasury). It is immutable at deploy.
4. Run `npm run deploy:base`.
5. Update `frontend/.env.local`:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` = mainnet address
   - `NEXT_PUBLIC_TOKEN_ADDRESS` = USDC mainnet
   - `NEXT_PUBLIC_TOKEN_SYMBOL=USDC`
   - `NEXT_PUBLIC_CHAIN_ID=8453`
6. Sign and ship the Farcaster manifest with your real domain.

---

## Disclaimer

Educational project. Not audited. Not financial / betting advice. Prediction-market style betting may be regulated in your jurisdiction. Use testnet first.
