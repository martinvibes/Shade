import { ethers } from "ethers";

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const RPC = "https://sepolia.base.org";

const IDENTITY_ABI = [
  "function register(string agentURI) external returns (uint256 agentId)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function agentURI(uint256 agentId) external view returns (string)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const address = await signer.getAddress();
  const registry = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, signer);

  console.log("Wallet:", address);

  // Check if already registered
  const balance = await registry.balanceOf(address);
  console.log("Existing agents:", Number(balance));

  if (Number(balance) > 0) {
    try {
      const agentId = await registry.tokenOfOwnerByIndex(address, 0);
      const uri = await registry.agentURI(agentId);
      console.log("Already registered! Agent ID:", agentId.toString());
      console.log("URI:", uri);
      console.log("View: https://www.8004scan.io/agents/" + agentId.toString());
      return;
    } catch {
      console.log("Has tokens but couldn't read — registering new one...");
    }
  }

  // Register
  // For now use a placeholder URI — we'll update it once we push to GitHub
  const agentURI = "https://raw.githubusercontent.com/shade-agent/shade/main/agent.json";

  console.log("\nRegistering Shade on ERC-8004 (Base Sepolia)...");
  console.log("URI:", agentURI);

  const tx = await registry.register(agentURI);
  console.log("TX sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("TX confirmed!");

  // Extract agent ID from event
  let agentId = "unknown";
  for (const log of receipt.logs) {
    try {
      const parsed = registry.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed && parsed.name === "Registered") {
        agentId = parsed.args.agentId.toString();
        break;
      }
    } catch {
      // skip
    }
  }

  console.log("\n=== Shade Registered ===");
  console.log("Agent ID:", agentId);
  console.log("TX:", `https://sepolia.basescan.org/tx/${receipt.hash}`);
  console.log("8004scan:", `https://www.8004scan.io/agents/${agentId}`);
}

main().catch(console.error);
