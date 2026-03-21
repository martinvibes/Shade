"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const LINKS = [
  { href: "/app", label: "Agent" },
  { href: "/dca", label: "DCA" },
  { href: "/recurring", label: "Recurring" },
  { href: "/demo", label: "Demo" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border px-6 h-14 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-2 h-2 rounded-full bg-gold animate-pulse-dot" />
          <span className="font-mono text-[13px] font-medium tracking-[0.18em] text-text uppercase">
            Shade
          </span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded text-[13px] transition-colors ${
                  active
                    ? "text-text bg-surface-2"
                    : "text-text-3 hover:text-text-2"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right side: status + wallet */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-safe" />
          <span className="text-[12px] text-text-3 font-mono">Agent Online</span>
        </div>
        <div className="h-5 w-px bg-border" />
        <ConnectButton
          chainStatus="icon"
          accountStatus="address"
          showBalance={false}
        />
      </div>
    </nav>
  );
}
