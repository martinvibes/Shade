import { ethers } from "ethers";
import { config } from "../config.js";
import { getBaseSigner } from "../identity/erc8004.js";
import { resolveRecipient, isENSName } from "../identity/ens.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECURRING_FILE = path.resolve(__dirname, "../../data/recurring-payments.json");

const VAULT_ABI = [
  "function spend(address payable recipient, uint256 amount, bytes32 intentHash) external",
  "function whitelisted(address) external view returns (bool)",
  "function setWhitelist(address recipient, bool status) external",
  "function getBalance() external view returns (uint256)",
];

export interface RecurringPayment {
  id: string;
  recipient: string;
  recipientDisplay: string; // ENS or truncated address
  amount: number;
  currency: "ETH";
  intervalMs: number;
  intervalLabel: string;
  status: "active" | "paused" | "cancelled";
  createdAt: number;
  lastExecutedAt: number | null;
  nextExecuteAt: number;
  executionCount: number;
  txHashes: string[];
}

// Store
const payments: Map<string, RecurringPayment> = new Map();
let recurringInterval: NodeJS.Timeout | null = null;

function save() {
  const dir = path.dirname(RECURRING_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RECURRING_FILE, JSON.stringify(Array.from(payments.values()), null, 2));
}

function load() {
  try {
    if (fs.existsSync(RECURRING_FILE)) {
      const data = JSON.parse(fs.readFileSync(RECURRING_FILE, "utf-8"));
      for (const p of data) payments.set(p.id, p);
      const active = data.filter((p: RecurringPayment) => p.status === "active").length;
      if (active > 0) {
        console.log(`[Recurring] Loaded ${data.length} payments (${active} active)`);
        startRecurringMonitor();
      }
    }
  } catch { /* fresh */ }
}

load();

// Intervals
const INTERVALS: Record<string, { ms: number; label: string }> = {
  "5m": { ms: 300000, label: "Every 5 minutes" },
  "1h": { ms: 3600000, label: "Every hour" },
  "6h": { ms: 21600000, label: "Every 6 hours" },
  "24h": { ms: 86400000, label: "Every day" },
  "7d": { ms: 604800000, label: "Every week" },
  "30d": { ms: 2592000000, label: "Every month" },
};

export function getIntervals() {
  return Object.entries(INTERVALS).map(([key, val]) => ({ key, ...val }));
}

export async function createRecurring(
  recipient: string,
  amount: number,
  intervalKey: string
): Promise<RecurringPayment> {
  const interval = INTERVALS[intervalKey] || INTERVALS["24h"];
  const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Resolve ENS
  let resolvedAddress = recipient;
  let display = recipient;
  if (isENSName(recipient)) {
    const resolved = await resolveRecipient(recipient);
    if (resolved.address) {
      resolvedAddress = resolved.address;
      display = recipient;
    }
  } else {
    display = `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;
  }

  const payment: RecurringPayment = {
    id,
    recipient: resolvedAddress,
    recipientDisplay: display,
    amount,
    currency: "ETH",
    intervalMs: interval.ms,
    intervalLabel: interval.label,
    status: "active",
    createdAt: Date.now(),
    lastExecutedAt: null,
    nextExecuteAt: Date.now() + interval.ms,
    executionCount: 0,
    txHashes: [],
  };

  payments.set(id, payment);
  save();

  if (!recurringInterval) startRecurringMonitor();

  return payment;
}

export function getRecurringPayments(): RecurringPayment[] {
  return Array.from(payments.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function cancelRecurring(id: string): boolean {
  const p = payments.get(id);
  if (!p || p.status !== "active") return false;
  p.status = "cancelled";
  save();
  return true;
}

async function executeRecurring(payment: RecurringPayment) {
  console.log(`[Recurring] Executing payment ${payment.id} → ${payment.recipientDisplay}`);

  try {
    const { signer } = getBaseSigner();
    const vault = new ethers.Contract(config.shadeVault, VAULT_ABI, signer);

    // Auto-whitelist
    const isWhitelisted = await vault.whitelisted(payment.recipient);
    if (!isWhitelisted) {
      const wlTx = await vault.setWhitelist(payment.recipient, true);
      await wlTx.wait();
    }

    // Check balance
    const balance = await vault.getBalance();
    const amountWei = ethers.parseEther(String(payment.amount));
    if (balance < amountWei) {
      console.log(`[Recurring] Insufficient vault balance for ${payment.id}`);
      return;
    }

    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("recurring_payment"));
    const tx = await vault.spend(payment.recipient, amountWei, intentHash);
    const receipt = await tx.wait();

    payment.lastExecutedAt = Date.now();
    payment.nextExecuteAt = Date.now() + payment.intervalMs;
    payment.executionCount++;
    payment.txHashes.push(receipt.hash);
    save();

    console.log(`[Recurring] Success! TX: ${receipt.hash} (execution #${payment.executionCount})`);
  } catch (err: any) {
    console.log(`[Recurring] Failed: ${err.message?.slice(0, 80)}`);
  }
}

function startRecurringMonitor() {
  if (recurringInterval) return;
  console.log("[Recurring] Monitor started (30s check interval)");

  recurringInterval = setInterval(async () => {
    const active = Array.from(payments.values()).filter((p) => p.status === "active");
    if (active.length === 0) {
      if (recurringInterval) {
        clearInterval(recurringInterval);
        recurringInterval = null;
        console.log("[Recurring] No active payments, monitor stopped");
      }
      return;
    }

    const now = Date.now();
    for (const payment of active) {
      if (now >= payment.nextExecuteAt) {
        await executeRecurring(payment);
      }
    }
  }, 30000);
}
