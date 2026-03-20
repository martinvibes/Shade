"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

/*
 * Card-stack slide: each section is sticky so it stays in place.
 * The NEXT section slides up over the current one — like swiping pages on a phone.
 * We wrap each slide in a tall container (200vh) so there's scroll room
 * for the sticky element to "hold" while the next card arrives.
 */
function Slide({
  children,
  imageSrc,
  overlay = "bg-bg/60",
  index = 0,
  isLast = false,
}: {
  children: ReactNode;
  imageSrc: string;
  overlay?: string;
  index?: number;
  isLast?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.4 });

  return (
    <div
      className="relative"
      style={{ height: isLast ? "100vh" : "200vh" }}
    >
      <section
        ref={ref}
        className="sticky top-0 h-screen flex items-center justify-center overflow-hidden"
        style={{ zIndex: index + 1 }}
      >
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src={imageSrc}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            quality={85}
            priority={index < 2}
          />
        </div>

        {/* Overlay */}
        <div className={`absolute inset-0 ${overlay}`} />

        {/* Content — fades + slides up when in view */}
        <motion.div
          className="relative z-10 w-full"
          initial={{ opacity: 0, y: 60 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </section>
    </div>
  );
}

/* ── Staggered child animation ── */
function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Landing() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();

  const handleConnect = () => {
    if (isConnected) {
      router.push("/app");
    } else {
      openConnectModal?.();
    }
  };

  return (
    <div className="bg-bg h-screen overflow-y-auto scroll-smooth">
      {/* ── Fixed nav ── */}
      <header className="fixed top-0 left-0 right-0 z-50 px-8 py-5 flex items-center justify-between mix-blend-difference pointer-events-none">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <span className="font-mono text-[13px] font-medium tracking-[0.2em] text-white uppercase">
            Shade
          </span>
        </div>
        <nav className="flex items-center gap-6 pointer-events-auto">
          <Link
            href="/demo"
            className="font-mono text-[12px] text-white/60 hover:text-white transition-colors"
          >
            Demo
          </Link>
          <button
            onClick={handleConnect}
            className="font-mono text-[12px] text-white/60 hover:text-white transition-colors"
          >
            {isConnected ? "Launch App" : "Connect"}
          </button>
        </nav>
      </header>

      {/* ── Slide progress dots ── */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-white/30 transition-all duration-300"
          />
        ))}
      </div>

      {/* ─────── SLIDE 1: Hero ─────── */}
      <Slide
        index={0}
        imageSrc="https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=1800&q=80&auto=format"
        overlay="bg-bg/50"
      >
        <div className="max-w-6xl mx-auto px-8 md:px-16">
          <FadeUp>
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold mb-6">
              Privacy-Preserving Autonomous Agent
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 className="font-serif text-6xl md:text-7xl lg:text-8xl text-white leading-[1.05] max-w-2xl">
              Act without
              <br />
              <span className="italic text-gold">being seen.</span>
            </h1>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="text-white/50 text-lg max-w-lg mt-8 leading-relaxed">
              An autonomous AI agent that pays, transacts, and operates
              on your behalf — without ever revealing your identity.
            </p>
          </FadeUp>
          <FadeUp delay={0.3}>
            <div className="flex items-center gap-4 mt-10">
              <button
                onClick={handleConnect}
                className="px-7 py-3.5 rounded-lg bg-gold text-bg font-mono text-[13px] font-medium hover:bg-gold-dim transition-colors"
              >
                {isConnected ? "Launch App" : "Connect Wallet"}
              </button>
              <Link
                href={isConnected ? "/app" : "/demo"}
                className="px-7 py-3.5 rounded-lg border border-white/20 font-mono text-[13px] text-white/70 hover:text-white hover:border-white/40 transition-colors"
              >
                {isConnected ? "View Demo" : "Watch Demo"}
              </Link>
            </div>
          </FadeUp>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <span className="font-mono text-[10px] text-white/30 tracking-widest uppercase">
              Scroll
            </span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent"
            />
          </motion.div>
        </div>
      </Slide>

      {/* ─────── SLIDE 2: The Problem ─────── */}
      <Slide
        index={1}
        imageSrc="https://images.unsplash.com/photo-1516557070061-c3d1653fa646?w=1800&q=80&auto=format"
        overlay="bg-bg/70"
      >
        <div className="max-w-6xl mx-auto px-8 md:px-16 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1">
            <FadeUp>
              <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-exposed mb-5">
                The Problem
              </p>
            </FadeUp>
            <FadeUp delay={0.1}>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-8">
                Every agent today
                <br />
                <span className="italic text-exposed/80">leaks everything.</span>
              </h2>
            </FadeUp>
            <FadeUp delay={0.2}>
              <p className="text-white/50 text-[16px] leading-relaxed max-w-md">
                Name. Wallet. Intent. IP. Device. Every action your agent takes
                creates a trail that leads directly back to you.
              </p>
            </FadeUp>
          </div>

          <FadeUp delay={0.3} className="w-80 shrink-0">
            <div className="bg-surface/80 backdrop-blur-2xl border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-exposed" />
                <span className="font-mono text-[11px] tracking-wider text-exposed uppercase">
                  Standard Agent Exposure
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Name", value: "John Smith" },
                  { label: "Wallet", value: "0x742d...8e4f" },
                  { label: "Email", value: "john@example.com" },
                  { label: "Intent", value: "Buy API for farm" },
                  { label: "IP", value: "192.168.1.105" },
                  { label: "Budget", value: "$7.50 exact" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-text-3">{item.label}</span>
                    <span className="font-mono text-[11px] text-exposed/70">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                <span className="font-mono text-[10px] text-exposed/50">
                  7/7 fields exposed to third parties
                </span>
              </div>
            </div>
          </FadeUp>
        </div>
      </Slide>

      {/* ─────── SLIDE 3: The Solution ─────── */}
      <Slide
        index={2}
        imageSrc="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1800&q=80&auto=format"
        overlay="bg-bg/65"
      >
        <div className="max-w-6xl mx-auto px-8 md:px-16 flex flex-col lg:flex-row items-center gap-16">
          <FadeUp delay={0.1} className="w-80 shrink-0 order-2 lg:order-1">
            <div className="bg-surface/80 backdrop-blur-2xl border border-gold/20 rounded-xl p-6 glow-gold">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-gold animate-pulse-dot" />
                <span className="font-mono text-[11px] tracking-wider text-gold uppercase">
                  Shade Agent Shield
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Name", value: "Hidden", safe: true },
                  { label: "Wallet", value: "Ephemeral", safe: true },
                  { label: "Email", value: "Hidden", safe: true },
                  { label: "Intent", value: '"data access"', safe: false },
                  { label: "IP", value: "Stripped", safe: true },
                  { label: "Budget", value: "$5\u201310 range", safe: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-text-3">{item.label}</span>
                    <span
                      className={`font-mono text-[11px] ${
                        item.safe ? "text-safe" : "text-gold"
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-gold/10">
                <span className="font-mono text-[10px] text-gold/60">
                  0/7 fields fully exposed
                </span>
              </div>
            </div>
          </FadeUp>

          <div className="flex-1 order-1 lg:order-2">
            <FadeUp>
              <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold mb-5">
                The Solution
              </p>
            </FadeUp>
            <FadeUp delay={0.15}>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-8">
                Shade breaks
                <br />
                <span className="italic text-gold">the link.</span>
              </h2>
            </FadeUp>
            <FadeUp delay={0.25}>
              <p className="text-white/50 text-[16px] leading-relaxed max-w-md">
                Fund the agent once. From that moment, it operates through
                ephemeral wallets, proves authorization with zero-knowledge proofs,
                and reasons through a private inference engine that retains nothing.
              </p>
            </FadeUp>
          </div>
        </div>
      </Slide>

      {/* ─────── SLIDE 4: How It Works ─────── */}
      <Slide
        index={3}
        imageSrc="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1800&q=80&auto=format"
        overlay="bg-bg/80"
      >
        <div className="max-w-6xl mx-auto px-8 md:px-16">
          <FadeUp>
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-text-3 mb-4">
              How It Works
            </p>
            <h2 className="font-serif text-4xl md:text-5xl text-white mb-14">
              Four layers of <span className="italic text-gold">privacy.</span>
            </h2>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                num: "01",
                title: "Private Reasoning",
                desc: "Venice AI processes your task with zero data retention. Nothing stored. Nothing logged.",
              },
              {
                num: "02",
                title: "Selective Disclosure",
                desc: "The agent reasons about minimum data to reveal. Budget range, not exact. Category, not full intent.",
              },
              {
                num: "03",
                title: "ZK Authorization",
                desc: 'Self Protocol proves "I am authorized" without revealing who. Zero-knowledge identity verification.',
              },
              {
                num: "04",
                title: "Ephemeral Execution",
                desc: "One-time wallets via Locus handle payments. Every transaction is untraceable back to you.",
              },
            ].map((step, i) => (
              <FadeUp key={step.num} delay={i * 0.1}>
                <div className="bg-surface/60 backdrop-blur-xl border border-gold/20 rounded-xl p-6 h-full">
                  <span className="font-mono text-gold/40 text-[28px] font-medium">
                    {step.num}
                  </span>
                  <h3 className="text-[15px] text-white font-medium mt-3 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[13px] text-white/40 leading-relaxed">{step.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </Slide>

      {/* ─────── SLIDE 5: CTA ─────── */}
      <Slide
        index={4}
        isLast
        imageSrc="https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1800&q=80&auto=format"
        overlay="bg-bg/60"
      >
        <div className="max-w-3xl mx-auto px-8 text-center">
          <FadeUp>
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold mb-6">
              Get Started
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-serif text-5xl md:text-6xl lg:text-7xl text-white mb-6">
              Ready to go
              <br />
              <span className="italic text-gold">invisible?</span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="text-white/40 text-[16px] max-w-md mx-auto mb-10 leading-relaxed">
              Connect your wallet. Fund the agent. From that moment on,
              Shade handles everything — and nothing traces back to you.
            </p>
          </FadeUp>
          <FadeUp delay={0.3}>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleConnect}
                className="px-8 py-4 rounded-lg bg-gold text-bg font-mono text-[14px] font-medium hover:bg-gold-dim transition-colors"
              >
                {isConnected ? "Launch App" : "Connect Wallet"}
              </button>
              <Link
                href="/app"
                className="px-8 py-4 rounded-lg border border-white/15 font-mono text-[14px] text-white/60 hover:text-white hover:border-white/30 transition-colors"
              >
                Launch App
              </Link>
            </div>
          </FadeUp>

          <FadeUp delay={0.4}>
            <div className="flex items-center justify-center gap-6 mt-16">
              {["Venice AI", "Self Protocol", "ERC-8004", "Locus", "ENS"].map(
                (name) => (
                  <span
                    key={name}
                    className="font-mono text-[10px] tracking-wider text-white/20 uppercase"
                  >
                    {name}
                  </span>
                )
              )}
            </div>
          </FadeUp>
        </div>
      </Slide>
    </div>
  );
}
