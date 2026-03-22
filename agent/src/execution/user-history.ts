import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.resolve(__dirname, "../../data/user-history.json");

export interface UserTransaction {
  userAddress: string;
  taskHash: string;
  intentCategory: string;
  cost: string;
  currency: string;
  fieldsHidden: number;
  fieldsRevealed: number;
  success: boolean;
  timestamp: number;
  txHash: string | null;
  recipient: string;
  method: string;
}

const history: UserTransaction[] = [];

function save() {
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function load() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      history.push(...data);
    }
  } catch { /* fresh */ }
}

load();

export function recordTransaction(tx: UserTransaction) {
  history.unshift(tx);
  // Keep last 500
  if (history.length > 500) history.length = 500;
  save();
}

export function getUserHistory(userAddress: string): UserTransaction[] {
  return history.filter(
    (tx) => tx.userAddress.toLowerCase() === userAddress.toLowerCase()
  );
}

export function getAllHistory(): UserTransaction[] {
  return history;
}
