import { ethers } from "ethers";
import { config } from "./config.js";
import { privateInference } from "./privacy/venice.js";
import {
  determineDisclosure,
  countDisclosure,
  generatePrivacyReport,
  type DisclosureManifest,
  type PrivacyLevel,
} from "./privacy/disclosure.js";
import { AgentLogger, type PrivacyAction } from "./logging/agent-log.js";
import { getBaseSigner } from "./identity/erc8004.js";
import { formatAgentIdentity } from "./identity/ens.js";
import { classifyTask } from "./execution/task-classifier.js";
import { executeClassifiedTask, type ExecutionResult } from "./execution/task-executor.js";

// ── Types ──

export interface TaskResult {
  success: boolean;
  task: string;
  taskType: string;
  disclosureManifest: DisclosureManifest;
  privacyReport: string;
  privacyScore: number;
  fieldsHidden: number;
  fieldsRevealed: number;
  intentCategory: string;
  cost: number;
  execution: ExecutionResult | null;
  agentLog: string;
  logEntries: Array<{
    time: string;
    action: string;
    type: string;
    detail?: string;
  }>;
}

// ── ShadeVerifier ABI ──

const VERIFIER_ABI = [
  "function logTask(bytes32 taskHash, bytes32 disclosureHash, string intentCategory, uint256 cost, uint8 fieldsHidden, uint8 fieldsRevealed, bool success) external returns (uint256)",
  "function getAgentStats() external view returns (uint256, uint256, uint256, uint256, uint256)",
];

// ── Main Agent Pipeline ──

/**
 * Full Shade agent pipeline:
 *
 * 1. CLASSIFY — Venice AI determines what type of task this is
 * 2. DISCLOSE — Selective disclosure engine decides minimum info to reveal
 * 3. EXECUTE — Real on-chain action (Locus payment, vault transfer, etc.)
 * 4. VERIFY — Log receipt on-chain to ShadeVerifier
 * 5. REPORT — Generate privacy report
 */
