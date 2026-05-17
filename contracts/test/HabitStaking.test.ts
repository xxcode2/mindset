import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("HabitStaking", () => {
  async function deploy() {
    const [deployer, alice, bob, charity] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("HabitStaking");
    const contract = await Factory.deploy(charity.address);
    await contract.waitForDeployment();
    return { contract, deployer, alice, bob, charity };
  }

  it("creates a habit and tracks check-ins", async () => {
    const { contract, alice } = await deploy();
    const stake = ethers.parseEther("0.01");

    await expect(
      contract.connect(alice).createHabit("Workout", 7, 5, { value: stake })
    ).to.emit(contract, "HabitCreated");

    const habit = await contract.getHabit(0);
    expect(habit.owner).to.equal(alice.address);
    expect(habit.stake).to.equal(stake);

    await expect(contract.connect(alice).checkIn(0)).to.emit(contract, "CheckedIn");
    await expect(contract.connect(alice).checkIn(0)).to.be.revertedWithCustomError(
      contract,
      "AlreadyCheckedInToday"
    );
  });

  it("allows claim after meeting target", async () => {
    const { contract, alice } = await deploy();
    const stake = ethers.parseEther("0.01");
    await contract.connect(alice).createHabit("Read", 5, 3, { value: stake });

    for (let i = 0; i < 3; i++) {
      await contract.connect(alice).checkIn(0);
      if (i < 2) await time.increase(24 * 60 * 60 + 1);
    }

    const before = await ethers.provider.getBalance(alice.address);
    const tx = await contract.connect(alice).claim(0);
    const r = await tx.wait();
    const gasCost = r!.gasUsed * r!.gasPrice;
    const after = await ethers.provider.getBalance(alice.address);
    expect(after + gasCost - before).to.equal(stake);
  });

  it("sends stake to charity on forfeit", async () => {
    const { contract, alice, charity } = await deploy();
    const stake = ethers.parseEther("0.02");
    await contract.connect(alice).createHabit("Meditate", 3, 3, { value: stake });

    await time.increase(4 * 24 * 60 * 60);

    const before = await ethers.provider.getBalance(charity.address);
    await contract.forfeit(0);
    const after = await ethers.provider.getBalance(charity.address);
    expect(after - before).to.equal(stake);
  });

  it("cannot forfeit before expiry, cannot claim without meeting target", async () => {
    const { contract, alice } = await deploy();
    await contract.connect(alice).createHabit("X", 5, 3, { value: ethers.parseEther("0.01") });

    await expect(contract.forfeit(0)).to.be.revertedWithCustomError(contract, "HabitNotExpired");
    await expect(contract.connect(alice).claim(0)).to.be.revertedWithCustomError(
      contract,
      "CheckInsTargetNotMet"
    );
  });
});
