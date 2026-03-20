"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Nav } from "@/components/Nav";
import { ComparisonView } from "@/components/ComparisonView";
import { ActivityLog, type LogEntry } from "@/components/ActivityLog";
import { PrivacyScore } from "@/components/PrivacyScore";
import { PrivacyReport } from "@/components/PrivacyReport";
import { DepositModal } from "@/components/DepositModal";

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API || "http://localhost:3001";

const QUICK_TASKS = [
  {
    label: "Private vault transfer",
    desc: "Send 0.0001 ETH to burn address",
    method: "ShadeVault",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    task: "Transfer 0.0001 ETH from vault to 0x000000000000000000000000000000000000dEaD privately",
  },
  {
    label: "Private USDC payment",
    desc: "Send $1 via Locus",
    method: "Locus",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M15 9.5c-.5-1-1.5-1.5-3-1.5s-3 .7-3 2 1.2 2 3 2.5 3 1 3 2.5-1.5 2-3 2-2.5-.5-3-1.5" />
      </svg>
    ),
    task: "Send $1 USDC to 0x000000000000000000000000000000000000dEaD privately via Locus",
  },
  {
    label: "Anonymous donation",
    desc: "Donate 0.00005 ETH",
    method: "ShadeVault",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    task: "Donate 0.00005 ETH anonymously to 0x000000000000000000000000000000000000dEaD",
  },
];

type AppState = "idle" | "running" | "complete" | "error";

interface TaskResult {
  success: boolean;
  task: string;
  taskType: string;
  privacyScore: number;
  fieldsHidden: number;
  fieldsRevealed: number;
  intentCategory: string;
  cost: number;
  privacyReport: string;
  disclosureManifest: any;
  execution: {
    success: boolean;
    txHash: string | null;
    method: string;
    amount: number;
    currency: string;
    recipient: string;
    error?: string;
  } | null;
  logEntries: Array<{ time: string; action: string; type: string; detail?: string }>;
}

interface AgentStats {
  taskCount: number;
  successCount: number;
  totalSpent: string;
  privacyScore: number;
}

