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
    budget: "Vault",
    icon: "\u26A1",
    task: "Transfer 0.0001 ETH from vault to 0x000000000000000000000000000000000000dEaD privately",
  },
  {
    label: "Private USDC payment",
    desc: "Send $1 via Locus",
    budget: "Locus",
    icon: "\u26BF",
    task: "Send $1 USDC to 0x000000000000000000000000000000000000dEaD privately via Locus",
  },
  {
    label: "Anonymous donation",
    desc: "Donate 0.00005 ETH",
    budget: "Vault",
    icon: "\u2665",
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
  execution: { success: boolean; txHash: string | null; method: string; amount: number; currency: string; recipient: string; error?: string } | null;
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

  // Fetch on-chain stats + vault balance
  useEffect(() => {
    fetch(`${API_BASE}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
    fetch(`${API_BASE}/vault/balance`)
      .then((r) => r.json())
      .then((d) => setVaultBalance(d.balance))
      .catch(() => {});
  }, [state, refreshKey]);

  const handleSubmit = useCallback(
    async (taskStr: string) => {
      if (!isConnected) {
        openConnectModal?.();
        return;
      }

      setTask(taskStr);
      setState("running");
      setInputValue("");
      setResult(null);
      setErrorMsg("");

      // Show initial "thinking" log entry
      setLiveLog([
        {
          time: new Date().toTimeString().slice(0, 8),
          action: "Sending task to Shade agent...",
          type: "reasoning",
          detail: "private inference",
        },
      ]);

      try {
        const res = await fetch(`${API_BASE}/task`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: taskStr }),
        });

        const data: TaskResult = await res.json();

        if (!res.ok) {
          throw new Error(data.task || "Agent request failed");
        }

        // Map backend log entries to our LogEntry format
        const mappedLog: LogEntry[] = (data.logEntries || []).map((e) => ({
          time: e.time,
          action: e.action,
          type: e.type as LogEntry["type"],
          detail: e.detail,
        }));

        setResult(data);
        setLiveLog(mappedLog);
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

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Nav />

      <main className="flex-1 flex flex-col">
        {/* Status bar */}
        <div className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-5">
              {isConnected ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-safe" />
                    <span className="text-[11px] font-mono text-text-2">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                  </div>
                  <div className="h-3 w-px bg-border" />
                  <button
                    onClick={() => setShowDeposit(true)}
                    className="text-[11px] font-mono text-text-3 hover:text-text transition-colors"
                  >
                    Vault: <span className="text-gold">{vaultBalance ? `${vaultBalance} ETH` : "..."}</span>
                    <span className="text-text-3/50 ml-1">+</span>
                  </button>
                  <div className="h-3 w-px bg-border" />
                  <span className="text-[11px] font-mono text-text-3">
                    Tasks: <span className="text-text-2">{stats?.taskCount ?? 0}</span>
                  </span>
                </>
              ) : (
                <span className="text-[11px] font-mono text-text-3">
                  Wallet not connected
                </span>
              )}
            </div>
            {state !== "idle" && (
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    state === "running"
                      ? "bg-gold animate-pulse-dot"
                      : state === "error"
                        ? "bg-exposed"
                        : "bg-safe"
                  }`}
                />
                <span className="text-[11px] font-mono text-text-3">
                  {state === "running"
                    ? "Processing..."
                    : state === "error"
                      ? "Error"
                      : "Complete"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-8">
          <AnimatePresence mode="wait">
            {/* ── Idle state ── */}
            {state === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
                  {/* Deposit prompt when vault is empty */}
                  {isConnected && vaultBalance !== null && parseFloat(vaultBalance) === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full rounded-lg border border-gold/20 bg-gold-glow p-4 mb-8 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-[13px] text-text font-medium">Vault is empty</p>
                        <p className="text-[11px] text-text-3 mt-0.5">
                          Deposit ETH to start executing private tasks on-chain.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowDeposit(true)}
                        className="px-4 py-2 rounded-lg bg-gold text-bg font-mono text-[12px] font-medium hover:bg-gold-dim transition-colors shrink-0 ml-4"
                      >
                        Deposit
                      </button>
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full text-center mb-10"
                  >
                    <h1 className="font-serif text-3xl md:text-4xl text-text mb-3">
                      What should Shade do?
                    </h1>
                    <p className="text-text-3 text-[14px]">
                      Describe a task. Shade will execute it privately.
                    </p>
                  </motion.div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (inputValue.trim()) handleSubmit(inputValue.trim());
                    }}
                    className="w-full"
                  >
                    <div className="relative">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="e.g. Buy weather API access, max $5..."
                        className="w-full bg-surface border border-border rounded-xl px-5 py-4 pr-24 text-[15px] font-mono text-text placeholder:text-text-3/50 focus:outline-none focus:border-gold/30 transition-colors"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-gold/10 border border-gold/20 font-mono text-[12px] text-gold hover:bg-gold/20 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      >
                        Execute
                      </button>
                    </div>
                  </form>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-6">
                    {QUICK_TASKS.map((qt, i) => (
                      <motion.button
                        key={qt.label}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.08 }}
                        onClick={() => handleSubmit(qt.task)}
                        className="text-left px-4 py-3.5 rounded-lg border border-border bg-surface hover:border-border-light hover:bg-surface-2 transition-all group"
                      >
                        <span className="text-lg mb-1 block">{qt.icon}</span>
                        <span className="text-[13px] text-text block">{qt.label}</span>
                        <span className="text-[11px] text-text-3 font-mono block mt-0.5">{qt.desc}</span>
                        <span className="text-[10px] text-text-3/50 font-mono group-hover:text-gold transition-colors mt-1 block">
                          via {qt.budget}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Bottom stats — from on-chain data */}
                <div className="grid grid-cols-3 gap-4 mt-auto pt-8">
                  <div className="rounded-lg border border-border bg-surface px-4 py-3">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">
                      Tasks Completed
                    </p>
                    <p className="text-xl font-mono text-text">{stats?.taskCount ?? 0}</p>
                    <p className="text-[10px] font-mono text-text-3 mt-0.5">On-chain verified</p>
                  </div>
                  <div className="rounded-lg border border-border bg-surface px-4 py-3">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">
                      Privacy Score
                    </p>
                    <p className="text-xl font-mono text-gold">
                      {stats?.taskCount ? `${stats.privacyScore}%` : "—"}
                    </p>
                    <p className="text-[10px] font-mono text-text-3 mt-0.5">Aggregate</p>
                  </div>
                  <div className="rounded-lg border border-border bg-surface px-4 py-3">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">
                      Vault Balance
                    </p>
                    <p className="text-xl font-mono text-gold">
                      {vaultBalance ? `${vaultBalance} ETH` : "—"}
                    </p>
                    <p className="text-[10px] font-mono text-text-3 mt-0.5">Base Sepolia</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Running state ── */}
            {state === "running" && (
              <motion.div
                key="running"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">
                      Active Task
                    </p>
                    <h2 className="text-lg font-mono text-text">{task}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gold animate-pulse-dot" />
                    <span className="text-[13px] font-mono text-gold">
                      Agent is working...
                    </span>
                  </div>
                </div>

                {/* Live log while processing */}
                <ActivityLog entries={liveLog} autoPlay={false} />

                {/* Waiting indicator */}
                <div className="rounded-lg border border-border bg-surface p-8 text-center">
                  <div className="w-10 h-10 rounded-full border border-gold/30 bg-gold-glow mx-auto mb-4 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-gold animate-pulse-dot" />
                  </div>
                  <p className="text-[14px] text-text-2">
                    Venice AI is reasoning privately...
                  </p>
                  <p className="text-[12px] text-text-3 mt-1">
                    No prompts or responses are stored
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Complete state ── */}
            {state === "complete" && result && (() => {
              const isGeneral = result.taskType === "general";
              const execFailed = result.execution && !result.execution.success;
              const execSuccess = result.execution && result.execution.success;

              return (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  {/* ── Non-executable task (like "hi") ── */}
                  {isGeneral && (
                    <div className="rounded-lg border border-border bg-surface p-10 text-center">
                      <div className="w-10 h-10 rounded-full border border-border bg-surface-2 mx-auto mb-4 flex items-center justify-center">
                        <span className="text-text-3 text-lg">?</span>
                      </div>
                      <h3 className="text-[16px] text-text font-medium mb-2">
                        Not an on-chain task
                      </h3>
                      <p className="text-[13px] text-text-3 max-w-sm mx-auto mb-6 leading-relaxed">
                        Shade executes privacy-preserving on-chain actions like payments,
                        transfers, and donations. Try one of the quick tasks below or
                        describe an on-chain action.
                      </p>
                      <p className="text-[11px] font-mono text-text-3 mb-6">
                        You said: <span className="text-text">&ldquo;{task}&rdquo;</span>
                      </p>
                      <button
                        onClick={handleReset}
                        className="px-5 py-2.5 rounded-lg bg-gold/10 border border-gold/20 font-mono text-[13px] text-gold hover:bg-gold/20 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {/* ── Execution failed (insufficient balance, etc.) ── */}
                  {!isGeneral && execFailed && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-gold mb-1">
                            Execution Failed
                          </p>
                          <h2 className="text-lg font-mono text-text">{task}</h2>
                        </div>
                        <button
                          onClick={handleReset}
                          className="px-4 py-2 rounded-lg border border-border font-mono text-[12px] text-text-3 hover:text-text hover:border-border-light transition-colors"
                        >
                          New Task
                        </button>
                      </div>

                      <div className="rounded-lg border border-exposed/20 bg-exposed-dim p-5">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-exposed mt-1.5 shrink-0" />
                          <div>
                            <p className="text-[13px] text-text font-medium mb-1">
                              {result.execution!.method === "locus" ? "Locus Payment Failed" : "Vault Transfer Failed"}
                            </p>
                            <p className="text-[12px] text-text-3 mb-3">
                              {result.execution!.error}
                            </p>
                            {result.execution!.method === "locus" && (
                              <p className="text-[11px] text-text-3 font-mono">
                                Locus credits pending approval. Try a vault transfer instead.
                              </p>
                            )}
                            {result.execution!.method === "vault" && result.execution!.error?.includes("Insufficient") && (
                              <button
                                onClick={() => setShowDeposit(true)}
                                className="mt-2 px-4 py-1.5 rounded-lg bg-gold/10 border border-gold/20 font-mono text-[11px] text-gold hover:bg-gold/20 transition-colors"
                              >
                                Deposit ETH to Vault
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <ComparisonView manifest={result.disclosureManifest} task={task} />
                      <ActivityLog entries={liveLog} autoPlay={false} />
                    </>
                  )}

                  {/* ── Successful execution ── */}
                  {!isGeneral && execSuccess && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-safe mb-1">
                            Task Complete
                          </p>
                          <h2 className="text-lg font-mono text-text">{task}</h2>
                        </div>
                        <div className="flex items-center gap-3">
                          <PrivacyScore
                            score={result.privacyScore}
                            fieldsHidden={result.fieldsHidden}
                            fieldsTotal={result.fieldsHidden + result.fieldsRevealed}
                            animate={true}
                          />
                          <button
                            onClick={handleReset}
                            className="px-4 py-2 rounded-lg border border-border font-mono text-[12px] text-text-3 hover:text-text hover:border-border-light transition-colors"
                          >
                            New Task
                          </button>
                        </div>
                      </div>

                      {/* Success banner with tx link */}
                      <div className="rounded-lg border border-safe/20 bg-safe-dim p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-safe" />
                          <div>
                            <p className="text-[13px] font-mono text-text">
                              {result.execution!.amount} {result.execution!.currency} sent via {result.execution!.method === "locus" ? "Locus" : "ShadeVault"}
                            </p>
                            {result.execution!.txHash && (
                              <a
                                href={`https://sepolia.basescan.org/tx/${result.execution!.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-gold hover:text-gold-dim transition-colors"
                              >
                                Verify on BaseScan: {result.execution!.txHash.slice(0, 20)}...
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

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
              );
            })()}

            {/* ── Error state ── */}
            {state === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex items-center justify-center"
              >
                <div className="rounded-lg border border-exposed/20 bg-exposed-dim p-8 text-center max-w-md">
                  <div className="w-2 h-2 rounded-full bg-exposed mx-auto mb-4" />
                  <h3 className="text-[15px] text-text font-medium mb-2">
                    Task Failed
                  </h3>
                  <p className="text-[13px] text-text-3 mb-4">{errorMsg}</p>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 rounded-lg border border-border font-mono text-[12px] text-text-3 hover:text-text transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <DepositModal
        open={showDeposit}
        onClose={() => setShowDeposit(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
        vaultBalance={vaultBalance}
      />
    </div>
  );
}
