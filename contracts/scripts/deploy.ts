import { ethers, network } from "hardhat";

async function main() {
  const feeRecipient = process.env.FEE_RECIPIENT;
  if (!feeRecipient || !ethers.isAddress(feeRecipient)) {
    throw new Error("Set FEE_RECIPIENT in .env to a valid address (your wallet or a treasury).");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Network:        ", network.name);
  console.log("Deployer:       ", deployer.address);
  console.log("Fee recipient:  ", feeRecipient);
  console.log("Balance:        ", (await ethers.provider.getBalance(deployer.address)).toString());

  const F = await ethers.getContractFactory("PredictionMarket");
  const c = await F.deploy(feeRecipient);
  await c.waitForDeployment();
  const address = await c.getAddress();

  console.log("\nPredictionMarket deployed to:", address);
  console.log("\nNext steps:");
  console.log(`  Add to frontend/.env.local: NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(`  Verify: npx hardhat verify --network ${network.name} ${address} ${feeRecipient}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
