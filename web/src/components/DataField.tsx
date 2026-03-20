"use client";

import { motion } from "framer-motion";

interface DataFieldProps {
  label: string;
  value: string;
  status: "exposed" | "hidden" | "partial";
  partialValue?: string;
  delay?: number;
}

export function DataField({
  label,
  value,
  status,
  partialValue,
  delay = 0,
}: DataFieldProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center justify-between py-2.5 border-b border-border"
    >
      <span className="text-[12px] text-text-3 font-mono uppercase tracking-wider w-20 shrink-0">
        {label}
      </span>

      <div className="flex-1 flex items-center justify-end gap-2">
        {status === "exposed" && (
          <>
            <span className="font-mono text-[13px] text-text">{value}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-exposed shrink-0" />
          </>
        )}

        {status === "hidden" && (
          <>
            <span className="font-mono text-[13px] text-text-3 redacted-blur select-none">
              {value}
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-safe shrink-0" />
          </>
        )}

        {status === "partial" && (
          <>
            <span className="font-mono text-[13px] text-gold">
              {partialValue}
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
          </>
        )}
      </div>
    </motion.div>
  );
}
