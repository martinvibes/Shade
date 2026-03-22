import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
  // Venice AI
  veniceApiKey: process.env.VENICE_API_KEY || "",
  veniceBaseUrl: "https://api.venice.ai/api/v1",
  veniceModel: process.env.VENICE_MODEL || "openai-gpt-4o-mini-2024-07-18",

  // Blockchain
  privateKey: process.env.PRIVATE_KEY || "",
  baseSepoliaRpc: "https://sepolia.base.org",
  statusSepoliaRpc: "https://public.sepolia.rpc.status.network",

  // Deployed contracts (Base Sepolia) — v2 with authorizedCaller
  shadeVault: "0x6cFf39E67B660A14933D83348Ecc5c8102B59EeC",
  shadeVerifier: "0xb2908FB08B189f2b91926705940E15D4E75ab501",

  // Deployed contracts (Status Sepolia) — v2
  statusVault: "0xA262185de81ee3fE50266a765a5e6AFa5Ad430D7",
  statusVerifier: "0xF74079a7CC2d0FB0268B10E34bbeBfd2f4299EC0",

  // ERC-8004 (Base Sepolia)
  erc8004IdentityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  erc8004ReputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",

  // Locus Payments
  locusApiKey: process.env.LOCUS_API_KEY || "",
  locusWalletAddress: process.env.LOCUS_WALLET_ADDRESS || "",

  // Agent config
  maxSpendPerTx: Number(process.env.MAX_SPEND_PER_TX || "10"),
  dailyBudget: Number(process.env.DAILY_BUDGET || "50"),
  privacyLevel: (process.env.PRIVACY_LEVEL || "high") as "maximum" | "high" | "medium" | "low",

  // Server
  port: Number(process.env.PORT || "3001"),
} as const;

export function validateConfig(): string[] {
  const errors: string[] = [];
  if (!config.veniceApiKey) errors.push("VENICE_API_KEY is required");
  if (!config.privateKey) errors.push("PRIVATE_KEY is required");
  return errors;
}
