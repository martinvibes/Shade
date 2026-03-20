"use client";

import { motion } from "framer-motion";

interface ReportField {
  label: string;
  status: string;
  detail?: string;
  type: "hidden" | "partial" | "exposed";
}

const TYPE_STYLES = {
  hidden: "text-safe",
  partial: "text-gold",
  exposed: "text-exposed",
};

interface PrivacyReportProps {
  task: string;
  cost?: number;
  fieldsHidden?: number;
  fieldsRevealed?: number;
  manifest?: any;
  onReset?: () => void;
}

function buildFields(manifest?: any): ReportField[] {
  if (!manifest) {
    return [
      { label: "Identity", status: "HIDDEN", type: "hidden" },
      { label: "Wallet", status: "EPHEMERAL", type: "hidden" },
      { label: "Budget", status: "RANGE ONLY", type: "partial" },
      { label: "Intent", status: "CATEGORY ONLY", type: "partial" },
      { label: "IP Address", status: "STRIPPED", type: "hidden" },
      { label: "Device", status: "STRIPPED", type: "hidden" },
      { label: "Session", status: "UNLINKED", type: "hidden" },
    ];
  }

  const m = manifest;
  const fields: ReportField[] = [];

  // Identity
  fields.push({
    label: "Identity",
    status: m.identity?.status?.toUpperCase() || "HIDDEN",
    detail: m.identity?.revealed || undefined,
    type: m.identity?.status === "hidden" ? "hidden" : "partial",
  });

  // Wallet
  const walletAddr = m.wallet?.address;
  fields.push({
    label: "Wallet",
    status: m.wallet?.type?.toUpperCase() || "EPHEMERAL",
    detail: walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : undefined,
    type: m.wallet?.primaryExposed ? "exposed" : "hidden",
  });

  // Budget
  fields.push({
    label: "Budget",
    status: m.budget?.status === "hidden" ? "HIDDEN" : m.budget?.status === "range" ? "RANGE ONLY" : "EXACT",
    detail: m.budget?.revealed || undefined,
    type: m.budget?.status === "hidden" ? "hidden" : m.budget?.status === "range" ? "partial" : "exposed",
  });

  // Intent
  fields.push({
    label: "Intent",
    status: m.intent?.status === "hidden" ? "HIDDEN" : m.intent?.status === "category" ? "CATEGORY ONLY" : m.intent?.status?.toUpperCase() || "HIDDEN",
    detail: m.intent?.revealed ? `"${m.intent.revealed}"` : undefined,
    type: m.intent?.status === "hidden" ? "hidden" : m.intent?.status === "full" ? "exposed" : "partial",
  });

  // Metadata
  fields.push({
    label: "IP Address",
    status: "STRIPPED",
    type: "hidden",
  });
  fields.push({
    label: "Device",
    status: "STRIPPED",
    type: "hidden",
  });
  fields.push({
    label: "Session",
    status: m.metadata?.sessionLinked ? "LINKED" : "UNLINKED",
    type: m.metadata?.sessionLinked ? "exposed" : "hidden",
  });

  return fields;
}

export function PrivacyReport({ task, cost, fieldsHidden, fieldsRevealed, manifest, onReset }: PrivacyReportProps) {
  const fields = buildFields(manifest);
  const hidden = fieldsHidden ?? fields.filter((f) => f.type === "hidden").length;
  const partial = fields.filter((f) => f.type === "partial").length;
  const exposed = fieldsRevealed !== undefined ? Math.max(0, fieldsRevealed - partial) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[12px] font-mono uppercase tracking-wider text-text-2 mb-1">
            Privacy Report
          </h3>
          <p className="text-[13px] font-mono text-text">{task}</p>
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
          className="px-3 py-1.5 rounded border border-gold/30 bg-gold-glow"
        >
          <span className="text-[11px] font-mono text-gold font-medium tracking-wider uppercase">
            Verified
          </span>
        </motion.div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 py-4 border-y border-border">
        <div className="text-center">
          <span className="text-2xl font-mono font-medium text-safe">{hidden}</span>
          <p className="text-[10px] font-mono text-text-3 uppercase tracking-wider mt-0.5">Hidden</p>
        </div>
        <div className="text-center">
          <span className="text-2xl font-mono font-medium text-gold">{partial}</span>
          <p className="text-[10px] font-mono text-text-3 uppercase tracking-wider mt-0.5">Partial</p>
        </div>
        <div className="text-center">
          <span className="text-2xl font-mono font-medium text-exposed">{exposed}</span>
          <p className="text-[10px] font-mono text-text-3 uppercase tracking-wider mt-0.5">Exposed</p>
        </div>
      </div>

      <div className="space-y-0">
        {fields.map((field, i) => (
          <motion.div
            key={field.label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.06 }}
            className="flex items-center justify-between py-2 border-b border-border last:border-0"
          >
            <span className="text-[12px] font-mono text-text-3 uppercase tracking-wider">
              {field.label}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[12px] font-mono ${TYPE_STYLES[field.type]}`}>
                {field.status}
              </span>
              {field.detail && (
                <span className="text-[11px] font-mono text-text-3">({field.detail})</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
        <p className="text-[11px] text-text-3 font-mono">
          Cost: ${cost ?? 0} &middot; Zero identity exposed
        </p>
        {onReset && (
          <button
            onClick={onReset}
            className="text-[12px] font-mono text-text-3 hover:text-text transition-colors"
          >
            Run another task
          </button>
        )}
      </div>
    </motion.div>
  );
}
