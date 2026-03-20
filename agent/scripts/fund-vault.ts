import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const vaultAddress = "0x6a9E17F61023f3Cd39Cc1F29D4649E87BD004ebb";

  console.log("Funding vault with 0.001 ETH...");
  const tx = await signer.sendTransaction({
    to: vaultAddress,
    value: ethers.parseEther("0.001"),
  });
  const receipt = await tx.wait();
  console.log("Done! tx:", receipt!.hash);
}

main().catch(console.error);
