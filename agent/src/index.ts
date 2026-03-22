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
  const { task, privacyLevel, userAddress } = req.body;

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
    const result = await executeTask(task, level, userAddress);

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

// ── Task history (from on-chain ShadeVerifier) ──
app.get("/history", async (_req, res) => {
  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(config.baseSepoliaRpc);
    const verifier = new ethers.Contract(
      config.shadeVerifier,
      [
        "function taskCount() external view returns (uint256)",
        "function getReceipt(uint256) external view returns (tuple(bytes32 taskHash, bytes32 disclosureHash, string intentCategory, uint256 cost, uint8 fieldsHidden, uint8 fieldsRevealed, bool success, uint256 timestamp))",
        "event TaskLogged(uint256 indexed taskIndex, bytes32 indexed taskHash, string intentCategory, uint256 cost, bool success)",
      ],
      provider
    );

    const count = Number(await verifier.taskCount());

    // Fetch events for tx hashes
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 9999);

    // Get vault SpendExecuted events — these are the real ETH transfers
    const vaultContract = new ethers.Contract(
      config.shadeVault,
      ["event SpendExecuted(address indexed recipient, uint256 amount, bytes32 intentHash)"],
      provider
    );

    // Get both event types
    const [spendEvents, receiptEvents] = await Promise.all([
      vaultContract.queryFilter(vaultContract.filters.SpendExecuted(), fromBlock, currentBlock),
      verifier.queryFilter(verifier.filters.TaskLogged(), fromBlock, currentBlock),
    ]);

    // Build tx hash map: prefer spend tx (real transfer), fallback to receipt tx
    const txHashMap = new Map<number, { spendTx: string | null; receiptTx: string | null }>();

    for (const ev of receiptEvents) {
      const idx = Number((ev as any).args?.[0]);
      txHashMap.set(idx, { spendTx: null, receiptTx: ev.transactionHash });
    }

    for (const spendEv of spendEvents) {
      const spendBlock = spendEv.blockNumber;
      for (const recEv of receiptEvents) {
        const idx = Number((recEv as any).args?.[0]);
        const recBlock = recEv.blockNumber;
        if (recBlock >= spendBlock && recBlock <= spendBlock + 5) {
          const existing = txHashMap.get(idx);
          if (existing && !existing.spendTx) {
            existing.spendTx = spendEv.transactionHash;
            break;
          }
        }
      }
    }

    const tasks = [];
    const start = Math.max(0, count - 20);
    for (let i = count - 1; i >= start; i--) {
      try {
        const r = await verifier.getReceipt(i);
        tasks.push({
          index: i,
          taskHash: r.taskHash,
          intentCategory: r.intentCategory,
          cost: ethers.formatEther(r.cost),
          fieldsHidden: Number(r.fieldsHidden),
          fieldsRevealed: Number(r.fieldsRevealed),
          success: r.success,
          timestamp: Number(r.timestamp),
          date: new Date(Number(r.timestamp) * 1000).toISOString(),
          txHash: txHashMap.get(i)?.spendTx || txHashMap.get(i)?.receiptTx || null,
        });
      } catch {
        // skip bad receipts
      }
    }

    res.json({ total: count, tasks });
  } catch (error: any) {
    // Return empty history instead of 500 — prevents console errors
    res.json({ total: 0, tasks: [], error: error.message });
  }
});

// ── Per-user transaction history ──
app.get("/user/history", async (req, res) => {
  try {
    const userAddr = req.query.user as string;
    if (!userAddr) {
      res.status(400).json({ error: "user query param required" });
      return;
    }
    const { getUserHistory } = await import("./execution/user-history.js");
    const transactions = getUserHistory(userAddr);
    res.json({ total: transactions.length, tasks: transactions });
  } catch (error: any) {
    res.json({ total: 0, tasks: [] });
  }
});

