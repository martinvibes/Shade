import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const registry = new ethers.Contract(
    "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    ["function setAgentURI(uint256 agentId, string calldata newURI) external"],
    signer
  );

  const newURI = "https://raw.githubusercontent.com/martinvibes/Shade/main/agent.json";
  console.log("Updating Agent #2321 URI to:", newURI);

  const tx = await registry.setAgentURI(2321, newURI);
  const receipt = await tx.wait();
  console.log("Done! TX:", receipt!.hash);
}

main().catch(console.error);