export default function AppPage() {
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [state, setState] = useState<AppState>("idle");
  const [task, setTask] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [liveLog, setLiveLog] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [vaultBalance, setVaultBalance] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/stats`).then((r) => r.json()).then(setStats).catch(() => {});
    fetch(`${API_BASE}/vault/balance`).then((r) => r.json()).then((d) => setVaultBalance(d.balance)).catch(() => {});
  }, [state, refreshKey]);

  const handleSubmit = useCallback(
    async (taskStr: string) => {
      if (!isConnected) { openConnectModal?.(); return; }
      setTask(taskStr);
      setState("running");
      setInputValue("");
      setResult(null);
      setErrorMsg("");
      setLiveLog([{ time: new Date().toTimeString().slice(0, 8), action: "Initializing private agent pipeline...", type: "reasoning", detail: "Venice AI" }]);

      try {
        const res = await fetch(`${API_BASE}/task`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: taskStr }),
        });
        const data: TaskResult = await res.json();
        if (!res.ok) throw new Error("Agent request failed");
        setResult(data);
        setLiveLog((data.logEntries || []).map((e) => ({ time: e.time, action: e.action, type: e.type as LogEntry["type"], detail: e.detail })));
        setState("complete");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to connect to agent");
        setState("error");
      }
    },
    [isConnected, openConnectModal]
  );

  const handleReset = useCallback(() => {
    setState("idle");
    setTask("");
    setResult(null);
    setLiveLog([]);
    setErrorMsg("");
  }, []);

  const isGeneral = result?.taskType === "general";
  const execFailed = result?.execution && !result.execution.success;
  const execSuccess = result?.execution && result.execution.success;

  return (
    <div className="min-h-screen flex flex-col bg-bg relative">
      {/* Ambient background */}
      <div className="ambient-bg">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Nav />

        {/* Status ribbon */}
        <div className="border-b border-white/[0.04]">
          <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isConnected ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-safe" />
                    <span className="text-[11px] font-mono text-text-2">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                  </div>
                  <span className="text-white/[0.08]">|</span>
                  <button
                    onClick={() => setShowDeposit(true)}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-text-3 hover:text-gold transition-colors group"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold/60 group-hover:text-gold">
                      <rect x="2" y="6" width="20" height="14" rx="2" />
                      <path d="M2 10h20" />
                    </svg>
                    <span className="text-gold">{vaultBalance || "0"} ETH</span>
                  </button>
                  <span className="text-white/[0.08]">|</span>
                  <span className="text-[11px] font-mono text-text-3">
                    {stats?.taskCount ?? 0} tasks
                  </span>
                  {stats?.taskCount ? (
                    <>
                      <span className="text-white/[0.08]">|</span>
                      <span className="text-[11px] font-mono text-gold">{stats.privacyScore}% private</span>
                    </>
                  ) : null}
                </>
              ) : (
                <span className="text-[11px] font-mono text-text-3">Connect wallet to begin</span>
              )}
            </div>
            {state === "running" && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" />
                <span className="text-[11px] font-mono text-gold">Processing</span>
              </div>
            )}
          </div>
        </div>

        <main className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-8">
            <AnimatePresence mode="wait">

              {/* ════════════ IDLE STATE ════════════ */}
              {state === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="flex-1 flex flex-col"
                >
                  {/* Deposit prompt */}
                  {isConnected && vaultBalance !== null && parseFloat(vaultBalance) === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass rounded-xl p-4 mb-6 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2">
                            <path d="M12 2v20M2 12h20" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[13px] text-text">Vault is empty</p>
                          <p className="text-[11px] text-text-3">Deposit ETH to execute private on-chain tasks</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDeposit(true)}
                        className="px-4 py-2 rounded-lg bg-gold text-bg font-mono text-[12px] font-medium hover:bg-gold-dim transition-colors"
                      >
                        Deposit
                      </button>
                    </motion.div>
                  )}

                  {/* Center input area */}
                  <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-center mb-10"
                    >
                      <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center mx-auto mb-6">
                        <div className="w-3 h-3 rounded-full bg-gold animate-pulse-dot" />
                      </div>
                      <h1 className="font-serif text-3xl md:text-4xl text-text mb-3">
                        What should Shade do?
                      </h1>
                      <p className="text-text-3 text-[14px] max-w-sm mx-auto">
                        Describe an on-chain task. Shade will execute it without revealing your identity.
                      </p>
                    </motion.div>

                    {/* Input */}
                    <motion.form
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      onSubmit={(e) => { e.preventDefault(); if (inputValue.trim()) handleSubmit(inputValue.trim()); }}
                      className="w-full"
                    >
                      <div className="relative group">
                        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-gold/20 via-transparent to-gold/10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                        <div className="relative glass-strong rounded-2xl">
                          <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="e.g. Send 0.001 ETH to 0x... privately"
                            className="w-full bg-transparent rounded-2xl px-6 py-5 pr-28 text-[15px] font-mono text-text placeholder:text-text-3/40 focus:outline-none input-glow"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={!inputValue.trim()}
                            className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2.5 rounded-xl bg-gold/10 border border-gold/20 font-mono text-[12px] text-gold hover:bg-gold/20 hover:border-gold/30 transition-all disabled:opacity-20 disabled:pointer-events-none"
                          >
                            Execute
                          </button>
                        </div>
                      </div>
                    </motion.form>

                    {/* Quick tasks */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-6">
                      {QUICK_TASKS.map((qt, i) => (
                        <motion.button
                          key={qt.label}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.35 + i * 0.08 }}
                          onClick={() => handleSubmit(qt.task)}
                          className="text-left glass rounded-xl px-4 py-4 hover:border-white/[0.1] transition-all group stat-card"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center text-text-3 group-hover:text-gold transition-colors">
                              {qt.icon}
                            </div>
                            <span className="text-[10px] font-mono text-text-3/60 uppercase tracking-wider">
                              {qt.method}
                            </span>
                          </div>
                          <span className="text-[13px] text-text block">{qt.label}</span>
                          <span className="text-[11px] text-text-3 font-mono mt-0.5 block group-hover:text-text-2 transition-colors">
                            {qt.desc}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Bottom stats */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="grid grid-cols-3 gap-3 mt-auto pt-8"
                  >
                    {[
                      { label: "Tasks", value: stats?.taskCount ?? 0, sub: "On-chain verified", accent: false },
                      { label: "Privacy", value: stats?.taskCount ? `${stats.privacyScore}%` : "\u2014", sub: "Aggregate score", accent: true },
                      { label: "Vault", value: vaultBalance ? `${vaultBalance}` : "\u2014", sub: "ETH on Base Sepolia", accent: true },
                    ].map((s) => (
                      <div key={s.label} className="glass rounded-xl px-4 py-3.5 stat-card">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">{s.label}</p>
                        <p className={`text-xl font-mono ${s.accent ? "text-gold" : "text-text"}`}>{s.value}</p>
                        <p className="text-[10px] font-mono text-text-3/60 mt-0.5">{s.sub}</p>
                      </div>
                    ))}
                  </motion.div>
                </motion.div>
              )}

              {/* ════════════ RUNNING STATE ════════════ */}
              {state === "running" && (
                <motion.div
                  key="running"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex-1 flex flex-col items-center justify-center"
                >
                  <div className="w-full max-w-lg text-center">
                    {/* Animated shield */}
                    <div className="relative w-20 h-20 mx-auto mb-8">
                      <div className="absolute inset-0 rounded-full bg-gold/5 animate-ping" style={{ animationDuration: "3s" }} />
                      <div className="absolute inset-2 rounded-full bg-gold/10 animate-ping" style={{ animationDuration: "3s", animationDelay: "0.5s" }} />
                      <div className="relative w-20 h-20 rounded-full glass flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-gold animate-pulse-dot" />
                      </div>
                    </div>

                    <h2 className="font-serif text-2xl text-text mb-2">Processing privately</h2>
                    <p className="text-[13px] text-text-3 mb-8 max-w-sm mx-auto">
                      Venice AI is reasoning about your task with zero data retention.
                      No prompts stored. No responses logged.
                    </p>

                    {/* Task */}
                    <div className="glass rounded-xl p-4 mb-4 text-left">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">Task</p>
                      <p className="text-[13px] font-mono text-text truncate">{task}</p>
                    </div>

                    {/* Live activity */}
                    <div className="glass rounded-xl p-4 text-left">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Live Activity</span>
                      </div>
                      <div className="space-y-1.5">
                        {liveLog.slice(-4).map((entry, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-2"
                          >
                            <span className="text-[10px] text-text-3 font-mono shrink-0 mt-0.5 w-12">{entry.time}</span>
                            <span className="text-[12px] text-text-2 font-mono">{entry.action}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Shimmer bar */}
                    <div className="mt-6 h-0.5 w-full rounded-full overflow-hidden bg-white/[0.03]">
                      <div className="h-full shimmer rounded-full" style={{ width: "100%" }} />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ════════════ COMPLETE STATE ════════════ */}
              {state === "complete" && result && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-5"
                >
                  {/* Non-executable task */}
                  {isGeneral && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="glass rounded-2xl p-10 text-center"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] mx-auto mb-5 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </div>
                      <h3 className="text-[16px] text-text font-medium mb-2">Not an on-chain task</h3>
                      <p className="text-[13px] text-text-3 max-w-sm mx-auto mb-2">
                        Shade executes privacy-preserving on-chain actions — payments, transfers, and donations.
                      </p>
                      <p className="text-[11px] font-mono text-text-3/60 mb-6">
                        &ldquo;{task}&rdquo;
                      </p>
                      <button
                        onClick={handleReset}
                        className="px-5 py-2.5 rounded-xl glass font-mono text-[12px] text-text-2 hover:text-text transition-colors"
                      >
                        Try again
                      </button>
                    </motion.div>
                  )}

                  {/* Execution failed */}
                  {!isGeneral && execFailed && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-gold mb-1">Execution Failed</p>
                          <h2 className="text-lg font-mono text-text">{task}</h2>
                        </div>
                        <button onClick={handleReset} className="px-4 py-2 rounded-xl glass font-mono text-[12px] text-text-3 hover:text-text transition-colors">
                          New Task
                        </button>
                      </div>

                      <div className="rounded-xl border border-exposed/15 bg-exposed/[0.06] p-5">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-exposed/10 flex items-center justify-center shrink-0 mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-exposed" />
                          </div>
                          <div>
                            <p className="text-[13px] text-text font-medium mb-1">
                              {result.execution!.method === "locus" ? "Locus Payment Failed" : "Vault Transfer Failed"}
                            </p>
                            <p className="text-[12px] text-text-3 mb-3">{result.execution!.error}</p>
                            {result.execution!.method === "vault" && result.execution!.error?.includes("Insufficient") && (
                              <button
                                onClick={() => setShowDeposit(true)}
                                className="px-4 py-2 rounded-lg bg-gold/10 border border-gold/20 font-mono text-[11px] text-gold hover:bg-gold/20 transition-colors"
                              >
                                Deposit ETH to Vault
                              </button>
                            )}
                            {result.execution!.method === "locus" && (
                              <p className="text-[11px] text-text-3 font-mono">Locus credits pending. Try a vault transfer instead.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <ComparisonView manifest={result.disclosureManifest} task={task} />
                      <ActivityLog entries={liveLog} autoPlay={false} />
                    </>
                  )}

                  {/* Successful execution */}
                  {!isGeneral && execSuccess && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-safe" />
                            <p className="text-[10px] font-mono uppercase tracking-wider text-safe">Task Complete</p>
                          </div>
                          <h2 className="text-lg font-mono text-text">{task}</h2>
                        </div>
                        <div className="flex items-center gap-3">
                          <PrivacyScore
                            score={result.privacyScore}
                            fieldsHidden={result.fieldsHidden}
                            fieldsTotal={result.fieldsHidden + result.fieldsRevealed}
                            animate={true}
                          />
                          <button onClick={handleReset} className="px-4 py-2 rounded-xl glass font-mono text-[12px] text-text-3 hover:text-text transition-colors">
                            New Task
                          </button>
                        </div>
                      </div>

                      {/* Success banner */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-safe/15 bg-safe/[0.06] p-5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-safe/10 flex items-center justify-center shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-safe)" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-[14px] font-mono text-text">
                              {result.execution!.amount} {result.execution!.currency} sent via {result.execution!.method === "locus" ? "Locus" : "ShadeVault"}
                            </p>
                            {result.execution!.txHash && (
                              <a
                                href={`https://sepolia.basescan.org/tx/${result.execution!.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-gold hover:text-gold-dim transition-colors inline-flex items-center gap-1 mt-0.5"
                              >
                                Verify on BaseScan
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>

                      <ComparisonView manifest={result.disclosureManifest} task={task} />

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <ActivityLog entries={liveLog} autoPlay={false} />
                        <PrivacyReport
                          task={task}
                          cost={result.cost}
                          fieldsHidden={result.fieldsHidden}
                          fieldsRevealed={result.fieldsRevealed}
                          manifest={result.disclosureManifest}
                        />
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* ════════════ ERROR STATE ════════════ */}
              {state === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex items-center justify-center"
                >
                  <div className="glass rounded-2xl p-10 text-center max-w-md">
                    <div className="w-10 h-10 rounded-xl bg-exposed/10 flex items-center justify-center mx-auto mb-4">
                      <div className="w-2 h-2 rounded-full bg-exposed" />
                    </div>
                    <h3 className="text-[15px] text-text font-medium mb-2">Connection Failed</h3>
                    <p className="text-[13px] text-text-3 mb-2">{errorMsg}</p>
                    <p className="text-[11px] text-text-3/50 font-mono mb-6">Is the agent running? cd agent && pnpm dev</p>
                    <button onClick={handleReset} className="px-5 py-2.5 rounded-xl glass font-mono text-[12px] text-text-2 hover:text-text transition-colors">
                      Try again
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </main>
      </div>

      <DepositModal
        open={showDeposit}
        onClose={() => setShowDeposit(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
        vaultBalance={vaultBalance}
      />
    </div>
  );
}
