import { privateInference } from "../privacy/venice.js";

export type TaskType = "private_payment" | "anonymous_donation" | "vault_transfer" | "general";

export interface ClassifiedTask {
  type: TaskType;
  recipientAddress: string | null;
  amount: number | null;
  currency: "USDC" | "ETH";
  description: string;
  intentCategory: string;
}

/**
 * Use Venice AI to classify a task and extract structured parameters.
 * This determines what the agent actually DOES.
 */
export async function classifyTask(taskDescription: string): Promise<ClassifiedTask> {
  const result = await privateInference(
    `You are a task classifier for a privacy-preserving agent. Given a user task, determine:

1. "type": one of:
   - "private_payment" — sending money to someone privately
   - "anonymous_donation" — donating to a project/cause anonymously
   - "vault_transfer" — funding a wallet or moving funds privately
   - "general" — anything else

2. "recipientAddress": the Ethereum address to send to (null if not specified)
3. "amount": the numeric amount (null if not specified)
4. "currency": "USDC" or "ETH"
5. "description": a one-sentence description of what to do
6. "intentCategory": a broad category like "payment", "donation", "transfer", "funding"

Respond ONLY with valid JSON. No markdown, no explanation.

Example:
Task: "Send $2 USDC to 0x1234...abcd privately"
{"type":"private_payment","recipientAddress":"0x1234...abcd","amount":2,"currency":"USDC","description":"Send $2 USDC privately to recipient","intentCategory":"payment"}

Task: "Donate 0.005 ETH to public goods anonymously"
{"type":"anonymous_donation","recipientAddress":null,"amount":0.005,"currency":"ETH","description":"Anonymous donation to public goods","intentCategory":"donation"}`,
    taskDescription,
    { temperature: 0.1 }
  );

  try {
    const parsed = JSON.parse(result);
    return {
      type: parsed.type || "general",
      recipientAddress: parsed.recipientAddress || null,
      amount: parsed.amount || null,
      currency: parsed.currency || "USDC",
      description: parsed.description || taskDescription,
      intentCategory: parsed.intentCategory || "general",
    };
  } catch {
    return {
      type: "general",
      recipientAddress: null,
      amount: null,
      currency: "USDC",
      description: taskDescription,
      intentCategory: "general",
    };
  }
}
