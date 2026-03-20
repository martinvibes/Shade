"use client";

import { motion } from "framer-motion";
import { DataField } from "./DataField";

interface DisclosureManifest {
  identity: { status: string; revealed: string | null; hidden: string[] };
  wallet: { type: string; address: string; primaryExposed: boolean };
  budget: { status: string; revealed: string | null };
  intent: { status: string; revealed: string | null };
  metadata: { timestamp: boolean; location: boolean; deviceInfo: boolean; sessionLinked: boolean };
}

interface ComparisonViewProps {
  manifest?: DisclosureManifest | null;
  task?: string;
}

/**
 * Build the "exposed" side — what a normal agent would leak.
 * Uses realistic fake data to show the contrast.
 */
function getExposedFields(task?: string) {
  return [
    { label: "Identity", value: "0xBE36...d6 (operator)" },
    { label: "Wallet", value: "0xBE36b98C7DBCd22d...d6" },
    { label: "Intent", value: task || "Full task description visible" },
    { label: "Budget", value: "Exact amount visible" },
    { label: "IP", value: "Leaked via API call" },
    { label: "Device", value: "Leaked via headers" },
    { label: "Session", value: "Linked to all past activity" },
  ];
}

/**
 * Build the "protected" side from a real disclosure manifest.
 */
function getShadeFields(manifest?: DisclosureManifest | null) {
  if (!manifest) {
    return [
      { label: "Identity", value: "Operator address", status: "hidden" as const },
      { label: "Wallet", value: "Primary wallet", status: "hidden" as const, partialValue: "Ephemeral" },
      { label: "Intent", value: "Full description", status: "partial" as const, partialValue: "Category only" },
      { label: "Budget", value: "Exact amount", status: "hidden" as const },
      { label: "IP", value: "IP address", status: "hidden" as const, partialValue: "Stripped" },
      { label: "Device", value: "Device info", status: "hidden" as const, partialValue: "Stripped" },
      { label: "Session", value: "Session data", status: "hidden" as const, partialValue: "Unlinked" },
    ];
  }

  const m = manifest;
  const walletShort = m.wallet.address
    ? `${m.wallet.address.slice(0, 6)}...${m.wallet.address.slice(-4)}`
    : "";

  return [
    {
      label: "Identity",
      value: "Operator address",
      status: m.identity.status === "hidden" ? "hidden" as const : "partial" as const,
      partialValue: m.identity.revealed || undefined,
    },
    {
      label: "Wallet",
      value: "Primary wallet",
      status: m.wallet.primaryExposed ? "exposed" as const : "hidden" as const,
      partialValue: `${m.wallet.type} ${walletShort}`,
    },
    {
      label: "Intent",
      value: "Full task description",
      status: m.intent.status === "hidden" ? "hidden" as const : "partial" as const,
      partialValue: m.intent.revealed ? `"${m.intent.revealed}"` : undefined,
    },
    {
      label: "Budget",
      value: "Exact amount",
      status: m.budget.status === "hidden" ? "hidden" as const : m.budget.status === "range" ? "partial" as const : "exposed" as const,
      partialValue: m.budget.revealed || undefined,
    },
    {
      label: "IP",
      value: "IP address",
      status: "hidden" as const,
      partialValue: "Stripped",
    },
    {
      label: "Device",
      value: "Device info",
      status: "hidden" as const,
      partialValue: "Stripped",
    },
    {
      label: "Session",
      value: "Session data",
      status: m.metadata.sessionLinked ? "exposed" as const : "hidden" as const,
      partialValue: m.metadata.sessionLinked ? "Linked" : "Unlinked",
    },
  ];
}

export function ComparisonView({ manifest, task }: ComparisonViewProps) {
  const exposedFields = getExposedFields(task);
  const shadeFields = getShadeFields(manifest);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Exposed panel */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-lg border border-border bg-surface p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-exposed" />
            <h3 className="text-[12px] font-mono uppercase tracking-wider text-text-2">
              Standard Agent
            </h3>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-exposed-dim text-exposed border border-exposed/20">
            Unprotected
          </span>
        </div>

        <div>
          {exposedFields.map((field, i) => (
            <DataField
              key={field.label}
              label={field.label}
              value={field.value}
              status="exposed"
              delay={i * 0.06}
            />
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-text-3 font-mono">Authorization</span>
          <span className="text-[12px] text-exposed/70 font-mono">None</span>
        </div>
      </motion.div>

      {/* Protected panel */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="rounded-lg border border-border bg-surface p-5 glow-border"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gold animate-pulse-dot" />
            <h3 className="text-[12px] font-mono uppercase tracking-wider text-text-2">
              Shade Agent
            </h3>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-gold-glow text-gold border border-gold/20">
            Protected
          </span>
        </div>

        <div>
          {shadeFields.map((field, i) => (
            <DataField
              key={field.label}
              label={field.label}
              value={field.value}
              status={field.status}
              partialValue={field.partialValue}
              delay={0.2 + i * 0.08}
            />
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-text-3 font-mono">Authorization</span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-[12px] text-gold font-mono"
          >
            ZK Proof Verified
          </motion.span>
        </div>
      </motion.div>
    </div>
  );
}
