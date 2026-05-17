import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const feeRecipient = process.env.FEE_RECIPIENT;
  if (!feeRecipient || !ethers.isAddress(feeRecipient)) {
    throw new Error("Set FEE_RECIPIENT in .env to a valid address.");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Network:        ", network.name);
  console.log("Deployer:       ", deployer.address);
  console.log("Fee recipient:  ", feeRecipient);

  // Resolve betting token: either reuse an existing ERC20 (real USDC on mainnet)
  // or deploy a MockUSDC alongside for testnet.
  let tokenAddress = process.env.BETTING_TOKEN ?? "";
  let mockDeployed = false;
  if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
    console.log("\nNo BETTING_TOKEN set — deploying MockUSDC for testing…");
    const Mock = await ethers.getContractFactory("MockUSDC");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    tokenAddress = await mock.getAddress();
    mockDeployed = true;
    console.log("MockUSDC:        ", tokenAddress);
  } else {
    console.log("Using existing token:", tokenAddress);
  }

  const Pm = await ethers.getContractFactory("PredictionMarket");
  const pm = await Pm.deploy(tokenAddress, feeRecipient);
  await pm.waitForDeployment();
  const pmAddress = await pm.getAddress();

  console.log("\nPredictionMarket deployed to:", pmAddress);

  // Persist a small JSON for the frontend to pick up.
  const out = path.join(__dirname, "..", "deployments.json");
  let existing: Record<string, any> = {};
  if (fs.existsSync(out)) {
    existing = JSON.parse(fs.readFileSync(out, "utf8"));
  }
  existing[network.name] = {
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    predictionMarket: pmAddress,
    bettingToken: tokenAddress,
    feeRecipient,
    mockDeployed,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(out, JSON.stringify(existing, null, 2));
  console.log(`\nWrote ${out}`);

  console.log("\nNext steps:");
  console.log(`  Add to frontend/.env.local:`);
  console.log(`    NEXT_PUBLIC_CONTRACT_ADDRESS=${pmAddress}`);
  console.log(`    NEXT_PUBLIC_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`  Verify: npx hardhat verify --network ${network.name} ${pmAddress} ${tokenAddress} ${feeRecipient}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
