"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface ResultTabsProps {
  tabs: Tab[];
}

export function ResultTabs({ tabs }: ResultTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id || "");

  return (
    <div>
      {/* Tab headers */}
      <div className="flex items-center gap-1 mb-4 border-b border-white/[0.04] pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className="relative px-4 py-2.5 text-[12px] font-mono transition-colors"
          >
            <span className={active === tab.id ? "text-text" : "text-text-3 hover:text-text-2"}>
              {tab.label}
            </span>
            {active === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-px bg-gold"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div
        key={active}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {tabs.find((t) => t.id === active)?.content}
      </motion.div>
    </div>
  );
}
