/**
 * Structured logging for Protocol Labs tracks.
 * Generates agent_log.json with every decision, privacy action,
 * tool call, and safety check the agent makes.
 */

export interface ToolCall {
  tool: string;
  input: any;
  output: any;
  duration_ms: number;
}

export interface Decision {
  description: string;
  reasoning: string;
  alternatives: string[];
}

export interface PrivacyAction {
  field: string;
  action: "hidden" | "revealed" | "redacted" | "stripped";
  reason: string;
}

export interface AgentLogEntry {
  timestamp: string;
  phase: "discover" | "plan" | "execute" | "verify" | "submit";
  action: string;
  toolCalls: ToolCall[];
  decisions: Decision[];
  privacyActions: PrivacyAction[];
  retries: number;
  success: boolean;
}

export interface SafetyCheck {
  check: string;
  passed: boolean;
  details: string;
}

export interface AgentLog {
  agentId: string;
  agentName: string;
  operatorWallet: string;
  startTime: string;
  endTime: string;
  taskDescription: string;
  entries: AgentLogEntry[];
  safetyChecks: SafetyCheck[];
  computeBudget: {
    estimatedCost: number;
    actualCost: number;
    unit: string;
  };
}

export class AgentLogger {
  private log: AgentLog;

  constructor(agentId: string, operatorWallet: string, task: string) {
    this.log = {
      agentId,
      agentName: "Shade",
      operatorWallet,
      startTime: new Date().toISOString(),
      endTime: "",
      taskDescription: task,
      entries: [],
      safetyChecks: [],
      computeBudget: { estimatedCost: 0, actualCost: 0, unit: "USD" },
    };
  }

  addEntry(entry: Omit<AgentLogEntry, "timestamp">): void {
    this.log.entries.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  addSafetyCheck(check: string, passed: boolean, details: string): void {
    this.log.safetyChecks.push({ check, passed, details });
  }

  setComputeBudget(estimated: number, actual: number): void {
    this.log.computeBudget = { estimatedCost: estimated, actualCost: actual, unit: "USD" };
  }

  finalize(): AgentLog {
    this.log.endTime = new Date().toISOString();
    return this.log;
  }

  toJSON(): string {
    return JSON.stringify(this.log, null, 2);
  }

  getEntries(): AgentLogEntry[] {
    return this.log.entries;
  }
}
