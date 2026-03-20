import { ethers } from "ethers";

/**
 * Resolve an ENS name to an address.
 */
export async function resolveENS(
  provider: ethers.Provider,
  ensName: string
): Promise<string | null> {
  return provider.resolveName(ensName);
}

/**
 * Reverse lookup — get ENS name for an address.
 */
export async function lookupENS(
  provider: ethers.Provider,
  address: string
): Promise<string | null> {
  return provider.lookupAddress(address);
}

/**
 * Format an identity: use ENS name if available, otherwise truncated address.
 * This replaces raw hex addresses in all agent communications.
 */
export function formatAgentIdentity(
  ensName: string | null,
  address: string
): string {
  return ensName ?? `${address.slice(0, 6)}...${address.slice(-4)}`;
}
