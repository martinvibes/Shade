import { ethers } from "ethers";

// ENS lives on Ethereum mainnet — we need a mainnet provider for resolution
const MAINNET_RPCS = [
  "https://eth.llamarpc.com",
  "https://rpc.ankr.com/eth",
  "https://ethereum-rpc.publicnode.com",
];

/**
 * Resolve an ENS name to an Ethereum address.
 * Tries multiple RPCs for reliability.
 */
export async function resolveENS(ensName: string): Promise<string | null> {
  for (const rpc of MAINNET_RPCS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      const address = await provider.resolveName(ensName);
      if (address) return address;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Reverse lookup — get ENS name for an address.
 */
export async function lookupENS(address: string): Promise<string | null> {
  for (const rpc of MAINNET_RPCS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      return await provider.lookupAddress(address);
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Check if a string looks like an ENS name.
 */
export function isENSName(input: string): boolean {
  return /^[a-zA-Z0-9-]+\.eth$/i.test(input.trim());
}

/**
 * Resolve any recipient — if it's an ENS name, resolve it. If it's an address, return as-is.
 */
export async function resolveRecipient(input: string): Promise<{
  address: string | null;
  ensName: string | null;
  resolved: boolean;
}> {
  const trimmed = input.trim();

  if (isENSName(trimmed)) {
    const address = await resolveENS(trimmed);
    return {
      address,
      ensName: trimmed,
      resolved: address !== null,
    };
  }

  // It's a raw address — try reverse lookup for ENS name
  if (trimmed.startsWith("0x") && trimmed.length === 42) {
    const ensName = await lookupENS(trimmed);
    return {
      address: trimmed,
      ensName,
      resolved: true,
    };
  }

  return { address: null, ensName: null, resolved: false };
}

/**
 * Format an identity: use ENS name if available, otherwise truncated address.
 */
export function formatAgentIdentity(
  ensName: string | null,
  address: string
): string {
  return ensName ?? `${address.slice(0, 6)}...${address.slice(-4)}`;
}
