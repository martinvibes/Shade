"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface LogEntry {
  time: string;
  action: string;
  type: "reasoning" | "discovery" | "privacy" | "identity" | "payment" | "success" | "info";
  detail?: string;
}

const TYPE_COLORS: Record<LogEntry["type"], string> = {
  reasoning: "bg-text-3",
  discovery: "bg-text-3",
  privacy: "bg-gold",
  identity: "bg-gold",
  payment: "bg-text-2",
  success: "bg-safe",
  info: "bg-text-3",
};

interface ActivityLogProps {
  entries: LogEntry[];
  autoPlay?: boolean;
  speed?: number;
}

export function ActivityLog({ entries, autoPlay = true, speed = 700 }: ActivityLogProps) {
  const [visibleCount, setVisibleCount] = useState(autoPlay ? 0 : entries.length);

  useEffect(() => {
    if (!autoPlay) return;
    if (visibleCount >= entries.length) return;

    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, speed);
    return () => clearTimeout(timer);
  }, [visibleCount, entries.length, autoPlay, speed]);

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[12px] font-mono uppercase tracking-wider text-text-2">
          Activity Log
        </h3>
        {autoPlay && visibleCount < entries.length && (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" />
            <span className="text-[11px] text-text-3 font-mono">Processing</span>
          </div>
        )}
        {visibleCount >= entries.length && (
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-safe-dim text-safe border border-safe/20">
            Complete
          </span>
        )}
      </div>

      <div className="space-y-0.5 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {entries.slice(0, visibleCount).map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-3 py-1.5"
            >
              <span className="text-[11px] text-text-3 font-mono shrink-0 w-14 tabular-nums mt-px">
                {entry.time}
              </span>
              <div
                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${TYPE_COLORS[entry.type]}`}
              />
              <div className="min-w-0">
                <span className="text-[13px] text-text font-mono leading-relaxed">
                  {entry.action}
                </span>
                {entry.detail && (
                  <span className="text-[11px] text-text-3 ml-2 font-mono">
                    {entry.detail}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
