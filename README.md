# MINDSET

> Prediction markets on Farcaster & Base.

Non-custodial parimutuel YES/NO prediction markets on **Base**. Take a side in any market with USDC. When the market resolves, winners split the entire pool — losing stakes top up the prize. The smart contract is the only custodian; there is no admin and no upgrade path.

```
contracts/   Solidity (Hardhat) — PredictionMarket.sol + ChainlinkPriceResolver.sol + MockUSDC.sol  · 18 tests passing
frontend/    Next.js 14 + wagmi v2 + Farcaster Mini App SDK + Tailwind
```

This repository deploys both:
- A **standalone web app** at any URL you host on (Vercel, Netlify, etc.)
- A **Farcaster Mini App** discoverable inside Farcaster clients, from the same codebase.
- A **Base App** registered with domain verification (`base:app_id` meta tag).

---

## Features

- **6 market categories** — Custom, Price, Sports, Politics, Social, Crypto
- **Chainlink auto-resolution** — Price-category markets resolve trustlessly via Chainlink oracles
- **Leaderboard** — Top market creators ranked by volume attracted
- **Share to Farcaster & X/Twitter** — One-click sharing per market
- **Network mismatch warning** — Alerts users on wrong chain with one-click switch
- **Error boundary** — Graceful error handling instead of blank pages
- **Farcaster webhook** — Receives Mini App lifecycle events (installs, removals, notifications)
- **Responsive mobile UX** — Wallet connect + faucet accessible on all screen sizes
- **Paginated markets** — Load-more pagination with loading states
- **Dynamic OG images** — Per-market social cards generated at the edge
- **Base App integration** — Registered with `base:app_id` for Base platform discovery

---

## Why parimutuel?

```
Market: "Will BTC > $200k by Dec 31, 2026?"

  YES pool: 200 USDC (alice 100, carol 100)
  NO  pool: 400 USDC (bob 400)
  ──────────────────────────────────────────
  Resolved: YES

  Fee = 5% of losing pool = 20 USDC → feeRecipient
  Distributable = 200 + 400 − 20 = 580 USDC

  alice payout = 100/200 × 580 = 290 USDC      (100 stake back + 190 winnings)
  carol payout = 100/200 × 580 = 290 USDC
  bob          = 0
```

Everyone on the winning side gets back their stake plus a slice of the losers' stakes — no order books, no AMM, no liquidity bootstrapping required.

---

## Trust model — read first

This is a **non-custodial** application. The dev (you) does **not** hold user funds.

- All bets and payouts pass through the `PredictionMarket` smart contract.
- The contract has **no owner, no admin, no upgrade path, no emergency withdraw**.
- `bettingToken`, `feeRecipient`, and `creationFee` are set in the constructor and **immutable** forever.
- The 5% protocol fee is taken only from the **losing pool**, so winners always receive their full stake back plus a proportional share of the losers' stakes.
- A small **5 USDC creation fee** (anti-spam) is charged when calling `createMarket` and forwarded to `feeRecipient`.
- **Safety net**: if a market's resolver fails to settle within **7 days** of close, anyone can call `markInvalid()` — bettors then call `refund()` to recover their stake. Funds cannot get stuck.

The remaining risk is the usual smart-contract risk. Start on **Base Sepolia testnet** to learn safely before going to mainnet.

---

## Trustless price markets via Chainlink

For markets in the **Price** category, you can use the included `ChainlinkPriceResolver` contract as your resolver. Flow:

1. `createMarket(...)` with `resolver = ChainlinkPriceResolver`, `category = Price`.
2. The creator calls `registerCondition(marketId, feed, comparator, threshold, maxStaleness)` — choose any Chainlink price feed on Base, a comparator (`>`, `>=`, `<`, `<=`), and a USD threshold.
3. After `closeTime`, **anyone** can call `resolveMarket(marketId)` — the resolver reads the Chainlink price and resolves the market accordingly. No human in the loop.

Built-in feed catalog (Base mainnet & Sepolia): BTC/USD, ETH/USD, SOL/USD, LINK/USD. The frontend's create page renders this as a one-form flow under the "Price" tab.

---

## Quick start (local)

```bash
# 1. Contracts
cd contracts
npm install
npm test            # expect 18 passing

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
FEE_RECIPIENT=0x<your wallet address — receives the 5% protocol fee + creation fees>
BETTING_TOKEN=                # leave empty on testnet — script auto-deploys MockUSDC
BASESCAN_API_KEY=             # optional, for verification
```

> Never commit `.env`. It's already in `.gitignore`.

### 3. Deploy

```bash
npm run deploy:base-sepolia
```

The script deploys `MockUSDC` (since `BETTING_TOKEN` is empty), then `PredictionMarket` (with a 5 USDC creationFee), then `ChainlinkPriceResolver`. Output:

```
MockUSDC:                      0xTOKEN...
PredictionMarket deployed to:  0xCONTRACT...
ChainlinkPriceResolver:        0xRESOLVER...
```

