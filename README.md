<p align="center">
  <img src="web/public/icon.svg" width="80" height="80" alt="Shade Logo" />
</p>

<h1 align="center">Shade</h1>

<p align="center">
  <strong>An AI agent that proves it can act, without exposing who sent it.</strong>
</p>

<p align="center">
  <a href="https://shade-privacy.vercel.app">Live Demo</a> &nbsp;|&nbsp;
  <a href="https://youtu.be/sgFL1r5_FuY">Video Walkthrough</a> &nbsp;|&nbsp;
  <a href="https://sepolia.basescan.org/address/0x6cFf39E67B660A14933D83348Ecc5c8102B59EeC">Contracts</a> &nbsp;|&nbsp;
  <a href="https://testnet.8004scan.io/agents/base-sepolia/2321">ERC-8004 Identity</a>
</p>

---

## The Problem

Every AI agent today leaks its operator's identity. When an agent calls an API, pays for a service, or interacts with a contract, it creates metadata — wallet addresses, transaction patterns, IP addresses, spending behavior — all tracing back to the human behind it.

**Your agent isn't leaking its own data. It's leaking yours.**

## What Shade Does

Shade is an autonomous agent that handles payments and on-chain actions privately. You give it a task, and it figures out the minimum information needed to complete it — hiding everything else.

**Private ETH Transfers** — Send ETH from ShadeVault to any address or ENS name. Your wallet never appears on-chain. Per-user balance tracking ensures you only spend what you deposited.

**Private USDC Payments** — Send USDC through Locus on Base mainnet. The recipient gets paid but can't trace it back to you.

**Private DCA Orders** — Set a price target. When ETH hits it, the agent auto-executes a private transfer. Live candlestick charts, real-time price monitoring.

**Recurring Auto-Payments** — Schedule private payments at any interval — every 5 minutes to every month. The agent handles everything autonomously.

**ENS Resolution** — Type `vitalik.eth` instead of raw hex addresses. The agent resolves names privately via Ethereum mainnet.

**On-chain Receipts** — Every action gets a verifiable receipt on ShadeVerifier. Anyone can verify the agent acted correctly, but nobody can see who requested it.

**PDF Audit Logs** — Export your full privacy report as a branded PDF. Every field hidden, every action logged, compliance-ready.

**QR Code Payments** — Generate scannable payment links for mobile deposits to both the vault and Locus wallet.

Every transaction listed above is real, executed on-chain, and verifiable on BaseScan.

## How It Works

```
User connects wallet
    |
    v
Deposits ETH into ShadeVault (per-user balance tracked on-chain)
    |
    v
Types a task: "Send 0.001 ETH to vitalik.eth privately"
    |
    v
Venice AI reasons about the task (zero data retention)
    |
    v
Selective Disclosure Engine decides minimum info to reveal
    |
    v
ENS resolves "vitalik.eth" to an address (Ethereum mainnet lookup)
    |
    v
Agent executes via ShadeVault (ETH) or Locus (USDC)
    |
    v
Receipt logged on-chain to ShadeVerifier
    |
    v
User sees privacy report: what was hidden vs what was revealed
```

## Architecture

