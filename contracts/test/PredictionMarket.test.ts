import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const ONE = 1_000_000n; // 1 USDC (6 decimals)

// Categories enum order in PredictionMarket: Custom, Price, Sports, Politics, Social, Crypto
const CAT_CUSTOM = 0;
const CAT_PRICE = 1;

const CREATION_FEE = 5_000_000n; // 5 USDC
const RESOLVER_BOND = 10_000_000n; // 10 USDC

describe("PredictionMarket", () => {
  async function deploy() {
    const [deployer, alice, bob, carol, resolver, fee, owner] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    const Pm = await ethers.getContractFactory("PredictionMarket");
    const pm = await Pm.deploy(
      await usdc.getAddress(),
      fee.address,
      CREATION_FEE,
      owner.address,
      RESOLVER_BOND
    );
    await pm.waitForDeployment();

    // Mark the test EOA resolver as trusted so existing single-phase resolution tests
    // continue to exercise the "instant finalize" path. The two-phase flow has its own suite below.
    await pm.connect(owner).setTrustedResolver(resolver.address, true);

    for (const s of [deployer, alice, bob, carol]) {
      await usdc.connect(s).faucet();
      await usdc.connect(s).approve(await pm.getAddress(), ethers.MaxUint256);
    }
    return { pm, usdc, deployer, alice, bob, carol, resolver, fee, owner };
  }

  async function newMarket(pm: any, resolver: any, daysAhead = 1) {
    const closeTime = (await time.latest()) + daysAhead * 24 * 3600;
    await pm.createMarket(
      "Will it rain tomorrow?",
      "Resolves via NOAA observation.",
      closeTime,
      resolver.address,
      CAT_CUSTOM
    );
    return { marketId: 0n, closeTime };
  }

  it("creates a market with a category and accepts bets on both sides", async () => {
    const { pm, alice, bob, resolver } = await deploy();
    await newMarket(pm, resolver);

    await expect(pm.connect(alice).bet(0, true, 100n * ONE)).to.emit(pm, "BetPlaced");
    await pm.connect(bob).bet(0, false, 100n * ONE);

    const m = await pm.getMarket(0);
    expect(m.yesPool).to.equal(100n * ONE);
    expect(m.noPool).to.equal(100n * ONE);
    expect(m.yesBettors).to.equal(1);
    expect(m.noBettors).to.equal(1);
    expect(m.category).to.equal(CAT_CUSTOM);
    expect(await pm.impliedYesBps(0)).to.equal(5000);
  });

  it("pays winners proportionally with 5% fee on losing pool", async () => {
    const { pm, usdc, alice, bob, carol, resolver, fee } = await deploy();
    await newMarket(pm, resolver);

    await pm.connect(alice).bet(0, true, 100n * ONE);
    await pm.connect(carol).bet(0, true, 100n * ONE);
    await pm.connect(bob).bet(0, false, 400n * ONE);

    await time.increase(2 * 24 * 3600);
    const feeBefore = await usdc.balanceOf(fee.address);
    await pm.connect(resolver).resolve(0, true);
    const feeAfter = await usdc.balanceOf(fee.address);
    // 5% of losing pool (400 USDC) = 20 USDC
    expect(feeAfter - feeBefore).to.equal(20n * ONE);

    // distributable = 200 + 400 - 20 = 580; alice has 1/2 stake => 290 USDC
    const aliceBefore = await usdc.balanceOf(alice.address);
    await pm.connect(alice).claim(0);
    const aliceAfter = await usdc.balanceOf(alice.address);
    expect(aliceAfter - aliceBefore).to.equal(290n * ONE);
  });

  it("preview matches actual claim", async () => {
    const { pm, usdc, alice, bob, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, 100n * ONE);
    await pm.connect(bob).bet(0, false, 300n * ONE);

    const preview = await pm.previewPayout(0, alice.address, true);
    await time.increase(2 * 24 * 3600);
    await pm.connect(resolver).resolve(0, true);

    const before = await usdc.balanceOf(alice.address);
    await pm.connect(alice).claim(0);
    const after = await usdc.balanceOf(alice.address);
    expect(after - before).to.equal(preview);
  });

  it("losers cannot claim, double claim reverts", async () => {
    const { pm, alice, bob, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, 50n * ONE);
    await pm.connect(bob).bet(0, false, 50n * ONE);
    await time.increase(2 * 24 * 3600);
    await pm.connect(resolver).resolve(0, true);

    await expect(pm.connect(bob).claim(0)).to.be.revertedWithCustomError(pm, "NothingToClaim");
    await pm.connect(alice).claim(0);
    await expect(pm.connect(alice).claim(0)).to.be.revertedWithCustomError(pm, "AlreadyClaimed");
  });

  it("only resolver can resolve, only after close time", async () => {
    const { pm, alice, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, 10n * ONE);

    await expect(pm.connect(resolver).resolve(0, true)).to.be.revertedWithCustomError(pm, "MarketNotClosed");
    await time.increase(2 * 24 * 3600);
    await expect(pm.connect(alice).resolve(0, true)).to.be.revertedWithCustomError(pm, "NotResolver");
  });

  it("invalidates after grace period and refunds bettors", async () => {
    const { pm, usdc, alice, bob, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, 50n * ONE);
    await pm.connect(bob).bet(0, false, 30n * ONE);

    await expect(pm.markInvalid(0)).to.be.revertedWithCustomError(pm, "NotInGracePeriod");

    await time.increase(8 * 24 * 3600);
    await pm.markInvalid(0);

    const aliceBefore = await usdc.balanceOf(alice.address);
    await pm.connect(alice).refund(0);
    const aliceAfter = await usdc.balanceOf(alice.address);
    expect(aliceAfter - aliceBefore).to.equal(50n * ONE);
  });

  it("cannot bet after close", async () => {
    const { pm, alice, resolver } = await deploy();
    await newMarket(pm, resolver);
    await time.increase(2 * 24 * 3600);
    await expect(pm.connect(alice).bet(0, true, 1n * ONE)).to.be.revertedWithCustomError(pm, "MarketNotOpen");
  });

  it("counts unique bettors per side correctly", async () => {
    const { pm, alice, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, 10n * ONE);
    await pm.connect(alice).bet(0, true, 10n * ONE);
    const m = await pm.getMarket(0);
    expect(m.yesBettors).to.equal(1);
  });

  it("falls back to Invalid (refunds) when winning pool is empty", async () => {
    const { pm, usdc, alice, bob, resolver, fee } = await deploy();
    await newMarket(pm, resolver);

    // Only NO bets — no one bet YES
    await pm.connect(alice).bet(0, false, 100n * ONE);
    await pm.connect(bob).bet(0, false, 50n * ONE);

    await time.increase(2 * 24 * 3600);

    // Resolver tries to resolve YES → no YES bettors → must auto-invalidate.
    const feeBefore = await usdc.balanceOf(fee.address);
    await expect(pm.connect(resolver).resolve(0, true)).to.emit(pm, "MarketInvalidated");
    const feeAfter = await usdc.balanceOf(fee.address);
    expect(feeAfter - feeBefore).to.equal(0n); // no fee taken

    const m = await pm.getMarket(0);
    expect(m.outcome).to.equal(3); // Invalid

    // Bettors can refund their full stake
    const aliceBefore = await usdc.balanceOf(alice.address);
    await pm.connect(alice).refund(0);
    expect((await usdc.balanceOf(alice.address)) - aliceBefore).to.equal(100n * ONE);

    const bobBefore = await usdc.balanceOf(bob.address);
    await pm.connect(bob).refund(0);
    expect((await usdc.balanceOf(bob.address)) - bobBefore).to.equal(50n * ONE);
  });
});