// ── Vault balance (per-user) ──
app.get("/vault/balance", async (req, res) => {
  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(config.baseSepoliaRpc);
    const userAddr = req.query.user as string;

    const vault = new ethers.Contract(
      config.shadeVault,
      [
        "function getBalance() external view returns (uint256)",
        "function getUserBalance(address) external view returns (uint256)",
        "function getRemainingDailyBudget() external view returns (uint256)",
        "function maxPerTx() external view returns (uint256)",
        "function dailyBudget() external view returns (uint256)",
      ],
      provider
    );

    const calls: Promise<any>[] = [
      vault.getRemainingDailyBudget(),
      vault.maxPerTx(),
      vault.dailyBudget(),
    ];

    // If user address provided, get their balance. Otherwise get total.
    if (userAddr && userAddr.startsWith("0x")) {
      calls.unshift(vault.getUserBalance(userAddr));
    } else {
      calls.unshift(vault.getBalance());
    }

    const [balance, remaining, maxPerTx, dailyBudget] = await Promise.all(calls);

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

// ── DCA: Create order ──
app.post("/dca/create", async (req, res) => {
  const { type, targetPrice, amount, recipient, userAddress } = req.body;

  if (!type || !targetPrice || !amount || !recipient) {
    res.status(400).json({ error: "type, targetPrice, amount, and recipient are required" });
    return;
  }

  try {
    const { createOrder, getETHPrice } = await import("./execution/dca-monitor.js");
    const currentPrice = await getETHPrice();
    const order = createOrder({ type, targetPrice, amount, currency: "ETH", recipient, userAddress: userAddress || "" });

    console.log(`[DCA] Order created: ${type} $${targetPrice} → ${amount} ETH to ${recipient.slice(0, 10)}...`);

    res.json({ order, currentPrice });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DCA: List orders ──
app.get("/dca/orders", async (req, res) => {
  try {
    const { getOrders, getETHPrice } = await import("./execution/dca-monitor.js");
    const userAddr = req.query.user as string;
    let orders = getOrders();
    if (userAddr) {
      orders = orders.filter((o: any) => o.userAddress && o.userAddress.toLowerCase() === userAddr.toLowerCase());
    }
    const currentPrice = await getETHPrice();
    res.json({ orders, currentPrice });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DCA: Cancel order ──
app.post("/dca/cancel/:id", async (req, res) => {
  try {
    const { cancelOrder } = await import("./execution/dca-monitor.js");
    const cancelled = cancelOrder(req.params.id);
    res.json({ cancelled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Locus Status ──
app.get("/locus/status", async (_req, res) => {
  try {
    const { getBalance } = await import("./payments/locus.js");
    const balance = await getBalance(config.locusApiKey);
    res.json({
      connected: true,
      balance: balance.usdc_balance || "0",
      wallet: balance.wallet_address || "",
      chain: "Base",
      currency: "USDC",
    });
  } catch (error: any) {
    res.json({ connected: false, balance: "0", wallet: "", chain: "Base", currency: "USDC", error: error.message });
  }
});

// ── ENS Resolution ──
app.get("/ens/resolve/:name", async (req, res) => {
  try {
    const { resolveENS } = await import("./identity/ens.js");
    const address = await resolveENS(req.params.name);
    if (address) {
      res.json({ name: req.params.name, address, resolved: true });
    } else {
      res.json({ name: req.params.name, address: null, resolved: false });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/ens/lookup/:address", async (req, res) => {
  try {
    const { lookupENS } = await import("./identity/ens.js");
    const name = await lookupENS(req.params.address);
    res.json({ address: req.params.address, name, resolved: name !== null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DCA: Price + Chart cache ──
let priceCache: { price: number; change24h: number; timestamp: number } | null = null;
let chartCache: { line: any[]; ohlc: any[]; fetchedAt: number } | null = null;

async function refreshPriceCache() {
  // Try CoinGecko first
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true"
    );
    if (res.ok) {
      const data = await res.json();
      if (data.ethereum?.usd) {
        priceCache = {
          price: data.ethereum.usd,
          change24h: data.ethereum.usd_24h_change || 0,
          timestamp: Date.now(),
        };
        return;
      }
    }
  } catch { /* try fallback */ }

  // Fallback: CoinLore (no API key, no rate limit)
  try {
    const res = await fetch("https://api.coinlore.net/api/ticker/?id=80");
    const data = await res.json();
    if (data?.[0]?.price_usd) {
      priceCache = {
        price: parseFloat(data[0].price_usd),
        change24h: parseFloat(data[0].percent_change_24h || "0"),
        timestamp: Date.now(),
      };
    }
  } catch { /* keep old cache */ }
}

async function refreshChartCache() {
  try {
    const lineRes = await fetch("https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=1");
    const lineData = await lineRes.json();
    
    const prices = lineData.prices || [];
    const chunkSize = Math.max(1, Math.floor(prices.length / 96));
    const ohlc = [];
    
    for (let i = 0; i < prices.length; i += chunkSize) {
      const chunk = prices.slice(i, i + chunkSize);
      const open = chunk[0][1];
      const close = chunk[chunk.length - 1][1];
      const high = Math.max(...chunk.map((p: any) => p[1]));
      const low = Math.min(...chunk.map((p: any) => p[1]));
      ohlc.push([chunk[0][0], open, high, low, close]);
    }
    
    chartCache = {
      line: prices,
      ohlc,
      fetchedAt: Date.now(),
    };
  } catch { /* keep old cache */ }
}

// Pre-fetch on server start
refreshPriceCache();
refreshChartCache();
// Refresh price every 30s, chart every 5 min
setInterval(refreshPriceCache, 30000);
setInterval(refreshChartCache, 300000);

app.get("/dca/price", async (_req, res) => {
  if (!priceCache) await refreshPriceCache();
  res.json(priceCache || { price: 0, change24h: 0, timestamp: Date.now() });
});

app.get("/dca/chart", async (_req, res) => {
  if (!chartCache) await refreshChartCache();
  res.json(chartCache || { line: [], ohlc: [] });
});

// ── Recurring Payments ──
app.post("/recurring/create", async (req, res) => {
  const { recipient, amount, interval, userAddress } = req.body;
  if (!recipient || !amount || !interval) {
    res.status(400).json({ error: "recipient, amount, and interval required" });
    return;
  }
  try {
    const { createRecurring } = await import("./execution/recurring.js");
    const payment = await createRecurring(recipient, amount, interval, userAddress);
    res.json({ payment });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/recurring/list", async (req, res) => {
  try {
    const { getRecurringPayments } = await import("./execution/recurring.js");
    const userAddr = req.query.user as string;
    let payments = getRecurringPayments();
    if (userAddr) {
      payments = payments.filter((p: any) => p.userAddress && p.userAddress.toLowerCase() === userAddr.toLowerCase());
    }
    res.json({ payments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/recurring/cancel/:id", async (req, res) => {
  try {
    const { cancelRecurring } = await import("./execution/recurring.js");
    res.json({ cancelled: cancelRecurring(req.params.id) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/recurring/intervals", async (_req, res) => {
  try {
    const { getIntervals } = await import("./execution/recurring.js");
    res.json({ intervals: getIntervals() });
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
