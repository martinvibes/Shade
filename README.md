# Shade — Privacy-Preserving Autonomous Agent

> An AI agent that proves it can act, without exposing who sent it.

Shade is a fully autonomous AI agent that executes on-chain actions on behalf of users — private payments, vault transfers, anonymous donations — **without ever revealing the user's identity, wallet, or intent**.

## How It Works

1. **Private Reasoning** — Venice AI processes every task with zero data retention. No prompts stored. No responses logged.
2. **Selective Disclosure** — The agent reasons about the *minimum* information needed to complete a task. Budget range instead of exact amount. Category instead of full intent. Identity always hidden.
3. **Ephemeral Execution** — Payments route through one-time wallets via ShadeVault. Authorization proven with ZK proofs. Nothing links the action back to you.
4. **On-chain Receipts** — Every task is logged to ShadeVerifier as a privacy-preserving receipt. Verifiable by anyone, reveals nothing about the operator.

## What Shade Actually Does (Real, Not Mocked)

- **Private vault transfers** — Send ETH from ShadeVault to any address. The vault's spending controls enforce budget limits. On-chain, verifiable.
- **Private payments via Locus** — Send USDC through Locus-managed wallets. The recipient receives payment but cannot trace it to the sender.
- **Anonymous donations** — Fund public goods without revealing your identity.
- **Privacy analysis** — For any task, Shade generates a disclosure manifest showing exactly what was hidden vs revealed.

All transactions are real and verifiable on Base Sepolia block explorer.

## Architecture

```
User connects wallet → Deposits ETH into ShadeVault
    ↓
User gives task ("Send 0.001 ETH to 0x... privately")
    ↓
Venice AI reasons about the task (zero data retention)
    ↓
Disclosure Engine decides minimum info to reveal
    ↓
Agent executes via ShadeVault or Locus (ephemeral wallets)
    ↓
Receipt logged on-chain to ShadeVerifier
    ↓
User sees privacy report: what was hidden vs revealed
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Inference | Venice AI (private, zero retention) |
| Smart Contracts | Solidity 0.8.20, Foundry, OpenZeppelin |
| Agent Backend | TypeScript, Express.js, ethers.js v6 |
| Frontend | Next.js 16, Tailwind CSS, Framer Motion |
| Wallet | RainbowKit, wagmi, viem |
| Payments | Locus (USDC on Base) |
| Agent Identity | ERC-8004 (Agent #2321) |
| Chains | Base Sepolia, Status Sepolia |

## Deployed Contracts

### Base Sepolia
| Contract | Address |
|----------|---------|
| ShadeVault | [`0x6a9E17F61023f3Cd39Cc1F29D4649E87BD004ebb`](https://sepolia.basescan.org/address/0x6a9E17F61023f3Cd39Cc1F29D4649E87BD004ebb) |
| ShadeVerifier | [`0xb2908FB08B189f2b91926705940E15D4E75ab501`](https://sepolia.basescan.org/address/0xb2908FB08B189f2b91926705940E15D4E75ab501) |

### Status Sepolia
| Contract | Address |
|----------|---------|
| ShadeVault | [`0xA262185de81ee3fE50266a765a5e6AFa5Ad430D7`](https://sepoliascan.status.network/address/0xA262185de81ee3fE50266a765a5e6AFa5Ad430D7) |
| ShadeVerifier | [`0xF74079a7CC2d0FB0268B10E34bbeBfd2f4299EC0`](https://sepoliascan.status.network/address/0xF74079a7CC2d0FB0268B10E34bbeBfd2f4299EC0) |

### ERC-8004 Identity
| | |
|-|-|
| Agent ID | 2321 |
| Registry | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://sepolia.basescan.org/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| 8004scan | [View Agent](https://www.8004scan.io/agents/2321) |

## Project Structure

```
shade/
├── agent/              # Autonomous agent backend
│   └── src/
│       ├── index.ts            # Express API server
│       ├── agent.ts            # Main orchestrator pipeline
│       ├── privacy/
│       │   ├── venice.ts       # Venice AI private inference
│       │   ├── disclosure.ts   # Selective disclosure engine
│       │   └── metadata-strip.ts
│       ├── identity/
│       │   ├── erc8004.ts      # ERC-8004 agent registration
│       │   └── ens.ts          # ENS name resolution
│       ├── payments/
│       │   └── locus.ts        # Locus payment client
│       ├── execution/
│       │   ├── task-classifier.ts  # Venice AI task classification
│       │   └── task-executor.ts    # Real on-chain execution
│       └── logging/
│           └── agent-log.ts    # Structured logging (Protocol Labs)
├── contracts/          # Solidity smart contracts (Foundry)
│   └── src/
│       ├── ShadeVault.sol      # Privacy-preserving treasury
│       └── ShadeVerifier.sol   # On-chain task receipts
├── web/                # Frontend (Next.js)
│   └── src/
│       ├── app/
│       │   ├── page.tsx        # Landing page
│       │   ├── app/page.tsx    # Agent dashboard
│       │   └── demo/page.tsx   # Live demo
│       └── components/         # UI components
├── agent.json          # ERC-8004 agent metadata
└── .env.example        # Environment template
```

## Setup

```bash
# Clone
git clone https://github.com/martinvibes/Shade.git
cd Shade

# Copy environment config
cp .env.example .env
# Fill in: VENICE_API_KEY, PRIVATE_KEY, LOCUS_API_KEY

# Install dependencies
cd agent && pnpm install
cd ../web && pnpm install

# Run agent backend
cd agent && pnpm dev

# Run frontend (separate terminal)
cd web && pnpm dev

# Open http://localhost:3000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Agent status |
| POST | `/task` | Execute a task privately |
| GET | `/stats` | On-chain agent stats |
| GET | `/vault/balance` | ShadeVault balance |
| GET | `/verify/:hash` | Verify task on-chain |
| GET | `/locus/balance` | Locus wallet balance |

## Smart Contract Tests

```bash
cd contracts
forge test -v
# 43 tests passing
```

## What Makes Shade Different

Every other agent project at this hackathon builds agents that DO things. Shade builds an agent that does things **without leaking who asked for it**.

The Selective Disclosure Engine is the core innovation — no other project has an agent that *reasons about what information to reveal*. It's not just encryption or mixing. The agent actively decides: "I need to reveal a budget range to complete this task, but I can hide the exact amount, the identity, the wallet, the IP, and the full intent."

## Hackathon Tracks

- **Venice AI** — Private inference as the core reasoning engine
- **Protocol Labs — Let the Agent Cook** — Fully autonomous agent with ERC-8004 identity + structured logs
- **Protocol Labs — Agents With Receipts** — On-chain verifiable task receipts via ShadeVerifier
- **Status Network** — Contracts deployed on Status Sepolia (gasless)
- **Locus** — Private payments via Locus USDC wallets
- **Synthesis Open Track** — Best overall project

## License

MIT
