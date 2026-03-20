/**
 * Locus Payment Client — privacy-preserving payments via ephemeral wallets.
 * Locus operates on Base chain with USDC.
 */

const LOCUS_BASE = process.env.LOCUS_BASE_URL || "https://beta-api.paywithlocus.com/api";

export interface LocusBalance {
  balance: string;
  currency: string;
}

export interface LocusTransaction {
  id: string;
  amount: string;
  recipient: string;
  note?: string;
  status: string;
  createdAt: string;
}

export interface LocusSendResult {
  success: boolean;
  txId?: string;
  error?: string;
}

function getHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Get the current USDC balance of the Locus wallet.
 */
export async function getBalance(apiKey: string): Promise<LocusBalance> {
  const res = await fetch(`${LOCUS_BASE}/pay/balance`, {
    headers: getHeaders(apiKey),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to get balance");
  return data.data;
}

/**
 * Send USDC to a recipient via Locus.
 * This uses the Locus-managed wallet — no primary wallet exposed.
 */
export async function sendPayment(
  apiKey: string,
  recipient: string,
  amount: number,
  note?: string
): Promise<LocusSendResult> {
  const res = await fetch(`${LOCUS_BASE}/pay/send`, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify({ recipient, amount, note }),
  });
  const data = await res.json();

  if (!res.ok) {
    return { success: false, error: data.message || "Payment failed" };
  }

  return { success: true, txId: data.data?.txId || data.data?.id };
}

/**
 * Get transaction history.
 */
export async function getTransactions(apiKey: string): Promise<LocusTransaction[]> {
  const res = await fetch(`${LOCUS_BASE}/pay/transactions`, {
    headers: getHeaders(apiKey),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to get transactions");
  return data.data || [];
}

/**
 * Check wallet deployment status.
 */
export async function getStatus(apiKey: string): Promise<any> {
  const res = await fetch(`${LOCUS_BASE}/status`, {
    headers: getHeaders(apiKey),
  });
  return res.json();
}