It also writes `contracts/deployments.json` for reference.

### 4. (Optional) Verify on BaseScan

```bash
npx hardhat verify --network baseSepolia 0xCONTRACT... 0xTOKEN... 0xFEE_RECIPIENT 5000000
npx hardhat verify --network baseSepolia 0xRESOLVER... 0xCONTRACT...
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
NEXT_PUBLIC_PRICE_RESOLVER_ADDRESS=0xRESOLVER...
NEXT_PUBLIC_TOKEN_SYMBOL=MUSDC          # MockUSDC on testnet, USDC on mainnet
NEXT_PUBLIC_TOKEN_DECIMALS=6
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_WC_PROJECT_ID=              # free at https://cloud.walletconnect.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

Open http://localhost:3000, connect a wallet on Base Sepolia, click **Faucet MUSDC** in the navbar to mint 10,000 test USDC, then create or bet.

---

## Publish as a Farcaster Mini App

Already wired:

- `public/.well-known/farcaster.json` — serves the Mini App manifest (static).
- `app/layout.tsx` — emits `fc:miniapp`, `fc:frame`, and `base:app_id` meta tags.
- `app/api/webhook/route.ts` — receives Farcaster lifecycle events (frame_added, frame_removed, notifications).
- `app/providers.tsx` — calls `sdk.actions.ready()` on mount to dismiss the Farcaster splash screen.
- `lib/wagmi.ts` — registers the `farcasterMiniApp()` connector first; works inside a Farcaster client and silently falls through to MetaMask / Coinbase Wallet / WalletConnect on the open web.

### Steps

1. **Deploy the website** (Vercel, Netlify, etc.) so it has a public HTTPS URL, e.g. `https://mindset.example.com`.
2. Set `NEXT_PUBLIC_APP_URL` in your hosting provider's env vars to that URL and redeploy.
3. Add brand assets to `frontend/public/`:
   - `icon.png` (200×200)
   - `og.png` (1200×800) — used as embed and social card image
   - `splash.png` (200×200) — shown while the mini app loads
