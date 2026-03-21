import { ethers } from "ethers";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const currentOwner = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  // Use the wallet we already generated and funded
  const agentWallet = new ethers.Wallet(
    "0x3a551c34ca0c8039c785be785ebc1c85d5d848146b84b9625f2536f67d684685",
    provider
  );

  console.log("Agent wallet:", agentWallet.address);
  const balance = await provider.getBalance(agentWallet.address);
  console.log("Agent balance:", ethers.formatEther(balance), "ETH");

  // Transfer ShadeVault ownership
  const vault = new ethers.Contract(
    "0x6a9E17F61023f3Cd39Cc1F29D4649E87BD004ebb",
    ["function transferOwnership(address) external", "function owner() view returns (address)"],
    currentOwner
  );

  const currentVaultOwner = await vault.owner();
  console.log("\nVault current owner:", currentVaultOwner);

  if (currentVaultOwner.toLowerCase() === currentOwner.address.toLowerCase()) {
    console.log("Transferring vault ownership...");
    const tx1 = await vault.transferOwnership(agentWallet.address);
    await tx1.wait();
    console.log("Done! tx:", tx1.hash);
  } else {
    console.log("Vault already transferred");
  }

  await delay(3000);

  // Transfer ShadeVerifier ownership
  const verifier = new ethers.Contract(
    "0xb2908FB08B189f2b91926705940E15D4E75ab501",
    ["function transferOwnership(address) external", "function owner() view returns (address)"],
    currentOwner
  );

  const currentVerifierOwner = await verifier.owner();
  console.log("\nVerifier current owner:", currentVerifierOwner);

  if (currentVerifierOwner.toLowerCase() === currentOwner.address.toLowerCase()) {
    console.log("Transferring verifier ownership...");
    const tx2 = await verifier.transferOwnership(agentWallet.address);
    await tx2.wait();
    console.log("Done! tx:", tx2.hash);
  } else {
    console.log("Verifier already transferred");
  }

  console.log("\n=== COMPLETE ===");
  console.log("Agent wallet:", agentWallet.address);
  console.log("Agent private key:", agentWallet.privateKey);
  console.log("\nYour MetaMask wallet ONLY deposits ETH.");
  console.log("Agent wallet handles all spend() calls — your address never appears.");
}

main().catch(console.error);