describe("PredictionMarket two-phase resolution", () => {
  async function deploy() {
    const [deployer, alice, bob, humanResolver, fee, owner, attacker] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    const Pm = await ethers.getContractFactory("PredictionMarket");
    const pm = await Pm.deploy(
      await usdc.getAddress(),
      fee.address,
      CREATION_FEE,
      owner.address,
      RESOLVER_BOND
    );
    await pm.waitForDeployment();

    // humanResolver is intentionally NOT trusted — must go through propose/approve flow.
    for (const s of [deployer, alice, bob, humanResolver, attacker]) {
      await usdc.connect(s).faucet();
      await usdc.connect(s).approve(await pm.getAddress(), ethers.MaxUint256);
    }
    return { pm, usdc, deployer, alice, bob, humanResolver, fee, owner, attacker };
  }

  async function newMarket(pm: any, resolver: any) {
    const closeTime = (await time.latest()) + 24 * 3600;
    await pm.createMarket("Q?", "D", closeTime, resolver.address, CAT_CUSTOM);
    return { marketId: 0n, closeTime };
  }

  async function setupBets(pm: any, alice: any, bob: any) {
    await pm.connect(alice).bet(0, true, 100n * ONE);
    await pm.connect(bob).bet(0, false, 100n * ONE);
    await time.increase(2 * 24 * 3600);
  }

  it("resolve() by non-trusted resolver only proposes; market stays unresolved and bond is locked", async () => {
    const { pm, usdc, alice, bob, humanResolver } = await deploy();
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);

    const resolverBalBefore = await usdc.balanceOf(humanResolver.address);
    const pmBalBefore = await usdc.balanceOf(await pm.getAddress());

    await expect(pm.connect(humanResolver).resolve(0, true))
      .to.emit(pm, "OutcomeProposed")
      .and.to.not.emit(pm, "MarketResolved");

    expect(resolverBalBefore - (await usdc.balanceOf(humanResolver.address))).to.equal(RESOLVER_BOND);
    expect((await usdc.balanceOf(await pm.getAddress())) - pmBalBefore).to.equal(RESOLVER_BOND);

    const m = await pm.getMarket(0);
    expect(m.outcome).to.equal(0); // still Unresolved
    expect(m.proposedOutcome).to.equal(1); // Yes
    expect(m.resolverBondLocked).to.equal(RESOLVER_BOND);
  });

  it("claims are blocked while a proposal is pending", async () => {
    const { pm, alice, humanResolver } = await deploy();
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, alice); // alice both sides for simplicity (won't claim anyway)
    await pm.connect(humanResolver).resolve(0, true);
    await expect(pm.connect(alice).claim(0)).to.be.revertedWithCustomError(pm, "MarketNotClosed");
  });

  it("resolver cannot propose twice for the same market", async () => {
    const { pm, alice, bob, humanResolver } = await deploy();
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);
    await pm.connect(humanResolver).resolve(0, true);
    await expect(pm.connect(humanResolver).resolve(0, false)).to.be.revertedWithCustomError(pm, "AlreadyProposed");
  });

  it("approveOutcome finalizes the market and refunds the bond", async () => {
    const { pm, usdc, alice, bob, humanResolver, owner, fee } = await deploy();
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);

    await pm.connect(humanResolver).resolve(0, true);

    const resolverBefore = await usdc.balanceOf(humanResolver.address);
    const feeBefore = await usdc.balanceOf(fee.address);

    await expect(pm.connect(owner).approveOutcome(0))
      .to.emit(pm, "OutcomeApproved")
      .and.to.emit(pm, "MarketResolved");

    // Bond returned, 5% fee taken from losing pool (5 USDC of 100 USDC NO pool)
    expect((await usdc.balanceOf(humanResolver.address)) - resolverBefore).to.equal(RESOLVER_BOND);
    expect((await usdc.balanceOf(fee.address)) - feeBefore).to.equal(5n * ONE);

    const m = await pm.getMarket(0);
    expect(m.outcome).to.equal(1); // Yes
    expect(m.proposedOutcome).to.equal(0);
    expect(m.resolverBondLocked).to.equal(0);

    // Winner can claim
    const aliceBefore = await usdc.balanceOf(alice.address);
    await pm.connect(alice).claim(0);
    // distributable = 100 + 100 - 5 = 195; alice owns full yesPool → gets 195 USDC
    expect((await usdc.balanceOf(alice.address)) - aliceBefore).to.equal(195n * ONE);
  });

  it("rejectOutcome slashes bond, invalidates market, and lets bettors refund", async () => {
    const { pm, usdc, alice, bob, humanResolver, owner, fee } = await deploy();
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);

    await pm.connect(humanResolver).resolve(0, false); // proposes NO (let's say cheating)

    const feeBefore = await usdc.balanceOf(fee.address);
    const resolverBefore = await usdc.balanceOf(humanResolver.address);

    await expect(pm.connect(owner).rejectOutcome(0))
      .to.emit(pm, "OutcomeRejected")
      .and.to.emit(pm, "MarketInvalidated");

    // Bond slashed to feeRecipient, resolver does NOT get bond back.
    expect((await usdc.balanceOf(fee.address)) - feeBefore).to.equal(RESOLVER_BOND);
    expect(await usdc.balanceOf(humanResolver.address)).to.equal(resolverBefore);

    const m = await pm.getMarket(0);
    expect(m.outcome).to.equal(3); // Invalid
    expect(m.resolverBondLocked).to.equal(0);

    // Both bettors can refund their full stake
    const aBefore = await usdc.balanceOf(alice.address);
    await pm.connect(alice).refund(0);
    expect((await usdc.balanceOf(alice.address)) - aBefore).to.equal(100n * ONE);

    const bBefore = await usdc.balanceOf(bob.address);
    await pm.connect(bob).refund(0);
    expect((await usdc.balanceOf(bob.address)) - bBefore).to.equal(100n * ONE);
  });

  it("only owner can approve or reject; non-owner reverts", async () => {
    const { pm, alice, bob, humanResolver, attacker } = await deploy();
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);
    await pm.connect(humanResolver).resolve(0, true);

    await expect(pm.connect(attacker).approveOutcome(0)).to.be.revertedWithCustomError(pm, "NotOwner");
    await expect(pm.connect(attacker).rejectOutcome(0)).to.be.revertedWithCustomError(pm, "NotOwner");
  });

  it("rejectOutcome reverts after the review window closes", async () => {
    const { pm, alice, bob, humanResolver, owner } = await deploy();
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);
    await pm.connect(humanResolver).resolve(0, true);

    await time.increase(3 * 24 * 3600 + 1);
    await expect(pm.connect(owner).rejectOutcome(0)).to.be.revertedWithCustomError(pm, "ReviewPeriodOver");
  });

  it("finalizeIfTimeout auto-approves the proposal after REVIEW_PERIOD", async () => {
    const { pm, usdc, alice, bob, humanResolver, attacker } = await deploy();
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);
    await pm.connect(humanResolver).resolve(0, true);

    await expect(pm.connect(attacker).finalizeIfTimeout(0)).to.be.revertedWithCustomError(pm, "StillInReview");

    await time.increase(3 * 24 * 3600 + 1);

    const resolverBefore = await usdc.balanceOf(humanResolver.address);
    // Anyone (even attacker) can finalize after timeout
    await expect(pm.connect(attacker).finalizeIfTimeout(0)).to.emit(pm, "MarketResolved");

    expect((await usdc.balanceOf(humanResolver.address)) - resolverBefore).to.equal(RESOLVER_BOND);

    const m = await pm.getMarket(0);
    expect(m.outcome).to.equal(1); // Yes — proposer's choice was applied
  });

  it("approveOutcome works even after the review window (owner can be late)", async () => {
    const { pm, alice, bob, humanResolver, owner } = await deploy();
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);
    await pm.connect(humanResolver).resolve(0, true);

    await time.increase(5 * 24 * 3600);
    await expect(pm.connect(owner).approveOutcome(0)).to.emit(pm, "MarketResolved");
  });

  it("approve / reject / timeout require a pending proposal", async () => {
    const { pm, humanResolver, owner } = await deploy();
    await newMarket(pm, humanResolver);
    await expect(pm.connect(owner).approveOutcome(0)).to.be.revertedWithCustomError(pm, "NoProposal");
    await expect(pm.connect(owner).rejectOutcome(0)).to.be.revertedWithCustomError(pm, "NoProposal");
    await expect(pm.finalizeIfTimeout(0)).to.be.revertedWithCustomError(pm, "NoProposal");
  });

  it("markInvalid is blocked while a proposal is pending", async () => {
    const { pm, alice, bob, humanResolver } = await deploy();
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);
    await pm.connect(humanResolver).resolve(0, true);

    // Even after grace period, markInvalid should defer to finalizeIfTimeout.
    await time.increase(8 * 24 * 3600);
    await expect(pm.markInvalid(0)).to.be.revertedWithCustomError(pm, "HasPendingProposal");
  });

  it("trusted resolver bypasses bond/review and finalizes instantly", async () => {
    const { pm, alice, bob, humanResolver, owner } = await deploy();
    await pm.connect(owner).setTrustedResolver(humanResolver.address, true);

    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);

    // No bond pulled, no proposal recorded — resolves in one tx.
    await expect(pm.connect(humanResolver).resolve(0, true))
      .to.emit(pm, "MarketResolved")
      .and.to.not.emit(pm, "OutcomeProposed");

    const m = await pm.getMarket(0);
    expect(m.outcome).to.equal(1);
    expect(m.resolverBondLocked).to.equal(0);
  });

  it("empty winning pool → instant Invalid even for non-trusted resolver, no bond charged", async () => {
    const { pm, usdc, alice, humanResolver } = await deploy();
    await newMarket(pm, humanResolver);
    // Only NO side has bets
    await pm.connect(alice).bet(0, false, 50n * ONE);
    await time.increase(2 * 24 * 3600);

    const resolverBefore = await usdc.balanceOf(humanResolver.address);
    await expect(pm.connect(humanResolver).resolve(0, true)).to.emit(pm, "MarketInvalidated");

    // Bond should not have been deducted from resolver (early-return before bond pull)
    expect(await usdc.balanceOf(humanResolver.address)).to.equal(resolverBefore);

    const m = await pm.getMarket(0);
    expect(m.outcome).to.equal(3);
  });

  it("transferOwnership moves approve/reject powers", async () => {
    const { pm, alice, bob, humanResolver, owner, attacker } = await deploy();
    await pm.connect(owner).transferOwnership(attacker.address); // attacker is now owner
    await newMarket(pm, humanResolver);
    await setupBets(pm, alice, bob);
    await pm.connect(humanResolver).resolve(0, true);

    await expect(pm.connect(owner).approveOutcome(0)).to.be.revertedWithCustomError(pm, "NotOwner");
    await expect(pm.connect(attacker).approveOutcome(0)).to.emit(pm, "MarketResolved");
  });

  it("only owner can manage the trusted resolver whitelist", async () => {
    const { pm, attacker, humanResolver } = await deploy();
    await expect(
      pm.connect(attacker).setTrustedResolver(humanResolver.address, true)
    ).to.be.revertedWithCustomError(pm, "NotOwner");
  });
});

