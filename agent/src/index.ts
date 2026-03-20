import express from "express";
import { config, validateConfig } from "./config.js";
import { executeTask } from "./agent.js";
import type { PrivacyLevel } from "./privacy/disclosure.js";

const app = express();
app.use(express.json());

// CORS — allow frontend to connect
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// ── Health check ──
app.get("/health", (_req, res) => {
  const errors = validateConfig();
  res.json({
    status: errors.length === 0 ? "ok" : "degraded",
    agent: "Shade v1.0",
    venice: config.veniceApiKey ? "configured" : "missing",
    blockchain: config.privateKey ? "configured" : "missing",
    contracts: {
      vault: config.shadeVault,
      verifier: config.shadeVerifier,
    },
    errors,
  });
});

// ── Execute a task ──
app.post("/task", async (req, res) => {
  const { task, privacyLevel } = req.body;

  if (!task || typeof task !== "string") {
    res.status(400).json({ error: "task is required (string)" });
    return;
  }

  const validLevels: PrivacyLevel[] = ["maximum", "high", "medium", "low"];
  const level: PrivacyLevel = validLevels.includes(privacyLevel)
    ? privacyLevel
    : config.privacyLevel;

  try {
    console.log(`\n[Shade] Task received: "${task}" (privacy: ${level})`);
    const result = await executeTask(task, level);

    console.log(`[Shade] Task ${result.success ? "completed" : "failed"}`);
    console.log(`[Shade] Privacy score: ${result.privacyScore}%`);
    console.log(`[Shade] Fields hidden: ${result.fieldsHidden}, revealed: ${result.fieldsRevealed}`);

    res.json(result);
  } catch (error: any) {
    console.error("[Shade] Task execution error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Get agent stats from on-chain verifier ──
app.get("/stats", async (_req, res) => {
  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(config.baseSepoliaRpc);
    const verifier = new ethers.Contract(
      config.shadeVerifier,
      [
        "function getAgentStats() external view returns (uint256, uint256, uint256, uint256, uint256)",
      ],
      provider
    );

    const [agentId, taskCount, successCount, totalSpent, privacyScore] =
      await verifier.getAgentStats();

    res.json({
      agentId: agentId.toString(),
      taskCount: Number(taskCount),
      successCount: Number(successCount),
      totalSpent: ethers.formatEther(totalSpent),
      privacyScore: Number(privacyScore),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Verify a task on-chain ──
app.get("/verify/:taskHash", async (req, res) => {
  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(config.baseSepoliaRpc);
    const verifier = new ethers.Contract(
      config.shadeVerifier,
      [
        "function verifyTask(bytes32) external view returns (bool, string, uint256, uint8, uint8, bool, uint256)",
      ],
      provider
    );

    const [exists, intentCategory, cost, fieldsHidden, fieldsRevealed, success, timestamp] =
      await verifier.verifyTask(req.params.taskHash);

    res.json({
      exists,
      intentCategory,
      cost: ethers.formatEther(cost),
      fieldsHidden: Number(fieldsHidden),
      fieldsRevealed: Number(fieldsRevealed),
      success,
      timestamp: Number(timestamp),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Vault balance ──
app.get("/vault/balance", async (_req, res) => {
  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(config.baseSepoliaRpc);
    const vault = new ethers.Contract(
      config.shadeVault,
      ["function getBalance() external view returns (uint256)", "function getRemainingDailyBudget() external view returns (uint256)", "function maxPerTx() external view returns (uint256)", "function dailyBudget() external view returns (uint256)"],
      provider
    );

    const [balance, remaining, maxPerTx, dailyBudget] = await Promise.all([
      vault.getBalance(),
      vault.getRemainingDailyBudget(),
      vault.maxPerTx(),
      vault.dailyBudget(),
    ]);

    res.json({
      address: config.shadeVault,
      balance: ethers.formatEther(balance),
      remainingDaily: ethers.formatEther(remaining),
      maxPerTx: ethers.formatEther(maxPerTx),
      dailyBudget: ethers.formatEther(dailyBudget),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Locus balance ──
app.get("/locus/balance", async (_req, res) => {
  if (!config.locusApiKey) {
    res.status(400).json({ error: "LOCUS_API_KEY not configured" });
    return;
  }
  try {
    const { getBalance } = await import("./payments/locus.js");
    const balance = await getBalance(config.locusApiKey);
    res.json({ wallet: config.locusWalletAddress, ...balance });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Locus transactions ──
app.get("/locus/transactions", async (_req, res) => {
  if (!config.locusApiKey) {
    res.status(400).json({ error: "LOCUS_API_KEY not configured" });
    return;
  }
  try {
    const { getTransactions } = await import("./payments/locus.js");
    const txs = await getTransactions(config.locusApiKey);
    res.json({ transactions: txs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Start server ──
app.listen(config.port, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║         SHADE AGENT v1.0             ║`);
  console.log(`║  Privacy-Preserving Autonomous Agent  ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`\n  Server:    http://localhost:${config.port}`);
  console.log(`  Venice AI: ${config.veniceApiKey ? "✓ configured" : "✗ missing"}`);
  console.log(`  Chain:     Base Sepolia`);
  console.log(`  Vault:     ${config.shadeVault}`);
  console.log(`  Verifier:  ${config.shadeVerifier}`);
  console.log(`\n  Endpoints:`);
  console.log(`    GET  /health         — agent status`);
  console.log(`    POST /task           — execute a task`);
  console.log(`    GET  /stats          — on-chain agent stats`);
  console.log(`    GET  /verify/:hash   — verify task on-chain\n`);
});