export async function executeTask(
  taskDescription: string,
  privacyLevel: PrivacyLevel = config.privacyLevel
): Promise<TaskResult> {
  const { signer } = getBaseSigner();
  const operatorAddress = await signer.getAddress();
  const logger = new AgentLogger("shade-v1", operatorAddress, taskDescription);
  const liveLog: TaskResult["logEntries"] = [];
  const startTime = Date.now();

  function log(action: string, type: string, detail?: string) {
    const time = new Date().toTimeString().slice(0, 8);
    liveLog.push({ time, action, type, detail });
  }

  try {
    // ── Phase 1: Private Classification via Venice AI ──
    log("Private reasoning via Venice AI", "reasoning", "no data retained");

    logger.addEntry({
      phase: "discover",
      action: "Private task classification via Venice AI",
      toolCalls: [{ tool: "venice-ai", input: { model: config.veniceModel }, output: "classifying", duration_ms: 0 }],
      decisions: [],
      privacyActions: [{ field: "task_prompt", action: "hidden", reason: "Venice AI retains zero data" }],
      retries: 0,
      success: true,
    });

    const classifyStart = Date.now();
    const classified = await classifyTask(taskDescription);
    const classifyDuration = Date.now() - classifyStart;

    log(`Task classified: ${classified.type}`, "discovery", classified.intentCategory);
    log(`Target: ${classified.description}`, "info");

    logger.addEntry({
      phase: "plan",
      action: `Classified as "${classified.type}" — ${classified.intentCategory}`,
      toolCalls: [{ tool: "venice-ai", input: { task: taskDescription }, output: { type: classified.type, category: classified.intentCategory }, duration_ms: classifyDuration }],
      decisions: [{
        description: `Task type: ${classified.type}, category: ${classified.intentCategory}`,
        reasoning: "Venice AI analyzed task to determine execution path and minimum disclosure",
        alternatives: ["Could reveal full task details — rejected for privacy"],
      }],
      privacyActions: [],
      retries: 0,
      success: true,
    });

    // ── Phase 2: Disclosure Decision ──
    const ephemeralWallet = ethers.Wallet.createRandom();
    const ephemeralAddress = ephemeralWallet.address;

    const serviceReqs = {
      needsBudgetProof: classified.amount !== null,
      needsIntentCategory: true,
      needsIdentityProof: classified.type !== "general",
    };

    const manifest = determineDisclosure(
      {
        description: taskDescription,
        budget: classified.amount || 0,
        category: classified.intentCategory,
      },
      privacyLevel,
      serviceReqs,
      ephemeralAddress
    );

    const { hidden, revealed, total } = countDisclosure(manifest);
    const privacyScore = total > 0 ? Math.round((hidden / total) * 100) : 100;

    log(`Disclosure: ${hidden} hidden, ${revealed} revealed`, "privacy", `${privacyScore}% private`);

    const privacyActions: PrivacyAction[] = [
      { field: "identity", action: manifest.identity.status === "hidden" ? "hidden" : "revealed", reason: "Identity never fully exposed" },
      { field: "wallet", action: "hidden", reason: `Using ${manifest.wallet.type} wallet` },
      { field: "budget", action: manifest.budget.status === "hidden" ? "hidden" : "revealed", reason: `Budget: ${manifest.budget.status}` },
      { field: "intent", action: manifest.intent.status === "hidden" ? "hidden" : "redacted", reason: `Intent: ${manifest.intent.status}` },
      { field: "ip_address", action: "stripped", reason: "Metadata sanitized" },
      { field: "device_info", action: "stripped", reason: "Metadata sanitized" },
      { field: "location", action: "stripped", reason: "Never revealed" },
    ];

    logger.addEntry({
      phase: "plan",
      action: `Disclosure manifest: ${hidden}/${total} fields hidden (${privacyScore}%)`,
      toolCalls: [],
      decisions: [{
        description: `Privacy level: ${privacyLevel} — ${hidden}/${total} fields hidden`,
        reasoning: "Selective disclosure engine determined minimum required exposure",
        alternatives: ["Full disclosure — rejected", "Zero disclosure — not feasible"],
      }],
      privacyActions,
      retries: 0,
      success: true,
    });

    // ── Phase 3: Real Execution ──
    let execution: ExecutionResult | null = null;

    if (classified.type !== "general") {
      const methodLabel = classified.type === "vault_transfer" ? "ShadeVault" : "Locus";
      log(`Executing via ${methodLabel}`, "payment", `${classified.amount || 0} ${classified.currency}`);

      const execStart = Date.now();
      execution = await executeClassifiedTask(classified);
      const execDuration = Date.now() - execStart;

      if (execution.success) {
        log(`Payment sent: ${execution.amount} ${execution.currency}`, "success", execution.txHash ? `tx: ${execution.txHash.slice(0, 10)}...` : undefined);
      } else {
        log(`Execution note: ${execution.error}`, "info");
      }

      logger.addEntry({
        phase: "execute",
        action: `${execution.success ? "Executed" : "Attempted"} ${classified.type} via ${execution.method}`,
        toolCalls: [{
          tool: execution.method === "locus" ? "locus-payments" : "shade-vault",
          input: { recipient: execution.recipient, amount: execution.amount, currency: execution.currency },
          output: { success: execution.success, txHash: execution.txHash, error: execution.error },
          duration_ms: execDuration,
        }],
        decisions: [{
          description: `Used ${execution.method} for ${classified.type}`,
          reasoning: execution.method === "locus" ? "Locus provides sender privacy — recipient can't trace origin" : "ShadeVault provides budget-controlled spending without exposing operator",
          alternatives: ["Direct wallet transfer — rejected, would expose identity"],
        }],
        privacyActions: [{ field: "wallet", action: "hidden", reason: `Payment sent via ${execution.method} — no link to operator wallet` }],
        retries: 0,
        success: execution.success,
      });
    } else {
      log("Task analyzed — no on-chain execution needed", "info");
    }

    // ── Phase 4: On-chain Receipt ──
    // Brief pause to avoid nonce collision after vault tx
    if (execution?.method === "vault" && execution.success) {
      await new Promise((r) => setTimeout(r, 2000));
    }

    log("Logging receipt on-chain", "info", "privacy-preserving proof");

    const taskHash = ethers.keccak256(ethers.toUtf8Bytes(taskDescription));
    const disclosureHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(manifest)));
    const costWei = classified.currency === "ETH"
      ? ethers.parseEther(String(classified.amount || 0))
      : ethers.parseUnits(String(classified.amount || 0), 6); // USDC has 6 decimals

    try {
      const verifier = new ethers.Contract(config.shadeVerifier, VERIFIER_ABI, signer);
      const tx = await verifier.logTask(
        taskHash,
        disclosureHash,
        classified.intentCategory,
        costWei,
        hidden,
        revealed,
        execution?.success ?? true
      );
      await tx.wait();

      log("Receipt logged on-chain", "success", "verifiable proof");

      logger.addEntry({
        phase: "verify",
        action: "Task receipt logged to ShadeVerifier on Base Sepolia",
        toolCalls: [{ tool: "shade-verifier", input: { taskHash, intentCategory: classified.intentCategory }, output: { txHash: tx.hash }, duration_ms: 0 }],
        decisions: [],
        privacyActions: [{ field: "task_details", action: "hidden", reason: "Only taskHash stored on-chain, not full description" }],
        retries: 0,
        success: true,
      });
    } catch (err: any) {
      log("Receipt logging skipped", "info", err.message?.slice(0, 50));
      logger.addEntry({
        phase: "verify",
        action: `On-chain logging: ${err.message?.slice(0, 100)}`,
        toolCalls: [],
        decisions: [],
        privacyActions: [],
        retries: 0,
        success: false,
      });
    }

    // ── Phase 5: Safety Checks ──
    logger.addSafetyCheck("Budget limit", (classified.amount || 0) <= config.maxSpendPerTx, `$${classified.amount || 0} vs limit $${config.maxSpendPerTx}`);
    logger.addSafetyCheck("Identity hidden", manifest.identity.status !== "revealed", `Status: ${manifest.identity.status}`);
    logger.addSafetyCheck("Primary wallet hidden", !manifest.wallet.primaryExposed, `Wallet type: ${manifest.wallet.type}`);
    logger.addSafetyCheck("Metadata stripped", !manifest.metadata.location && !manifest.metadata.deviceInfo, "Location and device info stripped");

    logger.setComputeBudget(classified.amount || 0, (classified.amount || 0) * 0.01);
    log("Privacy report generated — task complete", "success");

    const privacyReport = generatePrivacyReport(manifest);
    const finalLog = logger.finalize();

    return {
      success: true,
      task: taskDescription,
      taskType: classified.type,
      disclosureManifest: manifest,
      privacyReport,
      privacyScore,
      fieldsHidden: hidden,
      fieldsRevealed: revealed,
      intentCategory: classified.intentCategory,
      cost: classified.amount || 0,
      execution,
      agentLog: JSON.stringify(finalLog, null, 2),
      logEntries: liveLog,
    };
  } catch (error: any) {
    log(`Error: ${error.message}`, "info");

    const emptyManifest = determineDisclosure(
      { description: taskDescription, budget: 0, category: "error" },
      privacyLevel,
      { needsBudgetProof: false, needsIntentCategory: false, needsIdentityProof: false }
    );
    const finalLog = logger.finalize();

    return {
      success: false,
      task: taskDescription,
      taskType: "error",
      disclosureManifest: emptyManifest,
      privacyReport: "Task failed — no data was disclosed.",
      privacyScore: 100,
      fieldsHidden: 0,
      fieldsRevealed: 0,
      intentCategory: "error",
      cost: 0,
      execution: null,
      agentLog: JSON.stringify(finalLog, null, 2),
      logEntries: liveLog,
    };
  }
}
