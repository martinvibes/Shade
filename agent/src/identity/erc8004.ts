import { ethers } from "ethers";
import { config } from "../config.js";

const IDENTITY_ABI = [
  "function register(string agentURI) external returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string calldata newURI) external",
  "function agentURI(uint256 agentId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
];

/**
 * Get a provider and signer for Base Sepolia.
 */
export function getBaseSigner(): {
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;
} {
  const provider = new ethers.JsonRpcProvider(config.baseSepoliaRpc);
  const signer = new ethers.Wallet(config.privateKey, provider);
  return { provider, signer };
}

/**
 * Register Shade as an ERC-8004 agent on Base Sepolia.
 * The agentURI should point to the agent.json metadata file (IPFS or HTTPS).
 */
export async function registerAgent(
  agentMetadataURI: string
): Promise<{ agentId: string; txHash: string }> {
  const { signer } = getBaseSigner();
  const registry = new ethers.Contract(
    config.erc8004IdentityRegistry,
    IDENTITY_ABI,
    signer
  );

  const tx = await registry.register(agentMetadataURI);
  const receipt = await tx.wait();

  // Extract agentId from Registered event
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
      // Not our event, skip
    }
  }

  return { agentId, txHash: receipt.hash };
}

/**
 * Check if an agent is already registered by the current wallet.
 */
export async function getAgentBalance(): Promise<number> {
  const { signer } = getBaseSigner();
  const registry = new ethers.Contract(
    config.erc8004IdentityRegistry,
    IDENTITY_ABI,
    signer
  );

  const address = await signer.getAddress();
  const balance = await registry.balanceOf(address);
  return Number(balance);
}

/**
 * Update the metadata URI for an existing agent.
 */
export async function updateAgentURI(
  agentId: number,
  newURI: string
): Promise<string> {
  const { signer } = getBaseSigner();
  const registry = new ethers.Contract(
    config.erc8004IdentityRegistry,
    IDENTITY_ABI,
    signer
  );

  const tx = await registry.setAgentURI(agentId, newURI);
  const receipt = await tx.wait();
  return receipt.hash;
}