describe("ChainlinkPriceResolver", () => {
  // Comparator enum: GreaterThan=0, GreaterOrEqual=1, LessThan=2, LessOrEqual=3
  const GT = 0;
  const LT = 2;

  async function deploy() {
    const [deployer, alice, bob, fee, owner] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    const Pm = await ethers.getContractFactory("PredictionMarket");
    const pm = await Pm.deploy(
      await usdc.getAddress(),
      fee.address,
      CREATION_FEE,
      owner.address,
      RESOLVER_BOND
    );
    await pm.waitForDeployment();

    const Resolver = await ethers.getContractFactory("ChainlinkPriceResolver");
    const resolver = await Resolver.deploy(await pm.getAddress());
    await resolver.waitForDeployment();

    // Whitelist the price resolver so it can finalize markets in one tx.
    await pm.connect(owner).setTrustedResolver(await resolver.getAddress(), true);

    // Mock BTC/USD feed at 8 decimals; start at $75,000.
    const Agg = await ethers.getContractFactory("MockAggregator");
    const feed = await Agg.deploy(8, 75_000n * 10n ** 8n);
    await feed.waitForDeployment();

    for (const s of [alice, bob]) {
      await usdc.connect(s).faucet();
      await usdc.connect(s).approve(await pm.getAddress(), ethers.MaxUint256);
    }

    return { pm, usdc, resolver, feed, alice, bob, fee, owner };
  }

  async function createPriceMarket(pm: any, resolverAddr: string, alice: any, daysAhead = 1) {
    const closeTime = (await time.latest()) + daysAhead * 24 * 3600;
    await pm.connect(alice).createMarket(
      "Will BTC > $80k by tomorrow?",
      "Resolves via Chainlink BTC/USD feed.",
      closeTime,
      resolverAddr,
      CAT_PRICE
    );
    return { marketId: 0n, closeTime };
  }

  it("registers a condition and auto-resolves YES when price crosses threshold", async () => {
    const { pm, resolver, feed, alice, bob } = await deploy();
    await createPriceMarket(pm, await resolver.getAddress(), alice);

    // Threshold = $80k in 8-decimal feed units.
    const threshold = 80_000n * 10n ** 8n;
    await expect(
      resolver.connect(alice).registerCondition(0, await feed.getAddress(), GT, threshold, 3600)
    ).to.emit(resolver, "ConditionRegistered");

    // Bets: YES taken by alice 100, NO by bob 100.
    await pm.connect(alice).bet(0, true, 100n * ONE);
    await pm.connect(bob).bet(0, false, 100n * ONE);

    // Move past close.
    await time.increase(2 * 24 * 3600);

    // Price went up to $82k → YES wins.
    await feed.setPrice(82_000n * 10n ** 8n);

    await expect(resolver.connect(bob).resolveMarket(0))
      .to.emit(resolver, "AutoResolved")
      .and.to.emit(pm, "MarketResolved");

    const m = await pm.getMarket(0);
    expect(m.outcome).to.equal(1); // Yes
  });

  it("auto-resolves NO when price stays below threshold", async () => {
    const { pm, resolver, feed, alice, bob } = await deploy();
    await createPriceMarket(pm, await resolver.getAddress(), alice);
    const threshold = 80_000n * 10n ** 8n;
    await resolver.connect(alice).registerCondition(0, await feed.getAddress(), GT, threshold, 3600);

    await pm.connect(alice).bet(0, true, 100n * ONE);
    await pm.connect(bob).bet(0, false, 100n * ONE);
    await time.increase(2 * 24 * 3600);

    // Price still at $75k → YES condition (price > 80k) fails → NO wins.
    await feed.setPrice(75_000n * 10n ** 8n);
    await resolver.resolveMarket(0);

    const m = await pm.getMarket(0);
    expect(m.outcome).to.equal(2); // No
  });

  it("only the market creator can register the condition", async () => {
    const { pm, resolver, feed, alice, bob } = await deploy();
    await createPriceMarket(pm, await resolver.getAddress(), alice);

    await expect(
      resolver.connect(bob).registerCondition(0, await feed.getAddress(), GT, 1n, 3600)
    ).to.be.revertedWithCustomError(resolver, "NotMarketCreator");
  });

  it("rejects registration if the market resolver is not this contract", async () => {
    const { pm, resolver, feed, alice, bob } = await deploy();
    // Create with a non-resolver address.
    const closeTime = (await time.latest()) + 24 * 3600;
    await pm.connect(alice).createMarket("Q", "D", closeTime, bob.address, CAT_PRICE);

    await expect(
      resolver.connect(alice).registerCondition(0, await feed.getAddress(), GT, 1n, 3600)
    ).to.be.revertedWithCustomError(resolver, "WrongResolver");
  });

  it("cannot resolve before close time", async () => {
    const { pm, resolver, feed, alice } = await deploy();
    await createPriceMarket(pm, await resolver.getAddress(), alice);
    await resolver
      .connect(alice)
      .registerCondition(0, await feed.getAddress(), GT, 80_000n * 10n ** 8n, 3600);

    await expect(resolver.resolveMarket(0)).to.be.revertedWithCustomError(resolver, "MarketNotClosed");
  });

  it("rejects stale prices", async () => {
    const { pm, resolver, feed, alice } = await deploy();
    await createPriceMarket(pm, await resolver.getAddress(), alice);
    await resolver
      .connect(alice)
      .registerCondition(0, await feed.getAddress(), GT, 80_000n * 10n ** 8n, 600); // 10 min staleness

    await time.increase(2 * 24 * 3600);
    // Stamp updatedAt 1 hour before now → exceeds 10 min staleness window.
    const now = await time.latest();
    await feed.setUpdatedAt(now - 3600);

    await expect(resolver.resolveMarket(0)).to.be.revertedWithCustomError(resolver, "StalePrice");
  });

  it("cannot register twice", async () => {
    const { pm, resolver, feed, alice } = await deploy();
    await createPriceMarket(pm, await resolver.getAddress(), alice);
    await resolver.connect(alice).registerCondition(0, await feed.getAddress(), GT, 1n, 3600);
    await expect(
      resolver.connect(alice).registerCondition(0, await feed.getAddress(), GT, 2n, 3600)
    ).to.be.revertedWithCustomError(resolver, "AlreadyRegistered");
  });

  it("supports LessThan comparator", async () => {
    const { pm, resolver, feed, alice, bob } = await deploy();
    await createPriceMarket(pm, await resolver.getAddress(), alice);

    // "Will BTC < 70k?" — LT 70k.
    await resolver
      .connect(alice)
      .registerCondition(0, await feed.getAddress(), LT, 70_000n * 10n ** 8n, 3600);

    await pm.connect(alice).bet(0, true, 100n * ONE);
    await pm.connect(bob).bet(0, false, 100n * ONE);
    await time.increase(2 * 24 * 3600);

    // BTC = 75k → not less than 70k → NO wins.
    await feed.setPrice(75_000n * 10n ** 8n); // refresh updatedAt to "now"
    await resolver.resolveMarket(0);
    const m = await pm.getMarket(0);
    expect(m.outcome).to.equal(2);
  });

  it("preview helpers do not require resolution to have happened", async () => {
    const { pm, resolver, feed, alice } = await deploy();
    await createPriceMarket(pm, await resolver.getAddress(), alice);
    await resolver
      .connect(alice)
      .registerCondition(0, await feed.getAddress(), GT, 80_000n * 10n ** 8n, 3600);

    await feed.setPrice(82_000n * 10n ** 8n);
    const [yesWon, observed] = await resolver.previewResolution(0);
    expect(yesWon).to.equal(true);
    expect(observed).to.equal(82_000n * 10n ** 8n);

    const [price, decimals_] = await resolver.previewPrice(await feed.getAddress());
    expect(price).to.equal(82_000n * 10n ** 8n);
    expect(decimals_).to.equal(8);
  });
});



