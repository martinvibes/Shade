"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSendTransaction, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { QRCodeSVG } from "qrcode.react";
import { parseEther } from "viem";
import { baseSepolia } from "wagmi/chains";

const VAULT_ADDRESS = "0x6cFf39E67B660A14933D83348Ecc5c8102B59EeC" as const;

const PRESETS = [
  { label: "0.001 ETH", value: "0.001" },
  { label: "0.005 ETH", value: "0.005" },
  { label: "0.01 ETH", value: "0.01" },
];

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vaultBalance: string | null;
}

export function DepositModal({ open, onClose, onSuccess, vaultBalance }: DepositModalProps) {
  const [amount, setAmount] = useState("0.001");
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { switchChain } = useSwitchChain();

  const handleDeposit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    // Ensure user is on Base Sepolia
    switchChain({ chainId: baseSepolia.id });
    sendTransaction({
      to: VAULT_ADDRESS,
      value: parseEther(amount),
      chainId: baseSepolia.id,
    });
  };

  // Auto-close on success
  if (isSuccess) {
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 1500);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="rounded-xl border border-border bg-surface p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] text-text font-medium">Deposit to ShadeVault</h3>
                <button
                  onClick={onClose}
                  className="text-text-3 hover:text-text transition-colors text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Current balance */}
              <div className="rounded-lg bg-surface-2 border border-border px-4 py-3 mb-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-0.5">
                  Current Vault Balance
                </p>
                <p className="text-lg font-mono text-gold">
                  {vaultBalance || "0"} ETH
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] font-mono text-text-3">
                    {VAULT_ADDRESS.slice(0, 10)}...{VAULT_ADDRESS.slice(-6)}
                  </p>
                  <button
                    onClick={() => navigator.clipboard.writeText(VAULT_ADDRESS)}
                    className="text-text-3 hover:text-gold transition-colors cursor-pointer"
                    title="Copy address"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* QR Code for mobile deposit */}
              <div className="rounded-lg border border-border p-4 mb-5 text-center">
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-3 mb-3">Scan to deposit from phone</p>
                <div className="bg-white rounded-lg p-3 inline-block">
                  <QRCodeSVG
                    value={`ethereum:${VAULT_ADDRESS}@84532`}
                    size={140}
                    bgColor="#ffffff"
                    fgColor="#09090B"
                    level="M"
                  />
                </div>
                <p className="text-[10px] text-text-3/70 font-mono mt-2">Base Sepolia ETH only</p>
              </div>

              {isSuccess ? (
                <div className="rounded-lg border border-safe/20 bg-safe-dim p-4 text-center">
                  <div className="w-2 h-2 rounded-full bg-safe mx-auto mb-2" />
                  <p className="text-[13px] text-text font-medium">Deposit successful</p>
                  <p className="text-[11px] text-text-3 font-mono mt-1">
                    {amount} ETH sent to ShadeVault
                  </p>
                </div>
              ) : (
                <>
                  {/* Amount input */}
                  <div className="mb-4">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-text-3 block mb-2">
                      Amount (ETH)
                    </label>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.001"
                      disabled={isPending || isConfirming}
                      className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-[14px] font-mono text-text placeholder:text-text-3/70 focus:outline-none focus:border-gold/30 transition-colors disabled:opacity-40"
                    />
                  </div>

                  {/* Presets */}
                  <div className="flex gap-2 mb-5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setAmount(p.value)}
                        disabled={isPending || isConfirming}
                        className={`flex-1 py-2 rounded-lg border font-mono text-[11px] transition-colors ${
                          amount === p.value
                            ? "border-gold/30 bg-gold-glow text-gold"
                            : "border-border text-text-3 hover:border-border-light"
                        } disabled:opacity-40`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Deposit button */}
                  <button
                    onClick={handleDeposit}
                    disabled={isPending || isConfirming || !amount || Number(amount) <= 0}
                    className="w-full py-3 rounded-lg bg-gold text-bg font-mono text-[13px] font-medium hover:bg-gold-dim transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {isPending
                      ? "Confirm in wallet..."
                      : isConfirming
                        ? "Confirming..."
                        : `Deposit ${amount} ETH`}
                  </button>

                  <p className="text-[10px] text-text-3 font-mono text-center mt-3">
                    Funds go to ShadeVault on Base Sepolia. The agent spends from the vault
                    using ephemeral wallets, your identity stays hidden.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
