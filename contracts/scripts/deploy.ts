import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const feeRecipient = process.env.FEE_RECIPIENT;
  if (!feeRecipient || !ethers.isAddress(feeRecipient)) {
    throw new Error("Set FEE_RECIPIENT in .env to a valid address.");
  }

  const [deployer] = await ethers.getSigners();

  // Owner: address with permission to approve/reject pending proposals and manage the
  // trustedResolver whitelist. Defaults to deployer for convenience but a multisig is recommended.
  const ownerAddress = process.env.OWNER_ADDRESS && ethers.isAddress(process.env.OWNER_ADDRESS)
    ? process.env.OWNER_ADDRESS
    : deployer.address;

  // Resolver bond locked when a non-trusted resolver proposes an outcome. Slashed on rejection,
  // refunded on approval/timeout. Default: 10 USDC (6 decimals).
  const resolverBond = BigInt(process.env.RESOLVER_BOND ?? "10000000");

  const creationFee = BigInt(process.env.CREATION_FEE ?? "5000000"); // 5 USDC

  console.log("Network:        ", network.name);
  console.log("Deployer:       ", deployer.address);
  console.log("Fee recipient:  ", feeRecipient);
  console.log("Owner:          ", ownerAddress);
  console.log("Creation fee:   ", creationFee.toString(), "(token base units)");
  console.log("Resolver bond:  ", resolverBond.toString(), "(token base units)");

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
  const pm = await Pm.deploy(tokenAddress, feeRecipient, creationFee, ownerAddress, resolverBond);
  await pm.waitForDeployment();
  const pmAddress = await pm.getAddress();
  console.log("\nPredictionMarket:", pmAddress);

  // Deploy ChainlinkPriceResolver — auto-resolves Price-category markets.
  const Resolver = await ethers.getContractFactory("ChainlinkPriceResolver");
  const resolver = await Resolver.deploy(pmAddress);
  await resolver.waitForDeployment();
  const resolverAddress = await resolver.getAddress();
  console.log("ChainlinkPriceResolver:", resolverAddress);

  // Whitelist the price resolver so it can finalize markets in one tx without bond/review.
  // Only works if the deployer is the owner; otherwise the owner must call this themselves.
  if (ownerAddress.toLowerCase() === deployer.address.toLowerCase()) {
    const tx = await pm.setTrustedResolver(resolverAddress, true);
    await tx.wait();
    console.log("  -> ChainlinkPriceResolver marked trusted");
  } else {
    console.log("\n  Note: deployer is not owner. Owner must call:");
    console.log(`    pm.setTrustedResolver(${resolverAddress}, true)`);
  }

  // Persist a small JSON for the frontend to pick up.
  const out = path.join(__dirname, "..", "deployments.json");
  let existing: Record<string, any> = {};
  if (fs.existsSync(out)) existing = JSON.parse(fs.readFileSync(out, "utf8"));
  existing[network.name] = {
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    predictionMarket: pmAddress,
    chainlinkPriceResolver: resolverAddress,
    bettingToken: tokenAddress,
    feeRecipient,
    owner: ownerAddress,
    creationFee: creationFee.toString(),
    resolverBond: resolverBond.toString(),
    mockDeployed,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(out, JSON.stringify(existing, null, 2));
  console.log(`\nWrote ${out}`);

  console.log("\nNext steps:");
  console.log(`  Add to frontend/.env.local:`);
  console.log(`    NEXT_PUBLIC_CONTRACT_ADDRESS=${pmAddress}`);
  console.log(`    NEXT_PUBLIC_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`    NEXT_PUBLIC_PRICE_RESOLVER_ADDRESS=${resolverAddress}`);
  console.log(`  Verify:`);
  console.log(
    `    npx hardhat verify --network ${network.name} ${pmAddress} ${tokenAddress} ${feeRecipient} ${creationFee} ${ownerAddress} ${resolverBond}`
  );
  console.log(`    npx hardhat verify --network ${network.name} ${resolverAddress} ${pmAddress}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
