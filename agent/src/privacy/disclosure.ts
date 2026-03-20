import { z } from "zod";

// ── Types ──

export type PrivacyLevel = "maximum" | "high" | "medium" | "low";

export const DisclosureManifestSchema = z.object({
  identity: z.object({
    status: z.enum(["hidden", "pseudonymous", "revealed"]),
    revealed: z.string().nullable(),
    hidden: z.array(z.string()),
  }),
  wallet: z.object({
    type: z.enum(["ephemeral", "proxy", "primary"]),
    address: z.string(),
    primaryExposed: z.boolean(),
  }),
  budget: z.object({
    status: z.enum(["hidden", "range", "exact"]),
    revealed: z.string().nullable(),
  }),
  intent: z.object({
    status: z.enum(["hidden", "category", "detailed", "full"]),
    revealed: z.string().nullable(),
  }),
  metadata: z.object({
    timestamp: z.boolean(),
    location: z.boolean(),
    deviceInfo: z.boolean(),
    sessionLinked: z.boolean(),
  }),
});

export type DisclosureManifest = z.infer<typeof DisclosureManifestSchema>;

export interface TaskDescription {
  description: string;
  budget: number;
  category: string;
}

export interface ServiceRequirements {
  needsBudgetProof: boolean;
  needsIntentCategory: boolean;
  needsIdentityProof: boolean;
}

// ── Core Disclosure Engine ──

/**
 * The Selective Disclosure Engine — Shade's core innovation.
 *
 * Given a task and privacy level, determines the MINIMUM information
 * that must be revealed to complete the task. Everything else stays hidden.
 *
 * Even at the lowest privacy level, identity is never fully revealed.
 */
export function determineDisclosure(
  task: TaskDescription,
  privacyLevel: PrivacyLevel,
  serviceRequirements: ServiceRequirements,
  ephemeralWallet: string = ""
): DisclosureManifest {
  // Start with maximum privacy — hide everything
  const manifest: DisclosureManifest = {
    identity: {
      status: "hidden",
      revealed: null,
      hidden: ["real name", "primary wallet", "email", "phone", "location", "ip address"],
    },
    wallet: {
      type: "ephemeral",
      address: ephemeralWallet,
      primaryExposed: false,
    },
    budget: {
      status: "hidden",
      revealed: null,
    },
    intent: {
      status: "hidden",
      revealed: null,
    },
    metadata: {
      timestamp: false,
      location: false,
      deviceInfo: false,
      sessionLinked: false,
    },
  };

  // Only reveal what the service REQUIRES — nothing more

  // Budget disclosure
  if (serviceRequirements.needsBudgetProof) {
    if (privacyLevel === "maximum") {
      // Reveal a range, not exact
      const lower = Math.floor(task.budget / 5) * 5;
      const upper = lower + 5;
      manifest.budget = {
        status: "range",
        revealed: `$${lower}-${upper}`,
      };
    } else if (privacyLevel === "high") {
      manifest.budget = {
        status: "range",
        revealed: `$${Math.floor(task.budget / 10) * 10}-${Math.ceil(task.budget / 10) * 10 || 10}`,
      };
    } else {
      // medium or low — reveal exact
      manifest.budget = {
        status: "exact",
        revealed: `$${task.budget}`,
      };
    }
  }

  // Intent disclosure
  if (serviceRequirements.needsIntentCategory) {
    if (privacyLevel === "maximum" || privacyLevel === "high") {
      // Category only — "data access", never "weather API for my Iowa farm"
      manifest.intent = {
        status: "category",
        revealed: task.category,
      };
    } else if (privacyLevel === "medium") {
      manifest.intent = {
        status: "detailed",
        revealed: task.category,
      };
    } else {
      manifest.intent = {
        status: "full",
        revealed: task.description,
      };
    }
  }

  // Identity disclosure — NEVER fully revealed at any level
  if (serviceRequirements.needsIdentityProof) {
    if (privacyLevel === "maximum" || privacyLevel === "high") {
      manifest.identity = {
        status: "pseudonymous",
        revealed: "ZK proof of authorization",
        hidden: ["real name", "primary wallet", "email", "phone", "location"],
      };
    } else {
      // Even at low privacy, only pseudonymous
      manifest.identity = {
        status: "pseudonymous",
        revealed: "ENS name or agent ID",
        hidden: ["real name", "email", "phone", "location"],
      };
    }
  }

  // Wallet — always ephemeral at maximum/high, proxy at medium
  if (privacyLevel === "medium") {
    manifest.wallet.type = "proxy";
  } else if (privacyLevel === "low") {
    manifest.wallet.type = "proxy";
    // Still never expose primary
    manifest.wallet.primaryExposed = false;
  }

  // Metadata — timestamps only at medium/low, location/device NEVER
  if (privacyLevel === "medium" || privacyLevel === "low") {
    manifest.metadata.timestamp = true;
  }
  // location and deviceInfo are ALWAYS false — non-negotiable

  return manifest;
}

