"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";

interface QRPaymentProps {
  open: boolean;
  onClose: () => void;
}

export function QRPayment({ open, onClose }: QRPaymentProps) {
  const [amount, setAmount] = useState("0.001");
  const [recipient, setRecipient] = useState("");
  const [generated, setGenerated] = useState(false);

  const paymentData = JSON.stringify({
    action: "shade_private_payment",
    recipient,
    amount,
    currency: "ETH",
    method: "vault",
  });

  // Deep link that opens the app with pre-filled task
  const paymentUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/app?task=${encodeURIComponent(
    `Send ${amount} ETH to ${recipient} privately`
  )}`;

  const handleGenerate = () => {
    if (!recipient || !amount) return;
    setGenerated(true);
  };

  const handleReset = () => {
    setGenerated(false);
    setRecipient("");
    setAmount("0.001");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm"
          >
            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] text-text font-medium">Payment QR Code</h3>
                <button onClick={onClose} className="text-text-3 hover:text-text text-lg">&times;</button>
              </div>

              {!generated ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-text-3 block mb-2">
                      Recipient address or ENS
                    </label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="0x... or name.eth"
                      className="w-full glass rounded-lg px-4 py-3 text-[13px] font-mono text-text placeholder:text-text-3/60 focus:outline-none input-glow"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-text-3 block mb-2">
                      Amount (ETH)
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      step="0.001"
                      className="w-full glass rounded-lg px-4 py-3 text-[13px] font-mono text-text placeholder:text-text-3/60 focus:outline-none input-glow"
                    />
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={!recipient || !amount}
                    className="w-full py-3 rounded-xl bg-gold text-bg font-mono text-[13px] font-medium hover:bg-gold-dim transition-colors disabled:opacity-30"
                  >
                    Generate QR Code
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  {/* QR Code */}
                  <div className="bg-white rounded-xl p-4 inline-block mb-4">
                    <QRCodeSVG
                      value={paymentUrl}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#09090B"
                      level="M"
                    />
                  </div>

                  <p className="text-[13px] text-text font-medium mb-1">
                    {amount} ETH
                  </p>
                  <p className="text-[11px] font-mono text-text-3 mb-1">
                    To: {recipient.length > 20 ? `${recipient.slice(0, 10)}...${recipient.slice(-6)}` : recipient}
                  </p>
                  <p className="text-[10px] text-text-3/70 mb-4">
                    Scan to send a private payment via Shade
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(paymentUrl);
                      }}
                      className="flex-1 py-2.5 rounded-lg glass font-mono text-[11px] text-text-3 hover:text-text transition-colors"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 py-2.5 rounded-lg glass font-mono text-[11px] text-text-3 hover:text-text transition-colors"
                    >
                      New Code
                    </button>
                  </div>

                  <p className="text-[9px] font-mono text-text-3/70 mt-3">
                    Payment executes privately through ShadeVault
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
