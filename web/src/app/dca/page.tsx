"use client";

import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Nav } from "@/components/Nav";
import { DCAPanel } from "@/components/DCAPanel";
import { ShadeLogo } from "@/components/ShadeLogo";
import { motion } from "framer-motion";

export default function DCAPage() {
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();

  return (
    <div className="min-h-screen flex flex-col bg-bg relative overflow-hidden">
      {/* Animated gradient mesh */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-[30%] -right-[20%] w-[800px] h-[800px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #22C55E 0%, transparent 70%)", animation: "mesh-drift 25s ease-in-out infinite" }} />
        <div className="absolute -bottom-[20%] -left-[15%] w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #EF4444 0%, transparent 70%)", animation: "mesh-drift 20s ease-in-out infinite reverse" }} />
        <div className="absolute top-[30%] left-[40%] w-[500px] h-[500px] rounded-full opacity-[0.02]"
          style={{ background: "radial-gradient(circle, #D4A853 0%, transparent 70%)", animation: "mesh-drift 30s ease-in-out infinite 5s" }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Nav />

        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <ShadeLogo size={36} />
              <div>
                <h1 className="text-xl text-text font-medium">Private DCA</h1>
                <p className="text-[11px] font-mono text-text-3/60">
                  Automated &middot; Private &middot; On-chain
                </p>
              </div>
            </div>
            <p className="text-[13px] text-text-3 leading-relaxed max-w-md">
              Set price targets. When conditions are met, Shade auto-executes via ShadeVault.
              Your identity never touches the chain.
            </p>
          </motion.div>

          {isConnected ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <DCAPanel userAddress={address || ""} />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-12 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-safe/10 to-exposed/10 flex items-center justify-center mx-auto mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="1.5">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
              <h3 className="text-[17px] text-text font-medium mb-2">Connect to start trading</h3>
              <p className="text-[13px] text-text-3 mb-8 max-w-sm mx-auto">
                Set up private DCA orders that auto-execute when your price targets are hit.
                All trades route through ShadeVault — fully anonymous.
              </p>
              <button
                onClick={() => openConnectModal?.()}
                className="px-7 py-3.5 rounded-xl bg-gold text-bg font-mono text-[13px] font-medium hover:bg-gold-dim transition-colors"
              >
                Connect Wallet
              </button>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
