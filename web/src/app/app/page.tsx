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
import { TaskHistory } from "@/components/TaskHistory";
import { ResultTabs } from "@/components/ResultTabs";
import { QRPayment } from "@/components/QRPayment";
import dynamic from "next/dynamic";
const ExportPDF = dynamic(
  () =>
    import("@/components/ExportPDF").then((m) => ({ default: m.ExportPDF })),
  { ssr: false },
);

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API || "http://localhost:3001";

const QUICK_TASKS = [
  {
    label: "Send ETH privately",
    desc: "Transfer ETH without revealing your identity",
    hint: "Click to fill template",
    method: "ShadeVault",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    template: "Send 0.0001 ETH to [paste address or ENS here] privately",
  },
  {
    label: "Pay with USDC",
    desc: "Private USDC payment via Locus",
    hint: "Click to fill template",
    method: "Locus",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M15 9.5c-.5-1-1.5-1.5-3-1.5s-3 .7-3 2 1.2 2 3 2.5 3 1 3 2.5-1.5 2-3 2-2.5-.5-3-1.5" />
      </svg>
    ),
    template: "Send $1 USDC to [paste address or ENS] via Locus",
  },
  {
    label: "Donate anonymously",
    desc: "Support a cause no one knows it was you",
    hint: "Click to fill template",
    method: "ShadeVault",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    template: "Donate 0.0005 ETH anonymously to [paste address or ENS here]",
  },
  {
    label: "Set price alert",
    desc: "Auto-execute when ETH hits your target",
    hint: "Click to fill template",
    method: "DCA",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    template:
      "Send 0.0001 ETH to [paste address or ENS] when ETH drops below $2000",
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
  dcaOrder: {
    id: string;
    type: "price_above" | "price_below";
    targetPrice: number;
    amount: number;
    status: string;
    currentPrice?: number;
  } | null;
  logEntries: Array<{
    time: string;
    action: string;
    type: string;
    detail?: string;
  }>;
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
  const [showQR, setShowQR] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
      setLiveLog([
        {
          time: new Date().toTimeString().slice(0, 8),
          action: "Initializing private agent pipeline...",
          type: "reasoning",
          detail: "Venice AI",
        },
      ]);

      try {
        const res = await fetch(`${API_BASE}/task`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: taskStr }),
        });
        const data: TaskResult = await res.json();
        if (!res.ok) throw new Error("Agent request failed");
        setResult(data);
        setLiveLog(
          (data.logEntries || []).map((e) => ({
            time: e.time,
            action: e.action,
            type: e.type as LogEntry["type"],
            detail: e.detail,
          })),
        );
        setState("complete");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to connect to agent");
        setState("error");
      }
    },
    [isConnected, openConnectModal],
  );

  const handleReset = useCallback(() => {
    setState("idle");
    setTask("");
    setResult(null);
    setLiveLog([]);
    setErrorMsg("");
  }, []);

  const isGeneral = result?.taskType === "general";
  const isDCA = result?.taskType === "dca_order";
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
                    className="flex items-center gap-1.5 text-[11px] font-mono text-text-3 hover:text-gold transition-colors group px-2.5 py-1 rounded-lg hover:bg-gold/5 -mx-1"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-gold/60 group-hover:text-gold"
                    >
                      <rect x="2" y="6" width="20" height="14" rx="2" />
                      <path d="M2 10h20" />
                    </svg>
                    <span className="text-gold">{vaultBalance || "0"} ETH</span>
                    <span className="text-[9px] text-text-3/40 group-hover:text-gold/60 transition-colors">
                      Deposit
                    </span>
                  </button>
                  <span className="text-white/[0.08]">|</span>
                  <span className="text-[11px] font-mono text-text-3">
                    {stats?.taskCount ?? 0} tasks
                  </span>
                  {stats?.taskCount ? (
                    <>
                      <span className="text-white/[0.08]">|</span>
                      <span className="text-[11px] font-mono text-gold">
                        {stats.privacyScore}% private
                      </span>
                    </>
                  ) : null}
                </>
              ) : (
                <span className="text-[11px] font-mono text-text-3">
                  Connect wallet to begin
                </span>
              )}
            </div>
            {state === "running" && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" />
                <span className="text-[11px] font-mono text-gold">
                  Processing
                </span>
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
                  {isConnected &&
                    vaultBalance !== null &&
                    parseFloat(vaultBalance) === 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass rounded-xl p-4 mb-6 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--color-gold)"
                              strokeWidth="2"
                            >
                              <path d="M12 2v20M2 12h20" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-[13px] text-text">
                              Vault is empty
                            </p>
                            <p className="text-[11px] text-text-3">
                              Deposit ETH to execute private on-chain tasks
                            </p>
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
                        Describe an on-chain task. Shade will execute it without
                        revealing your identity.
                      </p>
                    </motion.div>

                    {/* Input */}
                    <motion.form
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (inputValue.trim()) handleSubmit(inputValue.trim());
                      }}
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-6">
                      {QUICK_TASKS.map((qt, i) => (
                        <motion.button
                          key={qt.label}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.35 + i * 0.08 }}
                          onClick={() => setInputValue(qt.template)}
                          className="text-left glass rounded-xl px-4 py-4 hover:border-white/[0.1] transition-all group stat-card cursor-pointer"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center text-text-3 group-hover:text-gold transition-colors">
                              {qt.icon}
                            </div>
                            <span className="text-[10px] font-mono text-text-3/60 uppercase tracking-wider">
                              {qt.method}
                            </span>
                          </div>
                          <span className="text-[13px] text-text block">
                            {qt.label}
                          </span>
                          <span className="text-[11px] text-text-3 mt-0.5 block">
                            {qt.desc}
                          </span>
                          <span className="text-[9px] font-mono text-gold/0 group-hover:text-gold/60 mt-1.5 block transition-colors">
                            {qt.hint} &rarr;
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
                    className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-auto pt-8"
                  >
                    {[
                      {
                        label: "Tasks",
                        value: stats?.taskCount ?? 0,
                        sub: "On-chain verified",
                        accent: false,
                      },
                      {
                        label: "Success",
                        value: stats?.successCount ?? 0,
                        sub: "Completed",
                        accent: false,
                      },
                      {
                        label: "Privacy",
                        value: stats?.taskCount
                          ? `${stats.privacyScore}%`
                          : "\u2014",
                        sub: "Aggregate score",
                        accent: true,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="glass rounded-xl px-4 py-3.5"
                      >
                        <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">
                          {s.label}
                        </p>
                        <p
                          className={`text-xl font-mono ${s.accent ? "text-gold" : "text-text"}`}
                        >
                          {s.value}
                        </p>
                        <p className="text-[10px] font-mono text-text-3/60 mt-0.5">
                          {s.sub}
                        </p>
                      </div>
                    ))}

                    {/* Vault deposit card */}
                    <button
                      onClick={() => setShowDeposit(true)}
                      className="glass rounded-xl px-4 py-3.5 stat-card text-left group hover:border-gold/20 transition-colors cursor-pointer"
                    >
                      <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">
                        Vault Balance
                      </p>
                      <p className="text-xl font-mono text-gold">
                        {vaultBalance ? `${vaultBalance}` : "\u2014"}{" "}
                        <span className="text-[12px] text-text-3/40">ETH</span>
                      </p>
                      <p className="text-[10px] font-mono text-text-3/40 group-hover:text-gold/60 mt-0.5 transition-colors">
                        Click to deposit &rarr;
                      </p>
                    </button>
                  </motion.div>

                  {/* Transaction history */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-4"
                  >
                    <TaskHistory refreshKey={refreshKey} />
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
                      <div
                        className="absolute inset-0 rounded-full bg-gold/5 animate-ping"
                        style={{ animationDuration: "3s" }}
                      />
                      <div
                        className="absolute inset-2 rounded-full bg-gold/10 animate-ping"
                        style={{
                          animationDuration: "3s",
                          animationDelay: "0.5s",
                        }}
                      />
                      <div className="relative w-20 h-20 rounded-full glass flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-gold animate-pulse-dot" />
                      </div>
                    </div>

                    <h2 className="font-serif text-2xl text-text mb-2">
                      Processing privately
                    </h2>
                    <p className="text-[13px] text-text-3 mb-8 max-w-sm mx-auto">
                      Venice AI is reasoning about your task with zero data
                      retention. No prompts stored. No responses logged.
                    </p>

                    {/* Task */}
                    <div className="glass rounded-xl p-4 mb-4 text-left">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">
                        Task
                      </p>
                      <p className="text-[13px] font-mono text-text truncate">
                        {task}
                      </p>
                    </div>

                    {/* Live activity */}
                    <div className="glass rounded-xl p-4 text-left">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">
                          Live Activity
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {liveLog.slice(-4).map((entry, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-2"
                          >
                            <span className="text-[10px] text-text-3 font-mono shrink-0 mt-0.5 w-12">
                              {entry.time}
                            </span>
                            <span className="text-[12px] text-text-2 font-mono">
                              {entry.action}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Shimmer bar */}
                    <div className="mt-6 h-0.5 w-full rounded-full overflow-hidden bg-white/[0.03]">
                      <div
                        className="h-full shimmer rounded-full"
                        style={{ width: "100%" }}
                      />
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
                      className="glass rounded-2xl p-8 max-w-lg mx-auto"
                    >
                      {/* Back button */}
                      <button
                        onClick={handleReset}
                        className="text-[12px] font-mono text-text-3 hover:text-text transition-colors flex items-center gap-1.5 mb-6"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back
                      </button>

                      {/* User message */}
                      <div className="flex justify-end mb-4">
                        <div className="bg-white/[0.04] rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                          <p className="text-[13px] text-text font-mono">
                            {task}
                          </p>
                        </div>
                      </div>

                      {/* Shade response */}
                      <div className="flex justify-start">
                        <div className="max-w-[90%]">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded-md bg-gold/10 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                            </div>
                            <span className="text-[11px] font-mono text-gold">
                              Shade
                            </span>
                          </div>
                          <p className="text-[14px] text-text-2 leading-relaxed mb-4">
                            I appreciate the message! But I&apos;m specifically
                            built for private on-chain actions — I can send ETH,
                            make payments, or donate anonymously without ever
                            revealing your identity.
                          </p>
                          <p className="text-[12px] text-text-3 mb-3">
                            Here, try one of these:
                          </p>
                          <div className="flex flex-col gap-2">
                            {[
                              {
                                label: "Private transfer",
                                task: `Transfer 0.0001 ETH from vault to ${address || "0x..."} privately`,
                              },
                              {
                                label: "Anonymous donation",
                                task: `Donate 0.00005 ETH anonymously to ${address || "0x..."}`,
                              },
                            ].map((example) => (
                              <button
                                key={example.label}
                                onClick={() => handleSubmit(example.task)}
                                className="text-left glass rounded-lg px-4 py-3 group hover:border-gold/20 transition-colors"
                              >
                                <span className="text-[12px] text-text block">
                                  {example.label}
                                </span>
                                <span className="text-[10px] font-mono text-text-3/50 group-hover:text-gold/60 transition-colors">
                                  {example.task.length > 45
                                    ? example.task.slice(0, 45) + "..."
                                    : example.task}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* DCA order created */}
                  {isDCA && result.dcaOrder && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="glass rounded-2xl p-8 max-w-lg mx-auto"
                    >
                      <button
                        onClick={handleReset}
                        className="text-[12px] font-mono text-text-3 hover:text-text transition-colors flex items-center gap-1.5 mb-6"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back
                      </button>

                      <div className="flex items-start gap-4 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--color-gold)"
                            strokeWidth="2"
                          >
                            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                            <polyline points="16 7 22 7 22 13" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-[15px] text-text font-medium">
                            DCA Order Active
                          </h3>
                          <p className="text-[12px] text-text-3 mt-1">
                            Monitoring ETH price every 30 seconds. Will execute
                            privately when triggered.
                          </p>
                        </div>
                      </div>

                      <div className="glass rounded-xl p-4 space-y-3 mb-5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-text-3">
                            Condition
                          </span>
                          <span className="text-[12px] font-mono text-text">
                            ETH{" "}
                            {result.dcaOrder.type === "price_below"
                              ? "drops below"
                              : "rises above"}{" "}
                            ${result.dcaOrder.targetPrice.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-text-3">
                            Action
                          </span>
                          <span className="text-[12px] font-mono text-text">
                            Send {result.dcaOrder.amount} ETH privately
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-text-3">
                            Current Price
                          </span>
                          <span className="text-[12px] font-mono text-gold">
                            $
                            {result.dcaOrder.currentPrice?.toLocaleString() ||
                              "..."}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-text-3">
                            Status
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" />
                            <span className="text-[12px] font-mono text-gold">
                              Monitoring
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-text-3">
                            Method
                          </span>
                          <span className="text-[12px] font-mono text-text-3">
                            ShadeVault (private)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono text-text-3/60">
                        <div className="w-1 h-1 rounded-full bg-safe" />
                        <span>
                          Your identity stays hidden — agent wallet executes all
                          trades
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {/* Execution failed */}
                  {!isGeneral && !isDCA && execFailed && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-gold mb-1">
                            Execution Failed
                          </p>
                          <h2 className="text-lg font-mono text-text">
                            {task}
                          </h2>
                        </div>
                        <button
                          onClick={handleReset}
                          className="px-4 py-2 rounded-xl glass font-mono text-[12px] text-text-2 hover:text-text transition-colors flex items-center gap-2"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                          </svg>
                          Back
                        </button>
                      </div>

                      <div className="rounded-xl border border-exposed/15 bg-exposed/[0.06] p-5">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-exposed/10 flex items-center justify-center shrink-0 mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-exposed" />
                          </div>
                          <div>
                            <p className="text-[13px] text-text font-medium mb-1">
                              {result.execution!.method === "locus"
                                ? "Locus Payment Failed"
                                : "Vault Transfer Failed"}
                            </p>
                            <p className="text-[12px] text-text-3 mb-3">
                              {result.execution!.error}
                            </p>
                            {result.execution!.method === "vault" &&
                              result.execution!.error?.includes(
                                "Insufficient",
                              ) && (
                                <button
                                  onClick={() => setShowDeposit(true)}
                                  className="px-4 py-2 rounded-lg bg-gold/10 border border-gold/20 font-mono text-[11px] text-gold hover:bg-gold/20 transition-colors"
                                >
                                  Deposit ETH to Vault
                                </button>
                              )}
                            {result.execution!.method === "locus" && (
                              <p className="text-[11px] text-text-3 font-mono">
                                Locus credits pending. Try a vault transfer
                                instead.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <ResultTabs
                        tabs={[
                          {
                            id: "activity",
                            label: "Activity Log",
                            content: (
                              <ActivityLog entries={liveLog} autoPlay={false} />
                            ),
                          },
                          {
                            id: "comparison",
                            label: "Comparison",
                            content: (
                              <ComparisonView
                                manifest={result.disclosureManifest}
                                task={task}
                              />
                            ),
                          },
                        ]}
                      />
                    </>
                  )}

                  {/* Successful execution */}
                  {!isGeneral && !isDCA && execSuccess && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-safe" />
                            <p className="text-[10px] font-mono uppercase tracking-wider text-safe">
                              Task Complete
                            </p>
                          </div>
                          <h2 className="text-lg font-mono text-text">
                            {task}
                          </h2>
                        </div>
                        <div className="flex items-center gap-3">
                          <PrivacyScore
                            score={result.privacyScore}
                            fieldsHidden={result.fieldsHidden}
                            fieldsTotal={
                              result.fieldsHidden + result.fieldsRevealed
                            }
                            animate={true}
                          />
                          <button
                            onClick={handleReset}
                            className="px-4 py-2 rounded-xl glass font-mono text-[12px] text-text-3 hover:text-text transition-colors"
                          >
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
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--color-safe)"
                              strokeWidth="2"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-[14px] font-mono text-text">
                              {result.execution!.amount}{" "}
                              {result.execution!.currency} sent via{" "}
                              {result.execution!.method === "locus"
                                ? "Locus"
                                : "ShadeVault"}
                            </p>
                            {result.execution!.txHash && (
                              <a
                                href={`https://sepolia.basescan.org/tx/${result.execution!.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-gold hover:text-gold-dim transition-colors inline-flex items-center gap-1 mt-0.5"
                              >
                                Verify on BaseScan
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div
                          className="flex items-center gap-3 px-4 py-3 rounded-xl glass hover:border-gold/20 transition-colors cursor-pointer group"
                          onClick={() => {
                            const el =
                              document.querySelector<HTMLButtonElement>(
                                "[data-export-pdf]",
                              );
                            el?.click();
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--color-gold)"
                              strokeWidth="1.5"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </div>
                          <div>
                            <span className="text-[12px] text-text block">
                              Export Report
                            </span>
                            <span className="text-[10px] text-text-3/50 font-mono">
                              Download PDF audit log
                            </span>
                          </div>
                        </div>
                        <div className="hidden">
                          <ExportPDF
                            task={task}
                            privacyScore={result.privacyScore}
                            fieldsHidden={result.fieldsHidden}
                            fieldsRevealed={result.fieldsRevealed}
                            intentCategory={result.intentCategory}
                            cost={result.cost}
                            logEntries={liveLog}
                            manifest={result.disclosureManifest}
                            execution={result.execution}
                          />
                        </div>
                        <button
                          onClick={() => setShowQR(true)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl glass hover:border-gold/20 transition-colors cursor-pointer group text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--color-gold)"
                              strokeWidth="1.5"
                            >
                              <rect x="3" y="3" width="7" height="7" />
                              <rect x="14" y="3" width="7" height="7" />
                              <rect x="3" y="14" width="7" height="7" />
                              <rect x="14" y="14" width="3" height="3" />
                              <line x1="21" y1="14" x2="21" y2="21" />
                              <line x1="14" y1="21" x2="21" y2="21" />
                            </svg>
                          </div>
                          <div>
                            <span className="text-[12px] text-text block">
                              Payment QR
                            </span>
                            <span className="text-[10px] text-text-3/50 font-mono">
                              Scannable payment link
                            </span>
                          </div>
                        </button>
                      </div>

                      <ResultTabs
                        tabs={[
                          {
                            id: "comparison",
                            label: "Comparison",
                            content: (
                              <ComparisonView
                                manifest={result.disclosureManifest}
                                task={task}
                              />
                            ),
                          },
                          {
                            id: "activity",
                            label: "Activity Log",
                            content: (
                              <ActivityLog entries={liveLog} autoPlay={false} />
                            ),
                          },
                          {
                            id: "report",
                            label: "Privacy Report",
                            content: (
                              <PrivacyReport
                                task={task}
                                cost={result.cost}
                                fieldsHidden={result.fieldsHidden}
                                fieldsRevealed={result.fieldsRevealed}
                                manifest={result.disclosureManifest}
                              />
                            ),
                          },
                        ]}
                      />
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
                    <h3 className="text-[15px] text-text font-medium mb-2">
                      Connection Failed
                    </h3>
                    <p className="text-[13px] text-text-3 mb-2">{errorMsg}</p>
                    <p className="text-[11px] text-text-3/50 font-mono mb-6">
                      Is the agent running? cd agent && pnpm dev
                    </p>
                    <button
                      onClick={handleReset}
                      className="px-5 py-2.5 rounded-xl glass font-mono text-[12px] text-text-2 hover:text-text transition-colors"
                    >
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
      <QRPayment open={showQR} onClose={() => setShowQR(false)} />
    </div>
  );
}
