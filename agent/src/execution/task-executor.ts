import { ethers } from "ethers";
import { config } from "../config.js";
import { getBaseSigner } from "../identity/erc8004.js";
import { sendPayment, getBalance } from "../payments/locus.js";
import { resolveRecipient, isENSName } from "../identity/ens.js";
import type { ClassifiedTask } from "./task-classifier.js";

export interface ExecutionResult {
  success: boolean;
  txHash: string | null;
  method: "locus" | "vault" | "none";
  amount: number;
  currency: string;
  recipient: string;
  error?: string;
}

const VAULT_ABI = [
  "function spend(address payable recipient, uint256 amount, bytes32 intentHash) external",
  "function whitelisted(address) external view returns (bool)",
  "function setWhitelist(address recipient, bool status) external",
  "function getBalance() external view returns (uint256)",
  "function getRemainingDailyBudget() external view returns (uint256)",
];

/**
 * Execute a classified task — real on-chain actions, not simulations.
 * Resolves ENS names to addresses before execution.
 */
export async function executeClassifiedTask(
  task: ClassifiedTask
): Promise<ExecutionResult> {
  // Resolve ENS names to addresses
  if (task.recipientAddress && isENSName(task.recipientAddress)) {
    const resolved = await resolveRecipient(task.recipientAddress);
    if (!resolved.address) {
      return {
        success: false,
        txHash: null,
        method: "none",
        amount: task.amount || 0,
        currency: task.currency,
        recipient: task.recipientAddress,
        error: `Could not resolve ENS name: ${task.recipientAddress}`,
      };
    }
    console.log(`[ENS] Resolved ${task.recipientAddress} → ${resolved.address}`);
    task.recipientAddress = resolved.address;
  }

  switch (task.type) {
    case "private_payment":
      return executePrivatePayment(task);
    case "anonymous_donation":
      return executeAnonymousDonation(task);
    case "vault_transfer":
      return executeVaultTransfer(task);
    default:
      return { success: false, txHash: null, method: "none", amount: 0, currency: "", recipient: "", error: "Task type not executable on-chain" };
  }
}

/**
 * Option 1: Private payment via Locus.
 * Sends USDC from Locus-managed wallet — recipient can't trace back to user.
 */
async function executePrivatePayment(task: ClassifiedTask): Promise<ExecutionResult> {
  if (!config.locusApiKey) {
    return { success: false, txHash: null, method: "locus", amount: 0, currency: "USDC", recipient: "", error: "Locus API key not configured" };
  }

  if (!task.recipientAddress || !task.amount) {
    return { success: false, txHash: null, method: "locus", amount: 0, currency: "USDC", recipient: "", error: "Recipient address and amount required" };
  }

  try {
    // Check balance first
    const balance = await getBalance(config.locusApiKey);
    const balanceNum = parseFloat(balance.usdc_balance || balance.balance || "0");

    if (balanceNum < task.amount) {
      return { success: false, txHash: null, method: "locus", amount: task.amount, currency: "USDC", recipient: task.recipientAddress, error: `Insufficient Locus balance: $${balanceNum} < $${task.amount}` };
    }

    const result = await sendPayment(
      config.locusApiKey,
      task.recipientAddress,
      task.amount,
      `Shade private payment — ${task.intentCategory}`
    );

    return {
      success: result.success,
      txHash: result.txId || null,
      method: "locus",
      amount: task.amount,
      currency: "USDC",
      recipient: task.recipientAddress,
      error: result.error,
    };
  } catch (err: any) {
    return { success: false, txHash: null, method: "locus", amount: task.amount || 0, currency: "USDC", recipient: task.recipientAddress || "", error: err.message };
  }
}

/**
 * Option 3: Anonymous donation via Locus.
 * Same as private payment but framed as a donation.
 * If no recipient specified, uses a known public goods address.
 */
async function executeAnonymousDonation(task: ClassifiedTask): Promise<ExecutionResult> {
  // Default public goods address (Protocol Guild on Base) if none specified
  const recipient = task.recipientAddress || "0x0000000000000000000000000000000000000000";

  if (recipient === "0x0000000000000000000000000000000000000000") {
    return { success: false, txHash: null, method: "locus", amount: 0, currency: "USDC", recipient: "", error: "Recipient address required for donations" };
  }

  const paymentTask: ClassifiedTask = { ...task, recipientAddress: recipient, type: "private_payment" };
  return executePrivatePayment(paymentTask);
}

/**
 * Option 4: Fund wallet via ShadeVault.
 * Uses the deployed ShadeVault contract to send ETH privately.
 * The vault's spend() function sends to whitelisted recipients.
 */
async function executeVaultTransfer(task: ClassifiedTask): Promise<ExecutionResult> {
  if (!task.recipientAddress || !task.amount) {
    return { success: false, txHash: null, method: "vault", amount: 0, currency: "ETH", recipient: "", error: "Recipient address and amount required" };
  }

  // Validate address
  let recipient: string;
  try {
    recipient = ethers.getAddress(task.recipientAddress);
  } catch {
    return { success: false, txHash: null, method: "vault", amount: task.amount, currency: "ETH", recipient: task.recipientAddress, error: `Invalid address: ${task.recipientAddress}` };
  }

  try {
    const { signer } = getBaseSigner();
    const vault = new ethers.Contract(config.shadeVault, VAULT_ABI, signer);

    // Check vault balance
    const vaultBalance = await vault.getBalance();
    const amountWei = ethers.parseEther(String(task.amount));

    if (vaultBalance < amountWei) {
      return {
        success: false,
        txHash: null,
        method: "vault",
        amount: task.amount,
        currency: "ETH",
        recipient,
        error: `Insufficient vault balance: ${ethers.formatEther(vaultBalance)} ETH < ${task.amount} ETH`,
      };
    }

    // Auto-whitelist recipient if not already
    const isWhitelisted = await vault.whitelisted(recipient);
    if (!isWhitelisted) {
      const wlTx = await vault.setWhitelist(recipient, true);
      await wlTx.wait();
    }

    // Check daily budget
    const remaining = await vault.getRemainingDailyBudget();
    if (remaining < amountWei) {
      return {
        success: false,
        txHash: null,
        method: "vault",
        amount: task.amount,
        currency: "ETH",
        recipient,
        error: `Exceeds daily budget. Remaining: ${ethers.formatEther(remaining)} ETH`,
      };
    }

    // Execute spend
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes(task.intentCategory));
    const tx = await vault.spend(
      recipient,
      amountWei,
      intentHash
    );
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.hash,
      method: "vault",
      amount: task.amount,
      currency: "ETH",
      recipient: task.recipientAddress,
    };
  } catch (err: any) {
    return { success: false, txHash: null, method: "vault", amount: task.amount || 0, currency: "ETH", recipient, error: err.message?.slice(0, 200) };
  }
}
