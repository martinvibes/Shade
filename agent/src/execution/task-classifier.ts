import { privateInference } from "../privacy/venice.js";

export type TaskType = "private_payment" | "anonymous_donation" | "vault_transfer" | "general";

export interface ClassifiedTask {
  type: TaskType;
  recipientAddress: string | null;
  amount: number | null;
  currency: "USDC" | "ETH";
  description: string;
  intentCategory: string;
  userAddress?: string;
}

/**
 * Use Venice AI to classify a task and extract structured parameters.
 * This determines what the agent actually DOES.
 */
export async function classifyTask(taskDescription: string): Promise<ClassifiedTask> {
  const result = await privateInference(
    `You are a task classifier for a privacy-preserving crypto agent on Ethereum. Given a user task, determine:

1. "type": one of:
   - "vault_transfer" — sending/transferring ETH to an address (DEFAULT if an address and amount are present)
   - "private_payment" — sending USDC via Locus (only if user says USDC or Locus or dollar amount with $)
   - "anonymous_donation" — donating (only if user explicitly says donate/donation)
   - "general" — no address or amount present, or not a transaction

2. "recipientAddress": the recipient — either a full 0x address OR an ENS name ending in .eth (e.g. "vitalik.eth"). Include it exactly as written.
3. "amount": the numeric amount (null if not specified). If user says "0.0003" that means 0.0003.
4. "currency": "USDC" if user mentions dollars/$, otherwise "ETH"
5. "description": a one-sentence description
6. "intentCategory": "transfer", "payment", or "donation"

IMPORTANT RULES:
- If a user provides an amount and an address OR ENS name, it is ALWAYS a vault_transfer (not general)
- "transfer 0.0003 to 0xABC..." is a vault_transfer with amount 0.0003 ETH
- "send 0.001 to vitalik.eth" is a vault_transfer with recipientAddress "vitalik.eth"
- "send 0.001 to 0xABC..." is a vault_transfer with amount 0.001 ETH
- ENS names like "name.eth" are valid recipients — keep them as-is, the agent will resolve them
- Only classify as "general" if there is NO address/ENS name AND NO amount
- Default currency is ETH unless user explicitly says USDC or uses $

Respond ONLY with valid JSON. No markdown, no explanation, no thinking.

Examples:
Task: "transfer 0.0003 to 0x1234abcd"
{"type":"vault_transfer","recipientAddress":"0x1234abcd","amount":0.0003,"currency":"ETH","description":"Transfer 0.0003 ETH privately","intentCategory":"transfer"}

Task: "Send $2 USDC to 0x1234abcd via Locus"
{"type":"private_payment","recipientAddress":"0x1234abcd","amount":2,"currency":"USDC","description":"Send $2 USDC privately","intentCategory":"payment"}

Task: "send 0.001 to 0xABCD privately"
{"type":"vault_transfer","recipientAddress":"0xABCD","amount":0.001,"currency":"ETH","description":"Transfer 0.001 ETH privately","intentCategory":"transfer"}

Task: "send 0.0001 ETH to vitalik.eth"
{"type":"vault_transfer","recipientAddress":"vitalik.eth","amount":0.0001,"currency":"ETH","description":"Transfer 0.0001 ETH to vitalik.eth privately","intentCategory":"transfer"}

Task: "hello"
{"type":"general","recipientAddress":null,"amount":null,"currency":"ETH","description":"Greeting","intentCategory":"general"}`,
    taskDescription,
    { temperature: 0.1 }
  );

  try {
    // Strip any markdown or thinking tags
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const parsed = JSON.parse(cleaned);

    let classified: ClassifiedTask = {
      type: parsed.type || "general",
      recipientAddress: parsed.recipientAddress || null,
      amount: parsed.amount ?? null,
      currency: parsed.currency || "ETH",
      description: parsed.description || taskDescription,
      intentCategory: parsed.intentCategory || "general",
    };

    // Safety net: if AI missed it but there's clearly an address/ENS + amount, force vault_transfer
    if (classified.type === "general") {
      const addressMatch = taskDescription.match(/0x[a-fA-F0-9]{40}/);
      const ensMatch = taskDescription.match(/[a-zA-Z0-9-]+\.eth\b/);
      const amountMatch = taskDescription.match(/(\d+\.?\d*)/);
      const recipientFound = addressMatch?.[0] || ensMatch?.[0] || null;
      if (recipientFound && amountMatch) {
        classified = {
          type: "vault_transfer",
          recipientAddress: recipientFound,
          amount: parseFloat(amountMatch[1]),
          currency: taskDescription.toLowerCase().includes("usdc") || taskDescription.includes("$") ? "USDC" : "ETH",
          description: `Transfer ${amountMatch[1]} ETH privately`,
          intentCategory: "transfer",
        };
      }
    }

    return classified;
  } catch {
    // Fallback: try to extract address/ENS and amount from the raw text
    const addressMatch = taskDescription.match(/0x[a-fA-F0-9]{40}/);
    const ensMatch = taskDescription.match(/[a-zA-Z0-9-]+\.eth\b/);
    const amountMatch = taskDescription.match(/(\d+\.?\d*)/);
    const recipientFound = addressMatch?.[0] || ensMatch?.[0] || null;

    if (recipientFound && amountMatch) {
      return {
        type: "vault_transfer",
        recipientAddress: recipientFound,
        amount: parseFloat(amountMatch[1]),
        currency: taskDescription.toLowerCase().includes("usdc") || taskDescription.includes("$") ? "USDC" : "ETH",
        description: `Transfer ${amountMatch[1]} ETH privately`,
        intentCategory: "transfer",
      };
    }

    return {
      type: "general",
      recipientAddress: null,
      amount: null,
      currency: "ETH",
      description: taskDescription,
      intentCategory: "general",
    };
  }
}
