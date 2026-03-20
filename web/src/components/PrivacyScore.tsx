"use client";

import { motion } from "framer-motion";

interface PrivacyScoreProps {
  score: number; // 0-100
  fieldsHidden: number;
  fieldsTotal: number;
  animate?: boolean;
}

export function PrivacyScore({
  score,
  fieldsHidden,
  fieldsTotal,
  animate = true,
}: PrivacyScoreProps) {
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-6">
      {/* Circular gauge */}
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth="3"
          />
          {/* Progress */}
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={animate ? { strokeDashoffset: circumference } : { strokeDashoffset: offset }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-xl font-mono font-medium text-text"
            initial={animate ? { opacity: 0 } : { opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {score}%
          </motion.span>
          <span className="text-[9px] text-text-3 font-mono uppercase tracking-wider">
            Private
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        <div>
          <span className="text-2xl font-mono font-medium text-text">
            {fieldsHidden}
          </span>
          <span className="text-text-3 text-sm ml-1.5">/ {fieldsTotal}</span>
          <p className="text-[11px] text-text-3 mt-0.5">Fields protected</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-safe" />
            <span className="text-[11px] text-text-3">Hidden</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gold" />
            <span className="text-[11px] text-text-3">Partial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-exposed" />
            <span className="text-[11px] text-text-3">Exposed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
