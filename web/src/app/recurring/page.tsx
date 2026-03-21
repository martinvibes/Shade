"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Nav } from "@/components/Nav";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API || "http://localhost:3001";

interface RecurringPayment {
  id: string;
  recipient: string;
  recipientDisplay: string;
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

interface IntervalOption {
  key: string;
  ms: number;
  label: string;
}

export default function RecurringPage() {
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [intervals, setIntervals] = useState<IntervalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [formRecipient, setFormRecipient] = useState("");
  const [formAmount, setFormAmount] = useState("0.0001");
  const [formInterval, setFormInterval] = useState("1h");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [paymentsRes, intervalsRes] = await Promise.all([
        fetch(`${API_BASE}/recurring/list`),
        fetch(`${API_BASE}/recurring/intervals`),
      ]);
      const pData = await paymentsRes.json();
      const iData = await intervalsRes.json();
      setPayments(pData.payments || []);
      setIntervals(iData.intervals || []);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCreate = async () => {
    if (!formRecipient || !formAmount) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/recurring/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: formRecipient,
          amount: parseFloat(formAmount),
          interval: formInterval,
        }),
      });
      const data = await res.json();
      if (data.payment) {
        setPayments((prev) => [data.payment, ...prev]);
        setShowForm(false);
        setFormRecipient("");
      }
    } catch { /* */ } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await fetch(`${API_BASE}/recurring/cancel/${id}`, { method: "POST" });
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "cancelled" as const } : p))
      );
    } catch { /* */ }
  };

  const active = payments.filter((p) => p.status === "active");
  const past = payments.filter((p) => p.status !== "active");
  const totalSent = payments.reduce((sum, p) => sum + p.amount * p.executionCount, 0);

  return (
    <div className="min-h-screen flex flex-col bg-bg relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-[25%] -left-[15%] w-[700px] h-[700px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #D4A853 0%, transparent 70%)", animation: "mesh-drift 25s ease-in-out infinite" }} />
        <div className="absolute -bottom-[20%] -right-[15%] w-[600px] h-[600px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #22C55E 0%, transparent 70%)", animation: "mesh-drift 20s ease-in-out infinite reverse" }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Nav />

        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold/20 to-safe/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="1.5">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl text-text font-medium">Recurring Payments</h1>
                  <p className="text-[11px] font-mono text-text-3/60">
                    Automated &middot; Private &middot; Scheduled
                  </p>
                </div>
              </div>
              {isConnected && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="px-4 py-2.5 rounded-xl bg-gold text-bg font-mono text-[12px] font-medium hover:bg-gold-dim transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New
                </button>
              )}
            </div>
            <p className="text-[13px] text-text-3 leading-relaxed mt-3 max-w-md">
              Set up automatic payments that execute on a schedule. Every transfer
              goes through ShadeVault — fully private, no identity exposed.
            </p>
          </motion.div>

          {!isConnected ? (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-white/[0.06] p-12 text-center" style={{ background: "linear-gradient(135deg, rgba(19,19,22,0.9) 0%, rgba(9,9,11,0.95) 100%)" }}>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/10 to-safe/10 flex items-center justify-center mx-auto mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h3 className="text-[17px] text-text font-medium mb-2">Connect to start</h3>
              <p className="text-[13px] text-text-3 mb-8 max-w-sm mx-auto">
                Set up private recurring payments that auto-execute on your schedule.
              </p>
              <button onClick={() => openConnectModal?.()}
                className="px-7 py-3.5 rounded-xl bg-gold text-bg font-mono text-[13px] font-medium hover:bg-gold-dim transition-colors cursor-pointer">
                Connect Wallet
              </button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {/* Stats */}
              {payments.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Active", value: active.length, sub: "scheduled" },
                    { label: "Executed", value: payments.reduce((s, p) => s + p.executionCount, 0), sub: "total transfers" },
                    { label: "Sent", value: `${totalSent.toFixed(4)}`, sub: "ETH total" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-white/[0.06] px-4 py-3" style={{ background: "rgba(13,13,16,0.8)" }}>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-1">{s.label}</p>
                      <p className="text-lg font-mono text-gold">{s.value}</p>
                      <p className="text-[10px] font-mono text-text-3/40">{s.sub}</p>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Create Form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5"
                      style={{ background: "linear-gradient(135deg, rgba(19,19,22,0.95) 0%, rgba(15,15,18,0.98) 100%)" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gold/10 flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          </div>
                          <h3 className="text-[14px] text-text font-medium">New Recurring Payment</h3>
                        </div>
                        <button onClick={() => setShowForm(false)}
                          className="w-7 h-7 rounded-lg bg-white/[0.03] flex items-center justify-center text-text-3 hover:text-text hover:bg-white/[0.06] transition-colors text-sm cursor-pointer">&times;</button>
                      </div>

                      {/* Recipient */}
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-text-3 block mb-2">
                          Recipient (address or ENS)
                        </label>
                        <input
                          type="text"
                          value={formRecipient}
                          onChange={(e) => setFormRecipient(e.target.value)}
                          placeholder="vitalik.eth or 0x..."
                          className="w-full glass rounded-xl px-4 py-3.5 text-[13px] font-mono text-text placeholder:text-text-3/25 focus:outline-none input-glow"
                        />
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-text-3 block mb-2">
                          Amount per payment (ETH)
                        </label>
                        <input
                          type="number"
                          value={formAmount}
                          onChange={(e) => setFormAmount(e.target.value)}
                          step="0.0001"
                          className="w-full glass rounded-xl px-4 py-3.5 text-[14px] font-mono text-text focus:outline-none input-glow tabular-nums"
                        />
                      </div>

                      {/* Interval */}
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-text-3 block mb-2">
                          Frequency
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {intervals.map((iv) => (
                            <button
                              key={iv.key}
                              onClick={() => setFormInterval(iv.key)}
                              className={`py-2.5 rounded-xl font-mono text-[11px] transition-all cursor-pointer ${
                                formInterval === iv.key
                                  ? "bg-gold/10 border border-gold/25 text-gold"
                                  : "glass text-text-3 hover:text-text-2"
                              }`}
                            >
                              {iv.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Summary */}
                      {formRecipient && formAmount && (
                        <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3">
                          <p className="text-[12px] text-text-2">
                            Send <span className="text-gold font-medium">{formAmount} ETH</span>{" "}
                            to <span className="text-text font-medium font-mono">
                              {formRecipient.length > 20 ? `${formRecipient.slice(0, 10)}...${formRecipient.slice(-6)}` : formRecipient}
                            </span>{" "}
                            <span className="text-text-3">{intervals.find(i => i.key === formInterval)?.label.toLowerCase()}</span>
                          </p>
                        </div>
                      )}

                      <button
                        onClick={handleCreate}
                        disabled={creating || !formRecipient || !formAmount}
                        className="w-full py-3.5 rounded-xl bg-gold text-bg font-mono text-[13px] font-medium hover:bg-gold-dim transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        {creating ? "Creating..." : "Start Recurring Payment"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active Payments */}
              {active.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-gold/10"
                  style={{ background: "linear-gradient(135deg, rgba(212,168,83,0.03) 0%, rgba(9,9,11,0.95) 100%)" }}>
                  <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-2 h-2 rounded-full bg-gold" />
                        <div className="absolute inset-0 w-2 h-2 rounded-full bg-gold animate-ping opacity-40" />
                      </div>
                      <span className="text-[12px] font-mono text-text font-medium">Active Payments</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gold/5">
                      <div className="w-1 h-1 rounded-full bg-gold animate-pulse-dot" />
                      <span className="text-[10px] font-mono text-gold/70">Running</span>
                    </div>
                  </div>

                  <div className="divide-y divide-white/[0.03]">
                    {active.map((payment, i) => {
                      const nextIn = payment.nextExecuteAt - Date.now();
                      const nextLabel = nextIn > 0
                        ? nextIn < 60000 ? "< 1 min" : nextIn < 3600000 ? `${Math.floor(nextIn / 60000)}m` : `${Math.floor(nextIn / 3600000)}h`
                        : "executing...";

                      return (
                        <motion.div
                          key={payment.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="px-5 py-4"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-xl bg-gold/8 flex items-center justify-center shrink-0 mt-0.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-text mb-0.5">
                                Send <span className="text-gold font-mono font-medium">{payment.amount} ETH</span>{" "}
                                to <span className="font-mono">{payment.recipientDisplay}</span>{" "}
                                <span className="text-text-3">{payment.intervalLabel.toLowerCase()}</span>
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-mono text-text-3/50">
                                  {payment.executionCount} executed
                                </span>
                                <span className="text-[10px] font-mono text-text-3/30">&middot;</span>
                                <span className="text-[10px] font-mono text-gold/60">
                                  Next: {nextLabel}
                                </span>
                                {payment.lastExecutedAt && (
                                  <>
                                    <span className="text-[10px] font-mono text-text-3/30">&middot;</span>
                                    <span className="text-[10px] font-mono text-text-3/40">
                                      Last: {getTimeAgo(Math.floor(payment.lastExecutedAt / 1000))}
                                    </span>
                                  </>
                                )}
                              </div>
                              {payment.txHashes.length > 0 && (
                                <a
                                  href={`https://sepolia.basescan.org/tx/${payment.txHashes[payment.txHashes.length - 1]}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-mono text-text-3/30 hover:text-gold transition-colors mt-1 inline-block"
                                >
                                  Latest tx &rarr;
                                </a>
                              )}
                            </div>

                            <button
                              onClick={() => handleCancel(payment.id)}
                              className="text-text-3/40 hover:text-exposed transition-colors shrink-0 p-1 cursor-pointer"
                              title="Cancel"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Past Payments */}
              {past.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-white/[0.04]" style={{ background: "rgba(13,13,16,0.8)" }}>
                  <div className="px-5 py-3.5 border-b border-white/[0.04]">
                    <span className="text-[12px] font-mono text-text-3">History</span>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {past.map((payment) => (
                      <div key={payment.id} className="px-5 py-3.5 flex items-center gap-4">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          payment.status === "cancelled" ? "bg-white/[0.03]" : "bg-exposed/10"
                        }`}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-text-2 mb-0.5">
                            <span className="font-mono">{payment.amount} ETH</span>{" "}
                            to <span className="font-mono text-text-3">{payment.recipientDisplay}</span>{" "}
                            <span className="text-text-3/50">{payment.intervalLabel.toLowerCase()}</span>
                          </p>
                          <p className="text-[10px] font-mono text-text-3/40">
                            {payment.status === "cancelled" ? "Cancelled" : "Stopped"} &middot; {payment.executionCount} payments made &middot; {(payment.amount * payment.executionCount).toFixed(4)} ETH total
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {payments.length === 0 && !loading && !showForm && (
                <div className="rounded-2xl border border-white/[0.04] p-10 text-center"
                  style={{ background: "linear-gradient(135deg, rgba(19,19,22,0.8) 0%, rgba(9,9,11,0.9) 100%)" }}>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold/10 to-safe/10 flex items-center justify-center mx-auto mb-5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] text-text font-medium mb-2">No recurring payments</h3>
                  <p className="text-[12px] text-text-3 mb-5 max-w-xs mx-auto">
                    Automate private payments on a schedule. Every transfer routes through ShadeVault.
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-3 rounded-xl bg-gold text-bg font-mono text-[12px] font-medium hover:bg-gold-dim transition-colors cursor-pointer"
                  >
                    Create first payment
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