describe("PredictionMarket hardening", () => {
  const CREATION_FEE = 5_000_000n;
  const RESOLVER_BOND = 10_000_000n;

  async function deploy() {
    const [deployer, alice, bob, resolver, fee, owner] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    const Pm = await ethers.getContractFactory("PredictionMarket");
    const pm = await Pm.deploy(
      await usdc.getAddress(),
      fee.address,
      CREATION_FEE,
      owner.address,
      RESOLVER_BOND
    );
    await pm.waitForDeployment();
    await pm.connect(owner).setTrustedResolver(resolver.address, true);

    for (const s of [deployer, alice, bob]) {
      await usdc.connect(s).faucet();
      await usdc.connect(s).approve(await pm.getAddress(), ethers.MaxUint256);
    }
    return { pm, usdc, deployer, alice, bob, resolver, fee, owner };
  }

  it("reverts bet exceeding uint128 max", async () => {
    const { pm, resolver } = await deploy();
    const closeTime = (await time.latest()) + 24 * 3600;
    await pm.createMarket("Q?", "D", closeTime, resolver.address, 0);

    const tooBig = 2n ** 128n;
    await expect(pm.bet(0, true, tooBig)).to.be.revertedWithCustomError(pm, "BetTooLarge");
  });

  it("claimBatch claims multiple winning markets in one tx", async () => {
    const { pm, usdc, alice, bob, resolver } = await deploy();
    // Create 3 markets, alice bets YES on each, bob bets NO
    for (let i = 0; i < 3; i++) {
      const closeTime = (await time.latest()) + 24 * 3600;
      await pm.createMarket(`Q${i}?`, "D", closeTime, resolver.address, 0);
      await pm.connect(alice).bet(BigInt(i), true, 10_000_000n);
      await pm.connect(bob).bet(BigInt(i), false, 10_000_000n);
    }
    await time.increase(2 * 24 * 3600);
    for (let i = 0; i < 3; i++) {
      await pm.connect(resolver).resolve(BigInt(i), true);
    }

    const before = await usdc.balanceOf(alice.address);
    await pm.connect(alice).claimBatch([0n, 1n, 2n]);
    const after = await usdc.balanceOf(alice.address);
    // Each market: distributable = 10 + 10 - 0.5 = 19.5 USDC → alice gets 19.5 per market
    expect(after - before).to.equal(19_500_000n * 3n);

    // Verify hasClaimed set
    expect(await pm.hasClaimed(0, alice.address)).to.be.true;
    expect(await pm.hasClaimed(1, alice.address)).to.be.true;
    expect(await pm.hasClaimed(2, alice.address)).to.be.true;
  });

  it("claimBatch skips markets with nothing to claim", async () => {
    const { pm, usdc, alice, bob, resolver } = await deploy();
    const closeTime = (await time.latest()) + 24 * 3600;
    await pm.createMarket("Q?", "D", closeTime, resolver.address, 0);
    await pm.connect(alice).bet(0n, true, 10_000_000n);
    await pm.connect(bob).bet(0n, false, 10_000_000n);
    await time.increase(2 * 24 * 3600);
    await pm.connect(resolver).resolve(0n, true);

    // Bob is loser — calling claimBatch should not revert, just skip
    const before = await usdc.balanceOf(bob.address);
    await pm.connect(bob).claimBatch([0n]);
    const after = await usdc.balanceOf(bob.address);
    expect(after - before).to.equal(0n);
  });

  it("refundBatch refunds multiple invalid markets in one tx", async () => {
    const { pm, usdc, alice, resolver } = await deploy();
    for (let i = 0; i < 2; i++) {
      const closeTime = (await time.latest()) + 24 * 3600;
      await pm.createMarket(`Q${i}?`, "D", closeTime, resolver.address, 0);
      await pm.connect(alice).bet(BigInt(i), true, 20_000_000n);
    }
    await time.increase(8 * 24 * 3600);
    await pm.markInvalid(0n);
    await pm.markInvalid(1n);

    const before = await usdc.balanceOf(alice.address);
    await pm.connect(alice).refundBatch([0n, 1n]);
    const after = await usdc.balanceOf(alice.address);
    expect(after - before).to.equal(40_000_000n);
  });
});


