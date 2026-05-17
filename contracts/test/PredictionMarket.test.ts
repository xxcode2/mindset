import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const ONE = 1_000_000n; // 1 USDC (6 decimals)

describe("PredictionMarket", () => {
  async function deploy() {
    const [deployer, alice, bob, carol, resolver, fee] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    const Pm = await ethers.getContractFactory("PredictionMarket");
    const pm = await Pm.deploy(await usdc.getAddress(), fee.address);
    await pm.waitForDeployment();

    // fund participants
    for (const s of [alice, bob, carol]) {
      await usdc.connect(s).faucet();
      await usdc.connect(s).approve(await pm.getAddress(), ethers.MaxUint256);
    }
    return { pm, usdc, deployer, alice, bob, carol, resolver, fee };
  }

  async function newMarket(pm: any, resolver: any, daysAhead = 1) {
    const closeTime = (await time.latest()) + daysAhead * 24 * 3600;
    await pm.createMarket("Will it rain tomorrow?", "Resolves via NOAA observation.", closeTime, resolver.address);
    return { marketId: 0n, closeTime };
  }

  it("creates a market and accepts bets on both sides", async () => {
    const { pm, alice, bob, resolver } = await deploy();
    await newMarket(pm, resolver);

    await expect(pm.connect(alice).bet(0, true, 100n * ONE)).to.emit(pm, "BetPlaced");
    await pm.connect(bob).bet(0, false, 100n * ONE);

    const m = await pm.getMarket(0);
    expect(m.yesPool).to.equal(100n * ONE);
    expect(m.noPool).to.equal(100n * ONE);
    expect(m.yesBettors).to.equal(1);
    expect(m.noBettors).to.equal(1);
    expect(await pm.impliedYesBps(0)).to.equal(5000);
  });

  it("pays winners proportionally with 1% fee on losing pool", async () => {
    const { pm, usdc, alice, bob, carol, resolver, fee } = await deploy();
    await newMarket(pm, resolver);

    // YES: alice 100, carol 100 (total 200). NO: bob 400. Total 600.
    await pm.connect(alice).bet(0, true, 100n * ONE);
    await pm.connect(carol).bet(0, true, 100n * ONE);
    await pm.connect(bob).bet(0, false, 400n * ONE);

    await time.increase(2 * 24 * 3600);
    const feeBefore = await usdc.balanceOf(fee.address);
    await pm.connect(resolver).resolve(0, true);
    const feeAfter = await usdc.balanceOf(fee.address);

    // 1% of losing pool (400 USDC) = 4 USDC
    expect(feeAfter - feeBefore).to.equal(4n * ONE);

    // distributable = 200 + 400 - 4 = 596; alice has 1/2 stake => 298 USDC
    const aliceBefore = await usdc.balanceOf(alice.address);
    await pm.connect(alice).claim(0);
    const aliceAfter = await usdc.balanceOf(alice.address);
    expect(aliceAfter - aliceBefore).to.equal(298n * ONE);
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

    await expect(pm.connect(resolver).resolve(0, true)).to.be.revertedWithCustomError(
      pm,
      "MarketNotClosed"
    );
    await time.increase(2 * 24 * 3600);
    await expect(pm.connect(alice).resolve(0, true)).to.be.revertedWithCustomError(pm, "NotResolver");
  });

  it("invalidates after grace period and refunds bettors", async () => {
    const { pm, usdc, alice, bob, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, 50n * ONE);
    await pm.connect(bob).bet(0, false, 30n * ONE);

    await expect(pm.markInvalid(0)).to.be.revertedWithCustomError(pm, "NotInGracePeriod");

    await time.increase(8 * 24 * 3600); // close + grace
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
    await expect(pm.connect(alice).bet(0, true, 1n * ONE)).to.be.revertedWithCustomError(
      pm,
      "MarketNotOpen"
    );
  });

  it("counts unique bettors per side correctly", async () => {
    const { pm, alice, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, 10n * ONE);
    await pm.connect(alice).bet(0, true, 10n * ONE); // same side again
    const m = await pm.getMarket(0);
    expect(m.yesBettors).to.equal(1);
  });
});