4. **Sign your manifest**: open the [Farcaster manifest tool](https://farcaster.xyz/~/developers/mini-apps/manifest), enter your domain, sign with the FID that owns the app, and paste the resulting `accountAssociation` block (`header`, `payload`, `signature`) into `public/.well-known/farcaster.json`. Redeploy.
5. **Test it**: paste your URL into the [Farcaster preview tool](https://farcaster.xyz/~/developers/mini-apps/preview).
6. **Cast it**: post the URL on Farcaster — it now renders as a rich Mini App card with an "Open Mindset" button.

---

## Base App Registration

The app includes `base:app_id` meta tag for Base platform verification:

1. Register your app at [base.dev](https://base.dev).
2. The meta tag `<meta name="base:app_id" content="...">` is already in `app/layout.tsx`.
3. After deploying to your domain, click "Register" in the Base dashboard to verify ownership.
4. Your **Builder Code** (API key starting with `bdev_`) enables onchain analytics and potential rewards attribution.

> **Note**: Base App only indexes **Base Mainnet** — testnet markets won't appear in the Base App until you deploy to mainnet.

---

## Contract surface

### `PredictionMarket.sol`

| Function | Who | Effect |
| --- | --- | --- |
| `createMarket(question, description, closeTime, resolver, category)` | anyone | Register a new YES/NO market. Charges `creationFee` (5 USDC) — requires prior `approve()` |
| `bet(marketId, yes, amount)` | anyone | Take a side. Requires prior `approve()` on the betting token |
| `resolve(marketId, yesWon)` | resolver | After close time, set the outcome; 5% fee from losing pool goes to feeRecipient |
| `claim(marketId)` | winner | Receive proportional payout from the pool |
| `markInvalid(marketId)` | anyone | After close + 7 days unresolved, mark for refunds |
| `refund(marketId)` | bettor | Get original stake back from an invalidated market |
| `previewPayout(marketId, user, yesOutcome) view` | anyone | Preview payout for a hypothetical outcome |
| `impliedYesBps(marketId) view` | anyone | Implied probability of YES (0–10000 bps) |

`Category` enum: `Custom (0)`, `Price (1)`, `Sports (2)`, `Politics (3)`, `Social (4)`, `Crypto (5)`. Stored as a UI hint.

### `ChainlinkPriceResolver.sol`

| Function | Who | Effect |
| --- | --- | --- |
| `registerCondition(marketId, feed, comparator, threshold, maxStaleness)` | market creator | Bind a Chainlink price feed condition to a `Price` market (one-time) |
| `resolveMarket(marketId)` | anyone | After close time, reads the feed and calls `PredictionMarket.resolve` accordingly |

`Comparator` enum: `GT (0)`, `GTE (1)`, `LT (2)`, `LTE (3)`. Staleness window guards against rotted oracle data.

---

## Project layout

```
mindset/
├── contracts/
│   ├── contracts/
│   │   ├── PredictionMarket.sol
│   │   ├── ChainlinkPriceResolver.sol   # trustless auto-resolve for price markets
│   │   ├── MockUSDC.sol                 # testnet faucet token (6 decimals)
│   │   └── MockAggregator.sol           # test-only Chainlink feed mock
│   ├── scripts/deploy.ts
│   ├── test/PredictionMarket.test.ts    # 18 tests (market + Chainlink resolver)
│   └── hardhat.config.ts
└── frontend/
    ├── app/
    │   ├── api/webhook/route.ts                   # Farcaster webhook endpoint
    │   ├── create/page.tsx                        # /create (category tabs + Chainlink flow)
    │   ├── dashboard/page.tsx                     # /dashboard (positions + claim/refund)
    │   ├── leaderboard/page.tsx                   # /leaderboard (top creators by volume)
    │   ├── markets/page.tsx                       # /markets (paginated, filterable, searchable)
    │   ├── markets/[id]/page.tsx                  # /markets/123 (detail + bet + share)
    │   ├── markets/[id]/opengraph-image.tsx       # per-market OG card (edge PNG)
    │   ├── icon.tsx                               # dynamic favicon (edge PNG)
    │   ├── opengraph-image.tsx                    # dynamic OG card (edge PNG)
    │   ├── layout.tsx                             # metadata + providers + error boundary
    │   ├── page.tsx                               # / (Hero + How It Works + live stats)
    │   ├── providers.tsx                          # wagmi + react-query + Farcaster SDK
    │   └── globals.css
    ├── components/
    │   ├── BetPanel.tsx                           # YES/NO bet form with approval flow
    │   ├── ConnectButton.tsx                      # wallet connect/disconnect dropdown
    │   ├── ErrorBoundary.tsx                      # global error catch with reload
    │   ├── FaucetButton.tsx                       # mint testnet MUSDC
    │   ├── Footer.tsx                             # site footer with links
    │   ├── MarketActivity.tsx                     # pool activity (event logs, chunked fetch)
    │   ├── MarketCard.tsx                         # market card with pool bar + badges
    │   ├── Navbar.tsx                             # responsive nav + mobile menu
    │   ├── NetworkWarning.tsx                     # wrong-chain banner with switch button
    │   ├── ParticlesBg.tsx                        # animated hero background
    │   └── Toaster.tsx                            # toast notification system
    ├── lib/
    │   ├── contract.ts            # ABIs, addresses, types, price feed catalog
    │   ├── wagmi.ts               # dual-mode connector setup (Farcaster + web)
    │   ├── hooks.ts               # useAllMarkets, useMarket, useMarketCount
    │   ├── toast.ts               # tiny pub/sub toast bus
    │   └── utils.ts               # token/time formatters
    └── public/
        ├── .well-known/farcaster.json   # Farcaster Mini App manifest
        ├── icon.svg                     # static SVG fallback
        ├── splash.svg                   # Farcaster splash screen
        ├── mindset.jpg                  # OG/embed image
        └── mindset-nobg.jpg             # transparent logo variant
```

---

## Pages & Routes

| Route | Description |
| --- | --- |
| `/` | Hero landing with live stats (total pool, markets, positions) |
| `/markets` | Browse all markets — search, filter by status/category, sort, paginated |
| `/markets/[id]` | Market detail — bet panel, pool activity, claim/refund/resolve, share |
| `/leaderboard` | Top market creators ranked by volume attracted |
| `/dashboard` | Personal positions, balance, pending claims |
| `/create` | Create market form — category tabs, Chainlink oracle config for Price |
| `/api/webhook` | Farcaster Mini App webhook (POST) |

---

## Going to mainnet (later)

When you're confident:

1. **Get a professional audit** of `PredictionMarket.sol`. Real money = real audit.
2. Use **real USDC on Base** by setting `BETTING_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base mainnet USDC).
3. Choose a meaningful `feeRecipient` (multisig or DAO treasury). It is immutable at deploy.
4. Consider adding **owner-exempt creation fee** (skip fee for your own address) in the new contract.
5. Run `npm run deploy:base`.
6. Update `frontend/.env.local`:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` = mainnet address
   - `NEXT_PUBLIC_TOKEN_ADDRESS` = USDC mainnet
   - `NEXT_PUBLIC_PRICE_RESOLVER_ADDRESS` = mainnet resolver
   - `NEXT_PUBLIC_TOKEN_SYMBOL=USDC`
   - `NEXT_PUBLIC_CHAIN_ID=8453`
7. Sign and ship the Farcaster manifest with your real domain.
8. Verify contracts on BaseScan.
9. Consider using a paid RPC (Alchemy/Infura) instead of public endpoints for reliability.
10. Set up a subgraph or indexer (The Graph, Envio, Goldsky) when market count exceeds ~100 for better query performance.

---

## Disclaimer

Educational project. Not audited. Not financial / betting advice. Prediction-market style betting may be regulated in your jurisdiction. Use testnet first.
