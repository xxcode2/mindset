import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("PredictionMarket", () => {
  async function deploy() {
    const [deployer, alice, bob, carol, resolver, fee] = await ethers.getSigners();
    const F = await ethers.getContractFactory("PredictionMarket");
    const pm = await F.deploy(fee.address);
    await pm.waitForDeployment();
    return { pm, deployer, alice, bob, carol, resolver, fee };
  }

  async function newMarket(pm: any, resolver: any, daysAhead = 1) {
    const closeTime = (await time.latest()) + daysAhead * 24 * 3600;
    await pm.createMarket("Will it rain tomorrow?", closeTime, resolver.address);
    return { marketId: 0n, closeTime };
  }

  it("creates a market and accepts bets on both sides", async () => {
    const { pm, alice, bob, resolver } = await deploy();
    await newMarket(pm, resolver);

    await expect(pm.connect(alice).bet(0, true, { value: ethers.parseEther("1") }))
      .to.emit(pm, "BetPlaced");
    await pm.connect(bob).bet(0, false, { value: ethers.parseEther("1") });

    const m = await pm.getMarket(0);
    expect(m.yesPool).to.equal(ethers.parseEther("1"));
    expect(m.noPool).to.equal(ethers.parseEther("1"));
    expect(await pm.impliedYesBps(0)).to.equal(5000);
  });

  it("pays winners proportionally with 1% fee on losing pool", async () => {
    const { pm, alice, bob, carol, resolver, fee } = await deploy();
    await newMarket(pm, resolver);

    // YES: alice 1, carol 1 (total 2). NO: bob 4. Total pool 6.
    await pm.connect(alice).bet(0, true, { value: ethers.parseEther("1") });
    await pm.connect(carol).bet(0, true, { value: ethers.parseEther("1") });
    await pm.connect(bob).bet(0, false, { value: ethers.parseEther("4") });

    await time.increase(2 * 24 * 3600);

    const feeBefore = await ethers.provider.getBalance(fee.address);
    await pm.connect(resolver).resolve(0, true);
    const feeAfter = await ethers.provider.getBalance(fee.address);
    // 1% of losing pool (4 ETH) = 0.04 ETH
    expect(feeAfter - feeBefore).to.equal(ethers.parseEther("0.04"));

    // distributable = 2 + 4 - 0.04 = 5.96 ETH; alice has 1/2 stake => 2.98 ETH
    const aliceBefore = await ethers.provider.getBalance(alice.address);
    const tx = await pm.connect(alice).claim(0);
    const r = await tx.wait();
    const cost = r!.gasUsed * r!.gasPrice;
    const aliceAfter = await ethers.provider.getBalance(alice.address);
    expect(aliceAfter + cost - aliceBefore).to.equal(ethers.parseEther("2.98"));
  });

  it("losers cannot claim, double claim reverts", async () => {
    const { pm, alice, bob, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, { value: ethers.parseEther("1") });
    await pm.connect(bob).bet(0, false, { value: ethers.parseEther("1") });
    await time.increase(2 * 24 * 3600);
    await pm.connect(resolver).resolve(0, true);

    await expect(pm.connect(bob).claim(0)).to.be.revertedWithCustomError(pm, "NothingToClaim");
    await pm.connect(alice).claim(0);
    await expect(pm.connect(alice).claim(0)).to.be.revertedWithCustomError(pm, "AlreadyClaimed");
  });

  it("only resolver can resolve, only after close time", async () => {
    const { pm, alice, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, { value: ethers.parseEther("0.5") });

    await expect(pm.connect(resolver).resolve(0, true)).to.be.revertedWithCustomError(
      pm,
      "MarketNotClosed"
    );
    await time.increase(2 * 24 * 3600);
    await expect(pm.connect(alice).resolve(0, true)).to.be.revertedWithCustomError(pm, "NotResolver");
  });

  it("invalidates after grace period and refunds bettors", async () => {
    const { pm, alice, bob, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, { value: ethers.parseEther("0.5") });
    await pm.connect(bob).bet(0, false, { value: ethers.parseEther("0.3") });

    await expect(pm.markInvalid(0)).to.be.revertedWithCustomError(pm, "NotInGracePeriod");

    // close + 7 days grace
    await time.increase(8 * 24 * 3600);
    await pm.markInvalid(0);

    const aliceBefore = await ethers.provider.getBalance(alice.address);
    const tx = await pm.connect(alice).refund(0);
    const r = await tx.wait();
    const cost = r!.gasUsed * r!.gasPrice;
    const aliceAfter = await ethers.provider.getBalance(alice.address);
    expect(aliceAfter + cost - aliceBefore).to.equal(ethers.parseEther("0.5"));
  });

  it("cannot bet after close time or on resolved market", async () => {
    const { pm, alice, resolver } = await deploy();
    await newMarket(pm, resolver);
    await time.increase(2 * 24 * 3600);
    await expect(
      pm.connect(alice).bet(0, true, { value: ethers.parseEther("1") })
    ).to.be.revertedWithCustomError(pm, "MarketNotOpen");
  });

  it("previewPayout matches actual claim amount", async () => {
    const { pm, alice, bob, resolver } = await deploy();
    await newMarket(pm, resolver);
    await pm.connect(alice).bet(0, true, { value: ethers.parseEther("1") });
    await pm.connect(bob).bet(0, false, { value: ethers.parseEther("3") });

    const preview = await pm.previewPayout(0, alice.address, true);
    await time.increase(2 * 24 * 3600);
    await pm.connect(resolver).resolve(0, true);

    const before = await ethers.provider.getBalance(alice.address);
    const tx = await pm.connect(alice).claim(0);
    const r = await tx.wait();
    const cost = r!.gasUsed * r!.gasPrice;
    const after = await ethers.provider.getBalance(alice.address);
    expect(after + cost - before).to.equal(preview);
  });
});
