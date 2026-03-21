"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API || "http://localhost:3001";
// All price data goes through our backend to avoid CORS + rate limits

type ChartMode = "line" | "candle";

interface DCAOrder {
  id: string;
  type: "price_above" | "price_below";
  targetPrice: number;
  amount: number;
  currency: string;
  recipient: string;
  status: "active" | "triggered" | "failed" | "cancelled";
  createdAt: number;
  triggeredAt?: number;
  txHash?: string;
  currentPrice?: number;
}

interface DCAPanelProps {
  userAddress: string;
  onOrderCreated?: () => void;
}

export function DCAPanel({ userAddress, onOrderCreated }: DCAPanelProps) {
  const [orders, setOrders] = useState<DCAOrder[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [change24h, setChange24h] = useState<number>(0);
  const [chartData, setChartData] = useState<[number, number][]>([]);
  const [ohlcData, setOhlcData] = useState<[number, number, number, number, number][]>([]); // [time, open, high, low, close]
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [loading, setLoading] = useState(true);

  // Form
  const [formType, setFormType] = useState<"price_below" | "price_above">("price_below");
  const [formPrice, setFormPrice] = useState("");
  const [formAmount, setFormAmount] = useState("0.0001");
  const [formRecipient, setFormRecipient] = useState(userAddress);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [chartHover, setChartHover] = useState<{ x: number; price: number } | null>(null);

  // Fetch price first (fast), then chart (heavier) — don't block each other
  useEffect(() => {
    // Price loads first — instant from cached backend
    fetch(`${API_BASE}/dca/price`)
      .then((r) => r.json())
      .then((d) => {
        setCurrentPrice(d.price || 0);
        setChange24h(d.change24h || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Chart loads separately — doesn't block price display
    fetch(`${API_BASE}/dca/chart`)
      .then((r) => r.json())
      .then((d) => {
        if (d.line) {
          setChartData(d.line);
          
          // Generate denser 10-minute candles from the 5-minute line data (288 points -> 144 candles)
          const chunkSize = 2;
          const prices = d.line;
          const generatedOhlc: [number, number, number, number, number][] = [];
          
          for (let i = 0; i < prices.length; i += chunkSize) {
            const chunk = prices.slice(i, i + chunkSize);
            const open = chunk[0][1];
            const close = chunk[chunk.length - 1][1];
            const high = Math.max(...chunk.map((p: [number, number]) => p[1]));
            const low = Math.min(...chunk.map((p: [number, number]) => p[1]));
            generatedOhlc.push([chunk[0][0], open, high, low, close]);
          }
          
          setOhlcData(generatedOhlc);
        }
      })
      .catch(() => {});

    // Refresh price every 30s
    const interval = setInterval(() => {
      fetch(`${API_BASE}/dca/price`)
        .then((r) => r.json())
        .then((d) => {
          setCurrentPrice(d.price || 0);
          if (d.change24h) setChange24h(d.change24h);
        })
        .catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Fetch orders from backend
  useEffect(() => {
    fetch(`${API_BASE}/dca/orders`)
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => {});

    const interval = setInterval(() => {
      fetch(`${API_BASE}/dca/orders`)
        .then((r) => r.json())
        .then((d) => setOrders(d.orders || []))
        .catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setFormRecipient(userAddress); }, [userAddress]);

  const handleCreate = async () => {
    if (!formPrice || !formAmount) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/dca/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          targetPrice: parseFloat(formPrice),
          amount: parseFloat(formAmount),
          recipient: formRecipient || userAddress,
        }),
      });
      const data = await res.json();
      if (data.order) {
        setOrders((prev) => [data.order, ...prev]);
        setShowForm(false);
        setFormPrice("");
        onOrderCreated?.();
      }
    } catch { /* */ } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await fetch(`${API_BASE}/dca/cancel/${id}`, { method: "POST" });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "cancelled" as const } : o)));
    } catch { /* */ }
  };

  const activeOrders = orders.filter((o) => o.status === "active");
  const pastOrders = orders.filter((o) => o.status !== "active");

  // Chart calculations (line)
  const chartMin = chartData.length ? Math.min(...chartData.map((d) => d[1])) * 0.9995 : 0;
  const chartMax = chartData.length ? Math.max(...chartData.map((d) => d[1])) * 1.0005 : 1;
  const chartRange = chartMax - chartMin || 1;

  // Chart calculations (candle)
  const allOhlcPrices = ohlcData.flatMap((d) => [d[2], d[3]]); // highs and lows
  const candleMin = allOhlcPrices.length ? Math.min(...allOhlcPrices) * 0.9995 : 0;
  const candleMax = allOhlcPrices.length ? Math.max(...allOhlcPrices) * 1.0005 : 1;
  const candleRange = candleMax - candleMin || 1;

  return (
    <div className="space-y-4">
      {/* ═══ Price Hero + Chart ═══ */}
      <div className="rounded-2xl overflow-hidden border border-white/[0.06]" style={{ background: "linear-gradient(180deg, rgba(19,19,22,0.9) 0%, rgba(9,9,11,0.95) 100%)" }}>
        {/* Price header */}
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#627EEA]/15 flex items-center justify-center">
                  <svg width="10" height="16" viewBox="0 0 256 417" fill="#627EEA">
                    <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" opacity=".6"/>
                    <path d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
                  </svg>
                </div>
                <div>
                  <span className="text-[13px] font-mono text-text font-medium">ETH / USD</span>
                  <div className="flex items-center gap-2 mt-px">
                    <span className="text-[10px] font-mono text-text-3/40">Ethereum</span>
                    <span className="w-px h-2.5 bg-white/[0.06]" />
                    <span className="text-[10px] font-mono text-text-3/40">24h</span>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-3">
                <motion.span
                  key={currentPrice}
                  initial={{ opacity: 0.5, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[32px] font-mono text-text font-semibold tabular-nums tracking-tight"
                >
                  {currentPrice > 0
                    ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "\u2014"}
                </motion.span>
                {change24h !== 0 && (
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${change24h >= 0 ? "bg-safe/10" : "bg-exposed/10"}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke={change24h >= 0 ? "var(--color-safe)" : "var(--color-exposed)"} strokeWidth="2.5">
                      <path d={change24h >= 0 ? "M7 17L17 7M17 17V7H7" : "M7 7l10 10M17 7v10H7"} />
                    </svg>
                    <span className={`text-[12px] font-mono font-medium ${change24h >= 0 ? "text-safe" : "text-exposed"}`}>
                      {Math.abs(change24h).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
              {chartHover && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] font-mono text-gold mt-1 tabular-nums"
                >
                  ${chartHover.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </motion.p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2.5 rounded-xl bg-gold text-bg font-mono text-[12px] font-medium hover:bg-gold-dim transition-colors flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Order
              </button>

              {/* Chart mode toggle */}
              <div className="flex items-center rounded-lg bg-white/[0.03] p-0.5">
                <button
                  onClick={() => setChartMode("line")}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-mono transition-all ${
                    chartMode === "line" ? "bg-white/[0.08] text-text shadow-sm" : "text-text-3/40 hover:text-text-3"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="inline -mt-px mr-1">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Line
                </button>
                <button
                  onClick={() => setChartMode("candle")}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-mono transition-all ${
                    chartMode === "candle" ? "bg-white/[0.08] text-text shadow-sm" : "text-text-3/40 hover:text-text-3"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="inline -mt-px mr-1">
                    <rect x="4" y="8" width="4" height="8" rx="0.5" />
                    <line x1="6" y1="4" x2="6" y2="8" />
                    <line x1="6" y1="16" x2="6" y2="20" />
                    <rect x="14" y="6" width="4" height="10" rx="0.5" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="16" y1="16" x2="16" y2="22" />
                  </svg>
                  Candles
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-72 w-full relative px-2 pb-3">
          {/* ── Line Chart ── */}
          {chartMode === "line" && chartData.length > 10 && (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${chartData.length} 100`}
              preserveAspectRatio="none"
              className="cursor-crosshair"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = Math.floor(((e.clientX - rect.left) / rect.width) * chartData.length);
                if (chartData[x]) setChartHover({ x, price: chartData[x][1] });
              }}
              onMouseLeave={() => setChartHover(null)}
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={change24h >= 0 ? "#22C55E" : "#EF4444"} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={change24h >= 0 ? "#22C55E" : "#EF4444"} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                fill="url(#areaGrad)"
                points={`0,100 ${chartData.map((d, i) => `${i},${100 - ((d[1] - chartMin) / chartRange) * 90}`).join(" ")} ${chartData.length - 1},100`}
              />
              <polyline
                fill="none"
                stroke={change24h >= 0 ? "#22C55E" : "#EF4444"}
                strokeWidth="1.2"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                points={chartData.map((d, i) => `${i},${100 - ((d[1] - chartMin) / chartRange) * 90}`).join(" ")}
              />
              {activeOrders.map((order) => {
                const y = 100 - ((order.targetPrice - chartMin) / chartRange) * 90;
                if (y < -10 || y > 110) return null;
                return (
                  <line key={order.id} x1="0" y1={y} x2={chartData.length} y2={y}
                    stroke={order.type === "price_below" ? "#EF4444" : "#22C55E"}
                    strokeWidth="0.8" strokeDasharray="4,4" vectorEffect="non-scaling-stroke" opacity="0.5" />
                );
              })}
              {chartHover && (
                <line x1={chartHover.x} y1="0" x2={chartHover.x} y2="100"
                  stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
          )}

          {/* ── Candlestick Chart ── */}
          {chartMode === "candle" && ohlcData.length > 3 && (() => {
            const candleSpacing = 10;
            const candleWidth = 7;
            const totalWidth = ohlcData.length * candleSpacing;

            return (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${totalWidth} 100`}
              preserveAspectRatio="none"
              className="cursor-crosshair"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const idx = Math.floor(((e.clientX - rect.left) / rect.width) * ohlcData.length);
                if (ohlcData[idx]) setChartHover({ x: idx, price: ohlcData[idx][4] });
              }}
              onMouseLeave={() => setChartHover(null)}
            >
              {ohlcData.map((candle, i) => {
                const [, open, high, low, close] = candle;
                const isGreen = close >= open;
                const color = isGreen ? "#22C55E" : "#EF4444";

                const x = i * candleSpacing + (candleSpacing - candleWidth) / 2;
                const wickX = i * candleSpacing + candleSpacing / 2;
                const width = candleWidth;

                const highY = 100 - ((high - candleMin) / candleRange) * 90;
                const lowY = 100 - ((low - candleMin) / candleRange) * 90;
                const openY = 100 - ((open - candleMin) / candleRange) * 90;
                const closeY = 100 - ((close - candleMin) / candleRange) * 90;

                const bodyTop = Math.min(openY, closeY);
                const bodyHeight = Math.max(Math.abs(openY - closeY), 0.5);

                return (
                  <g key={i}>
                    {/* Wick */}
                    <line
                      x1={wickX} y1={highY}
                      x2={wickX} y2={lowY}
                      stroke={color}
                      strokeWidth="1.2"
                      vectorEffect="non-scaling-stroke"
                      opacity="0.7"
                    />
                    {/* Body */}
                    <rect
                      x={x} y={bodyTop}
                      width={width} height={bodyHeight}
                      fill={color}
                      opacity={0.9}
                      rx="0.5"
                    />
                  </g>
                );
              })}

              {/* Active order target lines */}
              {activeOrders.map((order) => {
                const y = 100 - ((order.targetPrice - candleMin) / candleRange) * 90;
                if (y < -10 || y > 110) return null;
                return (
                  <line key={order.id} x1="0" y1={y} x2={totalWidth} y2={y}
                    stroke={order.type === "price_below" ? "#EF4444" : "#22C55E"}
                    strokeWidth="0.8" strokeDasharray="4,4" vectorEffect="non-scaling-stroke" opacity="0.5" />
                );
              })}

              {/* Hover line */}
              {chartHover && (
                <line x1={chartHover.x * candleSpacing + candleSpacing / 2} y1="0" x2={chartHover.x * candleSpacing + candleSpacing / 2} y2="100"
                  stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            );
          })()}

          {/* Loading */}
          {((chartMode === "line" && chartData.length <= 10) || (chartMode === "candle" && ohlcData.length <= 3)) && (
            <div className="h-full flex items-center justify-center">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-text-3 animate-pulse-dot" />
                <span className="text-[11px] font-mono text-text-3/40">Loading chart...</span>
              </div>
            </div>
          )}

          {/* Time labels */}
          <div className="absolute bottom-2 left-4 right-4 flex justify-between pointer-events-none">
            <span className="text-[9px] font-mono text-text-3/30">24h ago</span>
            <span className="text-[9px] font-mono text-text-3/30">Now</span>
          </div>

          {/* Price scale */}
          {(chartMode === "line" ? chartData.length > 10 : ohlcData.length > 3) && (
            <div className="absolute top-1 right-3 bottom-4 flex flex-col justify-between pointer-events-none">
              <span className="text-[8px] font-mono text-text-3/25 tabular-nums">
                ${(chartMode === "line" ? chartMax : candleMax).toFixed(0)}
              </span>
              <span className="text-[8px] font-mono text-text-3/25 tabular-nums">
                ${(chartMode === "line" ? chartMin : candleMin).toFixed(0)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Create Order Form ═══ */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5" style={{ background: "linear-gradient(135deg, rgba(19,19,22,0.95) 0%, rgba(15,15,18,0.98) 100%)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gold/10 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <h3 className="text-[14px] text-text font-medium">New DCA Order</h3>
                </div>
                <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg bg-white/[0.03] flex items-center justify-center text-text-3 hover:text-text hover:bg-white/[0.06] transition-colors text-sm">&times;</button>
              </div>

              {/* Condition */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-text-3 block mb-2">
                  Execute when ETH
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: "price_below" as const, label: "Drops below", color: "exposed" },
                    { val: "price_above" as const, label: "Rises above", color: "safe" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setFormType(opt.val)}
                      className={`py-3 rounded-xl font-mono text-[12px] transition-all ${
                        formType === opt.val
                          ? `bg-${opt.color}/10 border border-${opt.color}/25 text-${opt.color}`
                          : "glass text-text-3 hover:text-text-2"
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" className="inline mr-1.5 -mt-px"
                        stroke={formType === opt.val ? `var(--color-${opt.color})` : "currentColor"}>
                        <path d={opt.val === "price_below" ? "M7 7l10 10M17 7v10H7" : "M7 17L17 7M17 17V7H7"} />
                      </svg>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target price */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-text-3 block mb-2">
                  Target price
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-3 font-mono text-[14px]">$</span>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder={currentPrice > 0 ? currentPrice.toFixed(0) : "2000"}
                    className="w-full glass rounded-xl pl-8 pr-4 py-3.5 text-[15px] font-mono text-text placeholder:text-text-3/25 focus:outline-none input-glow tabular-nums"
                  />
                </div>
                <div className="flex gap-1.5 mt-2">
                  {currentPrice > 0 &&
                    [
                      { label: "-5%", mult: 0.95 },
                      { label: "-10%", mult: 0.90 },
                      { label: "+5%", mult: 1.05 },
                      { label: "+10%", mult: 1.10 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        onClick={() => {
                          setFormPrice((currentPrice * p.mult).toFixed(0));
                          setFormType(p.mult < 1 ? "price_below" : "price_above");
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono transition-colors ${
                          formPrice === (currentPrice * p.mult).toFixed(0)
                            ? "bg-gold/15 text-gold border border-gold/20"
                            : "glass text-text-3 hover:text-text-2"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                </div>
              </div>

              {/* Amount + Recipient */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-text-3 block mb-2">
                    Amount (ETH)
                  </label>
                  <input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    step="0.0001"
                    className="w-full glass rounded-xl px-4 py-3.5 text-[14px] font-mono text-text placeholder:text-text-3/25 focus:outline-none input-glow tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-text-3 block mb-2">
                    Recipient
                  </label>
                  <input
                    type="text"
                    value={formRecipient}
                    onChange={(e) => setFormRecipient(e.target.value)}
                    className="w-full glass rounded-xl px-4 py-3.5 text-[11px] font-mono text-text placeholder:text-text-3/25 focus:outline-none input-glow"
                  />
                </div>
              </div>

              {/* Summary */}
              {formPrice && formAmount && (
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3">
                  <p className="text-[12px] text-text-2">
                    When ETH {formType === "price_below" ? "drops below" : "rises above"}{" "}
                    <span className="text-text font-medium">${parseFloat(formPrice).toLocaleString()}</span>,
                    send <span className="text-gold font-medium">{formAmount} ETH</span> privately
                  </p>
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={creating || !formPrice || !formAmount}
                className="w-full py-3.5 rounded-xl bg-gold text-bg font-mono text-[13px] font-medium hover:bg-gold-dim transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                {creating ? "Creating order..." : "Create Private DCA Order"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Active Orders ═══ */}
      {activeOrders.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-gold/10" style={{ background: "linear-gradient(135deg, rgba(212,168,83,0.03) 0%, rgba(9,9,11,0.95) 100%)" }}>
          <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-gold" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-gold animate-ping opacity-40" />
              </div>
              <span className="text-[12px] font-mono text-text font-medium">Active Orders</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gold/5">
              <div className="w-1 h-1 rounded-full bg-gold animate-pulse-dot" />
              <span className="text-[10px] font-mono text-gold/70">Live</span>
            </div>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {activeOrders.map((order, i) => {
              const distPercent = currentPrice > 0
                ? (((order.targetPrice - currentPrice) / currentPrice) * 100)
                : 0;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="px-5 py-4 flex items-center gap-4"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    order.type === "price_below" ? "bg-exposed/8" : "bg-safe/8"
                  }`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"
                      stroke={order.type === "price_below" ? "var(--color-exposed)" : "var(--color-safe)"}>
                      <path d={order.type === "price_below" ? "M7 7l10 10M17 7v10H7" : "M7 17L17 7M17 17V7H7"} />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-text mb-0.5">
                      When ETH {order.type === "price_below" ? "drops below" : "rises above"}{" "}
                      <span className="font-mono font-medium">${order.targetPrice.toLocaleString()}</span>
                      <span className={`text-[11px] font-mono ml-1.5 ${distPercent < 0 ? "text-safe" : "text-text-3/50"}`}>
                        ({distPercent > 0 ? "+" : ""}{distPercent.toFixed(1)}% away)
                      </span>
                    </p>
                    <p className="text-[11px] font-mono text-text-3/50">
                      Send <span className="text-gold">{order.amount} ETH</span> to {order.recipient.slice(0, 8)}...{order.recipient.slice(-4)} via ShadeVault
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${order.type === "price_below" ? "bg-exposed/50" : "bg-safe/50"}`}
                          initial={{ width: "0%" }}
                          animate={{ width: `${Math.min(100, Math.max(5, 100 - Math.abs(distPercent) * 10))}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-text-3/40 shrink-0">
                        ${Math.abs(currentPrice - order.targetPrice).toFixed(0)} away
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCancel(order.id)}
                    className="text-text-3/40 hover:text-exposed transition-colors shrink-0 p-1"
                    title="Cancel"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Past Orders ═══ */}
      {pastOrders.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-white/[0.04]" style={{ background: "rgba(13,13,16,0.8)" }}>
          <div className="px-5 py-3.5 border-b border-white/[0.04]">
            <span className="text-[12px] font-mono text-text-3">Order History</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {pastOrders.slice(0, 5).map((order) => (
              <div key={order.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  order.status === "triggered" ? "bg-safe/10" : order.status === "cancelled" ? "bg-white/[0.03]" : "bg-exposed/10"
                }`}>
                  {order.status === "triggered" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-safe)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                  ) : order.status === "cancelled" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-exposed)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-text-2 mb-0.5">
                    {order.type === "price_below" ? "Below" : "Above"} <span className="font-mono">${order.targetPrice.toLocaleString()}</span>
                    {" \u2192 "}
                    <span className="text-gold font-mono">{order.amount} ETH</span>
                    {" to "}
                    <span className="font-mono text-text-3">{order.recipient.slice(0, 6)}...{order.recipient.slice(-4)}</span>
                  </p>
                  <p className="text-[10px] font-mono text-text-3/40">
                    {order.status === "triggered" ? "Executed privately via ShadeVault" : order.status === "cancelled" ? "Cancelled by user" : "Failed to execute"}
                    {order.triggeredAt ? ` \u2022 ${getTimeAgo(Math.floor(order.triggeredAt / 1000))}` : ""}
                  </p>
                </div>
                {order.txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${order.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-3/40 hover:text-gold transition-colors shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Empty State ═══ */}
      {orders.length === 0 && !loading && !showForm && (
        <div className="rounded-2xl border border-white/[0.04] p-10 text-center" style={{ background: "linear-gradient(135deg, rgba(19,19,22,0.8) 0%, rgba(9,9,11,0.9) 100%)" }}>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-safe/10 to-exposed/10 flex items-center justify-center mx-auto mb-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="1.5">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <h3 className="text-[15px] text-text font-medium mb-2">No active orders</h3>
          <p className="text-[12px] text-text-3 mb-5 max-w-xs mx-auto">
            Set a price target and Shade will auto-execute when conditions are met. Fully private.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 rounded-xl bg-gold text-bg font-mono text-[12px] font-medium hover:bg-gold-dim transition-colors"
          >
            Create first order
          </button>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
