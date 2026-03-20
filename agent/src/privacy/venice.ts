import OpenAI from "openai";
import { config } from "../config.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: config.veniceApiKey,
      baseURL: config.veniceBaseUrl,
    });
  }
  return client;
}

/**
 * Send a prompt to Venice AI for private inference.
 * Venice retains zero data — no prompts or responses are stored.
 */
export async function privateInference(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const venice = getClient();

  const response = await venice.chat.completions.create({
    model: config.veniceModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 2000,
    // Venice-specific: no system prompt injection, no data retention
    venice_parameters: {
      include_venice_system_prompt: false,
    },
  } as any);

  return response.choices[0]?.message?.content ?? "";
}

/**
 * Agent reasoning — privately determines how to approach a task
 * and what information needs to be disclosed.
 */
export async function agentReason(
  task: string,
  context: Record<string, any>
): Promise<{
  plan: string[];
  requiredDisclosures: string[];
  canHide: string[];
  estimatedCost: number;
  intentCategory: string;
}> {
  const result = await privateInference(
    `You are Shade, a privacy-preserving autonomous agent.
Given a task, analyze it and respond with a JSON object containing:
- "plan": array of step strings to execute the task
- "requiredDisclosures": array of data fields that MUST be revealed to complete the task
- "canHide": array of data fields that can remain hidden
- "estimatedCost": estimated cost in USD (number)
- "intentCategory": a broad category like "data access", "payment", "compute", "subscription" (NOT the full intent)

Always minimize disclosures. Identity, wallet, IP, device info should be hidden unless absolutely required.
Respond ONLY with valid JSON, no markdown, no explanation.`,
    `Task: ${task}\nContext: ${JSON.stringify(context)}`
  );

  try {
    return JSON.parse(result);
  } catch {
    // If Venice returns non-JSON, provide safe defaults
    return {
      plan: ["Analyze task", "Determine minimum disclosure", "Execute privately"],
      requiredDisclosures: ["budget range"],
      canHide: ["identity", "wallet", "email", "ip", "device", "full intent"],
      estimatedCost: 0,
      intentCategory: "general",
    };
  }
}
