import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const ONE = 1_000_000n; // 1 USDC (6 decimals)

// Categories enum order in PredictionMarket: Custom, Price, Sports, Politics, Social, Crypto
const CAT_CUSTOM = 0;
const CAT_PRICE = 1;

describe("PredictionMarket", () => {
  async function deploy() {
    const [deployer, alice, bob, carol, resolver, fee] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    const Pm = await ethers.getContractFactory("PredictionMarket");
    const pm = await Pm.deploy(await usdc.getAddress(), fee.address, 5_000_000n); // 5 USDC creation fee
    await pm.waitForDeployment();

    for (const s of [deployer, alice, bob, carol]) {
      await usdc.connect(s).faucet();
      await usdc.connect(s).approve(await pm.getAddress(), ethers.MaxUint256);
    }
    return { pm, usdc, deployer, alice, bob, carol, resolver, fee };
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

  it("pays winners proportionally with 1% fee on losing pool", async () => {
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
});

describe("ChainlinkPriceResolver", () => {
  // Comparator enum: GreaterThan=0, GreaterOrEqual=1, LessThan=2, LessOrEqual=3
  const GT = 0;
  const LT = 2;

  async function deploy() {
    const [deployer, alice, bob, fee] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    const Pm = await ethers.getContractFactory("PredictionMarket");
    const pm = await Pm.deploy(await usdc.getAddress(), fee.address, 5_000_000n); // 5 USDC creation fee
    await pm.waitForDeployment();

    const Resolver = await ethers.getContractFactory("ChainlinkPriceResolver");
    const resolver = await Resolver.deploy(await pm.getAddress());
    await resolver.waitForDeployment();

    // Mock BTC/USD feed at 8 decimals; start at $75,000.
    const Agg = await ethers.getContractFactory("MockAggregator");
    const feed = await Agg.deploy(8, 75_000n * 10n ** 8n);
    await feed.waitForDeployment();

    for (const s of [alice, bob]) {
      await usdc.connect(s).faucet();
      await usdc.connect(s).approve(await pm.getAddress(), ethers.MaxUint256);
    }

    return { pm, usdc, resolver, feed, alice, bob, fee };
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