/**
 * Count how many fields are hidden vs revealed in a manifest.
 */
export function countDisclosure(manifest: DisclosureManifest): {
  hidden: number;
  revealed: number;
  total: number;
} {
  let hidden = 0;
  let revealed = 0;

  // Identity
  if (manifest.identity.status === "hidden") hidden++;
  else revealed++;

  // Wallet
  if (manifest.wallet.type === "ephemeral") hidden++;
  else revealed++;
  if (!manifest.wallet.primaryExposed) hidden++;
  else revealed++;

  // Budget
  if (manifest.budget.status === "hidden") hidden++;
  else if (manifest.budget.status === "range") { hidden++; revealed++; } // partial
  else revealed++;

  // Intent
  if (manifest.intent.status === "hidden") hidden++;
  else if (manifest.intent.status === "category") { hidden++; revealed++; } // partial
  else revealed++;

  // Metadata (4 fields)
  if (!manifest.metadata.timestamp) hidden++; else revealed++;
  if (!manifest.metadata.location) hidden++; else revealed++;
  if (!manifest.metadata.deviceInfo) hidden++; else revealed++;
  if (!manifest.metadata.sessionLinked) hidden++; else revealed++;

  return { hidden, revealed, total: hidden + revealed };
}

/**
 * Generate a human-readable privacy report from a manifest.
 */
export function generatePrivacyReport(manifest: DisclosureManifest): string {
  const { hidden, revealed, total } = countDisclosure(manifest);
  const score = total > 0 ? Math.round((hidden / total) * 100) : 100;

  const lines = [
    `Privacy Score: ${score}%`,
    `Fields Hidden: ${hidden} / ${total}`,
    ``,
    `Identity:  ${manifest.identity.status.toUpperCase()}`,
    `Wallet:    ${manifest.wallet.type.toUpperCase()}${manifest.wallet.address ? ` (${manifest.wallet.address.slice(0, 6)}...${manifest.wallet.address.slice(-4)})` : ""}`,
    `Budget:    ${manifest.budget.status.toUpperCase()}${manifest.budget.revealed ? ` — ${manifest.budget.revealed}` : ""}`,
    `Intent:    ${manifest.intent.status.toUpperCase()}${manifest.intent.revealed ? ` — ${manifest.intent.revealed}` : ""}`,
    `Timestamp: ${manifest.metadata.timestamp ? "REVEALED" : "HIDDEN"}`,
    `Location:  ${manifest.metadata.location ? "REVEALED" : "STRIPPED"}`,
    `Device:    ${manifest.metadata.deviceInfo ? "REVEALED" : "STRIPPED"}`,
    `Session:   ${manifest.metadata.sessionLinked ? "LINKED" : "UNLINKED"}`,
  ];

  return lines.join("\n");
}
