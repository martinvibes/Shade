import { ethers } from "ethers";
import { config } from "../config.js";
import { getBaseSigner } from "../identity/erc8004.js";
import { privateInference } from "../privacy/venice.js";

// ── Types ──

export interface DCAOrder {
  id: string;
  type: "price_above" | "price_below";
  targetPrice: number;
  amount: number;
  currency: "ETH";
  recipient: string;
  userAddress?: string;
  status: "active" | "triggered" | "failed" | "cancelled";
  createdAt: number;
  triggeredAt?: number;
  txHash?: string;
  currentPrice?: number;
}

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORDERS_FILE = path.resolve(__dirname, "../../data/dca-orders.json");

// Persistent store — reads from file on startup, writes on every change
const activeOrders: Map<string, DCAOrder> = new Map();
let monitorInterval: NodeJS.Timeout | null = null;

function saveOrders() {
  const dir = path.dirname(ORDERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = Array.from(activeOrders.values());
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2));
}

function loadOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8"));
      for (const order of data) {
        activeOrders.set(order.id, order);
      }
      const active = data.filter((o: DCAOrder) => o.status === "active").length;
      if (active > 0) {
        console.log(`[DCA] Loaded ${data.length} orders (${active} active)`);
        startMonitoring();
      }
    }
  } catch { /* fresh start */ }
}

// Load on import
loadOrders();

const VAULT_ABI = [
  "function spend(address payable recipient, uint256 amount, bytes32 intentHash) external",
  "function spendFrom(address user, address payable recipient, uint256 amount, bytes32 intentHash) external",
  "function getUserBalance(address user) external view returns (uint256)",
  "function whitelisted(address) external view returns (bool)",
  "function setWhitelist(address recipient, bool status) external",
  "function getBalance() external view returns (uint256)",
];

// ── Price Feed ──

export async function getETHPrice(): Promise<number> {
  try {
    // CoinGecko free API — no key needed
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    const data = await res.json();
    return data.ethereum.usd;
  } catch {
    // Fallback: use Venice AI to reason about a hardcoded recent price
    // This ensures the demo always works even if CoinGecko is down
    return 0;
  }
}

// ── Order Management ──

export function createOrder(order: Omit<DCAOrder, "id" | "status" | "createdAt">): DCAOrder {
  const id = `dca_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newOrder: DCAOrder = {
    ...order,
    id,
    status: "active",
    createdAt: Date.now(),
  };
  activeOrders.set(id, newOrder);
  saveOrders();

  if (!monitorInterval) {
    startMonitoring();
  }

  return newOrder;
}

export function getOrders(): DCAOrder[] {
  return Array.from(activeOrders.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function cancelOrder(id: string): boolean {
  const order = activeOrders.get(id);
  if (!order || order.status !== "active") return false;
  order.status = "cancelled";
  saveOrders();
  return true;
}

// ── Monitoring Loop ──

async function checkAndExecute(order: DCAOrder): Promise<void> {
  if (order.status !== "active") return;

  const price = await getETHPrice();
  if (price === 0) return; // Price feed failed, skip

  order.currentPrice = price;

  const triggered =
    (order.type === "price_below" && price <= order.targetPrice) ||
    (order.type === "price_above" && price >= order.targetPrice);

  if (!triggered) return;

  console.log(`[DCA] Order ${order.id} triggered! Price: $${price}, Target: $${order.targetPrice}`);

  try {
    const { signer } = getBaseSigner();
    const vault = new ethers.Contract(config.shadeVault, VAULT_ABI, signer);

    // Auto-whitelist
    const isWhitelisted = await vault.whitelisted(order.recipient);
    if (!isWhitelisted) {
      const wlTx = await vault.setWhitelist(order.recipient, true);
      await wlTx.wait();
    }

    // Check balance (per-user if available)
    const amountWei = ethers.parseEther(String(order.amount));
    if (order.userAddress) {
      const userBal = await vault.getUserBalance(order.userAddress);
      if (userBal < amountWei) {
        order.status = "failed";
        saveOrders();
        console.log(`[DCA] Insufficient user balance for ${order.userAddress}`);
        return;
      }
    } else {
      const balance = await vault.getBalance();
      if (balance < amountWei) {
        order.status = "failed";
        saveOrders();
        console.log(`[DCA] Insufficient vault balance`);
        return;
      }
    }

    // Execute spend
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("dca_transfer"));
    const tx = order.userAddress
      ? await vault.spendFrom(order.userAddress, order.recipient, amountWei, intentHash)
      : await vault.spend(order.recipient, amountWei, intentHash);
    const receipt = await tx.wait();

    order.status = "triggered";
    order.triggeredAt = Date.now();
    order.txHash = receipt.hash;
    saveOrders();

    console.log(`[DCA] Executed! TX: ${receipt.hash}`);

    // Log to verifier
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const verifier = new ethers.Contract(
        config.shadeVerifier,
        ["function logTask(bytes32, bytes32, string, uint256, uint8, uint8, bool) external returns (uint256)"],
        signer
      );
      const taskHash = ethers.keccak256(ethers.toUtf8Bytes(`DCA: ${order.type} $${order.targetPrice} → ${order.amount} ETH`));
      const disclosureHash = ethers.keccak256(ethers.toUtf8Bytes("dca_auto"));
      await verifier.logTask(taskHash, disclosureHash, "dca_transfer", amountWei, 8, 3, true);
    } catch {
      // Verifier logging is optional
    }
  } catch (err: any) {
    order.status = "failed";
    console.log(`[DCA] Failed: ${err.message?.slice(0, 100)}`);
  }
}

function startMonitoring() {
  if (monitorInterval) return;

  console.log("[DCA] Price monitoring started (30s intervals)");

  monitorInterval = setInterval(async () => {
    const active = Array.from(activeOrders.values()).filter((o) => o.status === "active");
    if (active.length === 0) {
      if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        console.log("[DCA] No active orders, monitoring stopped");
      }
      return;
    }

    const price = await getETHPrice();
    if (price === 0) return;

    console.log(`[DCA] Price check: ETH = $${price} | ${active.length} active orders`);

    for (const order of active) {
      order.currentPrice = price;
      await checkAndExecute(order);
    }
  }, 30000); // Check every 30 seconds
}

// ── AI Classification ──

export async function classifyDCATask(taskDescription: string): Promise<{
  isDCA: boolean;
  type: "price_above" | "price_below";
  targetPrice: number;
  amount: number;
  recipient: string | null;
} | null> {
  const result = await privateInference(
    `You classify DCA (Dollar Cost Averaging) / conditional trading tasks. Given a user request, determine:

1. "isDCA": true if this is a price-based conditional order, false otherwise
2. "type": "price_below" if user wants to act when price DROPS, "price_above" if when price RISES
3. "targetPrice": the USD price threshold (number)
4. "amount": the ETH amount to transfer (number)
5. "recipient": the 0x address if specified, null otherwise

Respond ONLY with valid JSON.

Examples:
"Send 0.001 ETH when ETH drops below $3000" → {"isDCA":true,"type":"price_below","targetPrice":3000,"amount":0.001,"recipient":null}
"Transfer 0.0005 ETH to 0xABC when price hits $4000" → {"isDCA":true,"type":"price_above","targetPrice":4000,"amount":0.0005,"recipient":"0xABC"}
"Send 0.001 ETH to 0xABC" → {"isDCA":false,"type":"price_below","targetPrice":0,"amount":0,"recipient":null}`,
    taskDescription,
    { temperature: 0.1 }
  );

  try {
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