| Layer | Technology |
|-------|-----------|
| AI Inference | Venice AI (private, zero data retention) |
| Smart Contracts | Solidity 0.8.20, Foundry, OpenZeppelin |
| Agent Backend | TypeScript, Express.js, ethers.js v6 |
| Frontend | Next.js, Tailwind CSS, Framer Motion |
| Wallet | RainbowKit, wagmi, viem |
| Payments | Locus API (USDC on Base mainnet) |
| Agent Identity | ERC-8004 (Agent #2321 on Base Sepolia) |
| Price Feed | CoinGecko API with CoinLore fallback |
| Deployment | Vercel (frontend) + Railway (backend) |

## Deployed Contracts

**Base Sepolia**

| Contract | Address |
|----------|---------|
| ShadeVault (v2) | [`0x6cFf39E67B660A14933D83348Ecc5c8102B59EeC`](https://sepolia.basescan.org/address/0x6cFf39E67B660A14933D83348Ecc5c8102B59EeC) |
| ShadeVerifier | [`0xb2908FB08B189f2b91926705940E15D4E75ab501`](https://sepolia.basescan.org/address/0xb2908FB08B189f2b91926705940E15D4E75ab501) |

**Status Sepolia** (gasless, gas = 0)

| Contract | Address |
|----------|---------|
| ShadeVault | [`0xA262185de81ee3fE50266a765a5e6AFa5Ad430D7`](https://sepoliascan.status.network/address/0xA262185de81ee3fE50266a765a5e6AFa5Ad430D7) |
| ShadeVerifier | [`0xF74079a7CC2d0FB0268B10E34bbeBfd2f4299EC0`](https://sepoliascan.status.network/address/0xF74079a7CC2d0FB0268B10E34bbeBfd2f4299EC0) |

**ERC-8004 Identity**

| | |
|-|-|
| Agent ID | #2321 |
| Registry | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://sepolia.basescan.org/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| 8004scan | [View Agent](https://testnet.8004scan.io/agents/base-sepolia/2321) |

## Project Structure

```
shade/
├── agent/                    # Autonomous agent backend
│   └── src/
│       ├── index.ts          # Express API server + all endpoints
│       ├── agent.ts          # Main orchestrator (5-phase pipeline)
│       ├── config.ts         # Environment + contract config
│       ├── privacy/
│       │   ├── venice.ts     # Venice AI private inference
│       │   ├── disclosure.ts # Selective Disclosure Engine
│       │   └── metadata-strip.ts
│       ├── identity/
│       │   ├── erc8004.ts    # ERC-8004 agent registration
│       │   └── ens.ts        # ENS resolution (multi-RPC fallback)
│       ├── payments/
│       │   └── locus.ts      # Locus USDC payment client
│       ├── execution/
│       │   ├── task-classifier.ts  # Venice AI task classification
│       │   ├── task-executor.ts    # On-chain execution (spendFrom)
│       │   ├── dca-monitor.ts      # DCA price monitoring + auto-execute
│       │   ├── recurring.ts        # Recurring payment scheduler
│       │   └── user-history.ts     # Per-user transaction tracking
│       └── logging/
│           └── agent-log.ts  # Structured logs (Protocol Labs format)
├── contracts/                # Solidity smart contracts (Foundry)
│   └── src/
│       ├── ShadeVault.sol    # Per-user treasury with spending controls
│       └── ShadeVerifier.sol # On-chain privacy-preserving receipts
├── web/                      # Frontend (Next.js)
│   └── src/
│       ├── app/
│       │   ├── page.tsx      # Landing page (scroll-based slides)
│       │   ├── app/          # Agent dashboard
│       │   ├── dca/          # DCA orders + live price charts
│       │   ├── recurring/    # Auto-Pay scheduled payments
│       │   └── demo/         # Side-by-side comparison view
│       └── components/
│           ├── DCAPanel.tsx   # Candlestick + line charts
│           ├── TaskHistory.tsx # Per-user transaction history
│           ├── DepositModal.tsx # Vault deposit with QR code
│           ├── ExportPDF.tsx  # PDF audit log export
│           ├── QRPayment.tsx  # QR payment link generator
│           └── ShadeLogo.tsx  # Brand logo component
├── agent.json                # ERC-8004 agent metadata
└── agent_log.json            # Structured execution log
```

## Getting Started

```bash
# Clone the repo
git clone https://github.com/martinvibes/Shade.git
cd Shade

# Set up environment
cp .env.example .env
# Fill in: VENICE_API_KEY, PRIVATE_KEY, LOCUS_API_KEY

# Install everything
cd agent && pnpm install
cd ../web && pnpm install

# Start the agent (Terminal 1)
cd agent && pnpm dev

# Start the frontend (Terminal 2)
cd web && pnpm dev

# Open http://localhost:3000
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/task` | Execute a task privately |
| GET | `/vault/balance?user=0x...` | Per-user vault balance |
| GET | `/user/history?user=0x...` | Per-user transaction history |
| GET | `/health` | Agent status |
| GET | `/stats` | Global agent metrics |
| GET | `/dca/orders?user=0x...` | User's DCA orders |
| POST | `/dca/create` | Create a DCA price order |
| GET | `/dca/price` | Current ETH price (cached) |
| GET | `/dca/chart` | 24h line + OHLC chart data |
| POST | `/recurring/create` | Create recurring payment |
| GET | `/recurring/list?user=0x...` | User's scheduled payments |
| GET | `/locus/status` | Locus USDC wallet info |
| GET | `/ens/resolve/:name` | Resolve ENS name to address |

## What Makes Shade Different

Every other agent project builds agents that *do* things. Shade builds an agent that does things **without leaking who asked for it**.

The Selective Disclosure Engine is the core innovation. The agent actively reasons: "I need to reveal a budget range to complete this task, but I can hide the exact amount, the identity, the wallet, the IP, and the full intent."

It's not encryption. It's not mixing. It's an AI that decides what to reveal and what to keep secret — per task, in real time.

## Hackathon Tracks

| Track | What We Built |
|-------|--------------|
| Venice AI | Every task reasons through Venice with zero data retention |
| Protocol Labs — Let the Agent Cook | Fully autonomous agent with ERC-8004 #2321, structured agent_log.json |
| Protocol Labs — Agents With Receipts | On-chain receipts on ShadeVerifier, verifiable on BaseScan |
| Status Network — Go Gasless | Contracts deployed on Status Sepolia at 0 gwei |
| Locus — Best Use | Real USDC payments on Base mainnet via Locus API |
| ENS Identity | ENS resolution as core identity — type names, not addresses |
| Synthesis Open Track | Full platform with DCA, recurring payments, PDF exports, QR codes |

## License

MIT