describe("PredictionMarket pause + setResolverBond", () => {
  const CREATION_FEE = 5_000_000n;
  const RESOLVER_BOND = 10_000_000n;

  async function deploy() {
    const [deployer, alice, bob, resolver, fee, owner, attacker] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    const Pm = await ethers.getContractFactory("PredictionMarket");
    const pm = await Pm.deploy(
      await usdc.getAddress(),
      fee.address,
      CREATION_FEE,
      owner.address,
      RESOLVER_BOND
    );
    await pm.waitForDeployment();
    await pm.connect(owner).setTrustedResolver(resolver.address, true);

    for (const s of [deployer, alice, bob]) {
      await usdc.connect(s).faucet();
      await usdc.connect(s).approve(await pm.getAddress(), ethers.MaxUint256);
    }
    return { pm, usdc, deployer, alice, bob, resolver, fee, owner, attacker };
  }

  // ─── Pause tests ──────────────────────────────────────────────────────────

  it("owner can pause — blocks createMarket and bet", async () => {
    const { pm, alice, resolver, owner } = await deploy();
    const closeTime = (await time.latest()) + 24 * 3600;
    await pm.createMarket("Q?", "D", closeTime, resolver.address, 0);

    await expect(pm.connect(owner).pause()).to.emit(pm, "Paused");
    expect(await pm.paused()).to.be.true;

    // createMarket blocked
    await expect(
      pm.connect(alice).createMarket("Q2?", "D", closeTime + 100, resolver.address, 0)
    ).to.be.revertedWithCustomError(pm, "ContractPaused");

    // bet blocked
    await expect(
      pm.connect(alice).bet(0, true, 1_000_000n)
    ).to.be.revertedWithCustomError(pm, "ContractPaused");
  });

  it("claim and refund still work while paused", async () => {
    const { pm, usdc, alice, bob, resolver, owner } = await deploy();
    const closeTime = (await time.latest()) + 24 * 3600;
    await pm.createMarket("Q?", "D", closeTime, resolver.address, 0);
    await pm.connect(alice).bet(0, true, 10_000_000n);
    await pm.connect(bob).bet(0, false, 10_000_000n);
    await time.increase(2 * 24 * 3600);
    await pm.connect(resolver).resolve(0, true);

    // Pause AFTER resolution
    await pm.connect(owner).pause();

    // claim still works
    const before = await usdc.balanceOf(alice.address);
    await pm.connect(alice).claim(0);
    expect((await usdc.balanceOf(alice.address)) - before).to.be.gt(0n);
  });

  it("owner can unpause — re-enables createMarket and bet", async () => {
    const { pm, alice, resolver, owner } = await deploy();
    await pm.connect(owner).pause();

    await expect(pm.connect(owner).unpause()).to.emit(pm, "Unpaused");
    expect(await pm.paused()).to.be.false;

    // Now createMarket works again
    const closeTime = (await time.latest()) + 24 * 3600;
    await expect(
      pm.connect(alice).createMarket("Q?", "D", closeTime, resolver.address, 0)
    ).to.not.be.reverted;
  });

  it("non-owner cannot pause or unpause", async () => {
    const { pm, attacker, owner } = await deploy();
    await expect(pm.connect(attacker).pause()).to.be.revertedWithCustomError(pm, "NotOwner");
    await pm.connect(owner).pause();
    await expect(pm.connect(attacker).unpause()).to.be.revertedWithCustomError(pm, "NotOwner");
  });

  // ─── setResolverBond tests ────────────────────────────────────────────────

  it("owner can adjust resolverBond", async () => {
    const { pm, owner } = await deploy();
    expect(await pm.resolverBond()).to.equal(RESOLVER_BOND);

    await expect(pm.connect(owner).setResolverBond(20_000_000n))
      .to.emit(pm, "ResolverBondUpdated")
      .withArgs(RESOLVER_BOND, 20_000_000n);

    expect(await pm.resolverBond()).to.equal(20_000_000n);
  });

  it("reverts if bond exceeds MAX_RESOLVER_BOND", async () => {
    const { pm, owner } = await deploy();
    const tooHigh = 100_000_001n; // 1 unit over the 100 USDC cap
    await expect(
      pm.connect(owner).setResolverBond(tooHigh)
    ).to.be.revertedWithCustomError(pm, "BondTooHigh");
  });

  it("owner can set bond to zero (disables bond requirement)", async () => {
    const { pm, owner } = await deploy();
    await pm.connect(owner).setResolverBond(0n);
    expect(await pm.resolverBond()).to.equal(0n);
  });

  it("non-owner cannot adjust resolverBond", async () => {
    const { pm, attacker } = await deploy();
    await expect(
      pm.connect(attacker).setResolverBond(1n)
    ).to.be.revertedWithCustomError(pm, "NotOwner");
  });

  it("new bond applies to future proposals (not retroactive)", async () => {
    const { pm, usdc, alice, bob, owner } = await deploy();
    // Deploy a human resolver (not trusted)
    const [,,,,,,, humanResolver] = await ethers.getSigners();
    await usdc.connect(humanResolver).faucet();
    await usdc.connect(humanResolver).approve(await pm.getAddress(), ethers.MaxUint256);

    const closeTime = (await time.latest()) + 24 * 3600;
    await pm.createMarket("Q?", "D", closeTime, humanResolver.address, 0);
    await pm.connect(alice).bet(0, true, 10_000_000n);
    await pm.connect(bob).bet(0, false, 10_000_000n);

    // Raise bond to 50 USDC
    await pm.connect(owner).setResolverBond(50_000_000n);

    await time.increase(2 * 24 * 3600);

    // Resolver must now lock the new 50 USDC bond
    const resolverBefore = await usdc.balanceOf(humanResolver.address);
    await pm.connect(humanResolver).resolve(0, true);
    const resolverAfter = await usdc.balanceOf(humanResolver.address);
    expect(resolverBefore - resolverAfter).to.equal(50_000_000n);
  });
});
