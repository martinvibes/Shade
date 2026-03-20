import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const registry = new ethers.Contract(
    "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    [
      "function tokenURI(uint256) view returns (string)",
      "function ownerOf(uint256) view returns (address)",
      "function balanceOf(address) view returns (uint256)",
    ],
    provider
  );

  // First check ownership
  const owner = await registry.ownerOf(2321);
  let uri = "";
  try {
    uri = await registry.tokenURI(2321);
  } catch {
    uri = "(tokenURI call failed — may need different ABI)";
  }

  console.log("=== ERC-8004 Agent #2321 ===");
  console.log("Owner:", owner);
  console.log("URI:", uri);
  console.log("8004scan: https://www.8004scan.io/agents/2321");

  // Fetch the metadata
  try {
    const res = await fetch(uri);
    const json = await res.json();
    console.log("\nMetadata:");
    console.log("  Name:", json.name);
    console.log("  Description:", json.description?.slice(0, 80) + "...");
    console.log("  Active:", json.active);
    console.log("  Skills:", json.services?.[0]?.skills?.join(", "));
  } catch {
    console.log("\nCouldn't fetch metadata (push agent.json to GitHub first)");
  }
}

main().catch(console.error);
