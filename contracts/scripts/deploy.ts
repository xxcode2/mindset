import { ethers, network } from "hardhat";

async function main() {
  const charityAddress = process.env.CHARITY_ADDRESS;
  if (!charityAddress || !ethers.isAddress(charityAddress)) {
    throw new Error(
      "Set CHARITY_ADDRESS in .env to a valid address (e.g. a known charity wallet, " +
        "or for testnet just any address you do not control)."
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log("Network:        ", network.name);
  console.log("Deployer:       ", deployer.address);
  console.log("Charity address:", charityAddress);
  console.log("Balance:        ", (await ethers.provider.getBalance(deployer.address)).toString());

  const HabitStaking = await ethers.getContractFactory("HabitStaking");
  const contract = await HabitStaking.deploy(charityAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nHabitStaking deployed to:", address);
  console.log("\nNext steps:");
  console.log(`  1. Add to frontend/.env.local: NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(`  2. Verify on BaseScan: npx hardhat verify --network ${network.name} ${address} ${charityAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
