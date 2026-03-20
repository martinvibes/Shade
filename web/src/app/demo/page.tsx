"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Nav } from "@/components/Nav";
import { ComparisonView } from "@/components/ComparisonView";
import { ActivityLog, type LogEntry } from "@/components/ActivityLog";
import { PrivacyScore } from "@/components/PrivacyScore";
import { PrivacyReport } from "@/components/PrivacyReport";

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API || "http://localhost:3001";

type DemoState = "idle" | "running" | "complete" | "error";

const DEMO_TASK = "Transfer 0.00005 ETH from vault to 0x000000000000000000000000000000000000dEaD privately";

interface TaskResult {
  success: boolean;
  task: string;
  taskType: string;
  privacyScore: number;
  fieldsHidden: number;
  fieldsRevealed: number;
  intentCategory: string;
  cost: number;
  disclosureManifest: any;
  execution: any;
  logEntries: Array<{ time: string; action: string; type: string; detail?: string }>;
}

export default function DemoPage() {
  const [state, setState] = useState<DemoState>("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [liveLog, setLiveLog] = useState<LogEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const handleStart = useCallback(async () => {
    setState("running");
    setResult(null);
    setErrorMsg("");

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
        body: JSON.stringify({ task: DEMO_TASK }),
      });

      const data: TaskResult = await res.json();

      if (!res.ok) throw new Error("Agent request failed");

      const mapped: LogEntry[] = (data.logEntries || []).map((e) => ({
        time: e.time,
        action: e.action,
        type: e.type as LogEntry["type"],
        detail: e.detail,
      }));

      setResult(data);
      setLiveLog(mapped);
      setState("complete");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to agent. Is the backend running on port 3001?");
      setState("error");
    }
  }, []);

  const handleReset = useCallback(() => {
    setState("idle");
    setResult(null);
    setLiveLog([]);
    setErrorMsg("");
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Nav />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-8 w-full">
        {/* Demo header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-text-3 mb-1">
              Live Demo
            </p>
            <h1 className="text-xl font-medium text-text">
              Watch Shade execute a real on-chain task privately
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {state === "idle" && (
              <button
                onClick={handleStart}
                className="px-5 py-2.5 rounded-lg bg-gold/10 border border-gold/20 font-mono text-[13px] text-gold hover:bg-gold/15 transition-colors"
              >
                Run Demo
              </button>
            )}
            {state === "running" && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gold animate-pulse-dot" />
                <span className="text-[13px] font-mono text-gold">Processing...</span>
              </div>
            )}
            {(state === "complete" || state === "error") && (
              <button
                onClick={handleReset}
                className="px-5 py-2.5 rounded-lg bg-surface-2 border border-border font-mono text-[13px] text-text-2 hover:text-text transition-colors"
              >
                Reset Demo
              </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-lg border border-border bg-surface p-12 text-center">
                <div className="w-12 h-12 rounded-full border border-border bg-surface-2 mx-auto mb-5 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-gold animate-pulse-dot" />
                </div>
                <h2 className="font-serif text-2xl text-text mb-3">
                  Live Privacy Demo
                </h2>
                <p className="text-text-3 text-[14px] max-w-md mx-auto leading-relaxed mb-4">
                  This demo executes a real on-chain transaction through the Shade agent.
                  Watch as it reasons privately, decides what to disclose, and sends
                  real ETH from the ShadeVault — all verifiable on Base Sepolia.
                </p>
                <p className="text-text-3 text-[13px] font-mono mb-2">
                  Task: <span className="text-text">Transfer 0.00005 ETH privately</span>
                </p>
                <p className="text-text-3 text-[11px] font-mono">
                  Recipient: 0x...dEaD &middot; Chain: Base Sepolia &middot; Method: ShadeVault
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                {[
                  { step: "01", title: "Venice AI Reasoning", desc: "Zero data retention" },
                  { step: "02", title: "Disclosure Decision", desc: "Minimum data revealed" },
                  { step: "03", title: "Vault Execution", desc: "Real ETH transfer" },
                  { step: "04", title: "On-chain Receipt", desc: "Verifiable proof" },
                ].map((item, i) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className="rounded-lg border border-border bg-surface p-4"
                  >
                    <span className="text-[11px] font-mono text-text-3">{item.step}</span>
                    <h4 className="text-[13px] text-text font-medium mt-1">{item.title}</h4>
                    <p className="text-[12px] text-text-3 mt-0.5">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {state === "running" && (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-text-3 mb-1">
                    Task
                  </p>
                  <p className="text-[14px] font-mono text-text">Private vault transfer</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gold animate-pulse-dot" />
                  <span className="text-[13px] font-mono text-gold">Agent working...</span>
                </div>
              </div>

              <ActivityLog entries={liveLog} autoPlay={false} />

              <div className="rounded-lg border border-border bg-surface p-8 text-center">
                <div className="w-10 h-10 rounded-full border border-gold/30 bg-gold-glow mx-auto mb-4 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-gold animate-pulse-dot" />
                </div>
                <p className="text-[14px] text-text-2">Venice AI is reasoning privately...</p>
                <p className="text-[12px] text-text-3 mt-1">Real on-chain transaction in progress</p>
              </div>
            </motion.div>
          )}

          {state === "complete" && result && (
            <motion.div
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-safe mb-1">
                    Task Complete
                  </p>
                  <p className="text-[14px] font-mono text-text">{result.task}</p>
                </div>
                <PrivacyScore
                  score={result.privacyScore}
                  fieldsHidden={result.fieldsHidden}
                  fieldsTotal={result.fieldsHidden + result.fieldsRevealed}
                  animate={true}
                />
              </div>

              {/* Execution result banner */}
              {result.execution && (
                <div className={`rounded-lg border p-4 ${
                  result.execution.success
                    ? "border-safe/20 bg-safe-dim"
                    : "border-gold/20 bg-gold-glow"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${result.execution.success ? "bg-safe" : "bg-gold"}`} />
                    <div>
                      <p className="text-[13px] font-mono text-text">
                        {result.execution.success
                          ? `${result.execution.amount} ${result.execution.currency} sent via ${result.execution.method}`
                          : `Execution note: ${result.execution.error}`
                        }
                      </p>
                      {result.execution.txHash && (
                        <a
                          href={`https://sepolia.basescan.org/tx/${result.execution.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-gold hover:text-gold-dim transition-colors"
                        >
                          View on BaseScan: {result.execution.txHash.slice(0, 16)}...
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <ComparisonView manifest={result.disclosureManifest} task={result.task} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ActivityLog entries={liveLog} autoPlay={false} />
                <PrivacyReport
                  task={result.task}
                  cost={result.cost}
                  fieldsHidden={result.fieldsHidden}
                  fieldsRevealed={result.fieldsRevealed}
                  manifest={result.disclosureManifest}
                />
              </div>
            </motion.div>
          )}

          {state === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-lg border border-exposed/20 bg-exposed-dim p-8 text-center">
                <div className="w-2 h-2 rounded-full bg-exposed mx-auto mb-4" />
                <h3 className="text-[15px] text-text font-medium mb-2">Demo Failed</h3>
                <p className="text-[13px] text-text-3 mb-4">{errorMsg}</p>
                <p className="text-[11px] text-text-3 font-mono">Make sure the agent backend is running: cd agent && pnpm dev</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-border px-6 py-3 flex items-center justify-between">
        <span className="text-[11px] font-mono text-text-3">Shade v1.0</span>
        <span className="text-[11px] font-mono text-text-3">
          ERC-8004 &middot; Base Sepolia &middot; Venice AI
        </span>
      </footer>
    </div>
  );
}
