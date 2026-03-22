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
import { QRCodeSVG } from "qrcode.react";
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
  const [showLocusInfo, setShowLocusInfo] = useState(false);
  const [locusBalance, setLocusBalance] = useState<string | null>(null);
  const [locusWallet, setLocusWallet] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Fetch per-user stats from user history
    if (address) {
      fetch(`${API_BASE}/user/history?user=${address}`)
        .then((r) => r.json())
        .then((d) => {
          const tasks = d.tasks || [];
          const successCount = tasks.filter((t: any) => t.success).length;
          const totalFields = tasks.reduce((s: number, t: any) => s + t.fieldsHidden + t.fieldsRevealed, 0);
          const hiddenFields = tasks.reduce((s: number, t: any) => s + t.fieldsHidden, 0);
          const privacyScore = totalFields > 0 ? Math.round((hiddenFields / totalFields) * 100) : 0;
          setStats({
            taskCount: tasks.length,
            successCount,
            totalSpent: "0",
            privacyScore,
          });
        })
        .catch(() => {});
    } else {
      setStats(null);
    }
    // Only fetch user balance when wallet is connected
    if (address) {
      fetch(`${API_BASE}/vault/balance?user=${address}`)
        .then((r) => r.json())
        .then((d) => setVaultBalance(d.balance))
        .catch(() => {});
    } else {
      setVaultBalance(null);
    }
    fetch(`${API_BASE}/locus/status`)
      .then((r) => r.json())
      .then((d) => {
        setLocusBalance(d.balance || "0");
        setLocusWallet(d.wallet || "");
      })
      .catch(() => {});
  }, [state, refreshKey, address]);

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
          body: JSON.stringify({ task: taskStr, userAddress: address }),
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
        // Refresh balance after a short delay (wait for on-chain confirmation)
        setTimeout(() => setRefreshKey((k) => k + 1), 3000);
        setTimeout(() => setRefreshKey((k) => k + 1), 8000);
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
                    <span className="text-[9px] text-text-3/70 group-hover:text-gold/60 transition-colors">
                      Deposit
                    </span>
                  </button>
                  <span className="text-white/[0.08]">|</span>
                  <button
                    onClick={() => setShowLocusInfo(true)}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-text-3 hover:text-gold transition-colors group px-2.5 py-1 rounded-lg hover:bg-gold/5 -mx-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-safe/60 group-hover:text-safe">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v12M15 9.5c-.5-1-1.5-1.5-3-1.5s-3 .7-3 2 1.2 2 3 2.5 3 1 3 2.5-1.5 2-3 2-2.5-.5-3-1.5" />
                    </svg>
                    <span className="text-safe">${locusBalance || "0"}</span>
                    <span className="text-[9px] text-text-3/70 group-hover:text-safe/60 transition-colors">USDC</span>
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
                      <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 bg-gold/20 blur-xl rounded-full" />
                        <div className="relative w-14 h-14 rounded-2xl bg-surface/80 border border-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl">
                          <div className="w-3.5 h-3.5 rounded-full bg-gold animate-pulse-dot" />
                        </div>
                      </div>
                      <h1 className="font-serif text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40 mb-5 tracking-tight">
                        What should Shade do?
                      </h1>
                      <p className="text-white/40 text-[15px] max-w-md mx-auto leading-relaxed">
                        Describe an on-chain task. Shade uses <span className="text-gold/70 italic font-serif">Venice AI</span> to execute it without ever revealing your identity.
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
                      className="w-full relative z-20 group"
                    >
                      <div className="absolute -inset-6 bg-gold/5 blur-[40px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-700 pointer-events-none rounded-[100%]" />
                      <div className="relative bg-surface/50 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-gold/10 via-transparent to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 pointer-events-none" />
                        <input
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder="e.g. Send 0.001 ETH to 0x... privately"
                          className="relative w-full bg-transparent rounded-2xl px-6 py-5 md:py-6 pr-32 text-[15px] md:text-[16px] font-mono text-white placeholder:text-white/30 focus:outline-none placeholder:transition-opacity focus:placeholder:opacity-50"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={!inputValue.trim()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 md:py-3 rounded-xl bg-gold text-bg font-mono text-[13px] font-bold hover:bg-gold-dim hover:scale-105 transition-all disabled:opacity-30 disabled:scale-100 disabled:hover:bg-gold flex items-center gap-2 shadow-lg shadow-gold/20"
                        >
                          Execute
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </motion.form>

                    {/* Quick tasks */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-8 relative z-10">
                      {QUICK_TASKS.map((qt, i) => (
                        <motion.button
                          key={qt.label}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.35 + i * 0.08 }}
                          onClick={() => setInputValue(qt.template)}
                          className="text-left bg-surface/40 hover:bg-white/[0.04] border border-white/[0.05] hover:border-gold/30 rounded-2xl px-5 py-5 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-gold/5 cursor-pointer relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                          <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-8 h-8 rounded-xl bg-white/[0.04] group-hover:bg-gold/10 flex items-center justify-center text-white/40 group-hover:text-gold transition-colors duration-300 shadow-inner">
                                {qt.icon}
                              </div>
                              <span className="text-[9px] font-mono text-white/30 group-hover:text-gold/60 uppercase tracking-widest transition-colors duration-300">
                                {qt.method}
                              </span>
                            </div>
                            <span className="text-[14px] font-medium text-white/90 block mb-1">
                              {qt.label}
                            </span>
                            <span className="text-[12px] text-white/40 block leading-relaxed flex-1">
                              {qt.desc}
                            </span>
                            <span className="text-[10px] font-mono text-gold/0 group-hover:text-gold/80 mt-4 flex items-center gap-1.5 transition-colors duration-300">
                              {qt.hint} 
                              <span className="group-hover:translate-x-1 transition-transform duration-300">&rarr;</span>
                            </span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Bottom stats */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-auto pt-10 relative z-10"
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
                        className="bg-surface/30 backdrop-blur-md rounded-2xl px-5 py-4 border border-white/5 shadow-lg group hover:bg-white/[0.02] transition-colors"
                      >
                        <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                          {s.label}
                        </p>
                        <p
                          className={`text-2xl font-mono tracking-tight ${s.accent ? "text-gold drop-shadow-[0_0_12px_rgba(235,193,121,0.4)]" : "text-white/90"}`}
                        >
                          {s.value}
                        </p>
                        <p className="text-[10px] font-mono text-white/30 mt-1">
                          {s.sub}
                        </p>
                      </div>
                    ))}

                    {/* Vault deposit card */}
                    <button
                      onClick={() => setShowDeposit(true)}
                      className="bg-surface/30 backdrop-blur-md rounded-2xl px-5 py-4 text-left border border-white/5 shadow-lg group hover:border-gold/30 hover:bg-white/[0.04] transition-all cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <div className="relative z-10">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1.5">
                          Vault Balance
                        </p>
                        <p className="text-2xl font-mono text-gold drop-shadow-[0_0_12px_rgba(235,193,121,0.4)] tracking-tight">
                          {vaultBalance ? `${vaultBalance}` : "\u2014"}{" "}
                          <span className="text-[13px] text-white/40">ETH</span>
                        </p>
                        <p className="text-[10px] font-mono text-gold/60 mt-1 flex items-center gap-1 group-hover:text-gold/90 transition-colors">
                          Deposit <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                        </p>
                      </div>
                    </button>
                  </motion.div>

                  {/* Transaction history */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-4"
                  >
                    <TaskHistory refreshKey={refreshKey} userAddress={address} />
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
                  <div className="w-full max-w-lg text-center relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gold/10 blur-[80px] rounded-full pointer-events-none" />
                    
                    {/* Animated shield */}
                    <div className="relative w-24 h-24 mx-auto mb-10">
                      <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-gold/20 to-transparent animate-spin-slow rotate-45 mix-blend-screen" />
                      <div className="absolute inset-2 rounded-[2rem] bg-gradient-to-tl from-gold/20 to-transparent animate-spin-reverse-slow rotate-12 mix-blend-screen" />
                      <div
                        className="absolute inset-0 rounded-full bg-gold/5 animate-ping"
                        style={{ animationDuration: "3s" }}
                      />
                      <div
                        className="absolute inset-4 rounded-full bg-gold/10 animate-ping"
                        style={{ animationDuration: "3s", animationDelay: "0.5s" }}
                      />
                      <div className="relative w-24 h-24 rounded-full bg-surface/80 border border-gold/20 backdrop-blur-xl flex items-center justify-center shadow-[0_0_40px_-10px_rgba(235,193,121,0.3)]">
                        <div className="w-5 h-5 rounded-full bg-gold shadow-[0_0_20px_rgba(235,193,121,0.7)] animate-pulse-dot" />
                      </div>
                    </div>

                    <h2 className="font-serif text-4xl text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40 mb-4 tracking-tight">
                      Processing privately
                    </h2>
                    <p className="text-[15px] text-white/40 mb-10 max-w-sm mx-auto leading-relaxed">
                      <span className="text-gold/70 italic font-serif">Venice AI</span> is reasoning about your task with zero data retention. No prompts stored. No logs kept.
                    </p>

                    {/* Task */}
                    <div className="bg-surface/50 border border-white/5 backdrop-blur-xl rounded-2xl p-5 mb-6 text-left shadow-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                        <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                          Encrypted Task
                        </span>
                      </div>
                      <p className="text-[15px] font-mono text-white/90 truncate pl-5">
                        {task}
                      </p>
                    </div>

                    {/* Live activity */}
                    <div className="bg-surface/50 border border-white/5 backdrop-blur-xl rounded-2xl p-5 text-left shadow-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" />
                        <span className="text-[10px] font-mono uppercase tracking-widest text-gold/80">
                          Live Agent Activity
                        </span>
                      </div>
                      <div className="space-y-3">
                        {liveLog.slice(-4).map((entry, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-4 p-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                          >
                            <span className="text-[10px] text-white/30 font-mono shrink-0 mt-1 w-14 tracking-wider">
                              {entry.time}
                            </span>
                            <span className="text-[13px] text-white/80 font-mono leading-relaxed">
                              {entry.action}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Shimmer bar */}
                    <div className="mt-8 h-1 w-full rounded-full overflow-hidden bg-white/[0.03] shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-transparent via-gold/50 to-transparent animate-shimmer rounded-full"
                        style={{ width: "100%", backgroundSize: "200% 100%" }}
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
                      className="bg-surface/30 backdrop-blur-3xl rounded-3xl border border-white/5 p-8 max-w-lg mx-auto shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[50px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
                      
                      {/* Back button */}
                      <button
                        onClick={handleReset}
                        className="text-[12px] font-mono text-white/40 hover:text-white transition-colors flex items-center gap-2 mb-8 relative z-10 hover:-translate-x-0.5"
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
                        Back to Terminal
                      </button>

                      {/* User message */}
                      <div className="flex justify-end mb-6 relative z-10">
                        <div className="bg-white/[0.04] border border-white/5 rounded-2xl rounded-tr-sm px-5 py-3.5 max-w-[85%] shadow-md">
                          <p className="text-[14px] text-white/90 font-mono leading-relaxed">
                            {task}
                          </p>
                        </div>
                      </div>

                      {/* Shade response */}
                      <div className="flex justify-start relative z-10">
                        <div className="max-w-[90%]">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-gold/10 flex items-center justify-center border border-gold/20 shadow-inner">
                              <div className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_rgba(235,193,121,0.8)]" />
                            </div>
                            <span className="text-[12px] font-mono uppercase tracking-widest text-gold/80">
                              Shade Agent
                            </span>
                          </div>
                          <div className="bg-surface/50 border border-white/5 rounded-2xl rounded-tl-sm p-5 shadow-lg">
                            <p className="text-[15px] text-white/80 leading-relaxed mb-5 font-mono">
                              I interpret your intent clearly. However, my execution layer is specifically optimized for private on-chain actions — I can send ETH, stream payments, or execute swaps without revealing your identity.
                            </p>
                            <p className="text-[11px] uppercase tracking-widest text-white/30 mb-3 font-mono">
                              Suggested Execute Commands:
                            </p>
                            <div className="flex flex-col gap-3">
                              {[
                                {
                                  label: "Private Vault Transfer",
                                  task: `Transfer 0.0001 ETH from vault to ${address || "0x..."} privately`,
                                },
                                {
                                  label: "Anonymous Donation",
                                  task: `Donate 0.00005 ETH anonymously to ${address || "0x..."}`,
                                },
                              ].map((example) => (
                                <button
                                  key={example.label}
                                  onClick={() => handleSubmit(example.task)}
                                  className="text-left bg-surface/80 rounded-xl px-4 py-3.5 group border border-white/5 hover:border-gold/30 hover:bg-white/[0.03] transition-all hover:-translate-y-0.5 hover:shadow-lg"
                                >
                                  <span className="text-[13px] text-white/90 font-medium block mb-1">
                                    {example.label}
                                  </span>
                                  <span className="text-[11px] font-mono text-white/40 group-hover:text-gold/70 transition-colors block truncate">
                                    {example.task}
                                  </span>
                                </button>
                              ))}
                            </div>
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
                      className="bg-surface/30 backdrop-blur-3xl rounded-3xl border border-white/5 p-8 max-w-lg mx-auto shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-64 h-64 bg-gold/10 blur-[50px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />
                      
                      <button
                        onClick={handleReset}
                        className="text-[12px] font-mono text-white/40 hover:text-white transition-colors flex items-center gap-2 mb-8 relative z-10 hover:-translate-x-0.5"
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
                        Back to Terminal
                      </button>

                      <div className="flex items-start gap-5 mb-8 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center shrink-0 border border-gold/20 shadow-inner">
                          <svg
                            width="20"
                            height="20"
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
                          <h3 className="text-[18px] text-white/90 font-serif mb-1 tracking-tight">
                            Smart DCA Active
                          </h3>
                          <p className="text-[13px] text-white/50 leading-relaxed font-mono">
                            Monitoring price feed every 30s. Trigger executes via encrypted network pool.
                          </p>
                        </div>
                      </div>

                      <div className="bg-surface/60 rounded-2xl p-5 border border-white/5 space-y-4 mb-6 relative z-10 shadow-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono uppercase tracking-widest text-white/30">
                            Condition
                          </span>
                          <span className="text-[13px] font-mono text-white/90">
                            ETH{" "}
                            {result.dcaOrder.type === "price_below"
                              ? "falls below"
                              : "rises above"}{" "}
                            <span className="text-gold">${result.dcaOrder.targetPrice.toLocaleString()}</span>
                          </span>
                        </div>
                        <div className="w-full h-px bg-white/5" />
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono uppercase tracking-widest text-white/30">
                            Action
                          </span>
                          <span className="text-[13px] font-mono text-white/90">
                            Transfer {result.dcaOrder.amount} ETH
                          </span>
                        </div>
                        <div className="w-full h-px bg-white/5" />
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono uppercase tracking-widest text-white/30">
                            Current Price
                          </span>
                          <span className="text-[13px] font-mono text-white/50">
                            ShadeVault [Stealth]
                          </span>
                        </div>
                        <div className="w-full h-px bg-white/5" />
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono uppercase tracking-widest text-white/30">
                            Status
                          </span>
                          <div className="flex items-center gap-2 px-2.5 py-1 bg-gold/10 rounded-md border border-gold/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot shadow-[0_0_8px_rgba(235,193,121,0.8)]" />
                            <span className="text-[10px] font-mono uppercase tracking-widest text-gold">
                              Monitoring
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 mt-4 px-2 relative z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-safe mt-1 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                        <span className="text-[11px] font-mono text-white/40 leading-relaxed">
                          Your identity remains hidden. The agent wallet executes all parameters anonymously.
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
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-surface/30 backdrop-blur-3xl rounded-3xl border border-white/5 p-8 w-full max-w-4xl mx-auto shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-64 h-64 bg-safe/10 blur-[60px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
                      
                      <div className="flex items-center justify-between mb-8 relative z-10">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-safe shadow-[0_0_12px_rgba(52,211,153,0.6)] animate-pulse" />
                            <p className="text-[11px] font-mono uppercase tracking-widest text-safe font-semibold">
                              Task Completed
                            </p>
                          </div>
                          <h2 className="text-xl md:text-2xl font-serif text-white/90">
                            {task}
                          </h2>
                        </div>
                        <div className="flex items-center gap-4">
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
                            className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 font-mono text-[13px] text-white hover:border-white/20 transition-all hover:-translate-y-0.5"
                          >
                            New Task
                          </button>
                        </div>
                      </div>

                      {/* Success banner */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-safe/20 bg-gradient-to-r from-safe/[0.08] to-transparent p-6 mb-8 relative z-10"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-safe/10 flex items-center justify-center shrink-0 border border-safe/20 shadow-inner">
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--color-safe)"
                              strokeWidth="2.5"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-[16px] font-mono text-white mb-1 tracking-tight">
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
                                className="text-[12px] font-mono text-gold hover:text-gold-dim transition-colors inline-flex items-center gap-1.5 opacity-80 hover:opacity-100"
                              >
                                Verify on BaseScan
                                <svg
                                  width="12"
                                  height="12"
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 relative z-10">
                        <div
                          className="flex items-center gap-4 px-5 py-4 rounded-xl bg-surface/60 border border-white/[0.05] hover:border-gold/30 hover:bg-white/[0.04] transition-all cursor-pointer group hover:-translate-y-1 hover:shadow-lg hover:shadow-gold/5"
                          onClick={() => {
                            const el =
                              document.querySelector<HTMLButtonElement>(
                                "[data-export-pdf]",
                              );
                            el?.click();
                          }}
                        >
                          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <svg
                              width="16"
                              height="16"
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
                            <span className="text-[14px] font-medium text-white/90 block mb-0.5">
                              Export Report
                            </span>
                            <span className="text-[11px] text-white/40 font-mono">
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
                            <span className="text-[10px] text-text-3/70 font-mono">
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
                    </motion.div>
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
                  <div className="bg-surface/30 backdrop-blur-3xl border border-exposed/10 rounded-3xl p-10 text-center max-w-md shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 w-48 h-48 bg-exposed/10 blur-[40px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />
                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-exposed/10 flex items-center justify-center mx-auto mb-6 border border-exposed/20 shadow-inner">
                        <div className="w-3 h-3 rounded-full bg-exposed shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse" />
                      </div>
                      <h3 className="text-[18px] text-white/90 font-serif mb-2 tracking-tight">
                        Connection Failed
                      </h3>
                      <p className="text-[14px] text-white/60 mb-3">{errorMsg}</p>
                      <p className="text-[11px] text-white/30 font-mono mb-8 bg-surface/50 p-2 rounded-lg border border-white/5 mx-4">
                        Is the agent running? <span className="text-white/50">cd agent && pnpm dev</span>
                      </p>
                      <button
                        onClick={handleReset}
                        className="px-6 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 font-mono text-[13px] text-white hover:border-white/20 transition-all hover:-translate-y-0.5"
                      >
                        Try again
                      </button>
                    </div>
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

      {/* Locus Info Modal */}
      <AnimatePresence>
        {showLocusInfo && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLocusInfo(false)}
              className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm"
            >
              <div className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-safe)" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v12M15 9.5c-.5-1-1.5-1.5-3-1.5s-3 .7-3 2 1.2 2 3 2.5 3 1 3 2.5-1.5 2-3 2-2.5-.5-3-1.5" />
                    </svg>
                    <h3 className="text-[15px] text-text font-medium">Locus USDC Wallet</h3>
                  </div>
                  <button onClick={() => setShowLocusInfo(false)} className="text-text-3 hover:text-text text-lg cursor-pointer">&times;</button>
                </div>

                {/* Balance */}
                <div className="glass rounded-xl p-4 mb-4 text-center">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">Available Balance</p>
                  <p className="text-2xl font-mono text-safe font-medium">${locusBalance || "0"} <span className="text-[14px] text-text-3/70">USDC</span></p>
                  <p className="text-[10px] font-mono text-text-3/70 mt-1">On Base mainnet</p>
                </div>

                {/* Deposit address */}
                <div className="mb-4">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-2">Deposit Address (Base USDC)</p>
                  <div className="glass rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-text truncate">{locusWallet}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(locusWallet);
                      }}
                      className="shrink-0 text-text-3 hover:text-gold transition-colors cursor-pointer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[10px] text-text-3/70 mt-2">
                    Send USDC on <span className="text-text-3">Base</span> to this address to fund private payments.
                  </p>
                </div>

                {/* QR Code */}
                {locusWallet && (
                  <div className="glass rounded-xl p-4 mb-4 text-center">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-3">Scan to deposit from phone</p>
                    <div className="bg-white rounded-lg p-3 inline-block">
                      <QRCodeSVG
                        value={`ethereum:${locusWallet}@8453`}
                        size={140}
                        bgColor="#ffffff"
                        fgColor="#09090B"
                        level="M"
                      />
                    </div>
                    <p className="text-[10px] text-text-3/70 font-mono mt-2">Base USDC only</p>
                  </div>
                )}

                {/* How it works */}
                <div className="glass rounded-xl p-4">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-2">How it works</p>
                  <div className="space-y-2">
                    {[
                      "Send USDC to the address above on Base",
                      "Type \"Send $X USDC to [address] via Locus\"",
                      "Agent pays from Locus wallet — untraceable to you",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[10px] font-mono text-gold shrink-0">{i + 1}.</span>
                        <span className="text-[11px] text-text-3">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
